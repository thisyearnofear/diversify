/**
 * Utility functions for environment detection
 */
/**
 * Checks if the app is running in the MiniPay environment
 * MiniPay injects a special property into the window.ethereum object
 */
export declare function isMiniPayEnvironment(): boolean;
/**
 * Checks if the app is running in a mobile environment
 * This is a simple check based on screen width and user agent
 */
export declare function isMobileEnvironment(): boolean;
/**
 * Checks if the app is running in the Farcaster environment
 * Farcaster triggers frames and mini apps with specific referrers or parameters
 */
export declare function isFarcasterEnvironment(): boolean;
/**
 * Checks if the app should render the DiversiFi UI
 * This is true if the app is running in MiniPay, Farcaster, or on the root path
 */
export declare function shouldRenderDiversiFiUI(): boolean;
//# sourceMappingURL=environment.d.ts.map