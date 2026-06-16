import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { fitProfile } from "@/lib/voice-dna";
import { embed } from "@/lib/openrouter";

export const runtime = "nodejs";

// POST /api/brand-profiles/:id/samples  { text, label?, sourceUrl? }
// Adds a sample, then refits the brand profile (features + bigrams + embedding).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (!body.text?.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const wordCount = (body.text.match(/\b[\w'\-]+\b/gu) ?? []).length;
  await db.insert(schema.voiceSamples).values({
    brandProfileId: id,
    text: body.text,
    label: body.label ?? null,
    sourceUrl: body.sourceUrl ?? null,
    wordCount,
  });

  const samples = await db
    .select()
    .from(schema.voiceSamples)
    .where(eq(schema.voiceSamples.brandProfileId, id));
  const texts = samples.map((s) => s.text);
  const { styleFeatures, bigramSignature, totalWords } = fitProfile(texts);

  // Semantic voice centroid — best-effort; degrades gracefully without a key.
  let voiceEmbedding: number[] | null = null;
  try {
    const joined = texts.join("\n\n").slice(0, 24000);
    if (joined.trim()) voiceEmbedding = (await embed(joined)).vector;
  } catch {
    voiceEmbedding = null;
  }

  const [updated] = await db
    .update(schema.brandProfiles)
    .set({
      styleFeatures,
      bigramSignature,
      sampleCount: samples.length,
      totalWords,
      ...(voiceEmbedding ? { voiceEmbedding } : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.brandProfiles.id, id))
    .returning();

  return NextResponse.json(updated, { status: 201 });
}
