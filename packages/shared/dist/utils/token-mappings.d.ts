/**
 * Centralized Token Mapping System
 * Single source of truth for Mento token name mappings
 * Consolidates old C-prefix tokens to new m-suffix tokens
 */
export declare const MENTO_TOKEN_MAPPINGS: Record<string, string>;
export declare const MENTO_TOKEN_MAPPINGS_REVERSE: Record<string, string>;
/**
 * Normalize token symbol to new Mento naming convention
 * @param symbol Token symbol (could be old or new)
 * @returns New token symbol if it exists, otherwise original symbol
 */
export declare function normalizeMentoToken(symbol: string): string;
/**
 * Get the old token name for a given new token (for display purposes)
 * @param symbol New token symbol (e.g., USDm)
 * @returns Old token symbol if it exists, otherwise original symbol
 */
export declare function getOldMentoTokenName(symbol: string): string;
/**
 * Check if a token is a Mento regional stablecoin
 * @param symbol Token symbol
 * @returns Boolean indicating if it's a Mento token
 */
export declare function isMentoToken(symbol: string): boolean;
//# sourceMappingURL=token-mappings.d.ts.map