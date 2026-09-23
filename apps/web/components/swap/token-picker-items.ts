import React from "react";
import { TOKEN_METADATA } from "../../config";
import type { TokenPickerItem } from "./TokenPickerSheet";
// Deep leaf imports — NOT the barrel — keeps the strategy stack out of first-load.
import { StrategyService } from "@diversifi/shared/src/services/strategy/strategy.service";
import type { FinancialStrategy } from "@diversifi/shared/src/types/strategy";

interface Token {
  symbol: string;
  name: string;
  region: string;
}

export function getYieldBadge(symbol: string): { text: string; color: string } | null {
  if (symbol === "USDY") return { text: "+5% APY", color: "text-emerald-600 bg-emerald-100" };
  if (symbol === "SYRUPUSDC") return { text: "+4.5% APY", color: "text-purple-600 bg-purple-100" };
  if (symbol === "PAXG") return { text: "Gold", color: "text-amber-600 bg-amber-100" };
  return null;
}

function isRecommended(financialStrategy: FinancialStrategy, tokenSymbol: string): boolean {
  const recommended = StrategyService.getRecommendedAssets(financialStrategy);
  return recommended.some(
    (rec) =>
      tokenSymbol.toUpperCase().includes(rec.toUpperCase()) ||
      rec.toUpperCase().includes(tokenSymbol.toUpperCase()),
  );
}

function getStrategyBadge(
  financialStrategy: FinancialStrategy,
  tokenSymbol: string,
): { label: string } | null {
  if (!isRecommended(financialStrategy, tokenSymbol)) return null;
  switch (financialStrategy) {
    case "africapitalism":
      if (tokenSymbol.match(/KES|GHS|ZAR|NGN|XOF/i)) return { label: "Builds Africa" };
      break;
    case "buen_vivir":
      if (tokenSymbol.match(/BRL|COP|MXN|ARS/i)) return { label: "LatAm Unity" };
      break;
    case "pan_caribbean":
      if (tokenSymbol.match(/USDC|USDm|USDY|PAXG/i)) return { label: "Caribbean Hedge" };
      break;
    case "confucian":
      if (tokenSymbol.match(/USD|EUR|USDY/i)) return { label: "Stable Wealth" };
      break;
    case "gotong_royong":
      if (tokenSymbol.match(/PHP|IDR|THB|VND/i)) return { label: "Community" };
      break;
    case "islamic":
      if (tokenSymbol.match(/PAXG|USDm|EURm/i)) return { label: "Halal" };
      break;
    case "global":
    case "custom":
    default:
      return { label: "Aligned" };
  }
  return null;
}

/** The picker's item list — compliance, strategy badge, yield badge,
 *  balances — shared by the ticket's TokenSelector rows and the pair
 *  stage's label buttons so both pickers read the same. */
export function useTokenPickerItems(
  availableTokens: Token[],
  tokenBalances: Record<string, { formattedBalance: string; value: number }> = {},
  financialStrategy?: FinancialStrategy,
): TokenPickerItem[] {
  return React.useMemo(
    () =>
      availableTokens.map((token) => {
        const compliance = financialStrategy
          ? StrategyService.getAssetCompliance(financialStrategy, token.symbol)
          : null;
        const metadata = TOKEN_METADATA[token.symbol];
        return {
          symbol: token.symbol,
          name: metadata?.name || token.name || token.symbol,
          region: token.region,
          balance: tokenBalances[token.symbol]?.formattedBalance,
          balanceValue: tokenBalances[token.symbol]?.value ?? 0,
          compliant: compliance?.isCompliant ?? true,
          complianceReason: compliance?.reason,
          badge: financialStrategy ? getStrategyBadge(financialStrategy, token.symbol) : null,
          yieldBadge: getYieldBadge(token.symbol),
        };
      }),
    [availableTokens, tokenBalances, financialStrategy],
  );
}
