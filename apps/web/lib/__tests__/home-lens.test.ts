import { describe, expect, it } from "vitest";
import { concentrationOf } from "../home-lens";

const regions = (entries: Array<[string, number]>) =>
  entries.map(([region, value]) => ({ region, value }));

describe("concentrationOf", () => {
  it("returns null below the 50% threshold", () => {
    expect(concentrationOf(regions([["Africa", 499]]), 1000)).toBeNull();
  });

  it("hits at exactly 50%", () => {
    const hit = concentrationOf(regions([["Africa", 500], ["USA", 500]]), 1000);
    expect(hit).toEqual({ region: "Africa", pct: 50, value: 500 });
  });

  it("a single-region wallet is 100% concentrated", () => {
    const hit = concentrationOf(regions([["USA", 1200]]), 1200);
    expect(hit?.region).toBe("USA");
    expect(hit?.pct).toBe(100);
  });

  it("picks the top region, not the first", () => {
    const hit = concentrationOf(
      regions([["USA", 100], ["Africa", 700], ["EU", 200]]),
      1000,
    );
    expect(hit?.region).toBe("Africa");
  });

  it("returns null for an empty wallet or no regions", () => {
    expect(concentrationOf(regions([["USA", 0]]), 0)).toBeNull();
    expect(concentrationOf([], 1000)).toBeNull();
  });
});
