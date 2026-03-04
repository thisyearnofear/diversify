/**
 * Legacy Mento utilities
 * Kept for backward compatibility - gradually migrate to services/
 */
import { MAINNET_TOKENS as CELO_TOKENS, CELO_SEPOLIA_TOKENS, EXCHANGE_RATES as DEFAULT_EXCHANGE_RATES } from '../config';
export { CELO_TOKENS, CELO_SEPOLIA_TOKENS };
export declare const MENTO_ABIS: {
    ERC20_FULL: readonly ["function balanceOf(address owner) view returns (uint256)", "function allowance(address owner, address spender) view returns (uint256)", "function approve(address spender, uint256 amount) returns (bool)", "function transfer(address to, uint256 amount) returns (bool)", "event Transfer(address indexed from, address indexed to, uint256 value)", "event Approval(address indexed owner, address indexed spender, uint256 value)"];
    ERC20_BALANCE: readonly ["function balanceOf(address owner) view returns (uint256)", "function allowance(address owner, address spender) view returns (uint256)", "function approve(address spender, uint256 amount) returns (bool)", "function transfer(address to, uint256 amount) returns (bool)", "event Transfer(address indexed from, address indexed to, uint256 value)", "event Approval(address indexed owner, address indexed spender, uint256 value)"];
    ERC20_ALLOWANCE: readonly ["function balanceOf(address owner) view returns (uint256)", "function allowance(address owner, address spender) view returns (uint256)", "function approve(address spender, uint256 amount) returns (bool)", "function transfer(address to, uint256 amount) returns (bool)", "event Transfer(address indexed from, address indexed to, uint256 value)", "event Approval(address indexed owner, address indexed spender, uint256 value)"];
    ERC20_APPROVE: readonly ["function balanceOf(address owner) view returns (uint256)", "function allowance(address owner, address spender) view returns (uint256)", "function approve(address spender, uint256 amount) returns (bool)", "function transfer(address to, uint256 amount) returns (bool)", "event Transfer(address indexed from, address indexed to, uint256 value)", "event Approval(address indexed owner, address indexed spender, uint256 value)"];
    BROKER_PROVIDERS: readonly ["function getExchangeProviders() view returns (address[])"];
    EXCHANGE: readonly ["function getExchanges() view returns ((bytes32 exchangeId, address[] assets)[])"];
    BROKER_RATE: readonly ["function getAmountOut(address exchangeProvider, bytes32 exchangeId, address assetIn, address assetOut, uint256 amountIn) view returns (uint256)"];
    BROKER_SWAP: readonly ["function swapIn(address exchangeProvider, bytes32 exchangeId, address assetIn, address assetOut, uint256 amountIn, uint256 minAmountOut) returns (uint256)"];
};
export { DEFAULT_EXCHANGE_RATES };
export declare const MENTO_BROKER_ADDRESS: "0x777a8255ca72412f0d706dc03c9d1987306b4cad";
export declare const CELO_SEPOLIA_BROKER_ADDRESS: "0xD3Dff18E465bCa6241A244144765b4421Ac14D09";
export declare const CACHE_KEYS: {
    EXCHANGE_RATE_BRLM: string;
    EXCHANGE_RATE_KESM: string;
    EXCHANGE_RATE_COPM: string;
    EXCHANGE_RATE_PHPM: string;
};
/**
 * Get cached data or null if not found or expired
 */
export declare const getCachedData: (key: string, duration?: number) => any;
/**
 * Set data in cache
 */
export declare const setCachedData: (key: string, value: any) => void;
/**
 * Get exchange rate for a Celo stablecoin using Mento Protocol
 * @deprecated Use ExchangeDiscoveryService.getQuote instead
 */
export declare const getMentoExchangeRate: (tokenSymbol: string) => Promise<number>;
/**
 * Handle common swap errors
 * @deprecated Use SwapErrorHandler.handle instead
 */
export declare const handleMentoError: (error: unknown, context: string) => string;
//# sourceMappingURL=mento-utils.d.ts.map