# DClaw Write — YC Rebuild Roadmap

> Single source of truth for what we're building and where we are.
> Agent updates this after every meaningful step. Mirrored into Neon `_meta.progress` once the DB exists.

## The Product (one sentence)
AI that generates **publish-ready content in your brand's exact voice, with every factual claim cited** — so content teams ship faster without sounding generic or making things up.

## The Wedge (what makes us un-copyable)
1. **Voice DNA that learns** — every user edit to AI output is captured as training signal; each brand's voice sharpens with use (proprietary data + switching cost).
2. **Citation grounding as a guarantee** — no unsupported claim can be published (trust moat).
3. **Consensus AI routing** — multiple OpenRouter models cross-check each other, model chosen per-task for token efficiency (quality at low cost).

## Stack (committed)
- **Full-stack Next.js (App Router)** on **Vercel** — pages + route handlers are the AI APIs. Auto-deploy from git.
- **Neon Postgres + pgvector**, accessed via **Drizzle ORM**.
- **OpenRouter** for all LLM calls, behind a **consensus router**.
- Auth: Clerk (optional v1), dev-auth fallback.

---

## Milestones & Progress

Legend: ⬜ todo · 🟦 in progress · ✅ done · ⛔ blocked (needs key)

### M0 — Foundations
- ✅ Survey existing app, decide architecture
- ✅ Secrets file for user to fill (`SECRETS.local.md`)
- ✅ Scaffold Next.js full-stack app in `web/` (builds green for Vercel)
- ✅ Drizzle schema: documents, brand_profiles, voice_samples, citations, sources, embeddings, ai_edits, generations, _meta.progress/metrics
- ✅ Migration SQL generated (`drizzle/0000_*.sql`)
- ⛔ Create Neon DB (needs `NEON_API_KEY` or `DATABASE_URL`)
- ⛔ Run first migration against Neon
- ⛔ Link Vercel project + env + first deploy (needs keys in Vercel env)

### M1 — Consensus AI core
- ✅ OpenRouter client + model catalog (tiered by cost/quality)
- ✅ Consensus router: task-aware model selection, multi-model cross-check, token-efficient
- ✅ `/api/ai/complete` streaming route
- ⛔ Live end-to-end generation (needs `OPENROUTER_API_KEY`)

### M2 — Voice DNA (ported + upgraded)
- ✅ Port voice-dna feature extraction + match score to TS
- ✅ Brand profile CRUD + sample upload + fit
- ✅ Embedding-based semantic style match (on top of statistical)
- 🟦 **Edit-capture loop**: store every user edit of AI output as voice signal
- 🟦 Live voice-match score in editor

### M3 — Citation grounding
- ✅ Source ingestion (paste) + chunk + embed
- ✅ Web search ingestion (Tavily/Brave) — optional, wired into ground route
- ✅ Generate-with-citations: claims carry source refs + confidence
- ✅ Unsupported-claim detector blocks "publish"

### M4 — Editor & product surface
- ⬜ TipTap block editor with inline AI + citation chips
- ⬜ Documents list / project workspace
- ⬜ Brand voice setup flow
- ⬜ Landing page

### M5 — Polish & ship
- ⬜ Auth (Clerk) wired
- ⬜ Progress dashboard reading `_meta.progress`
- ⬜ Production deploy green on Vercel
- ⬜ 5 demo-ready end-to-end flows

---

## Progress Metrics (updated each step)
- Build: ✅ green — 4 pages + 12 API routes
- Tests: ✅ 23 passing (voice-dna, model routing, grounding claim extraction)
- Core libs: voice-dna (validated), consensus router, models catalog, openrouter, grounding, websearch
- Demo seed: ✅ ready (`npm run db:seed-demo` — Acme voice + draft + source)
- Deploy automation: ✅ `web/scripts/deploy.sh` (one command once keys are in)
- Deployed: not yet
- Blocked on (only these): `NEON_API_KEY` or `DATABASE_URL`, and `OPENROUTER_API_KEY` → then `deploy.sh` runs end-to-end

## Decision Log
- 2026-06-16 — Pivot from FastAPI+Docker+K8s to Next.js full-stack on Vercel. Reason: goal mandates serverless Vercel + Neon + OpenRouter. Python business logic (voice DNA, grounding) ported to TS.
- 2026-06-16 — Single wedge: voice + citations for content teams. Dropping the multi-app scaffold framing.
