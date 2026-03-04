import { AssetRegion } from "../config";
export interface TokenBalance {
    symbol: string;
    name: string;
    balance: string;
    formattedBalance: string;
    value: number;
    region: AssetRegion;
    chainId: number;
    chainName: string;
}
export interface ChainBalance {
    chainId: number;
    chainName: string;
    totalValue: number;
    tokenCount: number;
    balances: TokenBalance[];
    isLoading: boolean;
    error: string | null;
}
export interface MultichainPortfolio {
    chains: ChainBalance[];
    totalValue: number;
    tokenCount: number;
    chainCount: number;
    isLoading: boolean;
    isError: boolean;
    refresh: () => Promise<void>;
    lastUpdated: number;
}
//# sourceMappingURL=portfolio.d.ts.map