// Consensus router. For trivial/standard tasks it runs a single best-fit model
// (cheapest capable). For high-stakes tasks it consults a small panel in
// parallel and uses a cheap judge to pick the strongest answer, recording an
// agreement score. This buys quality where it matters while staying
// token-efficient everywhere else.

import { chat, ChatMessage } from "./openrouter";
import {
  selectPanel,
  judgeModel,
  estimateCost,
  complexityFor,
} from "./models";

export type ConsensusResult = {
  text: string;
  chosenModel: string;
  modelsConsulted: string[];
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  agreement: number; // 1 = single model / unanimous; lower = more divergence
};

export async function generate(
  task: string,
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number } = {},
): Promise<ConsensusResult> {
  const panel = selectPanel(task);

  // Single-model fast path.
  if (panel.length === 1) {
    const r = await chat(panel[0].id, messages, opts);
    return {
      text: r.text,
      chosenModel: r.model,
      modelsConsulted: [panel[0].id],
      promptTokens: r.promptTokens,
      completionTokens: r.completionTokens,
      costUsd: estimateCost(panel[0].id, r.promptTokens, r.completionTokens),
      agreement: 1,
    };
  }

  // Consensus path — run the panel in parallel.
  const settled = await Promise.allSettled(
    panel.map((m) => chat(m.id, messages, opts)),
  );
  const candidates = settled
    .map((s, i) => (s.status === "fulfilled" ? { ...s.value, modelId: panel[i].id } : null))
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (candidates.length === 0) throw new Error("All panel models failed");
  if (candidates.length === 1) {
    const c = candidates[0];
    return {
      text: c.text,
      chosenModel: c.modelId,
      modelsConsulted: panel.map((m) => m.id),
      promptTokens: c.promptTokens,
      completionTokens: c.completionTokens,
      costUsd: estimateCost(c.modelId, c.promptTokens, c.completionTokens),
      agreement: 1,
    };
  }

  // Judge picks the best candidate (cheap model, tiny prompt).
  const judged = await judge(task, messages, candidates.map((c) => c.text));

  const promptTokens = candidates.reduce((s, c) => s + c.promptTokens, 0) + judged.promptTokens;
  const completionTokens =
    candidates.reduce((s, c) => s + c.completionTokens, 0) + judged.completionTokens;
  const cost =
    candidates.reduce((s, c) => s + estimateCost(c.modelId, c.promptTokens, c.completionTokens), 0) +
    estimateCost(judgeModel(), judged.promptTokens, judged.completionTokens);

  const chosen = candidates[judged.index] ?? candidates[0];
  return {
    text: chosen.text,
    chosenModel: chosen.modelId,
    modelsConsulted: candidates.map((c) => c.modelId),
    promptTokens,
    completionTokens,
    costUsd: cost,
    agreement: judged.agreement,
  };
}

async function judge(
  task: string,
  original: ChatMessage[],
  candidates: string[],
): Promise<{ index: number; agreement: number; promptTokens: number; completionTokens: number }> {
  const userAsk = original.filter((m) => m.role === "user").map((m) => m.content).join("\n");
  const list = candidates
    .map((c, i) => `--- Candidate ${i + 1} ---\n${c}`)
    .join("\n\n");
  const prompt: ChatMessage[] = [
    {
      role: "system",
      content:
        "You are a strict editorial judge. Given a task and several candidate outputs, " +
        "choose the single best one. Reply with ONLY a JSON object: " +
        '{"best": <1-based index>, "confidence": <0..1>}.',
    },
    {
      role: "user",
      content: `Task type: ${task}\n\nTask:\n${userAsk}\n\n${list}\n\nReturn the JSON.`,
    },
  ];
  const r = await chat(judgeModel(), prompt, { maxTokens: 60, temperature: 0 });
  let index = 0;
  let confidence = 0.5;
  try {
    const m = r.text.match(/\{[\s\S]*\}/);
    if (m) {
      const parsed = JSON.parse(m[0]);
      index = Math.max(0, Math.min(candidates.length - 1, (parsed.best ?? 1) - 1));
      confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0.5;
    }
  } catch {
    // fall back to first candidate
  }
  return {
    index,
    agreement: confidence,
    promptTokens: r.promptTokens,
    completionTokens: r.completionTokens,
  };
}

export { complexityFor };
