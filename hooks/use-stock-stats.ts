import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { ProviderFactoryService } from "@diversifi/shared";
import { NETWORKS, BROKER_ADDRESSES, RH_TESTNET_TOKENS } from "../config";

const RH_CHAIN_ID = NETWORKS.RH_TESTNET.chainId;
const AMM_ADDRESS = BROKER_ADDRESSES.RH_TESTNET;
const WETH_ADDRESS = RH_TESTNET_TOKENS.WETH;

const AMM_ABI = [
  "event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)",
  "function getReserves(address tokenA, address tokenB) view returns (uint256, uint256)",
];

const ERC20_ABI = ["function totalSupply() view returns (uint256)"];

export interface StockStats {
  marketCapETH: number;
  poolTVLETH: number;
  volume24hETH: number;
  peRatioMock: number; // Deterministic mock
  divYieldMock: number; // Deterministic mock
  forecastVol?: number; // From Synth API
  realizedVol?: number; // From Synth API
}

/**
 * useStockStats
 *
 * Fetches real on-chain data for the Robinhood Chain testnet AMM to populate
 * the "Key Statistics" panel. Blends real data (Market Cap, TVL, Volume) with
 * deterministic mock data for fictional company stats (P/E, Div Yield).
 */
const FICTIONAL_STOCKS_SET = new Set(["ACME", "SPACELY", "WAYNE", "OSCORP", "STARK"]);

export function useStockStats(
  selectedStock: string,
  currentRatePerETH: string | null,
) {
  const [stats, setStats] = useState<StockStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    // Real-world stocks have no on-chain AMM data — skip contract calls
    if (!FICTIONAL_STOCKS_SET.has(selectedStock)) {
      setIsLoading(false);
      return;
    }
    if (!selectedStock || !currentRatePerETH) return;

    setIsLoading(true);
    try {
      const provider = ProviderFactoryService.getProvider(RH_CHAIN_ID);
      const stockAddr =
        RH_TESTNET_TOKENS[selectedStock as keyof typeof RH_TESTNET_TOKENS];

      const amm = new ethers.Contract(AMM_ADDRESS, AMM_ABI, provider);
      const stockToken = new ethers.Contract(stockAddr, ERC20_ABI, provider);

      // 1. Fetch Total Supply for Market Cap
      const supplyWei = await stockToken.totalSupply();
      const supply = parseFloat(ethers.utils.formatEther(supplyWei));

      // Rate is "Tokens per 1 ETH", so Price in ETH = 1 / Rate
      const priceInETH = 1 / parseFloat(currentRatePerETH.replace(/,/g, ""));
      const marketCapETH = supply * priceInETH;

      // 2. Fetch TVL (Total Value Locked in the AMM pool)
      const [rETH] = await amm.getReserves(WETH_ADDRESS, stockAddr);
      const poolTVLETH = parseFloat(ethers.utils.formatEther(rETH)) * 2; // Assuming symmetric pool value

      // 3. Fetch 24h Volume (approximate using last 43,200 blocks @ 2s block time)
      let volume24hETH = 0;
      try {
        const currentBlock = await provider.getBlockNumber();
        const startBlock = Math.max(0, currentBlock - 43200); // ~24h on Arbitrum Orbit

        // We look for Swap events where this token is involved
        // Sort tokens to match AMM indexing
        const [token0] =
          WETH_ADDRESS < stockAddr
            ? [WETH_ADDRESS, stockAddr]
            : [stockAddr, WETH_ADDRESS];

        // Note: Hardcoding filter without indexed topics for broad reach in testnet
        const logs = await amm.queryFilter(
          amm.filters.Swap(),
          startBlock,
          currentBlock,
        );

        logs.forEach((log) => {
          const parsed = amm.interface.parseLog(log);
          // If WETH is token0, add amount0In + amount0Out
          // If WETH is token1, add amount1In + amount1Out
          if (WETH_ADDRESS === token0) {
            volume24hETH += parseFloat(
              ethers.utils.formatEther(parsed.args.amount0In),
            );
            volume24hETH += parseFloat(
              ethers.utils.formatEther(parsed.args.amount0Out),
            );
          } else {
            volume24hETH += parseFloat(
              ethers.utils.formatEther(parsed.args.amount1In),
            );
            volume24hETH += parseFloat(
              ethers.utils.formatEther(parsed.args.amount1Out),
            );
          }
        });
      } catch (logError) {
        console.warn("[Stats] Could not fetch Swap logs:", logError);
        // Fallback to 0 or mock if RPC fails on wide block ranges
      }

      // 4. Deterministic Mocks for missing real-world equivalents
      // Use the token address to seed the random number so it stays constant
      const seed = parseInt(stockAddr.slice(-4), 16);
      const peRatioMock = 10 + (seed % 30) + (seed % 100) / 100;
      const divYieldMock = (seed % 5) + (seed % 10) / 10;

      // 5. Fetch Synth Volatility Data via API route (server-side only)
      let forecastVol: number | undefined;
      let realizedVol: number | undefined;
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "";
        const response = await fetch(`${apiBase}/api/trading/stock-stats?stock=${selectedStock}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            forecastVol = data.volatility?.forecast;
            realizedVol = data.volatility?.realized;
          }
        }
      } catch (e) {
        console.warn("[Stats] Could not fetch volatility data:", e);
      }

      setStats({
        marketCapETH,
        poolTVLETH,
        volume24hETH,
        peRatioMock,
        divYieldMock: divYieldMock === 0 ? 0 : divYieldMock,
        forecastVol,
        realizedVol,
      });
    } catch (error) {
      console.error("[Stats] Failed to fetch on-chain stats:", error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedStock, currentRatePerETH]);

  useEffect(() => {
    fetchStats();
    // Refresh stats every 60 seconds
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return { stats, isLoading };
}
