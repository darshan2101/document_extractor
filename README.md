# SMDE

Smart Maritime Document Extractor backend.

## Prerequisites

- Node.js 20+
- Docker with `docker compose`

## Environment Setup

Copy `.env.example` to `.env` and set:

- `NODE_ENV`
- `REDIS_URL`
- `LLM_PROVIDER`
- `LLM_MODEL`
- `LLM_API_KEY`

Optional:

- `PORT` defaults to `3000`
- `DATABASE_URL` defaults to `./dev.sqlite`

## Run

```bash
git clone https://github.com/darshan2101/document_extractor.git
cd document_extractor && npm install
cp .env.example .env && docker compose up -d && npm run dev
```

The server starts on `http://localhost:3000` unless `PORT` is overridden.

## Current API Surface

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Returns uptime plus database, queue, and LLM config health |
| POST | `/api/extract` | Accepts one uploaded document; `?mode=sync` (default) runs synchronously, `?mode=async` enqueues for background processing |
| GET | `/api/jobs/:jobId` | Poll extraction job status by ID; returns QUEUED, PROCESSING, COMPLETE, or FAILED state with metadata |
| GET | `/api/sessions/:sessionId` | Get session overview including aggregated documents, pending jobs, detected role, and health status |
| POST | `/api/sessions/:sessionId/validate` | Cross-document compliance validation via LLM; returns structured assessment with required docs, expiring certs, medical flags, and overall approval status |

### POST /api/extract

Expects multipart form data with a single file field named `document`. Optional `sessionId` may be sent in the form body.

**Sync mode** (`?mode=sync` or default): Returns `200` with the extraction result immediately. Blocks the request until LLM processing completes.

**Async mode** (`?mode=async`): Returns `202 Accepted` immediately with a `jobId`, `sessionId`, and `pollUrl`. The extraction runs in the background via BullMQ. Job record is persisted to the database with status `QUEUED`, then transitions to `PROCESSING`, `COMPLETE`, or `FAILED` as the worker executes. Retryable failures are flagged on the job record.

The route is rate-limited in memory to 10 requests per minute per IP.

### GET /api/jobs/:jobId

Poll the status of an extraction job. Returns:
- `QUEUED`: Job waiting in queue; includes estimated wait time
- `PROCESSING`: Job currently running; includes when it started and estimated completion time
- `COMPLETE`: Extraction finished; includes full extraction result (documents, fields, flags, validity data)
- `FAILED`: Job failed; includes error code, message, and whether the job is retryable

### GET /api/sessions/:sessionId

Get the session overview including all extracted documents aggregated into a single response. Returns:
- `documents`: Array of completed extractions with all fields, flags, and medical data
- `detectedRole`: Consensus role (DECK, ENGINE, BOTH, or AMBIGUOUS) derived from document certificates
- `overallHealth`: CRITICAL, WARN, or OK based on expiring/expired docs and compliance flags
- `flagCount` and `criticalFlagCount`: Summary of compliance issues
- `pendingJobs`: Array of jobs currently in QUEUED or PROCESSING state

### POST /api/sessions/:sessionId/validate

Trigger cross-document compliance validation against maritime employment standards. The LLM checks:
1. Identity consistency across all documents
2. SIRB presence and consistency
3. Role determination from documents
4. Required documents for determined role
5. Document expiry and upcoming expirations
6. Medical clearance status
7. Overall employment eligibility

Returns a structured assessment with holderProfile, consistency checks, missing/expiring documents, medical flags, and overall approval status (APPROVED, CONDITIONAL, or REJECTED).

## Running Tests

```bash
npm run test:unit
```
