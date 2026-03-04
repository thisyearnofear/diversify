/**
 * LiFi SDK Configuration
 * Centralized configuration for LiFi SDK to avoid initialization issues
 * Fixed to handle frontend wallet integration properly with Farcaster support
 */
/**
 * Initialize LiFi SDK configuration
 * Safe to call multiple times - will only configure once
 */
export declare function initializeLiFiConfig(): void;
/**
 * Initialize LiFi for route discovery only (no wallet needed)
 * Use this for getting quotes without wallet connection
 */
export declare function initializeLiFiForQuotes(): void;
/**
 * Check if LiFi SDK is configured
 */
export declare function isLiFiConfigured(): boolean;
/**
 * Reset configuration state (useful for testing)
 */
export declare function resetLiFiConfig(): void;
/**
 * Ensure wallet is connected and ready for LiFi operations
 */
export declare function ensureWalletConnection(): Promise<void>;
/**
 * Ensure wallet provider is available before using LiFi SDK
 */
export declare function validateWalletProvider(): Promise<void>;
/**
 * Check if LiFi SDK can detect execution providers
 */
export declare function checkExecutionProviders(): Promise<void>;
//# sourceMappingURL=lifi-config.d.ts.map