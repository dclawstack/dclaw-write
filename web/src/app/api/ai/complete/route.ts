import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { chatStream, ChatMessage } from "@/lib/openrouter";
import { buildStylePrompt } from "@/lib/voice-dna";
import { selectPanel } from "@/lib/models";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/ai/complete  { prompt, brandProfileId?, instruction?, maxTokens? }
// Streams a voice-constrained continuation of `prompt`.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const prompt: string = body.prompt ?? "";
  if (!prompt.trim()) {
    return new Response("prompt is required", { status: 400 });
  }

  let features = null;
  let bigrams = null;
  if (body.brandProfileId) {
    const [profile] = await db
      .select()
      .from(schema.brandProfiles)
      .where(eq(schema.brandProfiles.id, body.brandProfileId))
      .limit(1);
    if (profile) {
      features = profile.styleFeatures as Record<string, number>;
      bigrams = profile.bigramSignature as Record<string, number>;
    }
  }

  const system = buildStylePrompt(features, bigrams, body.instruction);
  const messages: ChatMessage[] = [
    { role: "system", content: system },
    { role: "user", content: recentContext(prompt) },
  ];

  // "complete" is a standard task → single best-fit model, streamed.
  const model = selectPanel("complete")[0].id;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of chatStream(model, messages, {
          maxTokens: body.maxTokens ?? 400,
          temperature: body.temperature ?? 0.7,
        })) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (e) {
        controller.enqueue(encoder.encode(`\n[error: ${(e as Error).message}]`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Model": model,
    },
  });
}

const MAX_CONTEXT_WORDS = 320;
function recentContext(text: string): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= MAX_CONTEXT_WORDS) return text.trim();
  return words.slice(-MAX_CONTEXT_WORDS).join(" ");
}
