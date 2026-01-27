export declare const CELO_TOKENS: {
    CELO: string;
    CUSD: string;
    CEUR: string;
    CKES: string;
    CCOP: string;
    PUSO: string;
};
export declare const MENTO_BROKER_ADDRESS = "0x777a8255ca72412f0d706dc03c9d1987306b4cad";
export declare const MENTO_ABIS: {
    ERC20_BALANCE: string[];
    ERC20_ALLOWANCE: string[];
    ERC20_APPROVE: string[];
    BROKER_PROVIDERS: string[];
    EXCHANGE: string[];
    BROKER_RATE: string[];
    BROKER_SWAP: string[];
};
export declare const DEFAULT_EXCHANGE_RATES: {
    CKES: number;
    CCOP: number;
    PUSO: number;
};
export declare const CACHE_KEYS: {
    EXCHANGE_RATE_CKES: string;
    EXCHANGE_RATE_CCOP: string;
    EXCHANGE_RATE_PUSO: string;
};
export declare const CACHE_DURATIONS: {
    EXCHANGE_RATE: number;
    BALANCE: number;
};
/**
 * Get cached data or null if not found or expired
 * @param key Cache key
 * @param duration Cache duration in milliseconds
 * @returns Cached value or null
 */
export declare const getCachedData: (key: string, duration?: number) => any;
/**
 * Set data in cache
 * @param key Cache key
 * @param value Value to cache
 */
export declare const setCachedData: (key: string, value: any) => void;
/**
 * Get exchange rate for a Celo stablecoin using Mento Protocol
 * @param tokenSymbol Token symbol (CKES, CCOP, PUSO)
 * @returns Exchange rate (cUSD to token)
 */
export declare const getMentoExchangeRate: (tokenSymbol: string) => Promise<number>;
export interface TradeablePair {
    assets: {
        address: string;
        symbol: string;
    }[];
    exchangeId: string;
    exchangeProvider: string;
}
/**
 * Get all tradeable pairs from Mento exchanges
 * @param rpcUrl RPC URL (defaults to Celo mainnet)
 * @returns Array of tradeable pairs with token addresses and symbols
 */
export declare const getTradeablePairs: (rpcUrl?: string) => Promise<TradeablePair[]>;
/**
 * Get all unique tradeable token symbols from Mento
 * @param rpcUrl RPC URL
 * @returns Array of unique token symbols that can be traded
 */
export declare const getTradeableTokenSymbols: (rpcUrl?: string) => Promise<string[]>;
/**
 * Check if a token pair is tradeable on Mento
 * @param fromSymbol Source token symbol
 * @param toSymbol Destination token symbol
 * @param rpcUrl RPC URL
 * @returns Whether the pair can be traded
 */
export declare const isPairTradeable: (fromSymbol: string, toSymbol: string, rpcUrl?: string) => Promise<boolean>;
/**
 * Handle common swap errors
 * @param error Error object
 * @param context Context string for error message
 * @returns User-friendly error message
 */
export declare const handleMentoError: (error: unknown, context: string) => string;
