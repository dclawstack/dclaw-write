# Deploy Runbook — what I auto-run once keys are in `SECRETS.local.md`

This is the exact sequence I execute autonomously after you fill the two required keys.
It's idempotent and resumable.

## 0. Read keys
Parse `SECRETS.local.md` for `NEON_API_KEY` / `DATABASE_URL` and `OPENROUTER_API_KEY`.

## 1. Neon database
- If `DATABASE_URL` given → use it.
- Else with `NEON_API_KEY`: `npx neonctl projects create --name dclaw-write` → capture pooled connection string.
- Write `web/.env.local` with `DATABASE_URL`, `OPENROUTER_API_KEY`, `ROUTING_PROFILE`.

## 2. Schema + progress
```
cd web
npm run db:migrate     # creates pgvector ext, _meta schema, all 10 tables
npm run db:seed        # mirrors roadmap into _meta.progress
```

## 3. Smoke test locally
- `npm run build` (already green)
- Start dev, hit `/api/brand-profiles` (DB), `/api/ai/generate` (OpenRouter) — confirm 200s.

## 4. Vercel
```
cd web
vercel link --yes
vercel env add DATABASE_URL production        # + preview/dev
vercel env add OPENROUTER_API_KEY production
vercel env add ROUTING_PROFILE production
vercel --prod                                 # first deploy
```
- Set Git auto-deploy: connect repo `dclawstack/dclaw-write`, Root Directory = `web`.
  (If push access to `dclawstack` is unavailable, I'll create `tharuni-01/dclaw-write` and point Vercel there.)

## 5. Verify production
- Open the deployment URL, run the 5 demo flows:
  1. Create brand voice + add sample → profile fits.
  2. Editor: "Continue in my voice" streams.
  3. Live voice-match meter updates.
  4. Edit the AI text → `ai_edits` row captured.
  5. Paste sources + "Check grounding" → unsupported claims gate publish.

## 6. Update tracking
- Flip M0/M1 "Live"/"deploy" tasks to done in `ROADMAP.md` and `_meta.progress`.
