import { describe, expect, it } from "vitest";
import { TOKEN_LOGOS, tokenLogoKey } from "../token-logos";
import { getTokenAddresses } from "@/config";

describe("token logo coverage", () => {
  const celoMainnet = getTokenAddresses(42220);

  it("every Celo mainnet stable the Exchange lists has a real logo", () => {
    // CELO is the gas token, not a savings pair. G$ (GoodDollar) has no
    // verified hosted logo yet (Trust Wallet 404) — it renders the Coin
    // fallback until one is sourced. Everything else must be a real coin.
    const KNOWN_GAPS = new Set(["CELO", "G$"]);
    const missing = Object.keys(celoMainnet)
      .filter((symbol) => !KNOWN_GAPS.has(symbol))
      .filter((symbol) => !TOKEN_LOGOS[tokenLogoKey(symbol)]);
    expect(missing).toEqual([]);
  });

  it("Mento logos point at the same contract the chain config trades", () => {
    for (const [symbol, address] of Object.entries(celoMainnet)) {
      const uri = TOKEN_LOGOS[tokenLogoKey(symbol)];
      if (!uri || !/M$/.test(tokenLogoKey(symbol))) continue;
      expect(uri.toLowerCase(), symbol).toContain(address.toLowerCase());
    }
  });
});
