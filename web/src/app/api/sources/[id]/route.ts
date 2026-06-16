import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";

export const runtime = "nodejs";

// DELETE /api/sources/:id — remove a single source.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await db.delete(schema.sources).where(eq(schema.sources.id, id));
  return new NextResponse(null, { status: 204 });
}
