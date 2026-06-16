// DEMO ONLY — delete the `api/dev/` folder to remove demo seeding endpoints.
import { NextResponse } from "next/server";
import { demoStatus } from "@/lib/demo";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(await demoStatus());
  } catch (e) {
    return NextResponse.json({ brands: 0, documents: 0, error: (e as Error).message }, { status: 200 });
  }
}
