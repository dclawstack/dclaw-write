import { describe, it, expect } from "vitest";
import { extractClaims, SUPPORT_THRESHOLD } from "../grounding";

describe("extractClaims", () => {
  it("splits prose into checkable claims", () => {
    const claims = extractClaims(
      "Our revenue grew forty percent last year. The team expanded to fifty people.",
    );
    expect(claims).toHaveLength(2);
    expect(claims[0].text).toContain("revenue grew");
  });

  it("skips questions and short fragments", () => {
    const claims = extractClaims("Why does this matter? Yes. It works.");
    // "Why does this matter?" is a question; "Yes." and "It works." are < 6 words
    expect(claims).toHaveLength(0);
  });

  it("handles newlines as separators", () => {
    const claims = extractClaims(
      "The market is worth four hundred billion dollars annually.\n\nGrowth is accelerating worldwide every single year now.",
    );
    expect(claims.length).toBeGreaterThanOrEqual(2);
  });
});

describe("SUPPORT_THRESHOLD", () => {
  it("is a sane confidence cutoff", () => {
    expect(SUPPORT_THRESHOLD).toBeGreaterThan(0.5);
    expect(SUPPORT_THRESHOLD).toBeLessThan(1);
  });
});
