import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { selectPanel, complexityFor, estimateCost } from "../models";

describe("complexityFor", () => {
  it("maps grounding to high (consensus matters most)", () => {
    expect(complexityFor("ground")).toBe("high");
  });
  it("maps voice-match to trivial", () => {
    expect(complexityFor("voice-match")).toBe("trivial");
  });
  it("defaults unknown tasks to standard", () => {
    expect(complexityFor("something-new")).toBe("standard");
  });
});

describe("selectPanel — token efficiency", () => {
  const prev = process.env.ROUTING_PROFILE;
  afterEach(() => {
    process.env.ROUTING_PROFILE = prev;
  });

  it("trivial tasks use exactly one model", () => {
    process.env.ROUTING_PROFILE = "balanced";
    expect(selectPanel("voice-match")).toHaveLength(1);
  });

  it("standard tasks use one model", () => {
    process.env.ROUTING_PROFILE = "balanced";
    expect(selectPanel("complete")).toHaveLength(1);
  });

  it("high-stakes tasks consult a cross-check panel", () => {
    process.env.ROUTING_PROFILE = "balanced";
    expect(selectPanel("ground").length).toBeGreaterThanOrEqual(2);
  });

  it("quality profile widens the panel vs cheap", () => {
    process.env.ROUTING_PROFILE = "cheap";
    const cheap = selectPanel("ground").length;
    process.env.ROUTING_PROFILE = "quality";
    const quality = selectPanel("ground").length;
    expect(quality).toBeGreaterThanOrEqual(cheap);
  });

  it("never returns duplicate models", () => {
    process.env.ROUTING_PROFILE = "quality";
    const ids = selectPanel("ground").map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("estimateCost", () => {
  it("scales with token counts", () => {
    const a = estimateCost("openai/gpt-4o", 1000, 1000);
    const b = estimateCost("openai/gpt-4o", 2000, 2000);
    expect(b).toBeCloseTo(a * 2, 6);
  });
  it("returns 0 for unknown model", () => {
    expect(estimateCost("nope/nope", 1000, 1000)).toBe(0);
  });
});
