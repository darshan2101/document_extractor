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

`POST /api/extract` expects multipart form data with a single file field named `document`. Optional `sessionId` may be sent in the form body.

**Sync mode** (`?mode=sync` or default): Returns `200` with the extraction result immediately. Blocks the request until LLM processing completes.

**Async mode** (`?mode=async`): Returns `202 Accepted` immediately with a `jobId`, `sessionId`, and `pollUrl`. The extraction runs in the background via BullMQ. Job record is persisted to the database with status `QUEUED`, then transitions to `PROCESSING`, `COMPLETE`, or `FAILED` as the worker executes. Retryable failures are flagged on the job record.

The route is rate-limited in memory to 10 requests per minute per IP.

Planned routes such as job polling (`GET /api/jobs/:jobId`), session validation, and reporting are not wired yet in the current codebase.

## Running Tests

```bash
npm run test:unit
```
