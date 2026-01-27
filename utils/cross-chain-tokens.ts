/**
 * Cross-Chain Token Configuration
 * Defines which tokens are available on which chains for cross-chain swaps
 * Uses centralized token addresses from config to maintain single source of truth
 */

import { NETWORKS, MAINNET_TOKENS, ALFAJORES_TOKENS, ARBITRUM_TOKENS, ARC_TOKENS } from '../config';

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
                address: ARBITRUM_TOKENS.USDC,
                decimals: 6,
            },
            {
                chainId: NETWORKS.ARC_TESTNET.chainId,
                address: ARC_TOKENS.USDC,
                decimals: 6,
            },
        ],
    },
    {
        symbol: 'EURC',
        name: 'Euro Coin',
        region: 'Europe',
        chains: [
            {
                chainId: NETWORKS.ARC_TESTNET.chainId,
                address: ARC_TOKENS.EURC,
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
                address: MAINNET_TOKENS.CUSD,
                decimals: 18,
            },
            {
                chainId: NETWORKS.ALFAJORES.chainId,
                address: ALFAJORES_TOKENS.CUSD,
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
                address: MAINNET_TOKENS.CEUR,
                decimals: 18,
            },
            {
                chainId: NETWORKS.ALFAJORES.chainId,
                address: ALFAJORES_TOKENS.CEUR,
                decimals: 18,
            },
        ],
    },
    {
        symbol: 'CREAL',
        name: 'Celo Brazilian Real',
        region: 'LatAm',
        chains: [
            {
                chainId: NETWORKS.CELO_MAINNET.chainId,
                address: MAINNET_TOKENS.CREAL,
                decimals: 18,
            },
            {
                chainId: NETWORKS.ALFAJORES.chainId,
                address: ALFAJORES_TOKENS.CREAL,
                decimals: 18,
            },
        ],
    },
    {
        symbol: 'CKES',
        name: 'Celo Kenyan Shilling',
        region: 'Africa',
        chains: [
            {
                chainId: NETWORKS.CELO_MAINNET.chainId,
                address: MAINNET_TOKENS.CKES,
                decimals: 18,
            },
            {
                chainId: NETWORKS.ALFAJORES.chainId,
                address: ALFAJORES_TOKENS.CKES,
                decimals: 18,
            },
        ],
    },
    {
        symbol: 'CCOP',
        name: 'Celo Colombian Peso',
        region: 'LatAm',
        chains: [
            {
                chainId: NETWORKS.CELO_MAINNET.chainId,
                address: MAINNET_TOKENS.CCOP,
                decimals: 18,
            },
            {
                chainId: NETWORKS.ALFAJORES.chainId,
                address: ALFAJORES_TOKENS.CCOP,
                decimals: 18,
            },
        ],
    },
    {
        symbol: 'PUSO',
        name: 'Celo Philippine Peso',
        region: 'Asia',
        chains: [
            {
                chainId: NETWORKS.CELO_MAINNET.chainId,
                address: MAINNET_TOKENS.PUSO,
                decimals: 18,
            },
            {
                chainId: NETWORKS.ALFAJORES.chainId,
                address: ALFAJORES_TOKENS.PUSO,
                decimals: 18,
            },
        ],
    },
    {
        symbol: 'CGHS',
        name: 'Celo Ghana Cedi',
        region: 'Africa',
        chains: [
            {
                chainId: NETWORKS.CELO_MAINNET.chainId,
                address: MAINNET_TOKENS.CGHS,
                decimals: 18,
            },
            {
                chainId: NETWORKS.ALFAJORES.chainId,
                address: ALFAJORES_TOKENS.CGHS,
                decimals: 18,
            },
        ],
    },
    {
        symbol: 'CGBP',
        name: 'Celo British Pound',
        region: 'Europe',
        chains: [
            {
                chainId: NETWORKS.CELO_MAINNET.chainId,
                address: MAINNET_TOKENS.CGBP,
                decimals: 18,
            },
            {
                chainId: NETWORKS.ALFAJORES.chainId,
                address: ALFAJORES_TOKENS.CGBP,
                decimals: 18,
            },
        ],
    },
    {
        symbol: 'CZAR',
        name: 'Celo South African Rand',
        region: 'Africa',
        chains: [
            {
                chainId: NETWORKS.CELO_MAINNET.chainId,
                address: MAINNET_TOKENS.CZAR,
                decimals: 18,
            },
            {
                chainId: NETWORKS.ALFAJORES.chainId,
                address: ALFAJORES_TOKENS.CZAR,
                decimals: 18,
            },
        ],
    },
    {
        symbol: 'CCAD',
        name: 'Celo Canadian Dollar',
        region: 'USA',
        chains: [
            {
                chainId: NETWORKS.CELO_MAINNET.chainId,
                address: MAINNET_TOKENS.CCAD,
                decimals: 18,
            },
            {
                chainId: NETWORKS.ALFAJORES.chainId,
                address: ALFAJORES_TOKENS.CCAD,
                decimals: 18,
            },
        ],
    },
    {
        symbol: 'CAUD',
        name: 'Celo Australian Dollar',
        region: 'Asia',
        chains: [
            {
                chainId: NETWORKS.CELO_MAINNET.chainId,
                address: MAINNET_TOKENS.CAUD,
                decimals: 18,
            },
            {
                chainId: NETWORKS.ALFAJORES.chainId,
                address: ALFAJORES_TOKENS.CAUD,
                decimals: 18,
            },
        ],
    },
    {
        symbol: 'CNGN',
        name: 'Celo Nigerian Naira',
        region: 'Africa',
        chains: [
            {
                chainId: NETWORKS.CELO_MAINNET.chainId,
                address: MAINNET_TOKENS.CNGN,
                decimals: 18,
            },
            {
                chainId: NETWORKS.ALFAJORES.chainId,
                address: ALFAJORES_TOKENS.CNGN,
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
                address: ARBITRUM_TOKENS.PAXG,
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