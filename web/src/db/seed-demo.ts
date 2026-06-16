// Seeds a demo brand voice + document + sources so the deployed app is
// instantly demoable. Idempotent-ish: skips if a demo brand already exists.
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { brandProfiles, voiceSamples, documents, sources } from "./schema";
import { fitProfile } from "../lib/voice-dna";

const SAMPLE_VOICE = `We don't ship features. We ship outcomes.

Every release starts with a question: what does the customer actually need to get done today? Not next quarter — today. We strip the idea to its smallest honest version, put it in front of real people, and watch. The data tells us what to keep.

This is how we move fast without breaking trust. Small bets, measured. Ship, learn, repeat.`;

const DEMO_DRAFT = `Content marketing is a four hundred billion dollar industry. Most teams still write everything by hand, which is slow and expensive. AI tools promise speed but produce generic copy that sounds like every other brand. The result is content nobody trusts.`;

const DEMO_SOURCE = `The global content marketing industry was valued at approximately 400 billion USD and is projected to keep growing. Surveys of marketing teams consistently report that producing enough high-quality content is their top challenge, and that generic AI output and factual accuracy are leading concerns when adopting AI writing tools.`;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const db = drizzle(neon(url));

  const existing = await db
    .select()
    .from(brandProfiles)
    .where(eq(brandProfiles.name, "Acme (demo voice)"))
    .limit(1);
  if (existing.length) {
    console.log("demo already seeded — skipping");
    return;
  }

  const fit = fitProfile([SAMPLE_VOICE]);
  const [profile] = await db
    .insert(brandProfiles)
    .values({
      name: "Acme (demo voice)",
      description: "Punchy, outcome-driven B2B SaaS voice.",
      styleFeatures: fit.styleFeatures,
      bigramSignature: fit.bigramSignature,
      sampleCount: 1,
      totalWords: fit.totalWords,
    })
    .returning();

  await db.insert(voiceSamples).values({
    brandProfileId: profile.id,
    label: "Manifesto",
    text: SAMPLE_VOICE,
    wordCount: fit.totalWords,
  });

  const [doc] = await db
    .insert(documents)
    .values({
      title: "Why content teams don't trust AI",
      content: DEMO_DRAFT,
      brandProfileId: profile.id,
      status: "draft",
    })
    .returning();

  await db.insert(sources).values({
    documentId: doc.id,
    title: "Content marketing market size",
    origin: "paste",
    text: DEMO_SOURCE,
  });

  console.log(`✅ demo seeded — brand ${profile.id}, doc ${doc.id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
