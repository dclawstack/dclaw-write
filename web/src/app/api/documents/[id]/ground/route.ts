import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { groundDraft } from "@/lib/grounding";
import { webSearch, webSearchEnabled } from "@/lib/websearch";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/documents/:id/ground
// Verifies every checkable claim in the document against its sources.
// Persists citations and flips status to "grounded" only if nothing is unsupported.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const [doc] = await db
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.id, id))
    .limit(1);
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Optionally pull live web sources to ground against, not just pasted ones.
  if (body.useWeb && webSearchEnabled()) {
    const hits = await webSearch(doc.title + "\n" + doc.content.slice(0, 300));
    if (hits.length) {
      await db.insert(schema.sources).values(
        hits.map((h) => ({
          documentId: id,
          title: h.title,
          url: h.url,
          origin: "web",
          text: h.text,
        })),
      );
    }
  }

  const srcRows = await db
    .select()
    .from(schema.sources)
    .where(eq(schema.sources.documentId, id));

  if (!srcRows.length) {
    return NextResponse.json(
      { error: "no sources attached — add sources or enable web search" },
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
