import { describe, it, expect } from "vitest";
import {
  computeFeatures,
  fitProfile,
  voiceMatchScore,
  topBigramSignature,
  buildStylePrompt,
  cosine,
} from "../voice-dna";

const TERSE =
  "The sun rose. He walked to the sea. The boat was small. He was old but strong. The fish was big.";
const ORNATE =
  "In the long, slow afternoon — heavy with dust and the memory of summers past — he wandered, thinking of the river that wound, serpentine and patient, through the fields his grandfather had cleared.";

describe("computeFeatures", () => {
  it("returns zeroed features for empty text", () => {
    expect(computeFeatures("").word_count).toBe(0);
    expect(computeFeatures("   ").mean_sentence_length).toBe(0);
  });

  it("measures shorter sentences for terse prose than ornate", () => {
    expect(computeFeatures(TERSE).mean_sentence_length).toBeLessThan(
      computeFeatures(ORNATE).mean_sentence_length,
    );
  });

  it("detects em-dash usage", () => {
    expect(computeFeatures(ORNATE).dash_density).toBeGreaterThan(0);
    expect(computeFeatures(TERSE).dash_density).toBe(0);
  });
});

describe("voiceMatchScore", () => {
  it("scores self-similarity higher than cross-style", () => {
    const profile = fitProfile([TERSE, TERSE]);
    const self = voiceMatchScore(
      computeFeatures(TERSE),
      {},
      profile.styleFeatures,
      profile.bigramSignature,
    );
    const cross = voiceMatchScore(
      computeFeatures(ORNATE),
      {},
      profile.styleFeatures,
      profile.bigramSignature,
    );
    expect(self).toBeGreaterThan(cross);
  });

  it("returns 0 against an empty profile", () => {
    expect(voiceMatchScore(computeFeatures(TERSE), {}, {}, {})).toBe(0);
  });

  it("stays within 0..100", () => {
    const p = fitProfile([ORNATE]);
    const s = voiceMatchScore(computeFeatures(ORNATE), {}, p.styleFeatures, p.bigramSignature);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });
});

describe("topBigramSignature", () => {
  it("normalizes frequencies to sum ~1", () => {
    const sig = topBigramSignature(["the cat sat on the mat the cat ran"]);
    const sum = Object.values(sig).reduce((a, b) => a + b, 0);
    expect(sum).toBeGreaterThan(0.99);
    expect(sum).toBeLessThan(1.01);
  });
});

describe("buildStylePrompt", () => {
  it("includes measured targets and keeps em-dash instruction", () => {
    const f = computeFeatures(ORNATE);
    const prompt = buildStylePrompt(f, { "the river": 0.1 });
    expect(prompt).toContain("mean sentence length");
    expect(prompt).toContain("the river");
  });
});

describe("cosine", () => {
  it("is 1 for identical vectors and 0 for orthogonal", () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
  });
});
