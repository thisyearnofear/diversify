/**
 * Cross-Chain Token Configuration
 * Defines which tokens are available on which chains for cross-chain swaps
 */

import { NETWORKS } from '../config';

export interface CrossChainToken {
    symbol: string;
    name: string;
    region: string;
    chains: {
        chainId: number;
        address: string;
        decimals: number;
    }[];
}

// Cross-chain token definitions
export const CROSS_CHAIN_TOKENS: CrossChainToken[] = [
    {
        symbol: 'USDC',
        name: 'USD Coin',
        region: 'USA',
        chains: [
            {
                chainId: NETWORKS.ARBITRUM_ONE.chainId,
                address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
                decimals: 6,
            },
            {
                chainId: NETWORKS.ARC_TESTNET.chainId,
                address: '0x3600000000000000000000000000000000000000',
                decimals: 6,
            },
        ],
    },
    {
        symbol: 'CUSD',
        name: 'Celo Dollar',
        region: 'USA',
        chains: [
            {
                chainId: NETWORKS.CELO_MAINNET.chainId,
                address: '0x765de816845861e75a25fca122bb6898b8b1282a',
                decimals: 18,
            },
            {
                chainId: NETWORKS.ALFAJORES.chainId,
                address: '0x874069fa1eb16d44d622f2e0ca25eea172369bc1',
                decimals: 18,
            },
        ],
    },
    {
        symbol: 'CEUR',
        name: 'Celo Euro',
        region: 'Europe',
        chains: [
            {
                chainId: NETWORKS.CELO_MAINNET.chainId,
                address: '0xd8763cba276a3738e6de85b4b3bf5fded6d6ca73',
                decimals: 18,
            },
            {
                chainId: NETWORKS.ALFAJORES.chainId,
                address: '0x10c892a6ec43a53e45d0b916b4b7d383b1b78c0f',
                decimals: 18,
            },
        ],
    },
    {
        symbol: 'PAXG',
        name: 'Paxos Gold',
        region: 'Global',
        chains: [
            {
                chainId: NETWORKS.ARBITRUM_ONE.chainId,
                address: '0xfeb4dfc8c4cf7ed305bb08065d08ec6ee6728429',
                decimals: 18,
            },
        ],
    },
];

/**
 * Get all tokens available on a specific chain
 */
export function getTokensForChain(chainId: number): Array<{
    symbol: string;
    name: string;
    region: string;
    address: string;
    decimals: number;
}> {
    return CROSS_CHAIN_TOKENS
        .filter(token => token.chains.some(chain => chain.chainId === chainId))
        .map(token => {
            const chainInfo = token.chains.find(chain => chain.chainId === chainId)!;
            return {
                symbol: token.symbol,
                name: token.name,
                region: token.region,
                address: chainInfo.address,
                decimals: chainInfo.decimals,
            };
        });
}

/**
 * Get all chains where a token is available
 */
export function getChainsForToken(symbol: string): number[] {
    const token = CROSS_CHAIN_TOKENS.find(t => t.symbol.toUpperCase() === symbol.toUpperCase());
    return token ? token.chains.map(chain => chain.chainId) : [];
}

/**
 * Check if a token is available on a specific chain
 */
export function isTokenAvailableOnChain(symbol: string, chainId: number): boolean {
    return getChainsForToken(symbol).includes(chainId);
}

/**
 * Get token address on a specific chain
 */
export function getTokenAddress(symbol: string, chainId: number): string | null {
    const token = CROSS_CHAIN_TOKENS.find(t => t.symbol.toUpperCase() === symbol.toUpperCase());
    if (!token) return null;

    const chainInfo = token.chains.find(chain => chain.chainId === chainId);
    return chainInfo ? chainInfo.address : null;
}

/**
 * Get all possible cross-chain routes
 */
export function getCrossChainRoutes(): Array<{
    fromChain: number;
    toChain: number;
    fromToken: string;
    toToken: string;
    bridgeRequired: boolean;
}> {
    const routes: Array<{
        fromChain: number;
        toChain: number;
        fromToken: string;
        toToken: string;
        bridgeRequired: boolean;
    }> = [];

    // Generate all possible combinations
    CROSS_CHAIN_TOKENS.forEach(fromToken => {
        fromToken.chains.forEach(fromChain => {
            CROSS_CHAIN_TOKENS.forEach(toToken => {
                toToken.chains.forEach(toChain => {
                    // Skip same token on same chain
                    if (fromToken.symbol === toToken.symbol && fromChain.chainId === toChain.chainId) {
                        return;
                    }

                    routes.push({
                        fromChain: fromChain.chainId,
                        toChain: toChain.chainId,
                        fromToken: fromToken.symbol,
                        toToken: toToken.symbol,
                        bridgeRequired: fromChain.chainId !== toChain.chainId,
                    });
                });
            });
        });
    });

    return routes;
}

/**
 * Get supported chain IDs for cross-chain swaps
 */
export function getSupportedChainIds(): number[] {
    const chainIds = new Set<number>();
    CROSS_CHAIN_TOKENS.forEach(token => {
        token.chains.forEach(chain => {
            chainIds.add(chain.chainId);
        });
    });
    return Array.from(chainIds);
}