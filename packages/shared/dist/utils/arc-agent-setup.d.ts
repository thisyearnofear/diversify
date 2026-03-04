/**
 * Arc Agent Setup Utilities
 * Helper functions for setting up and managing the Arc Network agent
 */
/**
 * Generate a new private key for the Arc Agent
 * This should be run once and the key stored securely in environment variables
 */
export declare function generateAgentPrivateKey(): {
    privateKey: string;
    address: string;
};
/**
 * Validate Arc Agent configuration with enhanced checks
 */
export declare function validateAgentConfig(): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    recommendations: string[];
};
/**
 * Get Arc Network configuration based on environment
 */
export declare function getArcNetworkConfig(): {
    isTestnet: boolean;
    rpcUrl: string;
    chainId: number;
    usdcAddress: string;
    explorerUrl: string;
};
/**
 * Format USDC amount for display
 */
export declare function formatUSDC(amount: number | string): string;
/**
 * Check if x402 is supported for a given URL
 */
export declare function checkX402Support(url: string): Promise<boolean>;
/**
 * Setup instructions for new users
 */
export declare const SETUP_INSTRUCTIONS: {
    title: string;
    steps: ({
        title: string;
        description: string;
        code: string;
        note?: undefined;
    } | {
        title: string;
        description: string;
        note: string;
        code?: undefined;
    })[];
};
//# sourceMappingURL=arc-agent-setup.d.ts.map