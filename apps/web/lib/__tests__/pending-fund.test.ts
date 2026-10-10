// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  savePendingFund,
  readPendingFund,
  clearPendingFund,
  pendingFundArrived,
} from "../pending-fund";

const KEY = "diversifi.pending-fund";

const base = {
  asset: "USDC",
  chainId: 42220,
  neededBalance: 250,
  usdEstimate: 210,
  resume: { fromToken: "USDC", toToken: "USDm", amount: "250" },
};

describe("pending-fund", () => {
  beforeEach(() => window.localStorage.removeItem(KEY));

  it("round-trips a saved fund", () => {
    savePendingFund(base);
    const read = readPendingFund();
    expect(read).toMatchObject(base);
    expect(read?.createdAt).toBeGreaterThan(0);
  });

  it("returns null when nothing is stored or after clear", () => {
    expect(readPendingFund()).toBeNull();
    savePendingFund(base);
    clearPendingFund();
    expect(readPendingFund()).toBeNull();
  });

  it("expires records older than 7 days", () => {
    savePendingFund(base);
    const stale = Date.now() + 8 * 24 * 60 * 60 * 1000;
    expect(readPendingFund(stale)).toBeNull();
    // Expiry also clears the record rather than leaving stale state.
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("tolerates corrupt JSON", () => {
    window.localStorage.setItem(KEY, "{not json");
    expect(readPendingFund()).toBeNull();
  });

  describe("pendingFundArrived", () => {
    const fund = { ...base, createdAt: Date.now() };

    it("is true when the wallet holds neededBalance on the right chain", () => {
      expect(
        pendingFundArrived(fund, [
          { symbol: "USDC", chainId: 42220, formattedBalance: "250.00" },
        ]),
      ).toBe(true);
    });

    it("matches symbols case-insensitively", () => {
      expect(
        pendingFundArrived(fund, [
          { symbol: "usdc", chainId: 42220, formattedBalance: "300" },
        ]),
      ).toBe(true);
    });

    it("is false below the threshold, on the wrong chain, or with no row", () => {
      expect(
        pendingFundArrived(fund, [
          { symbol: "USDC", chainId: 42220, formattedBalance: "249.99" },
        ]),
      ).toBe(false);
      expect(
        pendingFundArrived(fund, [
          { symbol: "USDC", chainId: 42161, formattedBalance: "9999" },
        ]),
      ).toBe(false);
      expect(pendingFundArrived(fund, [])).toBe(false);
    });
  });
});
