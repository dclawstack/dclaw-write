import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { generate } from "@/lib/consensus";
import { buildStylePrompt } from "@/lib/voice-dna";
import { ChatMessage } from "@/lib/openrouter";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/ai/generate
// { task, prompt, brandProfileId?, instruction?, maxTokens? }
// Runs the consensus router (single model or cross-checked panel by task),
// logs token/cost/agreement, returns the chosen output + metadata.
export async function POST(req: NextRequest) {
  const t0 = Date.now();
  const body = await req.json().catch(() => ({}));
  const task: string = body.task ?? "longform";
  const prompt: string = body.prompt ?? "";
  if (!prompt.trim()) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  let features = null;
  let bigrams = null;
  if (body.brandProfileId) {
    const [p] = await db
      .select()
      .from(schema.brandProfiles)
      .where(eq(schema.brandProfiles.id, body.brandProfileId))
      .limit(1);
    if (p) {
      features = p.styleFeatures as Record<string, number>;
      bigrams = p.bigramSignature as Record<string, number>;
    }
  }

  const messages: ChatMessage[] = [
    { role: "system", content: buildStylePrompt(features, bigrams, body.instruction) },
    { role: "user", content: prompt },
  ];

  let result;
  try {
    result = await generate(task, messages, { maxTokens: body.maxTokens ?? 1024 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }

  // Best-effort logging — never fail the request on a log write.
  try {
    await db.insert(schema.generations).values({
      task,
      models: result.modelsConsulted,
      chosenModel: result.chosenModel,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      costUsd: result.costUsd,
      agreement: result.agreement,
      latencyMs: Date.now() - t0,
    });
  } catch {
    /* ignore */
  }

  return NextResponse.json(result);
}
