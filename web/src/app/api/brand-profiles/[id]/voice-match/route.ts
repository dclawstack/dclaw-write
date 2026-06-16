import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { computeFeatures, voiceMatchScore, cosine } from "@/lib/voice-dna";
import { embed } from "@/lib/openrouter";

export const runtime = "nodejs";

// POST /api/brand-profiles/:id/voice-match  { text }
// Returns a blended score: statistical style match + semantic (embedding) match.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const text: string = body.text ?? "";
  if (!text.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const [profile] = await db
    .select()
    .from(schema.brandProfiles)
    .where(eq(schema.brandProfiles.id, id))
    .limit(1);
  if (!profile) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const sampleFeatures = computeFeatures(text);
  const statScore = voiceMatchScore(
    sampleFeatures,
    {},
    profile.styleFeatures as Record<string, number>,
    profile.bigramSignature as Record<string, number>,
  );

  // Semantic match — only if we have a stored voice embedding and a live key.
  let semanticScore: number | null = null;
  const voiceEmbedding = profile.voiceEmbedding as number[] | null;
  if (voiceEmbedding && voiceEmbedding.length) {
    try {
      const { vector } = await embed(text.slice(0, 8000));
      semanticScore = Math.round(Math.max(0, cosine(vector, voiceEmbedding)) * 100);
    } catch {
      semanticScore = null;
    }
  }

  const score =
    semanticScore === null
      ? statScore
      : Math.round(0.45 * statScore + 0.55 * semanticScore);

  return NextResponse.json({
    score,
    statScore,
    semanticScore,
    sampleFeatures,
  });
}
