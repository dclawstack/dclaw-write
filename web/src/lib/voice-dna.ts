// Voice DNA — statistical style fingerprint. Ported from the original Python
// service. Pure functions, no model calls. Used to (a) constrain generation via
// the style prompt and (b) score how well any text matches a brand profile.

const SENTENCE_SPLIT = /(?<=[.!?])\s+/;
const WORD_RE = /\b[\w'\-]+\b/gu;
const PARAGRAPH_SPLIT = /\n\s*\n+/;
const VOWEL_GROUPS = /[aeiouy]+/gi;

export type StyleFeatures = Record<string, number>;

function words(text: string): string[] {
  return text.match(WORD_RE) ?? [];
}
function splitSentences(text: string): string[] {
  const parts = text.split(SENTENCE_SPLIT).map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : text.trim() ? [text.trim()] : [];
}
function splitParagraphs(text: string): string[] {
  const parts = text.split(PARAGRAPH_SPLIT).map((p) => p.trim()).filter(Boolean);
  return parts.length ? parts : text.trim() ? [text.trim()] : [];
}
function syllables(word: string): number {
  const w = word.toLowerCase().replace(/e$/, "");
  const groups = w.match(VOWEL_GROUPS) ?? [];
  return Math.max(1, groups.length);
}
function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function pstdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}
function round(n: number, d = 3): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

export function fleschReadingEase(text: string): number {
  const sentences = splitSentences(text);
  const w = words(text);
  if (!sentences.length || !w.length) return 0;
  const syl = w.reduce((s, x) => s + syllables(x), 0);
  const asl = w.length / sentences.length;
  const asw = syl / w.length;
  return round(206.835 - 1.015 * asl - 84.6 * asw, 2);
}

const FEATURE_KEYS = [
  "word_count", "sentence_count", "paragraph_count", "mean_sentence_length",
  "std_sentence_length", "mean_word_length", "type_token_ratio",
  "punctuation_density", "comma_density", "semicolon_density", "dash_density",
  "question_density", "exclamation_density", "avg_paragraph_words", "flesch_reading_ease",
];

function emptyFeatures(): StyleFeatures {
  return Object.fromEntries(FEATURE_KEYS.map((k) => [k, 0]));
}

export function computeFeatures(text: string): StyleFeatures {
  if (!text || !text.trim()) return emptyFeatures();
  const sentences = splitSentences(text);
  const w = words(text);
  const paragraphs = splitParagraphs(text);
  if (!w.length) return emptyFeatures();

  const sentenceLengths = sentences.map((s) => words(s).length);
  const wordLengths = w.map((x) => x.length);
  const total = w.length;
  const per100 = (n: number) => round((n / total) * 100, 4);

  const commas = (text.match(/,/g) ?? []).length;
  const semicolons = (text.match(/;/g) ?? []).length;
  const dashes =
    (text.match(/—/g) ?? []).length + (text.match(/–/g) ?? []).length + (text.match(/ - /g) ?? []).length;
  const parens = (text.match(/\(/g) ?? []).length;
  const questions = (text.match(/\?/g) ?? []).length;
  const exclamations = (text.match(/!/g) ?? []).length;
  const totalPunct = commas + semicolons + dashes + parens + questions + exclamations;
  const unique = new Set(w.map((x) => x.toLowerCase())).size;

  return {
    word_count: total,
    sentence_count: sentences.length,
    paragraph_count: paragraphs.length,
    mean_sentence_length: round(mean(sentenceLengths)),
    std_sentence_length: round(pstdev(sentenceLengths)),
    mean_word_length: round(mean(wordLengths)),
    type_token_ratio: round(unique / total, 4),
    punctuation_density: per100(totalPunct),
    comma_density: per100(commas),
    semicolon_density: per100(semicolons),
    dash_density: per100(dashes),
    question_density: per100(questions),
    exclamation_density: per100(exclamations),
    avg_paragraph_words: round(total / Math.max(1, paragraphs.length)),
    flesch_reading_ease: fleschReadingEase(text),
  };
}

export function topBigramSignature(texts: string[], topK = 30): Record<string, number> {
  const counter = new Map<string, number>();
  for (const text of texts) {
    const toks = words(text.toLowerCase());
    for (let i = 0; i < toks.length - 1; i++) {
      const key = `${toks[i]} ${toks[i + 1]}`;
      counter.set(key, (counter.get(key) ?? 0) + 1);
    }
  }
  if (!counter.size) return {};
  const top = [...counter.entries()].sort((a, b) => b[1] - a[1]).slice(0, topK);
  const total = top.reduce((s, [, c]) => s + c, 0);
  return Object.fromEntries(top.map(([k, c]) => [k, round(c / total, 5)]));
}

export function fitProfile(samples: string[]): {
  styleFeatures: StyleFeatures;
  bigramSignature: Record<string, number>;
  totalWords: number;
} {
  const joined = samples.filter((s) => s && s.trim()).join("\n\n");
  return {
    styleFeatures: joined ? computeFeatures(joined) : emptyFeatures(),
    bigramSignature: topBigramSignature(samples),
    totalWords: samples.reduce((s, x) => s + words(x).length, 0),
  };
}

const NUMERIC_WEIGHTS: Record<string, number> = {
  mean_sentence_length: 1.5, std_sentence_length: 0.6, mean_word_length: 1.0,
  type_token_ratio: 1.2, punctuation_density: 0.8, comma_density: 0.8,
  semicolon_density: 0.4, dash_density: 0.4, question_density: 0.3,
  exclamation_density: 0.3, avg_paragraph_words: 0.6, flesch_reading_ease: 1.0,
};
const FEATURE_SCALE: Record<string, number> = {
  mean_sentence_length: 8.0, std_sentence_length: 6.0, mean_word_length: 1.0,
  type_token_ratio: 0.15, punctuation_density: 4.0, comma_density: 3.0,
  semicolon_density: 1.0, dash_density: 1.5, question_density: 1.5,
  exclamation_density: 1.0, avg_paragraph_words: 50.0, flesch_reading_ease: 20.0,
};

// Statistical match score 0..100. 70% weighted numeric distance (Gaussian
// falloff), 30% bigram Jaccard. Kept as a cheap guardrail; semantic match
// (embedding cosine) is layered on top in the API layer.
export function voiceMatchScore(
  sampleFeatures: StyleFeatures,
  sampleBigrams: Record<string, number>,
  profileFeatures: StyleFeatures,
  profileBigrams: Record<string, number>,
): number {
  if (!profileFeatures || !Object.keys(profileFeatures).length) return 0;
  let weightedSq = 0;
  let weightSum = 0;
  for (const [key, weight] of Object.entries(NUMERIC_WEIGHTS)) {
    const scale = FEATURE_SCALE[key];
    if (!scale) continue;
    const diff = ((sampleFeatures[key] ?? 0) - (profileFeatures[key] ?? 0)) / scale;
    weightedSq += weight * diff * diff;
    weightSum += weight;
  }
  const numericDistance = weightSum ? Math.sqrt(weightedSq / weightSum) : 1;
  const numericSimilarity = Math.exp(-numericDistance);

  let jaccard = 0;
  const aKeys = Object.keys(sampleBigrams ?? {});
  const bKeys = Object.keys(profileBigrams ?? {});
  if (aKeys.length && bKeys.length) {
    const a = new Set(aKeys);
    const b = new Set(bKeys);
    const inter = [...a].filter((x) => b.has(x)).length;
    const union = new Set([...aKeys, ...bKeys]).size;
    jaccard = union ? inter / union : 0;
  }
  const score = 0.7 * numericSimilarity + 0.3 * jaccard;
  return Math.round(Math.max(0, Math.min(1, score)) * 100);
}

// Build the style-constrained system prompt fed to the model.
export function buildStylePrompt(
  features: StyleFeatures | null,
  bigrams: Record<string, number> | null,
  instruction?: string,
): string {
  const lines = [
    "You are the user's writing copilot. Continue their text in their exact voice.",
    "Do not introduce yourself. Do not summarize. Do not repeat prior text.",
    "Add 2-4 sentences that flow naturally from where they left off.",
  ];
  if (features) {
    const msl = features.mean_sentence_length;
    if (msl) lines.push(`Target mean sentence length: ~${Math.round(msl)} words.`);
    const ttr = features.type_token_ratio;
    if (ttr) lines.push(`Target lexical diversity (type-token ratio): ~${ttr.toFixed(2)}.`);
    const flesch = features.flesch_reading_ease;
    if (flesch) lines.push(`Target reading ease: ~${Math.round(flesch)} (Flesch).`);
    if ((features.semicolon_density ?? 0) > 0.5) lines.push("The author uses semicolons — keep them.");
    if ((features.dash_density ?? 0) > 0.5) lines.push("The author uses em-dashes — keep them.");
    if ((features.question_density ?? 0) > 0.5) lines.push("The author occasionally uses rhetorical questions.");
  }
  if (bigrams) {
    const top = Object.keys(bigrams).slice(0, 8);
    if (top.length) lines.push("Common phrases in the author's voice: " + top.join(", ") + ".");
  }
  if (instruction) lines.push(`Additional instruction from the user: ${instruction}`);
  return lines.join("\n");
}

export function cosine(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}
