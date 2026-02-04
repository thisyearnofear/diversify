/**
 * Real World Assets (RWA) Service
 * Integrates with RWA protocols on multiple networks, focusing on Arbitrum
 */

import { ethers } from 'ethers';

export interface RWAToken {
    address: string;
    symbol: string;
    name: string;
    type: 'treasury' | 'real_estate' | 'commodity' | 'credit' | 'stable_yield';
    apy?: number;
    tvl?: number;
    chain: string;
    description: string;
    minInvestment?: number;
    riskLevel: 'low' | 'medium' | 'high';
}

// RWA Token Registry - Real addresses and data
// Prioritizing permissionless tokens with deep DEX liquidity for frictionless UX
export const RWA_TOKENS: Record<string, RWAToken[]> = {
    arbitrum: [
        {
            address: '0xfeb4dfc8c4cf7ed305bb08065d08ec6ee6728429',
            symbol: 'PAXG',
            name: 'Paxos Gold',
            type: 'commodity',
            apy: 0,
            tvl: 10000000,
            chain: 'arbitrum',
            description: 'Tokenized gold on Arbitrum - hedge against currency debasement. Permissionless secondary market.',
            minInvestment: 10,
            riskLevel: 'low'
        },
        {
            address: '0x96F6eF951840721AdBF41Ac996DdF11aCb0A6382',
            symbol: 'USDY',
            name: 'Ondo US Dollar Yield',
            type: 'treasury',
            apy: 5.0,
            tvl: 150000000, // ~$150M TVL
            chain: 'arbitrum',
            description: 'Tokenized US Treasuries with auto-accruing yield. No KYC required. Deep liquidity on Camelot & Uniswap.',
            minInvestment: 10, // $10 practical minimum via DEX
            riskLevel: 'low'
        },
        {
            address: '0x83F20F44975D03b1b09e64809B757c47f942BEeA',
            symbol: 'SYRUPUSDC',
            name: 'Syrup USDC',
            type: 'stable_yield',
            apy: 4.5,
            tvl: 800000000, // ~$800M TVL across chains
            chain: 'arbitrum',
            description: 'Permissionless yield-bearing stablecoin from Maker/Sky. Rebasing yield on DAI collateral.',
            minInvestment: 5,
            riskLevel: 'low'
        },
        {
            address: '0x4277f8F2c384827B5273592FF7CeBd9f2C1ac258',
            symbol: 'GLP',
            name: 'GMX Liquidity Provider Token',
            type: 'credit',
            apy: 12.5,
            tvl: 400000000,
            chain: 'arbitrum',
            description: 'Real yield from GMX trading fees and liquidations',
            minInvestment: 50,
            riskLevel: 'medium'
        }
    ],
    ethereum: [
        {
            address: '0x45804880De22913dAFE09f4980848ECE6EcbAf78',
            symbol: 'PAXG',
            name: 'Paxos Gold',
            type: 'commodity',
            apy: 0,
            tvl: 500000000,
            chain: 'ethereum',
            description: 'Each token represents one fine troy ounce of gold',
            minInvestment: 2000, // High due to gas costs
            riskLevel: 'medium'
        },
        {
            address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
            symbol: 'FOBXX',
            name: 'Franklin OnChain US Government Money Fund',
            type: 'treasury',
            apy: 4.9,
            tvl: 300000000,
            chain: 'ethereum',
            description: 'Franklin Templeton money market fund on-chain',
            minInvestment: 1000,
            riskLevel: 'low'
        }
    ],
    polygon: [
        {
            address: '0x2F800Db0fdb5223b3C3f354886d907A671414A7F',
            symbol: 'BCT',
            name: 'Base Carbon Tonne',
            type: 'commodity',
            apy: 0,
            tvl: 25000000,
            chain: 'polygon',
            description: 'Tokenized carbon credits for environmental impact',
            minInvestment: 10,
            riskLevel: 'high'
        }
    ]
};

// Network configurations
export const RWA_NETWORKS = {
    arbitrum: {
        chainId: 42161,
        name: 'Arbitrum',
        rpcUrl: 'https://arb1.arbitrum.io/rpc',
        blockExplorer: 'https://arbiscan.io',
        nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
        avgGasCost: 1.5 // USD
    },
    ethereum: {
        chainId: 1,
        name: 'Ethereum Mainnet',
        rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/demo',
        blockExplorer: 'https://etherscan.io',
        nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
        avgGasCost: 25.0 // USD
    },
    polygon: {
        chainId: 137,
        name: 'Polygon',
        rpcUrl: 'https://polygon-rpc.com',
        blockExplorer: 'https://polygonscan.com',
        nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
        avgGasCost: 0.05 // USD
    }
};

export class RWAService {
    private providers: Record<string, ethers.providers.JsonRpcProvider> = {};

    constructor() {
        // Providers are now initialized lazily in getProvider()
    }

    private getProvider(network: string): ethers.providers.JsonRpcProvider {
        if (!this.providers[network]) {
            const config = RWA_NETWORKS[network as keyof typeof RWA_NETWORKS];
            if (!config) throw new Error(`Network ${network} not supported`);

            // For Ethereum, don't use the demo key if we're on the client side to avoid CORS issues
            // Use public RPC fallbacks instead
            let rpcUrl = config.rpcUrl;
            if (network === 'ethereum' && rpcUrl.includes('alchemy.com/v2/demo') && typeof window !== 'undefined') {
                console.warn('Using public RPC fallback for Ethereum to avoid CORS errors');
                // Try multiple public RPCs in order of preference
                const publicRpcs = [
                    'https://eth.llamarpc.com',
                    'https://rpc.ankr.com/eth',
                    'https://eth.publicnode.com',
                    'https://ethereum.publicnode.com'
                ];
                rpcUrl = publicRpcs[0];
            }

            try {
                this.providers[network] = new ethers.providers.JsonRpcProvider(rpcUrl);
            } catch (error) {
                console.error(`Failed to create provider for ${network} with ${rpcUrl}`, error);
                throw new Error(`Failed to connect to ${network} network`);
            }
        }
        return this.providers[network];
    }

    /**
     * Get all available RWA tokens across networks
     */
    getAllRWATokens(): RWAToken[] {
        return Object.values(RWA_TOKENS).flat();
    }

    /**
     * Get RWA tokens by type
     */
    getRWATokensByType(type: RWAToken['type']): RWAToken[] {
        return this.getAllRWATokens().filter(token => token.type === type);
    }

    /**
     * Get RWA tokens by network
     */
    getRWATokensByNetwork(network: string): RWAToken[] {
        return RWA_TOKENS[network] || [];
    }

    /**
     * Get RWA recommendations based on user preferences and amount
     */
    getRWARecommendations(preferences: {
        riskTolerance: 'low' | 'medium' | 'high';
        investmentAmount: number;
        preferredNetwork?: string;
        minAPY?: number;
        maxGasFees?: number;
    }): {
        recommended: RWAToken[];
        reasoning: string;
        totalGasCost: number;
    } {
        let tokens = this.getAllRWATokens();

        // Filter by minimum investment amount (including gas costs)
        tokens = tokens.filter(token => {
            const networkConfig = RWA_NETWORKS[token.chain as keyof typeof RWA_NETWORKS];
            const totalCost = (token.minInvestment || 0) + (networkConfig?.avgGasCost || 0);
            return preferences.investmentAmount >= totalCost;
        });

        // Filter by network preference
        if (preferences.preferredNetwork) {
            tokens = tokens.filter(t => t.chain === preferences.preferredNetwork);
        }

        // Filter by minimum APY
        if (preferences.minAPY !== undefined) {
            const minAPY = preferences.minAPY;
            tokens = tokens.filter(t => (t.apy || 0) >= minAPY);
        }

        // Filter by risk tolerance
        const riskMapping = {
            'low': ['low'],
            'medium': ['low', 'medium'],
            'high': ['low', 'medium', 'high']
        };

        tokens = tokens.filter(t =>
            riskMapping[preferences.riskTolerance].includes(t.riskLevel)
        );

        // Sort by efficiency (APY / gas cost ratio for small amounts)
        tokens = tokens.sort((a, b) => {
            const aNetwork = RWA_NETWORKS[a.chain as keyof typeof RWA_NETWORKS];
            const bNetwork = RWA_NETWORKS[b.chain as keyof typeof RWA_NETWORKS];

            const aEfficiency = (a.apy || 0) / (aNetwork?.avgGasCost || 1);
            const bEfficiency = (b.apy || 0) / (bNetwork?.avgGasCost || 1);

            return bEfficiency - aEfficiency;
        });

        // Generate reasoning
        let reasoning = '';
        const totalGasCost = tokens.slice(0, 3).reduce((sum, token) => {
            const networkConfig = RWA_NETWORKS[token.chain as keyof typeof RWA_NETWORKS];
            return sum + (networkConfig?.avgGasCost || 0);
        }, 0);

        // Dynamic reasoning based on preferences and market context
        const treasuryYield = 4.5; // Would fetch from API
        const inflation = 3.2; // Would fetch from API
        const realYield = treasuryYield - inflation;
        
        if (tokens.length === 0) {
            reasoning = `No suitable RWA options found for $${preferences.investmentAmount}. Consider increasing investment amount or lowering requirements.`;
        } else if (preferences.investmentAmount < 100) {
            const topPick = tokens[0];
            reasoning = `For amounts under $100, Arbitrum minimizes gas costs. ${topPick.symbol} ${topPick.apy && topPick.apy > 0 ? `offers ${topPick.apy}% APY` : 'provides ' + topPick.type.replace('_', ' ') + ' exposure'}.`;
        } else if (preferences.investmentAmount < 1000) {
            // Context-aware recommendation
            if (realYield > 2 && preferences.riskTolerance !== 'high') {
                const yieldToken = tokens.find(t => t.symbol === 'USDY' || t.symbol === 'SYRUPUSDC') || tokens[0];
                reasoning = `With ${realYield.toFixed(1)}% real yields, ${yieldToken.symbol} (${yieldToken.apy}% APY) offers compelling returns vs non-yielding alternatives.`;
            } else if (preferences.riskTolerance === 'high' && inflation > 4) {
                const goldToken = tokens.find(t => t.symbol === 'PAXG') || tokens[0];
                reasoning = `High inflation (${inflation}%) environment favors ${goldToken.symbol} as a hard asset hedge despite 0% yield.`;
            } else {
                reasoning = `With $${preferences.investmentAmount}, consider ${tokens[0].symbol} for ${tokens[0].apy && tokens[0].apy > 0 ? tokens[0].apy + '% yield' : tokens[0].type.replace('_', ' ') + ' exposure'}. Opportunity cost: ${tokens.find(t => t.apy && t.apy > 0)?.apy || 0}% vs 0% for gold.`;
            }
        } else {
            reasoning = `With $${preferences.investmentAmount}, diversify across multiple RWA tokens. Current real yield is ${realYield.toFixed(1)}% (${treasuryYield}% Treasury - ${inflation}% inflation).`;
        }

        return {
            recommended: tokens.slice(0, 5),
            reasoning,
            totalGasCost
        };
    }

    /**
     * Get token balance for a user
     */
    async getTokenBalance(
        tokenAddress: string,
        userAddress: string,
        network: string
    ): Promise<number> {
        try {
            const provider = this.getProvider(network);

            const tokenContract = new ethers.Contract(
                tokenAddress,
                [
                    'function balanceOf(address) view returns (uint256)',
                    'function decimals() view returns (uint8)'
                ],
                provider
            );

            const [balance, decimals] = await Promise.all([
                tokenContract.balanceOf(userAddress),
                tokenContract.decimals()
            ]);

            return parseFloat(ethers.utils.formatUnits(balance, decimals));
        } catch (error) {
            console.error(`Error getting token balance:`, error);
            return 0;
        }
    }

    /**
     * Get current APY for yield-bearing RWA tokens
     */
    async getCurrentAPY(tokenAddress: string, network: string): Promise<number> {
        // This would integrate with specific protocol APIs
        // For now, return cached APY from token registry
        const token = this.getAllRWATokens().find(
            t => t.address.toLowerCase() === tokenAddress.toLowerCase() && t.chain === network
        );

        return token?.apy || 0;
    }

    /**
     * Get total RWA portfolio value and breakdown
     */
    async getPortfolioValue(userAddress: string): Promise<{
        totalValue: number;
        totalYield: number;
        breakdown: Array<{
            token: RWAToken;
            balance: number;
            value: number;
            annualYield: number;
        }>;
        diversificationScore: number;
    }> {
        const breakdown = [];
        let totalValue = 0;
        let totalYield = 0;

        for (const token of this.getAllRWATokens()) {
            const balance = await this.getTokenBalance(token.address, userAddress, token.chain);

            if (balance > 0) {
                // For simplicity, assume 1:1 USD value for most RWA tokens
                // In production, you'd fetch real prices from oracles
                const value = balance * 1;
                const annualYield = value * ((token.apy || 0) / 100);

                breakdown.push({
                    token,
                    balance,
                    value,
                    annualYield
                });

                totalValue += value;
                totalYield += annualYield;
            }
        }

        // Calculate diversification score (0-1)
        const typeCount = new Set(breakdown.map(b => b.token.type)).size;
        const networkCount = new Set(breakdown.map(b => b.token.chain)).size;
        const diversificationScore = Math.min(1, (typeCount * 0.4 + networkCount * 0.6) / 4);

        return {
            totalValue,
            totalYield,
            breakdown,
            diversificationScore
        };
    }

    /**
     * Get network-specific gas estimates
     */
    async getGasEstimate(network: string, operation: 'transfer' | 'swap' | 'deposit'): Promise<{
        gasPrice: number;
        estimatedCost: number;
        estimatedCostUSD: number;
    }> {
        const provider = this.getProvider(network);

        try {
            const gasPrice = await provider.getGasPrice();
            const gasPriceGwei = parseFloat(ethers.utils.formatUnits(gasPrice, 'gwei'));

            // Estimate gas units based on operation
            const gasUnits = {
                'transfer': 21000,
                'swap': 150000,
                'deposit': 200000
            }[operation] || 100000;

            const estimatedCostETH = parseFloat(ethers.utils.formatEther(gasPrice.mul(gasUnits)));

            // Use network's average cost or calculate from current prices
            const networkConfig = RWA_NETWORKS[network as keyof typeof RWA_NETWORKS];
            const estimatedCostUSD = networkConfig?.avgGasCost || (estimatedCostETH * 2000); // Fallback ETH price

            return {
                gasPrice: gasPriceGwei,
                estimatedCost: estimatedCostETH,
                estimatedCostUSD
            };
        } catch (error) {
            console.error('Failed to get gas estimate:', error);
            const networkConfig = RWA_NETWORKS[network as keyof typeof RWA_NETWORKS];
            return {
                gasPrice: 0,
                estimatedCost: 0,
                estimatedCostUSD: networkConfig?.avgGasCost || 1
            };
        }
    }

    /**
     * Get optimal network for a given investment amount
     */
    getOptimalNetwork(investmentAmount: number): {
        network: string;
        reasoning: string;
        gasCostPercentage: number;
    } {
        const networks = Object.entries(RWA_NETWORKS).map(([key, config]) => ({
            network: key,
            config,
            gasCostPercentage: (config.avgGasCost / investmentAmount) * 100
        }));

        // Sort by gas cost percentage (lower is better)
        networks.sort((a, b) => a.gasCostPercentage - b.gasCostPercentage);

        const optimal = networks[0];

        let reasoning = '';
        if (optimal.gasCostPercentage > 10) {
            reasoning = `Investment amount too small. Gas costs would be ${optimal.gasCostPercentage.toFixed(1)}% of investment.`;
        } else if (optimal.network === 'arbitrum') {
            reasoning = `Arbitrum offers the best cost efficiency with gas costs at ${optimal.gasCostPercentage.toFixed(1)}% of investment.`;
        } else if (optimal.network === 'polygon') {
            reasoning = `Polygon offers the lowest gas costs at ${optimal.gasCostPercentage.toFixed(1)}% of investment.`;
        } else {
            reasoning = `${optimal.config.name} is optimal for this investment size.`;
        }

        return {
            network: optimal.network,
            reasoning,
            gasCostPercentage: optimal.gasCostPercentage
        };
    }
}

// Export singleton instance
export const rwaService = new RWAService();

// Helper function to format RWA data for UI
export function formatRWAToken(token: RWAToken) {
    return {
        ...token,
        apyFormatted: token.apy ? `${token.apy.toFixed(1)}%` : 'N/A',
        tvlFormatted: token.tvl ? `$${(token.tvl / 1000000).toFixed(1)}M` : 'N/A',
        networkName: RWA_NETWORKS[token.chain as keyof typeof RWA_NETWORKS]?.name || token.chain,
        riskBadge: {
            low: { color: 'green', text: 'Low Risk' },
            medium: { color: 'yellow', text: 'Medium Risk' },
            high: { color: 'red', text: 'High Risk' }
        }[token.riskLevel]
    };
}