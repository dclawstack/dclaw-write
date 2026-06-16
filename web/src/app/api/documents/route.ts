import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db, schema } from "@/db/client";

export const runtime = "nodejs";

// GET /api/documents — list
export async function GET() {
  const items = await db
    .select()
    .from(schema.documents)
    .orderBy(desc(schema.documents.updatedAt));
  return NextResponse.json({ items, total: items.length });
}

// POST /api/documents — create  { title?, brandProfileId? }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const [created] = await db
    .insert(schema.documents)
    .values({
      title: body.title ?? "Untitled",
      brandProfileId: body.brandProfileId ?? null,
      content: body.content ?? "",
    })
    .returning();
  return NextResponse.json(created, { status: 201 });
}
