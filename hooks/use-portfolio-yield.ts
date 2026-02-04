import { useMemo } from 'react';
import { 
  TOKEN_METADATA, 
  getTokenApy, 
  isTokenInflationHedge,
  type RegionValue 
} from '../config';

// =============================================================================
// PORTFOLIO YIELD HOOK
// =============================================================================
// Calculates the net protection position: yield earned vs inflation exposure.
// Answers the core question: "Am I winning against inflation?"
// =============================================================================

// Regional inflation rates (fallback values, ideally from inflation API)
const REGION_INFLATION: Record<string, number> = {
  USA: 3.2,
  Europe: 2.4,
  LatAm: 6.5,
  Africa: 9.5,
  Asia: 3.8,
  Global: 3.0,      // USD inflation baseline
  Commodities: 0,   // Gold tracks inflation, net neutral
};

export interface AssetYieldInfo {
  symbol: string;
  value: number;
  region: RegionValue;
  apy: number;
  annualYield: number;        // $ earned per year
  inflationRate: number;      // % local inflation
  inflationCost: number;      // $ lost to inflation per year
  netAnnual: number;          // yield - inflation cost
  isInflationHedge: boolean;
}

export interface PortfolioYieldSummary {
  totalValue: number;
  totalAnnualYield: number;       // $ from yield-bearing assets
  totalInflationCost: number;     // $ lost to inflation exposure
  netAnnualGain: number;          // yield - inflation
  avgYieldRate: number;           // weighted average yield %
  avgInflationRate: number;       // weighted average inflation exposure %
  netRate: number;                // net % (can be negative)
  isNetPositive: boolean;         // true if earning more than losing
  assets: AssetYieldInfo[];       // per-asset breakdown
  hedgedValue: number;            // value in inflation hedges (PAXG)
  yieldingValue: number;          // value in yield-bearing assets
  exposedValue: number;           // value exposed to inflation (no yield, no hedge)
}

interface BalanceData {
  value: number;
  formattedBalance?: string;
}

export function usePortfolioYield(
  balances: Record<string, BalanceData> | undefined,
  inflationData?: Record<string, { avgRate: number }> | null
): PortfolioYieldSummary {
  return useMemo(() => {
    const defaultSummary: PortfolioYieldSummary = {
      totalValue: 0,
      totalAnnualYield: 0,
      totalInflationCost: 0,
      netAnnualGain: 0,
      avgYieldRate: 0,
      avgInflationRate: 0,
      netRate: 0,
      isNetPositive: true,
      assets: [],
      hedgedValue: 0,
      yieldingValue: 0,
      exposedValue: 0,
    };

    if (!balances) return defaultSummary;

    const assets: AssetYieldInfo[] = [];
    let totalValue = 0;
    let totalAnnualYield = 0;
    let totalInflationCost = 0;
    let hedgedValue = 0;
    let yieldingValue = 0;

    // Process each token balance
    Object.entries(balances).forEach(([symbol, data]) => {
      if (!data || data.value <= 0) return;

      const normalizedSymbol = symbol.toUpperCase();
      const metadata = TOKEN_METADATA[normalizedSymbol];
      if (!metadata) return;

      const value = data.value;
      const region = metadata.region;
      const apy = getTokenApy(normalizedSymbol);
      const isHedge = isTokenInflationHedge(normalizedSymbol);

      // Get inflation rate for this region (use live data if available)
      const inflationRate = isHedge 
        ? 0 // Inflation hedges are neutral
        : (inflationData?.[region]?.avgRate ?? REGION_INFLATION[region] ?? 3.0);

      // Calculate annual yield ($)
      const annualYield = (value * apy) / 100;

      // Calculate inflation cost ($) - only for non-hedged, non-yielding assets
      // Yield-bearing assets: inflation cost reduced by yield
      // Hedged assets: no inflation cost
      const inflationCost = isHedge ? 0 : (value * inflationRate) / 100;

      // Net annual = yield - inflation
      const netAnnual = annualYield - inflationCost;

      totalValue += value;
      totalAnnualYield += annualYield;
      totalInflationCost += inflationCost;

      if (isHedge) hedgedValue += value;
      if (apy > 0) yieldingValue += value;

      assets.push({
        symbol: normalizedSymbol,
        value,
        region,
        apy,
        annualYield,
        inflationRate,
        inflationCost,
        netAnnual,
        isInflationHedge: isHedge,
      });
    });

    // Sort by value descending
    assets.sort((a, b) => b.value - a.value);

    const netAnnualGain = totalAnnualYield - totalInflationCost;
    const avgYieldRate = totalValue > 0 ? (totalAnnualYield / totalValue) * 100 : 0;
    const avgInflationRate = totalValue > 0 ? (totalInflationCost / totalValue) * 100 : 0;
    const netRate = avgYieldRate - avgInflationRate;
    const exposedValue = totalValue - hedgedValue - yieldingValue;

    return {
      totalValue,
      totalAnnualYield,
      totalInflationCost,
      netAnnualGain,
      avgYieldRate,
      avgInflationRate,
      netRate,
      isNetPositive: netAnnualGain >= 0,
      assets,
      hedgedValue,
      yieldingValue,
      exposedValue: Math.max(0, exposedValue),
    };
  }, [balances, inflationData]);
}
