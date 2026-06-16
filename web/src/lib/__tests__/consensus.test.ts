import { describe, it, expect } from "vitest";
import { parseJudgeVerdict } from "../consensus";

describe("parseJudgeVerdict — defensive parsing of model output", () => {
  it("parses a clean verdict", () => {
    expect(parseJudgeVerdict('{"best": 2, "confidence": 0.9}', 3)).toEqual({
      index: 1,
      confidence: 0.9,
    });
  });

  it("extracts JSON embedded in prose", () => {
    const out = parseJudgeVerdict('Sure! Here you go:\n{"best":1,"confidence":0.7} hope that helps', 3);
    expect(out.index).toBe(0);
    expect(out.confidence).toBeCloseTo(0.7);
  });

  it("clamps an out-of-range index to the last candidate", () => {
    expect(parseJudgeVerdict('{"best": 9, "confidence": 1}', 3).index).toBe(2);
  });

  it("clamps a below-range index to 0", () => {
    expect(parseJudgeVerdict('{"best": 0, "confidence": 1}', 3).index).toBe(0);
  });

  it("clamps confidence into 0..1", () => {
    expect(parseJudgeVerdict('{"best": 1, "confidence": 5}', 2).confidence).toBe(1);
    expect(parseJudgeVerdict('{"best": 1, "confidence": -2}', 2).confidence).toBe(0);
  });

  it("falls back on malformed JSON", () => {
    expect(parseJudgeVerdict("not json at all", 3)).toEqual({ index: 0, confidence: 0.5 });
  });

  it("falls back on missing fields", () => {
    expect(parseJudgeVerdict("{}", 3)).toEqual({ index: 0, confidence: 0.5 });
  });

  it("handles zero candidates safely", () => {
    expect(parseJudgeVerdict('{"best": 1, "confidence": 0.5}', 0)).toEqual({
      index: 0,
      confidence: 0.5,
    });
  });

  it("rounds fractional indices", () => {
    expect(parseJudgeVerdict('{"best": 2.4, "confidence": 0.5}', 3).index).toBe(1);
  });
});
