import { describe, expect, it } from "vitest";
import {
  ANCHOR_CURRENCIES,
  asAnchorCurrency,
  fallbackUsdRate,
  resolveAnchorCurrency,
} from "../anchor-currency";

describe("anchor currency — default order", () => {
  it("a saved choice wins over everything", () => {
    expect(
      resolveAnchorCurrency({
        saved: "eur",
        cycleLocalCurrency: "KES",
        holdings: [{ symbol: "BRLm", value: 500 }],
      }),
    ).toEqual({ currency: "EUR", source: "profile" });
  });

  it("then the payment cycle's local currency", () => {
    expect(
      resolveAnchorCurrency({ cycleLocalCurrency: "kes", holdings: [{ symbol: "BRLm", value: 500 }] }),
    ).toEqual({ currency: "KES", source: "payment-cycle" });
  });

  it("then the largest held local-currency stablecoin, summed across chains and aliases", () => {
    expect(
      resolveAnchorCurrency({
        holdings: [
          { symbol: "USDC", value: 150 },
          { symbol: "KESm", value: 120 },
          { symbol: "cKES", value: 100 },
          { symbol: "BRLm", value: 200 },
          { symbol: "PAXG", value: 400 },
        ],
      }),
    ).toEqual({ currency: "KES", source: "holdings" });
  });

  it("a dollar-majority wallet stays on USD even with some local holdings", () => {
    expect(
      resolveAnchorCurrency({
        holdings: [
          { symbol: "USDC", value: 1500 },
          { symbol: "cUSD", value: 500 },
          { symbol: "KESm", value: 1000 },
        ],
      }),
    ).toEqual({ currency: "USD", source: "default" });
  });

  it("falls back to USD — dollars, gold and unknown codes never set a local anchor", () => {
    expect(
      resolveAnchorCurrency({
        saved: "XYZ",
        cycleLocalCurrency: "",
        holdings: [
          { symbol: "USDC", value: 900 },
          { symbol: "PAXG", value: 400 },
        ],
      }),
    ).toEqual({ currency: "USD", source: "default" });
  });

  it("only currencies are anchors", () => {
    expect(ANCHOR_CURRENCIES[0]).toBe("USD");
    expect(ANCHOR_CURRENCIES).toContain("KES");
    expect(asAnchorCurrency("XAU")).toBeNull();
    expect(asAnchorCurrency("US_EQUITY")).toBeNull();
  });
});

describe("anchor currency — fallback FX", () => {
  it("inverts the USD-per-unit table", () => {
    expect(fallbackUsdRate("USD")).toBe(1);
    expect(fallbackUsdRate("KES")).toBeCloseTo(1 / 0.0078);
  });
});
