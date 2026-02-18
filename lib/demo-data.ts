/**
 * Mock data for demo mode
 * Single source of truth for all demo data
 */

import type { Region } from "@/hooks/use-user-region";

export const DEMO_PORTFOLIO = {
    totalValue: 1000,
    chainCount: 2,
    tokenCount: 5,
    diversificationScore: 72,
    diversificationRating: "Good Diversification" as const,
    weightedInflationRisk: 4.2,

    chains: [
        {
            chainId: 42220,
            chainName: "Celo",
            totalValue: 650,
            tokenCount: 3,
            balances: [
                {
                    symbol: "cUSD",
                    name: "Celo Dollar",
                    balance: "400",
                    value: 400,
                    region: "USA" as Region,
                    chainId: 42220,
                    address: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
                },
                {
                    symbol: "cEUR",
                    name: "Celo Euro",
                    balance: "150",
                    value: 150,
                    region: "Europe" as Region,
                    chainId: 42220,
                    address: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73",
                },
                {
                    symbol: "cKES",
                    name: "Celo Kenyan Shilling",
                    balance: "100",
                    value: 100,
                    region: "Africa" as Region,
                    chainId: 42220,
                    address: "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0",
                },
            ],
        },
        {
            chainId: 42161,
            chainName: "Arbitrum",
            totalValue: 350,
            tokenCount: 2,
            balances: [
                {
                    symbol: "USDC",
                    name: "USD Coin",
                    balance: "250",
                    value: 250,
                    region: "USA" as Region,
                    chainId: 42161,
                    address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
                },
                {
                    symbol: "PAXG",
                    name: "Paxos Gold",
                    balance: "100",
                    value: 100,
                    region: "Global" as Region,
                    chainId: 42161,
                    address: "0xfEb4DfC8C4Cf7Ed305bb08065D08eC6ee6728429",
                },
            ],
        },
    ],

    regionData: [
        { region: "USA" as Region, value: 650, usdValue: 650, color: "#3B82F6" },
        { region: "Europe" as Region, value: 150, usdValue: 150, color: "#8B5CF6" },
        { region: "Africa" as Region, value: 100, usdValue: 100, color: "#F59E0B" },
        { region: "Global" as Region, value: 100, usdValue: 100, color: "#EAB308" },
    ],

    // Match PortfolioAnalysis goalScores shape: { hedge, diversify, rwa }
    goalScores: {
        hedge: 75,
        diversify: 80,
        rwa: 50,
    },

    missingRegions: ['Asia', 'LatAm'],
    overExposedRegions: ['USA'],
    underExposedRegions: ['Africa'],

    diversificationTips: [
        "Consider adding exposure to Asian markets (PHP, SGD)",
        "Your gold allocation (10%) is below recommended 15-20%",
        "Great job diversifying across 2 chains!",
    ],

    rebalancingOpportunities: [
        {
            fromToken: "cUSD",
            toToken: "PAXG",
            fromRegion: "USA" as Region,
            toRegion: "Global" as Region,
            fromInflation: 3.2,
            toInflation: 0,
            suggestedAmount: 50,
            annualSavings: 1.6,
            priority: "MEDIUM" as const,
        },
        {
            fromToken: "cKES",
            toToken: "cEUR",
            fromRegion: "Africa" as Region,
            toRegion: "Europe" as Region,
            fromInflation: 7.8,
            toInflation: 2.1,
            suggestedAmount: 30,
            annualSavings: 1.71,
            priority: "HIGH" as const,
        },
    ],

    // Derived fields for UI components
    get allTokens() {
        return this.chains.flatMap(c => c.balances.map(b => ({
            ...b,
            formattedBalance: b.balance,
            chainName: c.chainName,
            region: b.region
        })));
    },

    isLoading: false,
    isStale: false,
    refresh: async () => { },
};

export const DEMO_USER = {
    address: "0xDemo1234567890123456789012345678901234",
    chainId: 42220,
    region: "Africa" as Region,
};
