// Seeds the canonical demo dataset (delegates to lib/demo, shared with the
// in-app demo controls). Run: DATABASE_URL=... OPENROUTER_API_KEY=... npm run db:seed-demo
import { seedDemoData } from "../lib/demo";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const r = await seedDemoData();
  console.log(`✅ demo seeded — ${r.brands} voices, ${r.documents} documents, ${r.citations} citations`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
