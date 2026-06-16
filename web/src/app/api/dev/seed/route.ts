// DEMO ONLY — delete the `api/dev/` folder to remove demo seeding endpoints.
import { NextResponse } from "next/server";
import { seedDemoData } from "@/lib/demo";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  try {
    const result = await seedDemoData();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
