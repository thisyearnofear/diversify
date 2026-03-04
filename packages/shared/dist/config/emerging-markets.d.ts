/**
 * Emerging Markets Configuration
 *
 * Two-tier system:
 * - REAL_STOCKS: Trackable real emerging market stocks (price data only)
 * - FICTIONAL_COMPANIES: Tradeable tokens on Celo Sepolia AMM (seeded pools)
 *
 * This mirrors the Robinhood testnet strategy: trade fictional, track real
 */
export interface EmergingMarketStock {
    symbol: string;
    name: string;
    icon: string;
    market: string;
    region: "africa" | "latam" | "asia";
    realTicker: string;
    description: string;
    isTradeable: false;
}
export interface FictionalCompany {
    symbol: string;
    name: string;
    icon: string;
    market: string;
    region: "africa" | "latam" | "asia";
    description: string;
    tokenAddress: string;
    isTradeable: true;
    inspiration: string;
}
export type MarketAsset = EmergingMarketStock | FictionalCompany;
export declare const REAL_EMERGING_MARKET_STOCKS: EmergingMarketStock[];
export declare const FICTIONAL_EMERGING_MARKET_COMPANIES: FictionalCompany[];
/** All trackable real stocks */
export declare const EMERGING_MARKET_STOCKS: EmergingMarketStock[];
/** All tradeable fictional companies */
export declare const EMERGING_MARKET_COMPANIES: FictionalCompany[];
/** All tradeable symbols (for token lists) */
export declare const TRADEABLE_EMERGING_MARKET_SYMBOLS: string[];
/** All trackable symbols (for price tracking) */
export declare const TRACKABLE_EMERGING_MARKET_SYMBOLS: string[];
export declare const EMERGING_MARKETS_CONFIG: {
    chainId: number;
    network: string;
    rpcUrl: string;
    explorerUrl: string;
    ammAddress: string;
    wethAddress: string;
    baseToken: string;
    baseTokenName: string;
    baseTokenIcon: string;
    feePercent: number;
    faucetUrl: string;
    marketName: string;
    marketDescription: string;
    educationalTag: string;
};
/**
 * Get stocks by region
 */
export declare function getStocksByRegion(region: "africa" | "latam" | "asia"): EmergingMarketStock[];
/**
 * Get fictional companies by region
 */
export declare function getCompaniesByRegion(region: "africa" | "latam" | "asia"): FictionalCompany[];
/**
 * Get all assets (stocks + companies) by region
 */
export declare function getAllAssetsByRegion(region: "africa" | "latam" | "asia"): (EmergingMarketStock | FictionalCompany)[];
/**
 * Get stock by symbol (real)
 */
export declare function getEmergingMarketStock(symbol: string): EmergingMarketStock | undefined;
/**
 * Get company by symbol (fictional)
 */
export declare function getFictionalCompany(symbol: string): FictionalCompany | undefined;
/**
 * Get any asset by symbol
 */
export declare function getAssetBySymbol(symbol: string): MarketAsset | undefined;
/**
 * Check if symbol is a tradeable fictional company
 */
export declare function isTradeableCompany(symbol: string): boolean;
/**
 * Check if symbol is a trackable real stock
 */
export declare function isTrackableStock(symbol: string): boolean;
/**
 * Get token address for trading
 */
export declare function getTradingTokenAddress(symbol: string): string | undefined;
/**
 * Get real ticker for price tracking
 */
export declare function getRealTicker(symbol: string): string | undefined;
export declare const REGION_METADATA: {
    africa: {
        label: string;
        icon: string;
        color: string;
        bgGradient: string;
        darkBgGradient: string;
        description: string;
        countries: string[];
    };
    latam: {
        label: string;
        icon: string;
        color: string;
        bgGradient: string;
        darkBgGradient: string;
        description: string;
        countries: string[];
    };
    asia: {
        label: string;
        icon: string;
        color: string;
        bgGradient: string;
        darkBgGradient: string;
        description: string;
        countries: string[];
    };
};
//# sourceMappingURL=emerging-markets.d.ts.map