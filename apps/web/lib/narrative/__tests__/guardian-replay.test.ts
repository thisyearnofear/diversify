import { describe, expect, it } from "vitest";
import { buildGuardianReplay, sharpestDrop } from "../guardian-replay";

const series = {
  dates: ["2025-10-01", "2025-11-01", "2025-12-01", "2026-01-01", "2026-02-01"],
  values: [100, 99, 90, 88, 92.4],
};

describe("guardian replay", () => {
  it("finds the sharpest sampled fall", () => {
    const d = sharpestDrop(series)!;
    expect(d.index).toBe(2);
    expect(d.change).toBeCloseTo(-9.09, 1);
  });

  it("pins the three beats to real months, labelled from the data", () => {
    const steps = buildGuardianReplay("NGN", series, "2026-02-01")!;
    expect(steps.map((s) => s.mood)).toEqual(["protective", "alert", "neutral"]);
    expect(steps[0].title).toBe("Nov 2025");
    expect(steps[1].title).toBe("NGN −9.1% in 30 days");
    expect(steps[1].line).toContain("Dec 2025");
    expect(steps[2].title).toBe("Since then: +2.7%");
    expect(steps[2].why).toContain("as of 2026-02-01");
  });

  it("returns null without a real shock or a valid series", () => {
    expect(buildGuardianReplay("USD", { dates: series.dates, values: [100, 99.5, 99, 99.2, 99.1] })).toBeNull();
    expect(buildGuardianReplay("NGN", null)).toBeNull();
    expect(buildGuardianReplay("NGN", { dates: ["2026-01-01"], values: [1] })).toBeNull();
  });
});
