# SMDE

Smart Maritime Document Extractor. Accepts maritime certification documents, runs them through an LLM extraction pipeline, and returns structured compliance data.

## Prerequisites

- Node.js 20+
- Docker (for Redis)

## Setup

```bash
git clone https://github.com/darshan2101/document_extractor.git
cd document_extractor && npm install
cp .env.example .env
```

Edit `.env` and fill in `LLM_PROVIDER`, `LLM_MODEL`, and `LLM_API_KEY`. Everything else has defaults for local development. `DATABASE_URL` defaults to `./dev.sqlite` if left blank.

## Run

```bash
docker compose up -d && npm run dev
```

Service starts on `http://localhost:3000` (or `PORT` from your `.env`).

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Service status and dependency health |
| POST | `/api/extract` | Upload a document for extraction (`?mode=sync` or `?mode=async`) |
| GET | `/api/jobs/:jobId` | Poll the status of an async extraction job |
| GET | `/api/sessions/:sessionId` | All extractions and pending jobs for a session |
| POST | `/api/sessions/:sessionId/validate` | Cross-document compliance check via LLM |
| GET | `/api/sessions/:sessionId/report` | Structured compliance report derived from stored data |

## Tests

```bash
npm run test:unit
```