# Graph Report - document_extractor  (2026-04-24)

## Corpus Check
- 40 files · ~35,247 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 159 nodes · 260 edges · 19 communities detected
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 39 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]

## God Nodes (most connected - your core abstractions)
1. `repairJson()` - 11 edges
2. `SMDE â€” Smart Maritime Document Extractor` - 9 edges
3. `POST /api/extract Endpoint` - 6 edges
4. `AnthropicProvider` - 5 edges
5. `GeminiProvider` - 5 edges
6. `GroqProvider` - 5 edges
7. `getDerivedValidity()` - 5 edges
8. `LLM Provider Abstraction` - 5 edges
9. `Maritime Document Type Taxonomy (COC, SIRB, PASSPORT, PEME, etc.)` - 5 edges
10. `getTextContent()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `SMDE Assignment â€” Maritime Manning Agent Use Case` --conceptually_related_to--> `Sample Invoice Document (INV-10012, $1699.48)`  [AMBIGUOUS]
  Senior Backend Engineer â€” Evaluation Assignment e94909805e8d82ea805481526a05317f.md → sample_data/invoice1.png
- `Maritime Document Type Taxonomy (COC, SIRB, PASSPORT, PEME, etc.)` --conceptually_related_to--> `Certificate of Competency â€” Samoya (COC PDF)`  [INFERRED]
  Senior Backend Engineer â€” Evaluation Assignment e94909805e8d82ea805481526a05317f.md → sample_data/COC_Samoya.pdf
- `Maritime Document Type Taxonomy (COC, SIRB, PASSPORT, PEME, etc.)` --conceptually_related_to--> `Passport â€” Samoya (PASSPORT PDF)`  [INFERRED]
  Senior Backend Engineer â€” Evaluation Assignment e94909805e8d82ea805481526a05317f.md → sample_data/PASSPORT_Samoya.pdf
- `Maritime Document Type Taxonomy (COC, SIRB, PASSPORT, PEME, etc.)` --conceptually_related_to--> `Pre-Employment Medical Examination â€” Samoya (PEME PDF)`  [INFERRED]
  Senior Backend Engineer â€” Evaluation Assignment e94909805e8d82ea805481526a05317f.md → sample_data/PEME_Samoya.pdf
- `Maritime Document Type Taxonomy (COC, SIRB, PASSPORT, PEME, etc.)` --conceptually_related_to--> `Seafarer's Identity and Record Book â€” Samoya (SIRB PDF)`  [INFERRED]
  Senior Backend Engineer â€” Evaluation Assignment e94909805e8d82ea805481526a05317f.md → sample_data/SIRB_Samoya.pdf

## Hyperedges (group relationships)
- **LLM Pipeline Reliability: JSON Repair + Prompt Versioning + Raw Response Preservation** — assignment_llm_reliability, adr_prompt_versioning, adr_anthropic_provider [INFERRED 0.85]
- **Async Job Lifecycle: BullMQ + Extraction Worker + Job State Machine** — adr_bullmq, adr_extraction_worker, readme_job_states [EXTRACTED 0.95]
- **Samoya Seafarer Document Set (COC, PASSPORT, PEME, SIRB)** — sample_coc_samoya, sample_passport_samoya, sample_peme_samoya, sample_sirb_samoya [INFERRED 0.88]

## Communities

### Community 0 - "Community 0"
Cohesion: 0.15
Nodes (7): Extraction, initializeDatabase(), Job, startServer(), Session, Validation, createExtractionWorker()

### Community 1 - "Community 1"
Cohesion: 0.18
Nodes (8): GeminiProvider, toExtractionResult(), toRetryableError(), GroqProvider, toExtractionResult(), toRetryableError(), extractJson(), repairJson()

### Community 2 - "Community 2"
Cohesion: 0.16
Nodes (9): formatExtractionResponse(), parseJsonValue(), deriveDetectedRole(), generateReport(), deriveOverallHealth(), getCriticalDocumentTypes(), getTodayUtc(), isWithin90Days() (+1 more)

### Community 3 - "Community 3"
Cohesion: 0.21
Nodes (6): daysUntilExpiry(), getTodayUtc(), parseDateToUtc(), getDerivedValidity(), toPersistencePayload(), hashFile()

### Community 4 - "Community 4"
Cohesion: 0.14
Nodes (17): Bonus Endpoints (Retry and Expiry), BullMQ Queue System, SHA-256 File Deduplication, Prompt Versioning Strategy, BullMQ Queue Choice Decision, In-Memory Token Bucket Rate Limiting, Rationale: Async as Default (LLM latency unbounded), Rationale: BullMQ over in-process queue (durability, retries, stall recovery) (+9 more)

### Community 5 - "Community 5"
Cohesion: 0.13
Nodes (16): Async Extraction Path (Phase 5), createExtractionWorker Function, Job Polling and Session Aggregation (Phase 6), Overall Health Derivation (CRITICAL/WARN/OK), Report Generation (Phase 8), SMDE Assignment â€” Maritime Manning Agent Use Case, Sample Invoice Document (INV-10012, $1699.48), GET /api/sessions/:sessionId/expiring Endpoint (+8 more)

### Community 6 - "Community 6"
Cohesion: 0.14
Nodes (14): Anthropic LLM Provider Implementation, Cross-Document Compliance Validation (Phase 7), ILLMProvider Interface, LLM Provider Abstraction, Maritime Document Type Taxonomy (COC, SIRB, PASSPORT, PEME, etc.), LLM Extraction Prompt (Canonical Maritime Document Taxonomy), Supported LLM Providers (Anthropic, Gemini, Groq, Mistral, OpenAI, Ollama), LLM Reliability Requirements (JSON repair, timeout, retry, never discard) (+6 more)

### Community 7 - "Community 7"
Cohesion: 0.43
Nodes (4): AnthropicProvider, getTextContent(), toExtractionResult(), toRetryableError()

### Community 8 - "Community 8"
Cohesion: 0.7
Nodes (4): getClientIp(), getRefilledBucket(), getRetryAfterMs(), rateLimiter()

### Community 9 - "Community 9"
Cohesion: 0.67
Nodes (2): deliverWebhook(), signPayload()

### Community 10 - "Community 10"
Cohesion: 0.5
Nodes (4): Rationale: Hybrid Schema (queryability vs flexibility tradeoff), Hybrid Schema Design (Promoted + JSON columns), Suggested Database Schema (Sessions, Extractions, Jobs, Validations), Code Review Issue: Global State for Storage

### Community 11 - "Community 11"
Cohesion: 1.0
Nodes (2): createErrorResponse(), errorHandler()

### Community 12 - "Community 12"
Cohesion: 1.0
Nodes (2): Code Review Issue: Hardcoded API Key, Code Review Issue: No Timeout on LLM Request

### Community 13 - "Community 13"
Cohesion: 1.0
Nodes (1): Error Classification System

### Community 14 - "Community 14"
Cohesion: 1.0
Nodes (1): Code Review Issue: Unjustified Opus Model Choice

### Community 15 - "Community 15"
Cohesion: 1.0
Nodes (1): Code Review Issue: Synchronous File Read Blocking Event Loop

### Community 16 - "Community 16"
Cohesion: 1.0
Nodes (1): Code Review Issue: PII Written to Disk with Predictable Names

### Community 17 - "Community 17"
Cohesion: 1.0
Nodes (1): Code Review Issue: No MIME Type Validation

### Community 18 - "Community 18"
Cohesion: 1.0
Nodes (1): Evaluation Criteria (Technical 50%, Architecture 25%, Leadership 25%)

## Ambiguous Edges - Review These
- `SMDE Assignment â€” Maritime Manning Agent Use Case` → `Sample Invoice Document (INV-10012, $1699.48)`  [AMBIGUOUS]
  sample_data/invoice1.png · relation: conceptually_related_to

## Knowledge Gaps
- **33 isolated node(s):** `Extraction`, `Job`, `Session`, `Validation`, `Error Classification System` (+28 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 9`** (4 nodes): `webhook.ts`, `webhook.test.ts`, `deliverWebhook()`, `signPayload()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 11`** (3 nodes): `createErrorResponse()`, `errorHandler()`, `errorHandler.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 12`** (2 nodes): `Code Review Issue: Hardcoded API Key`, `Code Review Issue: No Timeout on LLM Request`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 13`** (1 nodes): `Error Classification System`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 14`** (1 nodes): `Code Review Issue: Unjustified Opus Model Choice`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 15`** (1 nodes): `Code Review Issue: Synchronous File Read Blocking Event Loop`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 16`** (1 nodes): `Code Review Issue: PII Written to Disk with Predictable Names`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 17`** (1 nodes): `Code Review Issue: No MIME Type Validation`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 18`** (1 nodes): `Evaluation Criteria (Technical 50%, Architecture 25%, Leadership 25%)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `SMDE Assignment â€” Maritime Manning Agent Use Case` and `Sample Invoice Document (INV-10012, $1699.48)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `SMDE â€” Smart Maritime Document Extractor` connect `Community 5` to `Community 4`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Why does `POST /api/extract Endpoint` connect `Community 4` to `Community 5`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `Anthropic LLM Provider Implementation` connect `Community 6` to `Community 4`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Are the 9 inferred relationships involving `repairJson()` (e.g. with `.extract()` and `.repair()`) actually correct?**
  _`repairJson()` has 9 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `POST /api/extract Endpoint` (e.g. with `Sync vs Async Default Decision` and `Prompt Versioning Strategy`) actually correct?**
  _`POST /api/extract Endpoint` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Extraction`, `Job`, `Session` to the rest of the system?**
  _33 weakly-connected nodes found - possible documentation gaps or missing edges._