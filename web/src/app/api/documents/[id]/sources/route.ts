import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";

export const runtime = "nodejs";

// GET — list sources for a document
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const rows = await db
    .select()
    .from(schema.sources)
    .where(eq(schema.sources.documentId, id));
  return NextResponse.json({ items: rows });
}

// POST — attach a source  { text, title?, url?, origin? }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (!body.text?.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  const [created] = await db
    .insert(schema.sources)
    .values({
      documentId: id,
      text: body.text,
      title: body.title ?? null,
      url: body.url ?? null,
      origin: body.origin ?? "paste",
    })
    .returning();
  return NextResponse.json(created, { status: 201 });
}
