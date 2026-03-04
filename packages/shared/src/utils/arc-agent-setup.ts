/**
 * Arc Agent Setup Utilities
 * Helper functions for setting up and managing the Arc Network agent
 */

import { ethers } from 'ethers';

/**
 * Generate a new private key for the Arc Agent
 * This should be run once and the key stored securely in environment variables
 */
export function generateAgentPrivateKey(): { privateKey: string; address: string } {
    const wallet = ethers.Wallet.createRandom();
    return {
        privateKey: wallet.privateKey,
        address: wallet.address
    };
}

/**
 * Validate Arc Agent configuration with enhanced checks
 */
export function validateAgentConfig(): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    recommendations: string[];
} {
    const errors: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Check required environment variables
    if (!process.env.ARC_AGENT_PRIVATE_KEY) {
        errors.push('ARC_AGENT_PRIVATE_KEY is required');
        recommendations.push('Run `pnpm setup-arc-agent` to generate a wallet');
    } else {
        try {
            const wallet = new ethers.Wallet(process.env.ARC_AGENT_PRIVATE_KEY);
            console.log(`Agent wallet address: ${wallet.address}`);
        } catch {
            errors.push('ARC_AGENT_PRIVATE_KEY is not a valid private key');
        }
    }

    // Check network configuration
    const isTestnet = process.env.ARC_AGENT_TESTNET !== 'false';
    const rpcUrl = isTestnet
        ? (process.env.NEXT_PUBLIC_ARC_RPC || 'https://rpc.testnet.arc.network')
        : 'https://rpc.arc.network';

    if (!rpcUrl.startsWith('https://')) {
        warnings.push('RPC URL should use HTTPS for security');
    }

    // Check API keys with enhanced validation
    const apiKeys = {
        'ALPHA_VANTAGE_API_KEY': {
            required: false,
            description: 'exchange rate data',
            testUrl: 'https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=USD&to_currency=EUR&apikey='
        },
        'FRED_API_KEY': {
            required: false,
            description: 'inflation data',
            testUrl: 'https://api.stlouisfed.org/fred/series?series_id=CPIAUCSL&api_key='
        },
        'COINGECKO_API_KEY': {
            required: false,
            description: 'crypto market data',
            testUrl: null
        },
        'TRUFLATION_API_KEY': {
            required: false,
            description: 'premium inflation data',
            testUrl: null
        },
        'GLASSNODE_API_KEY': {
            required: false,
            description: 'on-chain analytics',
            testUrl: null
        },
        'HELIOSTAT_API_KEY': {
            required: false,
            description: 'yield optimization',
            testUrl: null
        }
    };

    Object.entries(apiKeys).forEach(([key, config]) => {
        if (!process.env[key]) {
            if (config.required) {
                errors.push(`${key} is required`);
            } else {
                warnings.push(`${key} not set - ${config.description} may be limited`);
                recommendations.push(`Get ${key} for enhanced ${config.description}`);
            }
        } else {
            // Validate API key format
            const apiKey = process.env[key];
            if (apiKey.length < 10) {
                warnings.push(`${key} appears to be too short (${apiKey.length} chars)`);
            }
        }
    });

    // Check spending limits with enhanced validation
    const dailyLimit = parseFloat(process.env.ARC_AGENT_DAILY_LIMIT || '5.0');
    if (isNaN(dailyLimit) || dailyLimit <= 0) {
        errors.push('ARC_AGENT_DAILY_LIMIT must be a positive number');
    } else {
        if (dailyLimit > 100) {
            warnings.push('ARC_AGENT_DAILY_LIMIT is very high - consider security implications');
        } else if (dailyLimit < 1) {
            warnings.push('ARC_AGENT_DAILY_LIMIT is very low - may limit analysis capabilities');
        }
    }

    // Check data hub configuration
    const dataHubWallet = process.env.DATA_HUB_RECIPIENT_ADDRESS;
    if (dataHubWallet) {
        try {
            ethers.utils.getAddress(dataHubWallet);
        } catch {
            errors.push('DATA_HUB_RECIPIENT_ADDRESS is not a valid Ethereum address');
        }
    }

    // Security recommendations
    if (process.env.NODE_ENV === 'production') {
        recommendations.push('Ensure private keys are stored securely (not in code)');
        recommendations.push('Set up monitoring for spending limits and API usage');
        recommendations.push('Consider using a dedicated agent wallet with limited funds');
    }

    // Performance recommendations
    if (!process.env.REDIS_URL && process.env.NODE_ENV === 'production') {
        recommendations.push('Consider Redis for production caching and rate limiting');
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        recommendations
    };
}

/**
 * Get Arc Network configuration based on environment
 */
export function getArcNetworkConfig() {
    const isTestnet = process.env.ARC_AGENT_TESTNET !== 'false';

    return {
        isTestnet,
        rpcUrl: isTestnet
            ? (process.env.NEXT_PUBLIC_ARC_RPC || 'https://rpc.testnet.arc.network')
            : 'https://rpc.arc.network',
        chainId: isTestnet ? 5042002 : 5042001,
        usdcAddress: isTestnet
            ? '0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B'
            : '0xA0b86a33E6441b8435b662f0E2c8A0E1B8B8F8B8', // Placeholder for mainnet
        explorerUrl: isTestnet
            ? 'https://testnet.arcscan.app'
            : 'https://arcscan.app'
    };
}

/**
 * Format USDC amount for display
 */
export function formatUSDC(amount: number | string): string {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 6
    }).format(num);
}

/**
 * Check if x402 is supported for a given URL
 */
export async function checkX402Support(url: string): Promise<boolean> {
    try {
        const response = await fetch(url, { method: 'HEAD' });
        return response.status === 402 || response.headers.has('x-payment-required');
    } catch {
        return false;
    }
}

/**
 * Setup instructions for new users
 */
export const SETUP_INSTRUCTIONS = {
    title: "Arc Agent Setup Guide",
    steps: [
        {
            title: "Generate Agent Wallet",
            description: "Run `generateAgentPrivateKey()` to create a new wallet for your agent",
            code: `
import { generateAgentPrivateKey } from './utils/arc-agent-setup';
const { privateKey, address } = generateAgentPrivateKey();
console.log('Agent Address:', address);
console.log('Private Key (keep secret):', privateKey);
      `
        },
        {
            title: "Fund Agent Wallet",
            description: "Send USDC to the agent address on Arc Network",
            note: "Recommended: 10-50 USDC for testing, more for production use"
        },
        {
            title: "Configure Environment",
            description: "Add the private key and API keys to your .env file",
            code: `
ARC_AGENT_PRIVATE_KEY=your_private_key_here
ARC_AGENT_DAILY_LIMIT=5.0
ARC_AGENT_TESTNET=true
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key
FRED_API_KEY=your_fred_key
      `
        },
        {
            title: "Test Configuration",
            description: "Run validation to ensure everything is set up correctly",
            code: `
import { validateAgentConfig } from './utils/arc-agent-setup';
const validation = validateAgentConfig();
console.log('Setup valid:', validation.isValid);
if (validation.errors.length > 0) {
  console.error('Errors:', validation.errors);
}
      `
        }
    ]
};