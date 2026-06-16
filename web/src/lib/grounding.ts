// Citation grounding. Splits a draft into checkable claims, retrieves the most
// relevant source passages, and asks a cheap model whether each claim is
// supported. Claims below the confidence threshold are flagged as unsupported —
// the product guarantee is that those cannot be "published".

import { chat } from "./openrouter";
import { cosine } from "./voice-dna";
import { embed } from "./openrouter";

export const SUPPORT_THRESHOLD = 0.6;

export type Claim = { text: string };
export type GroundedClaim = {
  claim: string;
  supported: boolean;
  confidence: number;
  quote: string | null;
  sourceIndex: number | null;
};

// Sentence-ish split. Skips questions, headings and very short fragments —
// those aren't factual claims that need a source.
export function extractClaims(draft: string): Claim[] {
  const sentences = draft
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return sentences
    .filter((s) => s.split(/\s+/).length >= 6 && !s.endsWith("?"))
    .map((text) => ({ text }));
}

type Chunk = { sourceIndex: number; text: string; vector?: number[] };

function chunkSources(sources: { text: string }[]): Chunk[] {
  const chunks: Chunk[] = [];
  sources.forEach((src, sourceIndex) => {
    const paras = src.text.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean);
    for (const p of paras.length ? paras : [src.text]) {
      // keep chunks reasonable
      for (let i = 0; i < p.length; i += 1200) {
        chunks.push({ sourceIndex, text: p.slice(i, i + 1200) });
      }
    }
  });
  return chunks;
}

async function retrieve(claim: string, chunks: Chunk[], topK = 3): Promise<Chunk[]> {
  if (!chunks.length) return [];
  try {
    const { vector: cv } = await embed(claim);
    for (const c of chunks) {
      if (!c.vector) c.vector = (await embed(c.text.slice(0, 2000))).vector;
    }
    return [...chunks]
      .map((c) => ({ c, score: cosine(cv, c.vector!) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((x) => x.c);
  } catch {
    // No embeddings (missing key) → fall back to keyword overlap.
    const terms = new Set(claim.toLowerCase().split(/\s+/).filter((w) => w.length > 4));
    return [...chunks]
      .map((c) => {
        const lc = c.text.toLowerCase();
        const score = [...terms].filter((t) => lc.includes(t)).length;
        return { c, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((x) => x.c);
  }
}

const GROUND_MODEL = "google/gemini-2.5-flash"; // cheap, good at extraction

async function checkClaim(claim: string, passages: Chunk[]): Promise<GroundedClaim> {
  if (!passages.length) {
    return { claim, supported: false, confidence: 0, quote: null, sourceIndex: null };
  }
  const context = passages
    .map((p, i) => `[Passage ${i + 1} | source ${p.sourceIndex + 1}]\n${p.text}`)
    .join("\n\n");
  const r = await chat(
    GROUND_MODEL,
    [
      {
        role: "system",
        content:
          "You verify whether a CLAIM is supported by the provided PASSAGES. " +
          "Only use the passages. Reply ONLY with JSON: " +
          '{"supported": bool, "confidence": 0..1, "quote": "<exact supporting text or empty>", "passage": <1-based index or 0>}.',
      },
      { role: "user", content: `CLAIM: ${claim}\n\nPASSAGES:\n${context}\n\nJSON:` },
    ],
    { maxTokens: 200, temperature: 0 },
  );
  try {
    const m = r.text.match(/\{[\s\S]*\}/);
    if (m) {
      const p = JSON.parse(m[0]);
      const idx = (p.passage ?? 0) - 1;
      const sourceIndex = idx >= 0 && idx < passages.length ? passages[idx].sourceIndex : null;
      const confidence = Math.max(0, Math.min(1, Number(p.confidence) || 0));
      return {
        claim,
        supported: Boolean(p.supported) && confidence >= SUPPORT_THRESHOLD,
        confidence,
        quote: p.quote || null,
        sourceIndex,
      };
    }
  } catch {
    /* fall through */
  }
  return { claim, supported: false, confidence: 0, quote: null, sourceIndex: null };
}

export async function groundDraft(
  draft: string,
  sources: { text: string }[],
): Promise<{ claims: GroundedClaim[]; unsupported: number; coverage: number }> {
  const claims = extractClaims(draft);
  const chunks = chunkSources(sources);
  const results: GroundedClaim[] = [];
  for (const { text } of claims) {
    const passages = await retrieve(text, chunks);
    results.push(await checkClaim(text, passages));
  }
  const unsupported = results.filter((r) => !r.supported).length;
  const coverage = results.length ? (results.length - unsupported) / results.length : 1;
  return { claims: results, unsupported, coverage };
}
