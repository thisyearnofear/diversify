import { describe, expect, it } from "vitest";
import {
  assembleTokenBalances,
  shouldCacheChainBalance,
} from "../use-multichain-balances";

const CELO = { chainId: 42220, name: "Celo" };

function held(overrides: {
  symbol?: string;
  numericBalance: number;
  fallbackRate?: number;
}) {
  return {
    symbol: overrides.symbol ?? "USDm",
    metadata: { name: "Mento Dollar", region: "USA" as const },
    tokenAddress: "0xusd",
    rawBalance: "1",
    formattedBalance: String(overrides.numericBalance),
    numericBalance: overrides.numericBalance,
    fallbackRate: overrides.fallbackRate ?? 1,
  };
}

describe("assembleTokenBalances", () => {
  it("keeps held tokens at fallback rates so a price miss cannot hide coins", () => {
    const { balances, totalValue } = assembleTokenBalances(
      [held({ numericBalance: 12.5 })],
      [1],
      CELO,
    );
    expect(balances).toHaveLength(1);
    expect(balances[0].symbol).toBe("USDm");
    expect(totalValue).toBe(12.5);
  });

  it("drops true dust under a cent", () => {
    const { balances, totalValue } = assembleTokenBalances(
      [held({ numericBalance: 0.001 })],
      [1],
      CELO,
    );
    expect(balances).toHaveLength(0);
    expect(totalValue).toBe(0);
  });
});

describe("shouldCacheChainBalance", () => {
  it("does not cache a timed-out empty chain — that hid real holdings for 5 minutes", () => {
    expect(
      shouldCacheChainBalance({
        chainId: 42220,
        chainName: "Celo",
        totalValue: 0,
        tokenCount: 0,
        balances: [],
        isLoading: false,
        error: "Celo RPC timed out",
      }),
    ).toBe(false);
  });

  it("caches a successful snapshot, including a true empty wallet", () => {
    expect(
      shouldCacheChainBalance({
        chainId: 42220,
        chainName: "Celo",
        totalValue: 0,
        tokenCount: 0,
        balances: [],
        isLoading: false,
        error: null,
      }),
    ).toBe(true);
  });
});
