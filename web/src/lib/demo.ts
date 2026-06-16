// ============================================================================
// DEMO DATA — easy to remove later.
// Delete this file, the `src/app/api/dev/` folder, and the <DemoControls/>
// block in `src/app/page.tsx` to strip all demo seeding from the app.
// ============================================================================
import { db, schema } from "../db/client";
import { fitProfile } from "./voice-dna";
import { embed } from "./openrouter";

type VoiceSeed = { name: string; description: string; sample: string };

const VOICES: VoiceSeed[] = [
  {
    name: "Acme (demo voice)",
    description: "Punchy, outcome-driven B2B SaaS voice.",
    sample: `We don't ship features. We ship outcomes.

Every release starts with a question: what does the customer actually need to get done today? Not next quarter — today. We strip the idea to its smallest honest version, put it in front of real people, and watch. The data tells us what to keep.

This is how we move fast without breaking trust. Small bets, measured. Ship, learn, repeat.`,
  },
  {
    name: "Northwind Health",
    description: "Clear, reassuring, jargon-free healthcare voice.",
    sample: `Your health is personal. So is your plan.

We start by listening — really listening — to what matters to you. Then we build care around your life, not the other way around. No jargon. No surprises. Just steady, human support when you need it most.

You should never need a medical degree to understand your own care. We make it plain.`,
  },
  {
    name: "Forge Dev Tools",
    description: "Bold, no-nonsense developer-tools voice.",
    sample: `Ship it. Then ship it again.

Developers don't want hand-holding; they want power and a path out of their own way. We build sharp tools with sane defaults, zero ceremony, and docs that respect your time.

Less talking. More building. If a feature needs a tutorial, we designed it wrong.`,
  },
];

type DocSeed = {
  voice: string; // matches a VoiceSeed.name
  title: string;
  content: string;
  status: "draft" | "grounded" | "published";
  voiceMatch: number;
  sources: { title: string; text: string; url?: string }[];
  citations?: { claim: string; quote: string | null; supported: boolean; confidence: number }[];
};

const DOCS: DocSeed[] = [
  {
    voice: "Acme (demo voice)",
    title: "Why content teams don't trust AI",
    status: "draft",
    voiceMatch: 71,
    content: `Content marketing is a four hundred billion dollar industry. Most teams still write everything by hand, which is slow and expensive. AI tools promise speed but produce generic copy that sounds like every other brand. The result is content nobody trusts.`,
    sources: [
      {
        title: "Content marketing market size",
        text: `The global content marketing industry was valued at approximately 400 billion USD and is projected to keep growing. Surveys of marketing teams consistently report that producing enough high-quality content is their top challenge, and that generic AI output and factual accuracy are leading concerns when adopting AI writing tools.`,
      },
    ],
  },
  {
    voice: "Acme (demo voice)",
    title: "The hidden cost of generic content",
    status: "grounded",
    voiceMatch: 88,
    content: `Brands publish more content than ever, yet engagement keeps falling. The reason is sameness: when every article reads like it came from the same prompt, readers tune out. Voice is the moat. The teams that win treat their distinct voice as an asset and protect it on every page.`,
    sources: [
      {
        title: "Engagement decline report",
        text: `Industry benchmarks show average content engagement rates declining year over year as publishing volume rises. Differentiated brand voice and original perspective are repeatedly cited as the strongest predictors of above-average engagement.`,
      },
    ],
    citations: [
      {
        claim: "Brands publish more content than ever, yet engagement keeps falling.",
        quote: "average content engagement rates declining year over year as publishing volume rises",
        supported: true,
        confidence: 0.92,
      },
      {
        claim: "Voice is the moat.",
        quote: "Differentiated brand voice ... strongest predictors of above-average engagement",
        supported: true,
        confidence: 0.81,
      },
    ],
  },
  {
    voice: "Northwind Health",
    title: "Understanding your annual checkup",
    status: "draft",
    voiceMatch: 64,
    content: `An annual checkup is a chance to catch small things before they become big ones. Your provider will review your history, take a few basic measurements, and talk through anything on your mind. Most visits take less than an hour, and you leave with a clear, simple plan.`,
    sources: [
      {
        title: "Preventive care overview",
        text: `Annual preventive visits typically include a review of medical history, vital-sign measurements such as blood pressure, and a discussion of screenings appropriate for the patient's age. Routine checkups commonly last under one hour.`,
      },
    ],
  },
  {
    voice: "Forge Dev Tools",
    title: "Why we rewrote our CLI from scratch",
    status: "published",
    voiceMatch: 90,
    content: `Our old CLI grew by accretion until nobody could explain it. So we deleted it. The rewrite has one rule: every command does exactly what it says, with sane defaults and zero ceremony. Startup time dropped, the docs got shorter, and onboarding stopped needing a tutorial.`,
    sources: [],
  },
];

async function bestEffortEmbedding(text: string): Promise<number[] | null> {
  try {
    return (await embed(text)).vector;
  } catch {
    return null;
  }
}

/** Wipe all app data (keeps the _meta build tracker). Returns deleted-from tables. */
export async function clearAllData(): Promise<void> {
  // child → parent order (FKs cascade, but explicit is safe).
  await db.delete(schema.citations);
  await db.delete(schema.sources);
  await db.delete(schema.aiEdits);
  await db.delete(schema.embeddings);
  await db.delete(schema.generations);
  await db.delete(schema.voiceSamples);
  await db.delete(schema.documents);
  await db.delete(schema.brandProfiles);
}

/** Reset to the canonical demo state (clears first, then seeds). */
export async function seedDemoData(): Promise<{
  brands: number;
  documents: number;
  citations: number;
}> {
  await clearAllData();

  const brandIdByName = new Map<string, string>();

  for (const v of VOICES) {
    const fit = fitProfile([v.sample]);
    const voiceEmbedding = await bestEffortEmbedding(v.sample);
    const [brand] = await db
      .insert(schema.brandProfiles)
      .values({
        name: v.name,
        description: v.description,
        styleFeatures: fit.styleFeatures,
        bigramSignature: fit.bigramSignature,
        sampleCount: 1,
        totalWords: fit.totalWords,
        ...(voiceEmbedding ? { voiceEmbedding } : {}),
      })
      .returning();
    brandIdByName.set(v.name, brand.id);
    await db.insert(schema.voiceSamples).values({
      brandProfileId: brand.id,
      label: "Brand sample",
      text: v.sample,
      wordCount: fit.totalWords,
    });
  }

  let citationCount = 0;
  for (const d of DOCS) {
    const [doc] = await db
      .insert(schema.documents)
      .values({
        title: d.title,
        content: d.content,
        status: d.status,
        voiceMatch: d.voiceMatch,
        brandProfileId: brandIdByName.get(d.voice) ?? null,
      })
      .returning();

    const sourceIds: string[] = [];
    for (const s of d.sources) {
      const [src] = await db
        .insert(schema.sources)
        .values({ documentId: doc.id, title: s.title, url: s.url ?? null, origin: "paste", text: s.text })
        .returning();
      sourceIds.push(src.id);
    }

    for (const c of d.citations ?? []) {
      await db.insert(schema.citations).values({
        documentId: doc.id,
        sourceId: sourceIds[0] ?? null,
        claim: c.claim,
        quote: c.quote,
        confidence: c.confidence,
        supported: c.supported,
      });
      citationCount++;
    }
  }

  // The moat: a captured edit showing the user correcting AI voice.
  const acmeId = brandIdByName.get("Acme (demo voice)") ?? null;
  await db.insert(schema.aiEdits).values({
    brandProfileId: acmeId,
    aiText:
      "In today's fast-paced digital landscape, leveraging AI-powered solutions can synergistically enhance your content strategy.",
    finalText: "AI should make your content sharper, not blander. Use it to move faster — not to sound like everyone else.",
    metrics: { styleDrift: 74, editRatio: 0.86 },
  });

  // Consensus usage logs, so the metrics have something to show.
  await db.insert(schema.generations).values([
    { task: "complete", models: ["openai/gpt-4o"], chosenModel: "openai/gpt-4o", promptTokens: 320, completionTokens: 140, costUsd: 0.0022, agreement: 1, latencyMs: 1900 },
    { task: "headline", models: ["anthropic/claude-3.5-haiku"], chosenModel: "anthropic/claude-3.5-haiku", promptTokens: 75, completionTokens: 18, costUsd: 0.00013, agreement: 1, latencyMs: 850 },
    { task: "ground", models: ["google/gemini-2.5-flash", "anthropic/claude-sonnet-4"], chosenModel: "anthropic/claude-sonnet-4", promptTokens: 1450, completionTokens: 210, costUsd: 0.0075, agreement: 0.86, latencyMs: 3200 },
  ]);

  return { brands: VOICES.length, documents: DOCS.length, citations: citationCount };
}

/** Current data counts, for the demo controls to show state. */
export async function demoStatus(): Promise<{ brands: number; documents: number }> {
  const brands = await db.select({ id: schema.brandProfiles.id }).from(schema.brandProfiles);
  const documents = await db.select({ id: schema.documents.id }).from(schema.documents);
  return { brands: brands.length, documents: documents.length };
}
