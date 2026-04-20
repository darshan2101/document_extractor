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

Planned routes such as extraction, job polling, session validation, and reporting are not wired yet in the current codebase.

## Running Tests

```bash
npm run test:unit
```
