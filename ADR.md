# Architecture Decision Record

## Sync vs Async Default

Async should be the default. Document extraction depends on an external LLM provider, database writes, and queue coordination. Blocking an HTTP connection on all of that is the wrong tradeoff: it increases timeout risk, makes retries dangerous because the caller cannot tell "still processing" from "failed partway through," and gives you no path to webhook callbacks or batch uploads without a redesign.

Sync mode stays available as a convenience for local testing and small single-file demos. In production, anything past a few kilobytes or any concurrency above one request at a time should be forced async regardless of what the client requests. A reasonable threshold: files over 1MB or any time the queue depth exceeds ten pending jobs.

## Queue Choice

BullMQ with Redis. It is the simplest queue that handles the things a naive in-process queue does not: stalled job recovery, retry with backoff, worker concurrency control, and job state inspection without writing your own polling logic. For this assignment's scale it is adequate and operationally lightweight.

Failure modes worth knowing: Redis unavailability takes down both enqueue and dequeue, so there is no queue without it. Worker crashes can leave jobs in PROCESSING until BullMQ's stall detection kicks in, which means the stall window matters and should be set explicitly. Aggressive retry policies will amplify provider outages rather than absorb them.

At 500 concurrent extractions per minute, the migration is not necessarily away from BullMQ. The first step is separating the API process from the worker process, adding a dedicated Redis instance, and bounding worker concurrency per provider to avoid rate-limit cascades. If the load grows past that or multi-region becomes a requirement, the right move is a managed broker behind the same job service contract, SQS or RabbitMQ, rather than bolting more complexity onto a shared Redis.

## LLM Provider Abstraction

`ILLMProvider` with two methods: `extract(fileBuffer, mimeType, fileName)` and `repair(rawResponse)`. A factory in `src/llm/index.ts` reads `LLM_PROVIDER` from the environment and returns the concrete adapter. Nothing outside the `llm/` directory knows which provider is running.

`repair` belongs in the interface, not in the route or service layer, because malformed JSON recovery is part of the provider contract. A provider that sometimes returns fenced code blocks needs to own its own repair logic. The Anthropic adapter is fully implemented; others can be added by implementing the interface without touching anything else.

Claude Haiku is the default because it is fast, cheap, and accurate enough for structured extraction. Opus is not justified for this task at 15x the cost.

## Schema Design

Several fields that could live in a JSON column are promoted to real columns: `documentType`, `expiryDate`, `holderName`, `sirbNumber`, `passportNumber`, `applicableRole`, `status`. This is deliberate. Queries like "all sessions with an expired COC" or "all extractions for holder Jane Doe" need to run against indexed scalar columns, not JSON string parsing.

The remaining dynamic data, `fieldsJson`, `validityJson`, `medicalDataJson`, `flagsJson`, uses TEXT/JSONB columns. The risk at scale is that these columns accumulate schema diversity, resist validation, and become a read-time liability when you need to search or aggregate their contents. If the product needs full-text search across extracted values, or faceted queries by rank or nationality, the schema needs to evolve toward normalized tables for holders, validity windows, and compliance findings, plus JSONB with GIN indexes in PostgreSQL for anything that genuinely needs to stay flexible. Staying in text JSON is a deferral, not a long-term plan.

## What Was Skipped

**Authentication.** Every endpoint is open. A production system needs identity, session management, and role-based access before it handles real seafarer PII. Left out because the assignment is evaluating extraction architecture, not auth flows, and adding auth would have diluted the focus without adding signal.

**Cloud file storage.** Files are handled in memory during extraction and not persisted beyond the upload request. S3 or equivalent is the right production answer, particularly for audit trails and PII handling compliance. Deferred because local handling is sufficient to prove deduplication and extraction behavior.

**Monitoring and alerting.** No metrics, no traces, no error budgets. Pino structured logging is in place for log aggregation. Full observability is production-critical but adds no value to the assignment's evaluation surface.

**Multi-tenancy.** Single-tenant only. Tenant isolation changes schema boundaries, rate limiting, auth, and queue fairness simultaneously. Out of scope for week one.

**Webhook HMAC signing.** Webhook delivery is implemented; HMAC signature verification is not. Secure outbound integration should be added before any real consumer relies on job callbacks. Skipped because it adds implementation surface without changing the architectural signal.