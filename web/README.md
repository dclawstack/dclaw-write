# DClaw Write

AI that generates **publish-ready content in your brand's exact voice, with every
factual claim cited.** The longer a team uses it, the more it sounds like them.

A Next.js full-stack app: pages + route handlers, Neon Postgres (pgvector) via
Drizzle, all LLM traffic through a token-efficient consensus router over OpenRouter.

## The wedge (why this isn't just "AI writing")

1. **Voice DNA that learns** — a statistical style fingerprint + semantic embedding
   match enforces a brand's voice on every generation. Every user edit of AI output
   is captured (`ai_edits`) as a learning signal, so each brand's voice sharpens
   with use. That accruing data is the moat.
2. **Citation grounding as a guarantee** — claims are extracted, retrieved against
   sources, and verified; unsupported claims are flagged inline and **block publish.**
3. **Consensus AI** — multiple models cross-check each other, selected per task for
   the best quality per token.

## Architecture

```
src/
  app/
    page.tsx              landing
    documents/            workspace (list / create / open)
    editor/               TipTap rich editor (?id= loads a doc)
    brand/                brand-voice setup
    progress/             DB-backed build tracker (_meta.progress)
    api/
      ai/complete         streaming voice-constrained completion
      ai/generate         consensus generation + token/cost logging
      ai/edits            edit-capture loop (the moat)
      brand-profiles/…    CRUD + sample fit + voice-match
      documents/…         CRUD + sources + grounding
      progress            reads _meta.progress
  db/
    schema.ts             Drizzle schema (10 tables, pgvector, _meta)
    client.ts             lazy Neon client
    migrate / seed-*      migration + progress + demo seeders
  lib/
    voice-dna.ts          style fingerprint + match score + style prompt
    models.ts             tiered OpenRouter catalog + token-efficient selection
    consensus.ts          single-model fast path / cross-check panel + judge
    openrouter.ts         chat / stream / embed
    grounding.ts          claim extraction → retrieval → support check
    websearch.ts          optional Tavily/Brave ingestion
```

## Consensus routing (how models are chosen)

`models.ts` classifies each task by complexity and picks a panel:

| Task | Complexity | Models consulted |
|------|-----------|------------------|
| voice-match, score | trivial | 1 cheapest capable |
| complete, headline, rewrite | standard | 1 at the active profile tier |
| ground, longform | high | cross-check panel; a cheap judge picks the best |

`ROUTING_PROFILE` (`cheap` \| `balanced` \| `quality`) widens or narrows the panel.
High-stakes tasks (grounding factual claims) get the most cross-checking because
that's where being wrong is most costly. `parseJudgeVerdict` defensively parses the
judge's output so a malformed response never breaks routing.

## Develop

```bash
npm install
cp .env.example .env.local   # fill DATABASE_URL + OPENROUTER_API_KEY
npm run db:migrate           # pgvector + _meta + tables
npm run db:seed              # progress tracker rows
npm run db:seed-demo         # demo brand + draft + source
npm run dev
npm test                     # 32 unit tests
```

## Deploy

`bash scripts/deploy.sh` reads keys from `../SECRETS.local.md`, provisions Neon (if
given an API key), migrates, seeds, sets Vercel env, and ships to production.

## Env

| Var | Required | Purpose |
|-----|----------|---------|
| `DATABASE_URL` | yes | Neon Postgres (pooled) |
| `OPENROUTER_API_KEY` | yes | all LLM calls |
| `ROUTING_PROFILE` | no | `balanced` (default) |
| `TAVILY_API_KEY` / `BRAVE_API_KEY` | no | web-search grounding |

<!-- live: https://dclaw-write.vercel.app -->
