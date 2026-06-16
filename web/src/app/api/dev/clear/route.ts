// DEMO ONLY — delete the `api/dev/` folder to remove demo seeding endpoints.
import { NextResponse } from "next/server";
import { clearAllData } from "@/lib/demo";

export const runtime = "nodejs";

export async function POST() {
  try {
    await clearAllData();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
