import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { CELO_TOKENS, MENTO_ABIS } from "@stable-station/mento-utils";
import {
  TOKEN_METADATA,
  EXCHANGE_RATES,
  REGION_COLORS,
  RegionValue,
} from "../config";

interface StablecoinBalance {
  token: string;
  symbol: string;
  region: RegionValue;
  balance: string;
  value: number;
  percentage: number;
}

interface RegionData {
  region: string;
  value: number;
  color: string;
}

interface DiversificationMetric {
  name: string;
  value: number;
  description: string;
  interpretation: string;
  color: string;
}

export function useStablecoinPortfolio(address?: string) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [balances, setBalances] = useState<StablecoinBalance[]>([]);
  const [regionData, setRegionData] = useState<RegionData[]>([]);
  const [metrics, setMetrics] = useState<DiversificationMetric[]>([]);

  useEffect(() => {
    const fetchBalances = async () => {
      if (!address) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Create a read-only provider for Celo mainnet
        const provider = new ethers.providers.JsonRpcProvider(
          "https://forno.celo.org",
        );

        const balancePromises = Object.entries(CELO_TOKENS).map(
          async ([symbol, tokenAddress]) => {
            try {
              // Skip CELO token (not a stablecoin)
              if (symbol === "CELO") return null;

              // Create ERC20 contract instance
              const tokenContract = new ethers.Contract(
                tokenAddress,
                MENTO_ABIS.ERC20_BALANCE,
                provider,
              );

              // Get token metadata from config
              const metadata = TOKEN_METADATA[symbol];
              const decimals = metadata?.decimals || 18;

              // Get balance
              const balance = await tokenContract.balanceOf(address);
              const formattedBalance = ethers.utils.formatUnits(
                balance,
                decimals,
              );

              // Get exchange rate from config
              const price = EXCHANGE_RATES[symbol] || 1.0;
              const value = Number.parseFloat(formattedBalance) * price;

              return {
                token: metadata?.name || symbol,
                symbol,
                region: metadata?.region || "Global",
                balance: formattedBalance,
                value,
                percentage: 0, // Will be calculated after all balances are fetched
              };
            } catch (error) {
              console.error(`Error fetching balance for ${symbol}:`, error);
              return null;
            }
          },
        );

        // Wait for all balance promises to resolve
        const results = await Promise.all(balancePromises);
        const validBalances = results.filter(
          (balance): balance is StablecoinBalance => balance !== null,
        );

        // Calculate total value
        const totalValue = validBalances.reduce(
          (sum, balance) => sum + balance.value,
          0,
        );

        // Calculate percentages
        const balancesWithPercentages: StablecoinBalance[] = validBalances.map(
          (balance) => ({
            ...balance,
            percentage: totalValue > 0 ? (balance.value / totalValue) * 100 : 0,
          }),
        );

        // Sort by value (descending)
        balancesWithPercentages.sort((a, b) => b.value - a.value);

        setBalances(balancesWithPercentages);

        // Calculate region data
        const regionMap = new Map<string, number>();
        for (const balance of balancesWithPercentages) {
          const region = balance.region;
          const currentValue = regionMap.get(region) || 0;
          regionMap.set(region, currentValue + balance.percentage);
        }

        const regionDataArray: RegionData[] = Array.from(
          regionMap.entries(),
        ).map(([region, value]) => ({
          region,
          value,
          color: (REGION_COLORS as Record<string, string>)[region] || "#CBD5E0",
        }));

        setRegionData(regionDataArray);

        // Calculate diversification metrics
        const metrics = calculateDiversificationMetrics(
          balancesWithPercentages,
        );
        setMetrics(metrics);

        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching stablecoin balances:", error);
        setError("Failed to fetch stablecoin balances. Please try again.");
        setIsLoading(false);
      }
    };

    fetchBalances();
  }, [address]);

  return {
    isLoading,
    error,
    balances,
    regionData,
    metrics,
  };
}

// Helper function to calculate diversification metrics
function calculateDiversificationMetrics(
  balances: StablecoinBalance[],
): DiversificationMetric[] {
  // Calculate Herfindahl-Hirschman Index (HHI)
  // Lower values indicate better diversification
  const hhi = balances.reduce((sum, balance) => {
    const marketShare = balance.percentage / 100;
    return sum + marketShare * marketShare;
  }, 0);

  // Calculate Shannon Entropy
  // Higher values indicate better diversification
  const shannonEntropy = balances.reduce((entropy, balance) => {
    const p = balance.percentage / 100;
    return p > 0 ? entropy - p * Math.log(p) : entropy;
  }, 0);

  // Calculate Geographic Spread Ratio
  // Higher values indicate better geographic spread
  const regionCount = new Set(balances.map((b) => b.region)).size;
  const maxRegions = Object.keys(REGION_COLORS).length;
  const geographicSpreadRatio = regionCount / maxRegions;

  // Calculate Inflation Protection Score (simplified)
  // Higher values indicate better protection
  const inflationProtectionScore = Math.min(
    10,
    regionCount * 2 + shannonEntropy * 3,
  );

  return [
    {
      name: "Herfindahl-Hirschman Index",
      value: hhi,
      description: "Measures concentration of portfolio across regions",
      interpretation: "Lower values indicate better diversification",
      color: "#4299E1",
    },
    {
      name: "Shannon Entropy",
      value: shannonEntropy,
      description: "Measures information diversity in portfolio",
      interpretation: "Higher values indicate better diversification",
      color: "#48BB78",
    },
    {
      name: "Geographic Spread Ratio",
      value: geographicSpreadRatio,
      description: "Measures how evenly distributed your portfolio is",
      interpretation: "Higher values indicate better geographic spread",
      color: "#F6AD55",
    },
    {
      name: "Inflation Protection Score",
      value: inflationProtectionScore,
      description:
        "Measures how well protected your portfolio is against inflation",
      interpretation: "Higher values indicate better protection",
      color: "#F56565",
    },
  ];
}
