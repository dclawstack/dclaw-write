import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db, schema } from "@/db/client";

export const runtime = "nodejs";

// GET /api/brand-profiles — list
export async function GET() {
  const items = await db
    .select()
    .from(schema.brandProfiles)
    .orderBy(desc(schema.brandProfiles.updatedAt));
  return NextResponse.json({ items, total: items.length });
}

// POST /api/brand-profiles — create  { name, description? }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const [created] = await db
    .insert(schema.brandProfiles)
    .values({ name: body.name, description: body.description ?? null })
    .returning();
  return NextResponse.json(created, { status: 201 });
}
