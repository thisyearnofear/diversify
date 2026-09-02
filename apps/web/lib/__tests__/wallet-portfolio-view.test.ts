import { describe, expect, it } from "vitest";
import { buildWalletPortfolioView, canSafelyExecute, getProtectionGaps, getWalletHoldings } from "../wallet-portfolio-view";

const balance = (symbol: string, value: number, chainId = 42220) => ({
  symbol,
  value,
  balance: String(value),
  formattedBalance: String(value),
  name: symbol,
  region: "Global" as never,
  chainId,
  chainName: "Celo",
});

const portfolio = (chains: any[], extra: any = {}) => ({
  chains,
  totalValue: 0,
  errors: [],
  isLoading: false,
  isStale: false,
  hasEstimates: false,
  ...extra,
}) as any;

describe("wallet portfolio view", () => {
  it("aggregates the same token across chains and calculates live percentages", () => {
    const result = getWalletHoldings(portfolio([
      { balances: [balance("USDC", 30)] },
      { balances: [balance("USDC", 20, 42161), balance("PAXG", 50, 42161)] },
    ]));
    expect(result.map(({ symbol }) => symbol)).toEqual(["USDC", "PAXG"]);
    expect(result.find(({ symbol }) => symbol === "USDC")?.percent).toBe(50);
  });

  it("includes wallet-only tokens when calculating gaps", () => {
    const holdings = [{ symbol: "WETH", valueUsd: 100, percent: 100, balances: [] }];
    const gaps = getProtectionGaps(holdings, [{ token: "USDC", region: "Global", percent: 100 }]);
    expect(gaps).toEqual([
      { token: "WETH", heldPercent: 100, targetPercent: 0, deltaPercent: -100 },
      { token: "USDC", heldPercent: 0, targetPercent: 100, deltaPercent: 100 },
    ]);
  });

  it("only allows execution with fresh complete data", () => {
    expect(canSafelyExecute("ready")).toBe(true);
    expect(canSafelyExecute("stale")).toBe(false);
    expect(canSafelyExecute("partial")).toBe(false);
    expect(canSafelyExecute("loading")).toBe(false);
  });

  it("marks errored populated data as partial instead of empty", () => {
    const result = buildWalletPortfolioView(
      portfolio([{ balances: [balance("USDC", 100)] }], { errors: ["Arbitrum failed"] }),
      [],
    );
    expect(result.freshness).toBe("partial");
    expect(result.totalUsd).toBe(100);
  });
});
