# Architecture Decision Record

## Sync vs Async Default

Async remains the default operating model. Extraction depends on an external LLM call, JSON repair, database writes, and queue coordination. Holding an HTTP request open through that entire chain is the wrong default because timeout behavior becomes ambiguous and retries become unsafe. A caller cannot easily tell whether the request is still running, failed after a partial write, or succeeded just after the client gave up.

The implementation is still early, but there is now a synchronous `POST /api/extract` path for direct request-response extraction. That path exists as a practical stepping stone, not as the target steady state. BullMQ is initialized, job and extraction models exist, and the shared types already separate extraction results from job state. Sync mode can stay available for single-document flows and local verification, but the architecture should continue to bias toward async once queue execution lands.

## Queue Choice

BullMQ with Redis is still the right queue choice for this assignment. It gives the service the things an in-process queue cannot: durable-enough job coordination, retries with backoff, stalled job recovery, and a clean separation between API ingestion and worker execution. That is enough for the current assignment scope without introducing unnecessary infrastructure.

The important failure modes have not changed. If Redis is unavailable, enqueue and dequeue both fail. If a worker crashes mid-job, the queue needs stall recovery to push that work back into circulation. If retries are too aggressive, a provider outage turns into a self-inflicted traffic spike. At higher load, the migration path is still to separate API and worker processes first, then move to a managed broker only if BullMQ plus dedicated Redis stops being operationally comfortable.

The async extraction path is now implemented. When a client posts to `POST /api/extract?mode=async`, the route creates a `Job` record immediately with status `QUEUED` and `queuedAt` timestamp, serializes the uploaded file buffer as `Array.from(buffer)` (necessary because BullMQ serializes job data as JSON and `Buffer` does not survive JSON round-trip), adds the job to the queue with full payload, and returns `202 Accepted` with `jobId` and `pollUrl`. The response is immediate; the client can poll `GET /api/jobs/:jobId` later for status.

The `createExtractionWorker()` function initializes a BullMQ Worker that processes jobs from the queue. When a job is picked up, the worker reconstructs the `Buffer` from the serialized array, creates a mock `Express.Multer.File` object, and calls `extractionService.runExtraction()` — reusing the exact same service as the sync path so both code paths depend on identical extraction logic. On success, it updates the `Job` record with status `COMPLETE`, `extractionId`, and `completedAt`. On failure, it updates with status `FAILED`, error details, and the `completedAt` timestamp. Critically, the worker **never throws unhandled**: it always updates the job record before settling so callers can inspect the final state even on failure. If the error includes `retryable: true` (as LLM timeouts do), that flag is persisted on the job record. The worker is initialized in `server.ts` after database and queue are ready, and it registers graceful shutdown handlers (`SIGTERM` and `SIGINT`) to close cleanly. This design keeps the HTTP path fast and decouples request-response from LLM latency. The trade-off is that clients must poll for results rather than blocking, but that is the correct tradeoff for a service where extraction latency is unbounded and timeouts would otherwise require infrastructure magic to distinguish genuine provider stalls from slow-but-working requests.

## LLM Provider Abstraction

The provider boundary is now concrete. `ILLMProvider` defines `extract(fileBuffer, mimeType, fileName)` and `repair(rawResponse)`, and `src/llm/index.ts` resolves the implementation from `LLM_PROVIDER`. The Anthropic adapter is the first production implementation, and unsupported providers fail fast during configuration checks.

This boundary matters because the provider owns the hardest parts of the integration: request formatting, timeout handling, malformed JSON recovery, and raw-response preservation. The Anthropic provider now embeds the exact extraction prompt, exports `PROMPT_VERSION = "v1"`, applies `repairJson()` to raw output, and carries the raw LLM string through `LLMExtractionResult` so callers can persist it on both success and failure paths. A low-confidence retry path now exists above the provider boundary by passing an optional hint into `extract()` rather than teaching routes about prompt construction. That keeps provider-specific behavior out of routes and services.

## Schema Design

The schema is still intentionally hybrid. The database promotes fields that need to be queryable, such as `documentType`, `status`, `sessionId`, and `expiryDate`, while flexible extraction structures remain serialized in `fieldsJson`, `validityJson`, `complianceJson`, `medicalDataJson`, and `flagsJson`. That is the right tradeoff while the extraction contract is settling.

The long-term risk is still JSON-heavy persistence. It is fine for early iterations and for storing raw extraction payloads, but it becomes a constraint once the product needs richer search and reporting. Queries such as "all sessions with expired COC" are only efficient today because some key attributes are promoted into indexed scalar columns. If the product grows into search by holder identity, compliance limitation, or extracted field content, the schema has to move further toward normalized relational tables and PostgreSQL-native JSONB indexing rather than leaning on stringified JSON forever. One known gap remains: `holder.photo` is part of the LLM contract but is not yet persisted in the `Extraction` table, so responses reconstructed from stored rows cannot preserve it accurately. That should be fixed in the next model revision.

## What Was Skipped

Authentication is still intentionally absent. The service handles backend workflow concerns first and does not yet attempt identity, authorization, or tenant isolation. That is a deliberate omission, not an oversight. The same is true for cloud file storage: the codebase has utility support for hashing and parsing, but no S3-style storage layer is in place yet.

Monitoring and alerting are also deferred. Pino logging exists, but metrics, tracing, and alerting policy do not. Multi-tenancy is out of scope because it would reshape queue fairness, schema boundaries, and auth in one step. Webhook HMAC signing remains on the skipped list as well. Uploaded files are now explicitly handled in memory through `multer` rather than persisted to local disk, but there is still no long-term managed storage layer. None of those features are blocked by the current architecture, but none of them are implemented yet, and the documentation should state that plainly.

The synchronous extraction route returns `503` for retryable model timeouts. That is a deliberate divergence from a simpler `500` bucket because an upstream timeout is a transient dependency failure, not the same class of problem as an internal application bug.

Rate limiting is currently implemented as an in-memory token bucket on `POST /api/extract`, capped at 10 requests per minute per IP. That is sufficient for single-instance local execution and assignment evaluation, but it is not a distributed or durable limit. Once the async path and multiple processes are in play, that policy should move to a shared store or edge layer.
