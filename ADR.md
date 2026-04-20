# Architecture Decision Record

## Sync vs Async Default

Async remains the default operating model. Extraction depends on an external LLM call, JSON repair, database writes, and queue coordination. Holding an HTTP request open through that entire chain is the wrong default because timeout behavior becomes ambiguous and retries become unsafe. A caller cannot easily tell whether the request is still running, failed after a partial write, or succeeded just after the client gave up.

The implementation is still early, so only the health route is exposed today, but the architecture is already pointed toward async execution. BullMQ is initialized, job and extraction models exist, and the shared types already separate extraction results from job state. Sync mode can still exist later for local demos or very small files, but the backend should treat it as a convenience mode, not the steady-state path.

## Queue Choice

BullMQ with Redis is still the right queue choice for this assignment. It gives the service the things an in-process queue cannot: durable-enough job coordination, retries with backoff, stalled job recovery, and a clean separation between API ingestion and worker execution. That is enough for the current assignment scope without introducing unnecessary infrastructure.

The important failure modes have not changed. If Redis is unavailable, enqueue and dequeue both fail. If a worker crashes mid-job, the queue needs stall recovery to push that work back into circulation. If retries are too aggressive, a provider outage turns into a self-inflicted traffic spike. At higher load, the migration path is still to separate API and worker processes first, then move to a managed broker only if BullMQ plus dedicated Redis stops being operationally comfortable.

## LLM Provider Abstraction

The provider boundary is now concrete. `ILLMProvider` defines `extract(fileBuffer, mimeType, fileName)` and `repair(rawResponse)`, and `src/llm/index.ts` resolves the implementation from `LLM_PROVIDER`. The Anthropic adapter is the first production implementation, and unsupported providers fail fast during configuration checks.

This boundary matters because the provider owns the hardest parts of the integration: request formatting, timeout handling, malformed JSON recovery, and raw-response preservation. The Anthropic provider now embeds the exact extraction prompt, exports `PROMPT_VERSION = "v1"`, applies `repairJson()` to raw output, and carries the raw LLM string through `LLMExtractionResult` so callers can persist it on both success and failure paths. That keeps provider-specific behavior out of routes and services.

## Schema Design

The schema is still intentionally hybrid. The database promotes fields that need to be queryable, such as `documentType`, `status`, `sessionId`, and `expiryDate`, while flexible extraction structures remain serialized in `fieldsJson`, `validityJson`, `complianceJson`, `medicalDataJson`, and `flagsJson`. That is the right tradeoff while the extraction contract is settling.

The long-term risk is still JSON-heavy persistence. It is fine for early iterations and for storing raw extraction payloads, but it becomes a constraint once the product needs richer search and reporting. Queries such as "all sessions with expired COC" are only efficient today because some key attributes are promoted into indexed scalar columns. If the product grows into search by holder identity, compliance limitation, or extracted field content, the schema has to move further toward normalized relational tables and PostgreSQL-native JSONB indexing rather than leaning on stringified JSON forever.

## What Was Skipped

Authentication is still intentionally absent. The service handles backend workflow concerns first and does not yet attempt identity, authorization, or tenant isolation. That is a deliberate omission, not an oversight. The same is true for cloud file storage: the codebase has utility support for hashing and parsing, but no S3-style storage layer is in place yet.

Monitoring and alerting are also deferred. Pino logging exists, but metrics, tracing, and alerting policy do not. Multi-tenancy is out of scope because it would reshape queue fairness, schema boundaries, and auth in one step. Webhook HMAC signing remains on the skipped list as well. None of those features are blocked by the current architecture, but none of them are implemented yet, and the documentation should state that plainly.
