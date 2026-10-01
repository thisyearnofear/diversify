import { describe, expect, it } from "vitest";
import { createEmptyPortfolio } from "@/hooks/use-multichain-balances";
import { STRATEGY_ALLOCATIONS } from "@/components/protection-cards/plan-preview";
import {
  buildWalletPortfolioView,
  canSafelyExecute,
  getProtectionGaps,
  getWalletHoldings,
  heldAsLine,
  heldAsSymbol,
} from "../wallet-portfolio-view";

const balance = (symbol: string, value: number, chainId = 42220, chainName = "Celo") => ({
  symbol,
  value,
  balance: String(value),
  formattedBalance: String(value),
  name: symbol,
  region: "Global" as never,
  chainId,
  chainName,
});

const portfolio = (chains: any[], extra: any = {}) => ({
  ...createEmptyPortfolio(),
  chains,
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
    const gaps = getProtectionGaps(holdings, [{ token: "USDC", region: "Global", percent: 100, why: "Global liquid core" }]);
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

  it("merges config tickers into the plan-leg name when a plan is in scope", () => {
    const buenVivir = [
      { token: "cREAL", region: "LatAm", percent: 45, why: "x" },
      { token: "COPm", region: "LatAm", percent: 35, why: "x" },
      { token: "cUSD", region: "Global", percent: 20, why: "x" },
    ];
    const result = buildWalletPortfolioView(
      portfolio([
        { balances: [balance("USDm", 40), balance("BRLm", 10), balance("PAXG", 50)] },
      ]),
      buenVivir,
    );
    const symbols = result.holdings.map((h) => h.symbol);
    expect(symbols).toContain("cUSD");
    expect(symbols).not.toContain("USDm");
    expect(symbols).not.toContain("BRLm");
    expect(result.holdings.find((h) => h.symbol === "cUSD")?.percent).toBe(40);
    expect(result.holdings.find((h) => h.symbol === "cREAL")?.percent).toBe(10);
  });

  it("leaves raw symbols untouched when no plan is in scope", () => {
    const result = buildWalletPortfolioView(
      portfolio([{ balances: [balance("USDm", 100)] }]),
    );
    expect(result.holdings.map((h) => h.symbol)).toEqual(["USDm"]);
  });
});

describe("wallet portfolio view — exposure buckets", () => {
  it("buckets USD tokens on every chain under the Dollar leg and says what they're held as", () => {
    const view = buildWalletPortfolioView(
      portfolio([
        { balances: [balance("USDm", 10), balance("PAXG", 50, 42161, "Arbitrum")] },
        { balances: [balance("USDC", 40, 42161, "Arbitrum")] },
      ]),
      STRATEGY_ALLOCATIONS.islamic,
      { excludeYield: true },
    );
    const dollar = view.holdings.find((h) => h.symbol === "cUSD");
    expect(dollar?.percent).toBe(50);
    expect(heldAsLine(dollar, view.totalUsd)).toBe("Held as: USDC · Arbitrum 40%, USDm · Celo 10%");
    expect(heldAsSymbol(dollar)).toBe("USDC");
  });

  it("keeps a yield dollar out of an Islamic Dollar leg", () => {
    const view = buildWalletPortfolioView(
      portfolio([{ balances: [balance("USDY", 50, 42161, "Arbitrum"), balance("USDm", 50)] }]),
      STRATEGY_ALLOCATIONS.islamic,
      { excludeYield: true },
    );
    expect(view.holdings.map((h) => h.symbol).sort()).toEqual(["USDY", "cUSD"]);
  });

  it("has no held-as line without balances", () => {
    expect(heldAsLine(undefined, 100)).toBeNull();
  });

  it("inherits chain metadata from the enclosing chain when a balance omits it", () => {
    const bare = (symbol: string, value: number) => ({
      symbol,
      value,
      balance: String(value),
      formattedBalance: String(value),
      name: symbol,
      region: "Global" as never,
    });
    const targets = [
      { token: "cUSD", region: "Global", percent: 50, why: "x" },
      { token: "PAXG", region: "Global", percent: 50, why: "x" },
    ];
    const view = buildWalletPortfolioView(
      portfolio([
        { chainId: 42220, chainName: "Celo", balances: [bare("USDm", 400)] },
        { chainId: 42161, chainName: "Arbitrum", balances: [bare("USDC", 250), bare("PAXG", 100)] },
        { chainId: 42220, chainName: "Celo", balances: [bare("EURm", 150), bare("KESm", 100)] },
      ]),
      targets,
    );
    const dollar = view.holdings.find((h) => h.symbol === "cUSD");
    expect(dollar?.valueUsd).toBe(650);
    expect(dollar?.percent).toBe(65);
    expect(view.gaps.find((g) => g.token === "cUSD")?.deltaPercent).toBe(-15);
    expect(heldAsLine(dollar, view.totalUsd)).toBe(
      "Held as: USDm · Celo 40%, USDC · Arbitrum 25%",
    );
  });

  it("omits the chain label when neither balance nor chain names it", () => {
    const bare = (symbol: string, value: number) => ({
      symbol,
      value,
      balance: String(value),
      formattedBalance: String(value),
      name: symbol,
      region: "Global" as never,
    });
    const view = buildWalletPortfolioView(
      portfolio([{ balances: [bare("USDm", 100)] }]),
    );
    const usdm = view.holdings.find((h) => h.symbol === "USDm");
    expect(heldAsLine(usdm, view.totalUsd)).toBe("Held as: USDm 100%");
    expect(heldAsLine(usdm, view.totalUsd)).not.toContain("undefined");
  });
});
