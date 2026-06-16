// Tiered OpenRouter model catalog. The consensus router picks from here based
// on task complexity and the active ROUTING_PROFILE, optimizing for the best
// quality per token. Prices are approximate USD per 1M tokens (in/out) and are
// only used for relative cost-efficiency ranking, not billing.

export type Tier = "cheap" | "balanced" | "quality";

export type ModelSpec = {
  id: string; // OpenRouter model id
  tier: Tier;
  inPrice: number; // $/Mtok input
  outPrice: number; // $/Mtok output
  strengths: string[]; // tasks this model is good at
};

export const CATALOG: ModelSpec[] = [
  {
    id: "openai/gpt-4o-mini",
    tier: "cheap",
    inPrice: 0.15,
    outPrice: 0.6,
    strengths: ["classify", "score", "extract", "shortform"],
  },
  {
    id: "google/gemini-2.5-flash",
    tier: "cheap",
    inPrice: 0.3,
    outPrice: 2.5,
    strengths: ["classify", "ground", "extract", "shortform"],
  },
  {
    id: "anthropic/claude-3.5-haiku",
    tier: "balanced",
    inPrice: 0.8,
    outPrice: 4,
    strengths: ["shortform", "rewrite", "ground", "voice"],
  },
  {
    id: "openai/gpt-4o",
    tier: "balanced",
    inPrice: 2.5,
    outPrice: 10,
    strengths: ["longform", "voice", "rewrite", "headline"],
  },
  {
    id: "anthropic/claude-sonnet-4",
    tier: "quality",
    inPrice: 3,
    outPrice: 15,
    strengths: ["longform", "voice", "reasoning", "ground"],
  },
];

export type RoutingProfile = "cheap" | "balanced" | "quality";

export function activeProfile(): RoutingProfile {
  const p = (process.env.ROUTING_PROFILE ?? "balanced").toLowerCase();
  if (p === "cheap" || p === "quality") return p;
  return "balanced";
}

// Map a task to how much it benefits from cross-checking and which tier it needs.
export type TaskComplexity = "trivial" | "standard" | "high";

const TASK_COMPLEXITY: Record<string, TaskComplexity> = {
  score: "trivial",
  classify: "trivial",
  "voice-match": "trivial",
  headline: "standard",
  rewrite: "standard",
  repurpose: "standard",
  complete: "standard",
  longform: "high",
  ground: "high", // factual claims — cross-check matters most here
};

export function complexityFor(task: string): TaskComplexity {
  return TASK_COMPLEXITY[task] ?? "standard";
}

function pricePerCall(m: ModelSpec): number {
  // Rough expected cost weighting (assume ~3:1 output:input for generation).
  return m.inPrice + m.outPrice * 3;
}

// Pick the panel of models to consult for a task. Token-efficiency rule:
// - trivial → 1 cheapest capable model
// - standard → 1 model at the profile tier (+ matching strength preferred)
// - high → a small consensus panel spanning tiers, capped by profile
export function selectPanel(task: string): ModelSpec[] {
  const profile = activeProfile();
  const complexity = complexityFor(task);
  const strengthMatch = (m: ModelSpec) =>
    m.strengths.some((s) => task.includes(s) || s.includes(task));

  const byEfficiency = [...CATALOG].sort(
    (a, b) => pricePerCall(a) - pricePerCall(b),
  );

  if (complexity === "trivial") {
    const capable = byEfficiency.filter(strengthMatch);
    return [capable[0] ?? byEfficiency[0]];
  }

  if (complexity === "standard") {
    const tier: Tier = profile === "quality" ? "quality" : profile === "cheap" ? "cheap" : "balanced";
    const pool = CATALOG.filter((m) => m.tier === tier);
    const pick = pool.find(strengthMatch) ?? pool[0] ?? byEfficiency[0];
    return [pick];
  }

  // high complexity → consensus panel
  if (profile === "cheap") {
    // two cheap+balanced models cross-check
    return dedupe([
      CATALOG.find((m) => m.tier === "cheap" && strengthMatch(m)) ?? CATALOG[0],
      CATALOG.find((m) => m.tier === "balanced") ?? CATALOG[3],
    ]);
  }
  if (profile === "quality") {
    return dedupe([
      CATALOG.find((m) => m.tier === "quality") ?? CATALOG[4],
      CATALOG.find((m) => m.tier === "balanced" && strengthMatch(m)) ?? CATALOG[3],
      CATALOG.find((m) => m.tier === "cheap" && strengthMatch(m)) ?? CATALOG[1],
    ]);
  }
  // balanced
  return dedupe([
    CATALOG.find((m) => m.tier === "balanced" && strengthMatch(m)) ?? CATALOG[3],
    CATALOG.find((m) => m.tier === "quality") ?? CATALOG[4],
  ]);
}

// A cheap model to act as the judge that picks the best candidate.
export function judgeModel(): string {
  return "google/gemini-2.5-flash";
}

function dedupe(models: ModelSpec[]): ModelSpec[] {
  const seen = new Set<string>();
  return models.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
}

export function estimateCost(
  modelId: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const m = CATALOG.find((x) => x.id === modelId);
  if (!m) return 0;
  return (promptTokens * m.inPrice + completionTokens * m.outPrice) / 1_000_000;
}
