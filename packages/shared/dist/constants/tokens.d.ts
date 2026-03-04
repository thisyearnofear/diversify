/**
 * Token Design System
 *
 * Consistent visual identity for all tokens across the app.
 * Ensures uniform gradients, icons, and styling recommendations.
 *
 * Core Principles:
 * - CONSISTENT: Same token always looks the same
 * - ACCESSIBLE: High contrast, clear visual hierarchy
 * - DELIGHTFUL: Premium feel with gradients and animations
 * - SCALABLE: Easy to add new tokens
 */
export interface TokenDesign {
    symbol: string;
    name: string;
    gradient: string;
    icon: string;
    textColor: string;
    bgColor: string;
    borderColor: string;
    shadowColor: string;
    category: 'stablecoin' | 'yield' | 'commodity' | 'equity' | 'regional' | 'default';
    description: string;
    shortLabel: string;
}
export declare const TOKEN_DESIGN: Record<string, TokenDesign>;
export interface RegionDesign {
    name: string;
    color: string;
    gradient: string;
    icon: string;
    textColor: string;
    description: string;
}
export declare const REGION_DESIGN: Record<string, RegionDesign>;
/**
 * Get design for a token (with fallback to default)
 */
export declare function getTokenDesign(symbol: string): TokenDesign;
/**
 * Get design for a region
 */
export declare function getRegionDesign(region: string): RegionDesign;
/**
 * Get icon for token (safe fallback)
 */
export declare function getTokenIcon(symbol: string): string;
/**
 * Get gradient classes for token
 */
export declare function getTokenGradient(symbol: string): string;
/**
 * Check if token is a yield-bearing asset
 */
export declare function isYieldToken(symbol: string): boolean;
/**
 * Check if token is a commodity (gold, etc.)
 */
export declare function isCommodityToken(symbol: string): boolean;
/**
 * Check if token is an equity (stock token)
 */
export declare function isEquityToken(symbol: string): boolean;
export declare const TokenDesignSystem: {
    TOKEN_DESIGN: Record<string, TokenDesign>;
    REGION_DESIGN: Record<string, RegionDesign>;
    getTokenDesign: typeof getTokenDesign;
    getRegionDesign: typeof getRegionDesign;
    getTokenIcon: typeof getTokenIcon;
    getTokenGradient: typeof getTokenGradient;
    isYieldToken: typeof isYieldToken;
    isCommodityToken: typeof isCommodityToken;
    isEquityToken: typeof isEquityToken;
};
export default TokenDesignSystem;
//# sourceMappingURL=tokens.d.ts.map