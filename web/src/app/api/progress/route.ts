import { NextResponse } from "next/server";
import { db, schema } from "@/db/client";

export const runtime = "nodejs";

// GET /api/progress — reads the DB-backed build tracker (_meta.progress).
export async function GET() {
  try {
    const rows = await db.select().from(schema.progress);
    const byMilestone: Record<string, typeof rows> = {};
    for (const r of rows) (byMilestone[r.milestone] ??= []).push(r);
    const done = rows.filter((r) => r.status === "done").length;
    return NextResponse.json({
      summary: {
        total: rows.length,
        done,
        pct: rows.length ? Math.round((done / rows.length) * 100) : 0,
      },
      milestones: Object.entries(byMilestone)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([milestone, tasks]) => ({ milestone, tasks })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message, hint: "DB not configured yet" },
      { status: 503 },
    );
  }
}
