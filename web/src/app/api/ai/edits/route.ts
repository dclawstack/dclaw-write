import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db/client";
import { computeFeatures, voiceMatchScore } from "@/lib/voice-dna";

export const runtime = "nodejs";

// POST /api/ai/edits  { aiText, finalText, documentId?, brandProfileId? }
// THE MOAT: every time a user edits AI output, capture before/after so each
// brand's voice model can learn from real corrections over time.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const aiText: string = body.aiText ?? "";
  const finalText: string = body.finalText ?? "";
  if (!aiText.trim() || !finalText.trim()) {
    return NextResponse.json({ error: "aiText and finalText are required" }, { status: 400 });
  }
  if (aiText.trim() === finalText.trim()) {
    // No correction — nothing to learn.
    return NextResponse.json({ captured: false });
  }

  // Lightweight learning signal: how far the kept text drifted from the AI's,
  // measured in the same style space the model is graded on.
  const aiFeatures = computeFeatures(aiText);
  const finalFeatures = computeFeatures(finalText);
  const styleDrift =
    100 - voiceMatchScore(aiFeatures, {}, finalFeatures, {}); // 0 = identical style

  const [row] = await db
    .insert(schema.aiEdits)
    .values({
      documentId: body.documentId ?? null,
      brandProfileId: body.brandProfileId ?? null,
      aiText,
      finalText,
      metrics: {
        styleDrift,
        editRatio: 1 - similarity(aiText, finalText),
        aiFeatures,
        finalFeatures,
      },
    })
    .returning();

  return NextResponse.json({ captured: true, id: row.id, styleDrift });
}

// Cheap token-set Jaccard as an edit-distance proxy.
function similarity(a: string, b: string): number {
  const ta = new Set(a.toLowerCase().split(/\s+/));
  const tb = new Set(b.toLowerCase().split(/\s+/));
  const inter = [...ta].filter((x) => tb.has(x)).length;
  const union = new Set([...ta, ...tb]).size;
  return union ? inter / union : 0;
}
