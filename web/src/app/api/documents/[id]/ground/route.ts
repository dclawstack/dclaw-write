import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { groundDraft } from "@/lib/grounding";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/documents/:id/ground
// Verifies every checkable claim in the document against its sources.
// Persists citations and flips status to "grounded" only if nothing is unsupported.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const [doc] = await db
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.id, id))
    .limit(1);
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });

  const srcRows = await db
    .select()
    .from(schema.sources)
    .where(eq(schema.sources.documentId, id));

  if (!srcRows.length) {
    return NextResponse.json(
      { error: "no sources attached — add sources before grounding" },
      { status: 400 },
    );
  }

  const { claims, unsupported, coverage } = await groundDraft(
    doc.content,
    srcRows.map((s) => ({ text: s.text })),
  );

  // Replace prior citations for this doc.
  await db.delete(schema.citations).where(eq(schema.citations.documentId, id));
  if (claims.length) {
    await db.insert(schema.citations).values(
      claims.map((c) => ({
        documentId: id,
        sourceId: c.sourceIndex !== null ? srcRows[c.sourceIndex].id : null,
        claim: c.claim,
        quote: c.quote,
        confidence: c.confidence,
        supported: c.supported,
      })),
    );
  }

  const status = unsupported === 0 ? "grounded" : "draft";
  await db
    .update(schema.documents)
    .set({ status, updatedAt: new Date() })
    .where(eq(schema.documents.id, id));

  return NextResponse.json({
    coverage,
    unsupported,
    canPublish: unsupported === 0,
    claims,
  });
}
