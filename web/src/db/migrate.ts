// Applies generated SQL migrations to Neon. Also ensures pgvector + _meta exist.
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const sql = neon(url);

  // Prerequisites the generated migration assumes.
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;
  await sql`CREATE SCHEMA IF NOT EXISTS "_meta"`;

  const db = drizzle(sql);
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("✅ migrations applied");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
