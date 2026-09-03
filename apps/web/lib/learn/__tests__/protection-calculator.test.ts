import { describe, expect, it } from "vitest";
import {
  GOLD_MIX,
  inflationForToken,
  localInflationRate,
  mixForPhilosophy,
  mixLabelFor,
  projectMix,
  projectPurchasingPower,
  seriesFor,
  type InflationRates,
} from "../protection-calculator";

const RATES: InflationRates = {
  local: 12.5,
  usd: 4.1,
  eur: 6.8,
  africa: 12.5,
  latam: 8.7,
  asia: 4.2,
  europe: 6.8,
};

describe("inflationForToken", () => {
  it("treats gold as holding purchasing power, not Global 5% inflation", () => {
    expect(inflationForToken("PAXG", RATES)).toBe(0);
    expect(inflationForToken("paxg", RATES)).toBe(0);
  });

  it("maps USD and EUR pegs to their inflation, not a yield", () => {
    expect(inflationForToken("cUSD", RATES)).toBe(4.1);
    expect(inflationForToken("USDY", RATES)).toBe(4.1);
    expect(inflationForToken("cEUR", RATES)).toBe(6.8);
  });

  it("keeps local stables on the local inflation (they do not hedge it)", () => {
    expect(inflationForToken("KESm", RATES)).toBe(12.5);
  });
});

describe("mixForPhilosophy", () => {
  it("defaults to gold when there is no plan", () => {
    expect(mixForPhilosophy(null)).toEqual(GOLD_MIX);
    expect(mixForPhilosophy(undefined)).toEqual(GOLD_MIX);
    expect(mixForPhilosophy("custom")).toEqual(GOLD_MIX);
  });

  it("uses the Africapitalism allocation when that philosophy is set", () => {
    expect(mixForPhilosophy("africapitalism")).toEqual([
      { token: "KESm", percent: 60 },
      { token: "cUSD", percent: 25 },
      { token: "cEUR", percent: 15 },
    ]);
  });
});

describe("mixLabelFor", () => {
  it("names gold when there is no philosophy", () => {
    expect(mixLabelFor(null, GOLD_MIX)).toBe("Gold");
  });

  it("uses the strategy name for a named mix", () => {
    expect(
      mixLabelFor("africapitalism", mixForPhilosophy("africapitalism"), "Africapitalism"),
    ).toBe("Africapitalism");
  });
});

describe("projection", () => {
  it("erodes cash at local inflation", () => {
    const year5 = projectPurchasingPower(10_000, 12.5, 5);
    expect(year5).toBeCloseTo(10_000 * Math.pow(0.875, 5), 5);
  });

  it("preserves more with gold than with cash in a high-inflation region", () => {
    const cash = projectPurchasingPower(10_000, RATES.local, 5);
    const gold = projectMix(10_000, GOLD_MIX, RATES, 5);
    expect(gold).toBe(10_000);
    expect(gold).toBeGreaterThan(cash);
  });

  it("Africapitalism mix sits between cash and gold — local slice still erodes", () => {
    const mix = mixForPhilosophy("africapitalism");
    const cash = projectPurchasingPower(10_000, RATES.local, 5);
    const protectedValue = projectMix(10_000, mix, RATES, 5);
    const gold = projectMix(10_000, GOLD_MIX, RATES, 5);
    expect(protectedValue).toBeGreaterThan(cash);
    expect(protectedValue).toBeLessThan(gold);
  });

  it("builds a year-0-to-N series", () => {
    const series = seriesFor(10_000, GOLD_MIX, RATES, 5);
    expect(series).toHaveLength(6);
    expect(series[0]).toEqual({ year: 0, cash: 10_000, protected: 10_000 });
    expect(series[5].protected).toBe(10_000);
    expect(series[5].cash).toBeLessThan(10_000);
  });
});

describe("localInflationRate", () => {
  const byRegion = { Africa: 12.5, USA: 4.1, LatAm: 8.7 };

  it("uses the named region when present", () => {
    expect(localInflationRate("Africa", byRegion)).toBe(12.5);
  });

  it("maps Caribbean to LatAm imported-inflation, then USA", () => {
    expect(localInflationRate("Caribbean", byRegion)).toBe(8.7);
    expect(localInflationRate("Caribbean", { USA: 4.1 })).toBe(4.1);
  });
});
