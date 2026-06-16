// Mirrors the roadmap into _meta.progress so the database is the live source of
// truth for build progress (as the project goal requires). Idempotent.
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { progress, metrics } from "./schema";

type Row = { milestone: string; task: string; status: string };

const ROADMAP: Row[] = [
  { milestone: "M0", task: "Decide architecture", status: "done" },
  { milestone: "M0", task: "Scaffold Next.js full-stack app", status: "done" },
  { milestone: "M0", task: "Drizzle schema + migration SQL", status: "done" },
  { milestone: "M0", task: "Create Neon DB + run migration", status: "done" },
  { milestone: "M0", task: "Link Vercel + first deploy", status: "done" },
  { milestone: "M1", task: "OpenRouter client + tiered catalog", status: "done" },
  { milestone: "M1", task: "Consensus router (token-efficient)", status: "done" },
  { milestone: "M1", task: "Streaming /api/ai/complete", status: "done" },
  { milestone: "M1", task: "Consensus /api/ai/generate + logging", status: "done" },
  { milestone: "M1", task: "Live end-to-end generation", status: "done" },
  { milestone: "M2", task: "Voice DNA port to TS", status: "done" },
  { milestone: "M2", task: "Brand profile CRUD + sample fit", status: "done" },
  { milestone: "M2", task: "Semantic (embedding) voice match", status: "done" },
  { milestone: "M2", task: "Edit-capture loop (moat)", status: "done" },
  { milestone: "M2", task: "Live voice-match meter in editor", status: "done" },
  { milestone: "M3", task: "Source ingestion", status: "done" },
  { milestone: "M3", task: "Grounding + unsupported-claim gate", status: "done" },
  { milestone: "M3", task: "Web search ingestion (optional)", status: "todo" },
  { milestone: "M4", task: "Editor surface", status: "done" },
  { milestone: "M4", task: "Brand setup flow", status: "done" },
  { milestone: "M4", task: "Landing page", status: "done" },
  { milestone: "M4", task: "TipTap rich editor + inline citation chips", status: "done" },
  { milestone: "M5", task: "Auth (Clerk)", status: "todo" },
  { milestone: "M5", task: "Progress dashboard from _meta.progress", status: "done" },
  { milestone: "M5", task: "Production deploy green", status: "done" },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const db = drizzle(neon(url));

  await db.delete(progress);
  await db.insert(progress).values(ROADMAP.map((r) => ({ ...r, updatedAt: new Date() })));

  const done = ROADMAP.filter((r) => r.status === "done").length;
  await db.insert(metrics).values({
    key: "tasks_done_pct",
    value: Math.round((done / ROADMAP.length) * 100),
    recordedAt: new Date(),
  });

  console.log(`✅ seeded ${ROADMAP.length} tasks (${done} done)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
