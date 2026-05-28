# DClaw Write — v1.2 Feature Roadmap

> 📘 **REVISED PRD v2.3 available:** See `REVISED-PRD.md` for the original gap analysis. This document supersedes the prior roadmap and reframes the product for a YC-grade submission.
>
> 🧭 **Authoritative scaffold values (from `AGENTS.md`):**
> - Backend port: **`8017`** (FastAPI)
> - Frontend port: **`3017`** (Next.js 14+)
> - Database: **`dclaw_write`** (PostgreSQL 16 prod / `aiosqlite` local dev)
> - Base API path: **`/api/v1`**

---

## 0. Why This Plan Was Rewritten — YC Gap Analysis

The prior roadmap shipped a generic "AI Writing Copilot + SEO + Templates" — a feature set indistinguishable from Jasper, Copy.ai, Notion AI, Writer.com, Sudowrite, and Lex. To clear the YC bar, DClaw Write needs a defensible wedge, a hair-on-fire problem, agentic technical depth, and a data flywheel that improves with use.

| Gap | What was missing | How this plan fixes it |
|-----|------------------|------------------------|
| **Moat / differentiation** | LLM wrappers get cloned in a week; no proprietary data, no specialized model. | **Voice DNA fingerprinting** — per-user style embedding + statistical signature trained on the writer's own samples, used to constrain every generation. Builds a per-customer model that improves with each draft. |
| **Hair-on-fire problem** | "Writer's block + SEO" is not a top-3 pain. | Reframe around three real pains: (a) **AI-detection panic** for agencies/journalists, (b) **voice drift** that kills conversion, (c) **hallucination risk** blocking B2B/journalism adoption. |
| **Technical sophistication** | "LLM generates text" — no agentic depth, no RAG, no evals. | **Multi-agent draft pipeline** (planner → researcher → drafter → editor → fact-checker), **inline citation grounding** with retrieval verification, **eval harness** (voice-match, citation density, hallucination rate). |
| **Scalability** | PG/Redis/MinIO named but no hot-path plan. | Streaming SSE, pgvector for retrieval, async task queue for multi-agent runs, per-user voice model artifacts in MinIO, inference cost telemetry. |
| **GTM wedge** | "Writers" is too broad. | Initial wedge: **B2B content teams under AI-detection pressure**. Their drafts get rejected by clients running GPTZero/Originality.ai. Voice DNA + citation grounding directly solves this. |
| **Data flywheel** | None. | Voice DNA + accept/reject telemetry on every AI suggestion → fine-tuning data → better completions → more retention. |

### Differentiating wedges (the four bets)
1. **Voice DNA** — every generation passes through the user's style constraints; outputs sound like the human, not the model.
2. **Citation-grounded generation** — every factual claim links to a retrieved source with inline footnotes; eliminates hallucination as a deal-blocker for B2B and journalism.
3. **Multi-agent draft pipeline** — explicit planner/researcher/drafter/editor/fact-checker agents with intermediate artifacts the user can inspect and re-run.
4. **Cross-platform repurposing** — one canonical document expands into Twitter/LinkedIn/Substack/email/ad copy with constraint-aware compression. Workflow lock-in.

---

## 1. Pre-Flight Checklist

- [ ] `frontend/package-lock.json` committed after any `npm install`
- [ ] `frontend/next-env.d.ts` exists and is committed
- [ ] `docker-compose.yml` healthchecks correct **and** ports match `AGENTS.md` (8017 / 3017)
- [ ] `frontend/Dockerfile` declares `ARG NEXT_PUBLIC_API_URL` before `RUN npm run build`
- [ ] `backend/app/core/config.py` defaults to `dclaw_write` (not `dclaw_app`)
- [ ] `backend/tests/conftest.py` test DB name is `dclaw_write_test`
- [ ] `backend/alembic.ini` `sqlalchemy.url` updated to `dclaw_write`
- [ ] Local SQLite dev fallback (`aiosqlite`) works without docker

---

## 2. Architecture & Stack (locked — from `AGENTS.md` + `REVISED-PRD.md`)

| Layer | Tech | Notes |
|-------|------|-------|
| Backend | FastAPI + SQLAlchemy 2.0 (async) + Pydantic v2 | `DeclarativeBase` from `app.models.base`; repository pattern; `Depends(get_db)`; `pytest-asyncio==0.24.0` pinned |
| DB (prod) | PostgreSQL 16 + asyncpg | `dclaw_write` |
| DB (local dev) | SQLite + aiosqlite | `sqlite+aiosqlite:///./dclaw_write.db` — auto when no `DATABASE_URL` env |
| Vector | pgvector (in same Postgres) | For voice retrieval + citation grounding (complexity 2) |
| Frontend | Next.js 14 App Router + Tailwind + custom pre-built UI | **No shadcn CLI**, no `@base-ui/react` |
| LLM local | Ollama (`llama3.1` default) | Default for privacy + cost |
| LLM cloud | OpenRouter (Kimi K2.5) | Fallback when Ollama unavailable |
| Streaming | SSE | Token-by-token UI |
| Background work | FastAPI background tasks (v1) → Temporal/Celery (v2) | Multi-agent pipeline runs |
| Telemetry | structlog + Prometheus | Latency, cost, accept/reject rate |

---

## 3. Domain Model (initial)

| Entity | Purpose | Key fields |
|--------|---------|------------|
| `Project` | Container for related docs | `id`, `name`, `description`, `brand_profile_id?` |
| `Document` | A single long-form piece | `id`, `project_id`, `title`, `content` (markdown), `content_type`, `status`, `word_count`, `reading_time_seconds` |
| `Revision` | Immutable snapshot per save | `id`, `document_id`, `content`, `word_count`, `created_at` |
| `VoiceSample` | Writer's prior work used to fit Voice DNA | `id`, `brand_profile_id`, `source_url?`, `text`, `tokens`, `created_at` |
| `BrandProfile` | Container for Voice DNA artifacts | `id`, `name`, `style_features` (JSON), `embedding` (vector), `sample_count` |
| `Citation` | Source-of-truth for a claim in a doc | `id`, `document_id`, `paragraph_index`, `claim`, `source_url`, `verified` |
| `AISuggestion` | Generated text the user accepted/rejected (telemetry → flywheel) | `id`, `document_id`, `prompt`, `output`, `accepted`, `latency_ms`, `model`, `cost_cents` |

Complexity 0 ships `Project`, `Document`, `Revision`. The rest land in complexity 1/2.

---

## 4. Roadmap (by complexity)

### Complexity 0 — Foundation (Quick Wins)

> Goal: clean scaffold + real CRUD + minimal editor that boots end-to-end on SQLite.
> **Definition of done:** `docker compose config` passes, `pytest` green, `npm run dev` opens a usable editor that persists.

| # | Item | Where |
|---|------|-------|
| **0.1** | Align scaffold metadata: `config.py` defaults (`app_name="DClaw Write"`, SQLite-by-default DB URL), `alembic.ini` URL, `conftest.py` test DB name, docker-compose ports `8017`/`3017` per `AGENTS.md`. | `backend/app/core/config.py`, `backend/alembic.ini`, `backend/tests/conftest.py`, `docker-compose.yml`, `.env.example` |
| **0.2** | Add `aiosqlite` to `requirements.txt`; engine respects `DATABASE_URL` env, falls back to local SQLite file. | `backend/requirements.txt`, `backend/app/core/database.py` |
| **0.3** | SQLAlchemy 2.0 models: `Project`, `Document`, `Revision` with `Mapped[...]`, `mapped_column`, `lazy="selectin"`, cascade rules. | `backend/app/models/` |
| **0.4** | Pydantic v2 schemas (`from_attributes=True`): Create/Read/Update for each entity. | `backend/app/schemas/` |
| **0.5** | Concrete repositories subclassing `BaseRepository[T]`: `ProjectRepository`, `DocumentRepository`, `RevisionRepository` (with `update`, `list_by_project`). | `backend/app/repositories/` |
| **0.6** | Real `/api/v1/projects` and `/api/v1/documents` routers replacing the mock `write.py`. Endpoints: list, get, create, update, delete; documents support `?project_id=` filter and an autosave path that snapshots revisions. | `backend/app/api/v1/`, `backend/app/api/main.py` |
| **0.7** | Alembic initial migration covering `projects`, `documents`, `revisions`. | `backend/alembic/versions/` |
| **0.8** | Backend tests: project CRUD, document CRUD, autosave creates revision, health endpoint. | `backend/tests/` |
| **0.9** | DPanel manifest. | `frontend/public/dclaw-manifest.json` |
| **0.10** | Typed API client functions: `listProjects`, `createProject`, `listDocuments`, `getDocument`, `saveDocument`, `createDocument`. | `frontend/src/lib/api.ts` |
| **0.11** | Dashboard page: list projects + documents, "New document" action. | `frontend/src/app/page.tsx`, `frontend/src/app/dashboard/page.tsx` |
| **0.12** | Document editor page: title + body (textarea/contenteditable), client-side word/char/reading-time, debounced autosave (POST `/documents/{id}`). | `frontend/src/app/documents/[id]/page.tsx`, `frontend/src/components/editor/` |
| **0.13** | Frontend: brand title + metadata; package name → `dclaw-write-frontend`; dev port `3017`. | `frontend/src/app/layout.tsx`, `frontend/package.json` |
| **0.14** | Tests: smoke check that document list page renders (snapshot or basic playwright optional). | optional — defer if heavyweight |

### Complexity 1 — Core Differentiators

> Goal: ship the wedge features that make DClaw Write distinguishable from generic LLM wrappers.

| # | Item | Why it matters |
|---|------|-----------------|
| **1.1** | `VoiceSample` + `BrandProfile` models, migration, repositories, schemas, upload endpoint. | Foundation for Voice DNA. |
| **1.2** | Voice DNA fingerprinting service (`backend/app/services/voice_dna.py`): statistical features (avg sentence length, lexical diversity, type-token ratio, punctuation density, sentiment baseline, n-gram signature). | Defensible per-user style vector that does **not** require a hosted LLM to compute. |
| **1.3** | AI Copilot endpoint `/api/v1/ai/complete` — Ollama-first, OpenRouter fallback, style constraints injected from active BrandProfile. | The wedge. |
| **1.4** | SSE streaming endpoint `/api/v1/ai/stream`. | Perceived latency parity with ChatGPT. |
| **1.5** | Inline suggestion UI: ghost-text completion in editor with accept/reject. | Surfaces the value where the user works. |
| **1.6** | `AISuggestion` telemetry persisted on every accept/reject. | Data flywheel. |
| **1.7** | Voice-match score per paragraph (compare paragraph features against BrandProfile features). | Live feedback that the AI sounds like the user. |
| **1.8** | Readability scoring (Flesch-Kincaid, sentence-length distribution) — local Python, no network. | Quick win, table-stakes for the category. |
| **1.9** | Multi-format export: Markdown, HTML, DOCX (via `python-docx`). | Removes the leave-to-finish-elsewhere step. |
| **1.10** | Focus mode + writing sprints (FE only, persist sprint to backend optional). | Retention hook. |
| **1.11** | Citation model + endpoint scaffolding (no retrieval yet). | Sets up complexity 2 work. |

### Complexity 2 — Advanced / AI-Heavy

> Goal: full YC story — agentic pipeline, RAG, evals, repurposing, real-time collab.

| # | Item | Why it matters |
|---|------|-----------------|
| **2.1** | Multi-agent draft pipeline: planner → researcher → drafter → editor → fact-checker. Each step persists an inspectable artifact; user can re-run a single step. | Headline technical-sophistication story. |
| **2.2** | Citation-grounded generation: web search (Tavily/Serper) + retrieval + per-claim verification + inline footnotes. | Solves hallucination for B2B/journalism. |
| **2.3** | pgvector integration for: (a) semantic search across user's own corpus, (b) retrieval over cited sources, (c) voice-similarity nearest neighbors. | The vector substrate the rest of complexity 2 depends on. |
| **2.4** | Cross-platform repurposing pipeline: one document → Twitter thread, LinkedIn post, Substack email, ad copy, with constraint-aware compression. | Workflow lock-in; primary retention engine. |
| **2.5** | Eval harness: voice-match score, citation density, hallucination rate (LLM-as-judge against retrieved sources), readability. Surfaces per-document scorecards. | Data flywheel + sales proof. |
| **2.6** | AI plagiarism / AI-detection self-check (run drafts through GPTZero/Originality.ai-style heuristics before the client does). | Solves the AI-detection panic head-on. |
| **2.7** | Real-time collaboration (Yjs / CRDT). | Team plan unlock. |
| **2.8** | A/B headline testing + performance prediction (LLM ranks 5 headline variants; user picks). | Marketing-team unlock. |
| **2.9** | Multi-language with cultural-adaptation review. | International expansion. |
| **2.10** | Inference cost & latency dashboard (per-model spend, accept/reject rates, voice-match trend). | Operator visibility + investor demo. |

---

## 5. Implementation Order

1. **Sprint 0 (this PR):** Complexity 0 items 0.1 → 0.13 — clean scaffold, real CRUD, editor, tests.
2. **Sprint 1:** 1.1 → 1.8 — Voice DNA + AI Copilot + readability.
3. **Sprint 2:** 1.9 → 1.11, 2.1, 2.5 — exports, multi-agent skeleton, eval harness.
4. **Sprint 3:** 2.2 → 2.4 — citation grounding, pgvector, repurposing.
5. **Sprint 4:** 2.6 → 2.10 — AI-detection self-check, collab, cost dashboard.

---

## 6. Open Questions

- **Port conflict:** `docker-compose.yml` currently uses `8105`/`3019`. `AGENTS.md` authoritative is `8017`/`3017`. Plan: align compose to AGENTS.md unless another DClaw app on this host already binds those ports.
- **REVISED-PRD content angle:** the PRD frames the product as content-marketing (Jasper-style). The original PLAN framed it as creative long-form (Scrivener-style). This rewrite picks the **B2B content + creator** wedge because the AI-detection pain is sharpest there. Revisit if user disagrees.
- **Voice DNA modality:** initial fit is statistical (no model server needed). When pgvector lands in complexity 2, augment with embedding-based similarity. Two-stage approach keeps complexity 1 shippable on SQLite.
