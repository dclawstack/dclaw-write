---
tags: [meta, prd, revised, swarm]
version: 2.3
date: 2026-05-16
app_id: write
app_name: DClaw Write
category: Content
status: Future
---

# 📘 DClaw Write — Revised PRD v2.3

> **The single document every agent must read before writing code for this app.**
> Generated from DClaw Master PRD v2.2. Read the Master PRD first: https://raw.githubusercontent.com/dclawstack/dclaw-prd/main/DClaw-Master-PRD.md

---

## 1. Product Identity

| Field | Value |
|-------|-------|
| **App ID** | `write` |
| **Name** | DClaw Write |
| **Category** | Content |
| **Tagline** | Long-form writing |
| **Color** | #3B82F6 |
| **Phase** | Future |
| **Port (Frontend Dev)** | 3038 (TBD — assign before build) |
| **Port (Backend Dev)** | 18108 (TBD — assign before build) |
| **Maturity Tier** | 🟡 Tier 2 — Partial |

---

## 2. Current State Assessment

### 2.1 Scaffold Status
| Component | Status | Notes |
|-----------|--------|-------|
| `frontend/` | ✅ | Next.js 14+ app |
| `backend/` | ✅ | FastAPI + SQLAlchemy 2.0 |
| `docs/` | ✅ | getting-started, guides, reference, releases |
| `helm/` | ✅ | K8s deployment manifests |
| `.github/workflows/` | ✅ | CI/CD + Claude integration |
| `AGENTS.md` | ✅ | Per-repo agent instructions |
| `PLAN-v1.2.md` | ✅ | Feature roadmap |
| `docker-compose.yml` | ✅ | Local dev stack |
| `tests/` | ✅ | pytest + pytest-asyncio |
| `alembic/` | ✅ | Database migrations |
| `dclaw-manifest.json` | ❌ | DPanel registration |

### 2.2 Code Maturity
| Metric | Value |
|--------|-------|
| Python source files (backend) | ~22 |
| TypeScript/TSX files (frontend) | ~16 |
| Total source files | ~38 |
| Tests | ✅ Present |
| Alembic migrations | ✅ Present |
| DPanel manifest | ❌ Missing |

### 2.3 Feature Maturity
- **P0 Foundation:** Partially implemented
- **P1 Platform:** Not yet started
- **P2 Vertical:** Not yet started

---

## 3. Gap Analysis

| # | Gap | Severity | Fix |
|---|-----|----------|-----|
| 1 | Missing `dclaw-manifest.json` | 🔴 | Create frontend/public/dclaw-manifest.json for DPanel |
| 2 | Partial implementation — needs more domain features | 🟡 | Expand backend services and frontend pages per P0 roadmap |

---

## 4. Sacred Architecture & Tech Stack

> **NON-NEGOTIABLE. Every DClaw product MUST use this exact stack.**

| Layer | Technology | Version |
|-------|------------|---------|
| **Frontend** | Next.js 14+ | App Router, Tailwind CSS, shadcn/ui |
| **Backend** | FastAPI | Pydantic v2, SQLAlchemy 2.0, asyncpg |
| **Database** | PostgreSQL 16 | CloudNativePG operator in K8s |
| **Vector DB** | Qdrant / pgvector | Only if RAG / semantic search |
| **Cache / Bus** | Redis | 7.x |
| **Object Storage** | MinIO | Latest |
| **Workflow** | Temporal.io | Only if automation/orchestration |
| **Auth** | Logto | JWT validation on all protected routes |
| **Billing** | Stripe | Metered or per-seat |
| **K8s Operator** | Go + controller-runtime | 0.18 |
| **LLM Local** | Ollama | Apple Silicon |
| **LLM Cloud** | OpenRouter + Kimi K2.5 | Fallback |
| **Monitoring** | Prometheus + Grafana | Latest |

### 4.1 Python Rules
- `ruff` formatting enforced
- Type hints on ALL public APIs
- `pydantic` v2 for schemas
- `sqlalchemy` 2.0 style (`Mapped`, `mapped_column`)
- `pytest` + `pytest-asyncio` for tests
- Functions < 50 lines
- No `print()` — use `structlog`

### 4.2 TypeScript / Next.js Rules
- Strict TypeScript (`strict: true`)
- Tailwind for ALL styling
- `cn()` utility for conditional classes
- No `any` without `// @ts-ignore`

### 4.3 Docker Standards
- Port mappings MUST match container listen port
- Healthchecks MUST use binaries present in base image
- `docker compose config` must pass before shipping
- Service type MUST be `ClusterIP`
- TLS required on all ingress

---

## 5. P0 Foundation Features (Must Have — Demo Ready)

> **Every P0 MUST include an AI Copilot per YC S25/W26 RFS.**

| # | Feature | Description | AI Component | Acceptance Criteria |
|---|---------|-------------|--------------|---------------------|
| P0.1 | **AI Writing Copilot** | Generate, expand, and refine long-form content with tone control. | LLM long-form generation + style transfer | Generate 2000 words in <30s; 5 tone presets |
| P0.2 | **Document Editor** | Rich-text editor with markdown, tables, and embeds. | AI formatting suggestion + structure optimization | Block-based editor; real-time collaboration; version history |
| P0.3 | **Content Templates** | Blog posts, whitepapers, case studies, and email templates. | AI template filling from brief + research | 50+ templates; auto-fill from keyword research |
| P0.4 | **SEO Integration** | Real-time SEO scoring and keyword suggestions while writing. | NLP keyword-coverage + readability scoring | Score updates every 3s; suggest keywords in context |

---

## 6. P1 Platform Features (Should Have — v1.1–1.2)

| # | Feature | Description | AI Component | Acceptance Criteria |
|---|---------|-------------|--------------|---------------------|
| P1.1 | **Plagiarism & Fact Check** | Detect unoriginal content and verify factual claims. | AI fact-verification against web sources | Plagiarism <5%; flag unsupported claims with source suggestions |
| P1.2 | **Team Collaboration** | Comments, suggestions, and approval workflows. | AI sentiment analysis on editorial feedback | Threaded comments; suggest mode; approval gates |
| P1.3 | **Content Calendar** | Schedule and manage publishing pipeline. | AI optimal-publish-time prediction | Drag-and-drop calendar; auto-schedule; platform integrations |
| P1.4 | **Brand Voice Training** | Train AI on existing content to match brand voice. | Fine-tuned voice model + consistency scoring | Train on 10 samples; voice-match score >85% |

---

## 7. P2 Vertical / Scale Features (Could Have — v1.3+)

| # | Feature | Description | AI Component | Acceptance Criteria |
|---|---------|-------------|--------------|---------------------|
| P2.1 | **Multi-Language Writing** | Write and translate content into 30+ languages. | AI cultural-adaptation + localization review | Translate in <10s per 1000 words; cultural nuance check |
| P2.2 | **AI Research Assistant** | Auto-research topics and synthesize source material. | Web search + RAG + synthesis | Find 10 sources; synthesize key points; cite in APA/MLA |
| P2.3 | **Content Performance** | Track views, engagement, and conversion per article. | AI performance prediction + headline optimization | Dashboard with 10+ metrics; A/B headline testing |
| P2.4 | **Ghostwriter Mode** | AI writes in the style of a specific author or publication. | Few-shot style transfer + tone calibration | Match style from 3 samples; human-like readability score |

---

## 8. Scaffold Checklist

Before marking this app "shipped", confirm:

- [ ] `frontend/` with Next.js 14+, Tailwind, shadcn/ui
- [ ] `backend/` with FastAPI, Pydantic v2, SQLAlchemy 2.0, asyncpg
- [ ] `docs/` with getting-started, guides, reference, releases, troubleshooting
- [ ] `helm/` with Chart.yaml, values.yaml, templates (deployment, service, ingress, cloudnativepg)
- [ ] `.github/workflows/` with build-backend.yml, build-frontend.yml, deploy.yml, claude.yml
- [ ] `frontend/public/dclaw-manifest.json` for DPanel registration
- [ ] `backend/tests/` with pytest + pytest-asyncio
- [ ] `backend/alembic/` with initial migration
- [ ] `Dockerfile` + `docker-compose.yml` with correct healthchecks
- [ ] Health endpoint at `/health` returning `{"status":"ok"}`
- [ ] `AGENTS.md` with per-repo instructions
- [ ] `PLAN-v1.2.md` with feature roadmap
- [ ] Port assigned from registry and documented
- [ ] No hardcoded secrets — use `.env.example` + K8s Secrets
- [ ] Non-root containers in Dockerfile

---

## 9. AI Copilot Mandate (YC S25/W26 Requirement)

Every DClaw app MUST have an AI Copilot as its first P0 feature. The copilot must:
1. Be contextually aware of the app's domain data
2. Use RAG over the app's knowledge base where applicable
3. Suggest next actions, not just answer questions
4. Be accessible from every page via floating chat or sidebar
5. Fall back to local Ollama when cloud is unavailable

---

## 10. Next Tasks for Vibe Coders

1. **Complete P0 features**: Finish any incomplete P0 backend services and frontend pages.
2. **Add missing scaffold**: Fill gaps identified above (docs, helm, tests, manifest, etc.).
3. **Start P1 features**: Implement the first 2 P1 features to deepen domain capability.
4. **Polish and integrate**: Ensure health endpoints, Docker builds, and DPanel manifest are production-ready.

---

## 11. Domain Research Notes

Inspired by Jasper, Copy.ai, Notion AI, Writer.com. Content marketing is a $400B market.

---

## 12. Links & Resources

| Resource | URL |
|----------|-----|
| **Master PRD** | https://raw.githubusercontent.com/dclawstack/dclaw-prd/main/DClaw-Master-PRD.md |
| **GitHub Org** | https://github.com/dclawstack |
| **DPanel** | https://dpanel.dclawstack.io |
| **Port Registry** | See `dclaw-platform/PORT_REGISTRY.md` |
| **App PRD Template** | Obsidian Vault → `00-META/📐 App PRD Template.md` |
| **Scaffold Source** | `dclaw-scaffold/` in DClaw-Stack |

---

*Revised PRD version: 2.3*
*Generated: 2026-05-16 by DClaw Stack Generator*
*Next review: When P0 features are complete or architecture changes*
