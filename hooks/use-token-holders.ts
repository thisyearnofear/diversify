import { useState, useEffect, useCallback } from "react";
import { RH_TESTNET_TOKENS } from "../config";

export interface TokenHolder {
  address: string;
  value: string;
  percentage: number;
}

export interface TokenHolderData {
  holdersCount: number;
  totalSupply: string;
  topHolders: TokenHolder[];
}

export function useTokenHolders(selectedStock: string) {
  const [data, setData] = useState<TokenHolderData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHolders = useCallback(async () => {
    if (!selectedStock) return;

    setIsLoading(true);
    try {
      const tokenAddress =
        RH_TESTNET_TOKENS[selectedStock as keyof typeof RH_TESTNET_TOKENS];
      if (!tokenAddress) return;

      const res = await fetch(
        `/api/token-holders?token=${tokenAddress}&limit=10`,
      );
      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error("[TokenHolders] Failed to fetch holder data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedStock]);

  useEffect(() => {
    fetchHolders();
    const interval = setInterval(fetchHolders, 120000);
    return () => clearInterval(interval);
  }, [fetchHolders]);

  return { holderData: data, isHoldersLoading: isLoading };
}
