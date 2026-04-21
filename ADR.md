# Architecture Decision Record

## Sync vs Async Default

Async remains the default operating model. Extraction depends on an external LLM call, JSON repair, database writes, and queue coordination. Holding an HTTP request open through that entire chain is the wrong default because timeout behavior becomes ambiguous and retries become unsafe. A caller cannot easily tell whether the request is still running, failed after a partial write, or succeeded just after the client gave up.

The implementation is still early, but there is now a synchronous `POST /api/extract` path for direct request-response extraction. That path exists as a practical stepping stone, not as the target steady state. BullMQ is initialized, job and extraction models exist, and the shared types already separate extraction results from job state. Sync mode can stay available for single-document flows and local verification, but the architecture continues to bias toward async once queue execution lands.

## Queue Choice

BullMQ with Redis is still the right queue choice for this assignment. It gives the service the things an in-process queue cannot: durable-enough job coordination, retries with backoff, stalled job recovery, and a clean separation between API ingestion and worker execution. That is enough for the current assignment scope without introducing unnecessary infrastructure.

The important failure modes have not changed. If Redis is unavailable, enqueue and dequeue both fail. If a worker crashes mid-job, the queue needs stall recovery to push that work back into circulation. If retries are too aggressive, a provider outage turns into a self-inflicted traffic spike. At higher load, the migration path is still to separate API and worker processes first, then move to a managed broker only if BullMQ plus dedicated Redis stops being operationally comfortable.

## Async Extraction Path (Phase 5)

The async extraction path is fully implemented. When a client posts to `POST /api/extract?mode=async`, the route creates a `Job` record immediately with status `QUEUED` and `queuedAt` timestamp, serializes the uploaded file buffer as `Array.from(buffer)` (necessary because BullMQ serializes job data as JSON and `Buffer` does not survive JSON round-trip), adds the job to the queue with full payload, and returns `202 Accepted` with `jobId` and `pollUrl`. The response is immediate; the client can poll `GET /api/jobs/:jobId` later for status.

The `createExtractionWorker()` function initializes a BullMQ Worker that processes jobs from the queue. When a job is picked up, the worker reconstructs the `Buffer` from the serialized array, creates a mock `Express.Multer.File` object, and calls `extractionService.runExtraction()` — reusing the exact same service as the sync path so both code paths depend on identical extraction logic. On success, it updates the `Job` record with status `COMPLETE`, `extractionId`, and `completedAt`. On failure, it updates with status `FAILED`, error details, and the `completedAt` timestamp. Critically, the worker **never throws unhandled**: it always updates the job record before settling so callers can inspect the final state even on failure. If the error includes `retryable: true` (as LLM timeouts do), that flag is persisted on the job record. The worker is initialized in `server.ts` after database and queue are ready, and it registers graceful shutdown handlers (`SIGTERM` and `SIGINT`) to close cleanly. This design keeps the HTTP path fast and decouples request-response from LLM latency. The trade-off is that clients must poll for results rather than blocking, but that is the correct tradeoff for a service where extraction latency is unbounded and timeouts would otherwise require infrastructure magic to distinguish genuine provider stalls from slow-but-working requests.

## Job Polling and Session Aggregation (Phase 6)

Jobs can now be polled via `GET /api/jobs/:jobId`. The response is status-dependent: if the job is queued, it includes estimated wait time; if processing, it includes start time and estimated completion; if complete, it includes the full extraction result; if failed, it includes error details and retry eligibility. This allows clients to monitor extraction progress and handle long-running operations without arbitrary timeouts.

Sessions aggregate extractions. A caller can fetch `GET /api/sessions/:sessionId` to get all documents extracted so far, plus derived metadata. The `detectedRole` field is computed by consensus: if all documents with an `applicableRole` field agree on DECK or ENGINE, that role is reported; if they disagree or are absent, the role is BOTH or AMBIGUOUS. The `overallHealth` field reflects compliance posture in three states:
- **CRITICAL**: Any flag has severity CRITICAL, OR any critical-path document is expired (COC, SIRB, PASSPORT, PEME)
- **WARN**: Any document is expired OR will expire within 90 days, OR any flag has severity HIGH/MEDIUM
- **OK**: No critical or warn conditions

Job records are eager-loaded into the session response so callers can see which extractions are still in flight.

## Cross-Document Compliance Validation (Phase 7)

The validation endpoint at `POST /api/sessions/:sessionId/validate` performs LLM-driven cross-document compliance checks. The service:
1. Fetches all COMPLETE extractions for the session
2. Builds a JSON payload with extracted identity data, document flags, medical clearance, and validity info
3. Calls the LLM provider with a detailed 7-step compliance prompt
4. Parses the structured JSON response
5. Persists the result to the `Validation` table with timestamp

The prompt guides the LLM to check identity consistency, SIRB presence, role determination, required documents for role, expiry status, medical flags, and overall employment eligibility. The response is structured JSON with explicit schema: holderProfile, consistencyChecks, missingDocuments, expiringDocuments, medicalFlags, overallStatus, and recommendations.

The Anthropic provider now implements both `extract()` for document-to-JSON and `validate()` for text-only LLM calls. The validate method applies JSON repair to the response so minor formatting issues do not derail the validation flow. Results are stored with timestamps and can be retrieved later for audit and re-validation.

## LLM Provider Abstraction

The provider boundary is concrete. `ILLMProvider` defines `extract(fileBuffer, mimeType, fileName)`, `repair(rawResponse)`, and `validate(prompt)`. The `src/llm/index.ts` exports `getLLMProvider()` which resolves the implementation from `LLM_PROVIDER` environment variable. The Anthropic adapter is the first production implementation, and unsupported providers fail fast during configuration checks.

This boundary matters because the provider owns the hardest parts of the integration: request formatting, timeout handling, malformed JSON recovery, and raw-response preservation. The Anthropic provider embeds the exact extraction prompt and validation prompt, exports `PROMPT_VERSION = "v1"`, applies `repairJson()` to raw output, and carries the raw LLM string through `LLMExtractionResult` so callers can persist it on both success and failure paths. A low-confidence retry path exists above the provider boundary by passing an optional hint into `extract()` rather than teaching routes about prompt construction. That keeps provider-specific behavior out of routes and services.

## Schema Design

The schema promotes fields that need to be queryable, such as `documentType`, `status`, `sessionId`, and `expiryDate`, while flexible extraction structures remain serialized in `fieldsJson`, `validityJson`, `complianceJson`, `medicalDataJson`, and `flagsJson`. The `Job` model tracks async processing state: `status`, `queuedAt`, `startedAt`, `completedAt`, `errorCode`, `errorMessage`, `rawLlmResponse`, and `retryable`. The `Validation` model stores compliance assessments with full structured result and timestamp.

The hybrid approach is intentional. It is fine for early iterations and for storing raw extraction payloads, but it becomes a constraint once the product needs richer search and reporting. Queries such as "all sessions with expired COC" are only efficient today because some key attributes are promoted into indexed scalar columns. If the product grows into search by holder identity, compliance limitation, or extracted field content, the schema has to move further toward normalized relational tables and PostgreSQL-native JSONB indexing rather than leaning on stringified JSON forever.

One known gap remains: `holder.photo` is part of the LLM contract but is not yet persisted in the `Extraction` table, so responses reconstructed from stored rows cannot preserve it accurately. That should be fixed in the next model revision.

## Error Classification

The codebase now distinguishes error types:
- **HTTP-level errors**: Mapped to 404 (SESSION_NOT_FOUND, JOB_NOT_FOUND), 400 (INSUFFICIENT_DOCUMENTS)
- **Service-level errors**: Custom error classes (ExtractionServiceError, ValidationError) with typed codes
- **Provider-level errors**: Timeout vs parse failure, retryable flag on job record
- **Middleware errors**: Unhandled exceptions caught and logged as 500 with request ID for tracing

The goal is that production logs can be queried by error code, and retry logic can inspect the `retryable` flag before deciding whether to requeue.

## Report Generation (Phase 8)

The report endpoint at `GET /api/sessions/:sessionId/report` generates a comprehensive compliance report entirely from data already in the database. No LLM calls, no external dependencies — only read and aggregate.

The service `generateReport(sessionId)` loads all COMPLETE extractions and the most recent validation record for the session, then derives:
- **holderProfile**: Aggregated identity (name, DOB, nationality, rank) from extractions or validation result; photo presence flag (known gap: `holderPhoto` column not persisted, defaults to false)
- **goNoGo**: Three-state determination (GO/NO-GO/CONDITIONAL/PENDING) mapped from validation `overallStatus`, plus the first recommendation as reason
- **documentChecklist**: All extractions with status (PRESENT/EXPIRED/EXPIRING_SOON based on 90-day threshold), flag counts, and confidence scores
- **missingDocuments**: Required documents list from validation result (empty if no validation)
- **expiryTimeline**: All documents with expiry dates, sorted by urgency (earliest first), with days-remaining calculation using UTC dates
- **flags**: All compliance flags from extractions, grouped by severity (CRITICAL, HIGH, MEDIUM, LOW) with document context
- **medicalSummary**: Finds PEME and DRUG_TEST extractions, extracts medical results (`fitnessResult`, `drugTestResult`) from `medicalDataJson`, includes medical flags from validation
- **complianceScore**: Overall score from validation result (null if no validation)
- **recommendations**: Full recommendation list from validation (empty if no validation)
- **validationSummary**: Plain-English summary from validation result (null if no validation)

The report is cacheable and suitable for PDF generation, compliance dashboards, and audit trails. The service reuses the same role-derivation logic as Phase 6 (`deriveDetectedRole()`) so report conclusions are consistent with session aggregation.

## What Was Skipped

Authentication is still intentionally absent. The service handles backend workflow concerns first and does not yet attempt identity, authorization, or tenant isolation. That is a deliberate omission, not an oversight. The same is true for cloud file storage: the codebase has utility support for hashing and parsing, but no S3-style storage layer is in place yet.

Monitoring and alerting are also deferred. Pino logging exists, but metrics, tracing, and alerting policy do not. Multi-tenancy is out of scope because it would reshape queue fairness, schema boundaries, and auth in one step. Webhook HMAC signing remains on the skipped list as well. Uploaded files are handled in memory through `multer` rather than persisted to local disk.

Pagination is not yet implemented on session documents or validation history. For now, sessions are assumed to have a small number of extractions. If that assumption breaks, the GET `/api/sessions/:sessionId` response will need offset/limit parameters and the UI will need to handle multi-page results.

Deduplication by file hash is not yet wired. The `hashFile()` utility exists but is not called during extraction. That is future work once the extraction contract stabilizes.

Rate limiting is currently implemented as an in-memory token bucket on `POST /api/extract`, capped at 10 requests per minute per IP. That is sufficient for single-instance local execution and assignment evaluation, but it is not a distributed or durable limit. Once multiple processes are in play, that policy should move to a shared store or edge layer.
