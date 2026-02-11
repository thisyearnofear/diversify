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
        symbol: 'USDm',
        name: 'Mento Dollar',
        region: 'USA',
        chains: [
            {
                chainId: NETWORKS.CELO_MAINNET.chainId,
                address: MAINNET_TOKENS.USDm,
                decimals: 18,
            },
            {
                chainId: NETWORKS.ALFAJORES.chainId,
                address: ALFAJORES_TOKENS.USDm,
                decimals: 18,
            },
        ],
    },
    {
        symbol: 'EURm',
        name: 'Mento Euro',
        region: 'Europe',
        chains: [
            {
                chainId: NETWORKS.CELO_MAINNET.chainId,
                address: MAINNET_TOKENS.EURm,
                decimals: 18,
            },
            {
                chainId: NETWORKS.ALFAJORES.chainId,
                address: ALFAJORES_TOKENS.EURm,
                decimals: 18,
            },
        ],
    },
    {
        symbol: 'BRLm',
        name: 'Mento Brazilian Real',
        region: 'LatAm',
        chains: [
            {
                chainId: NETWORKS.CELO_MAINNET.chainId,
                address: MAINNET_TOKENS.BRLm,
                decimals: 18,
            },
            {
                chainId: NETWORKS.ALFAJORES.chainId,
                address: ALFAJORES_TOKENS.BRLm,
                decimals: 18,
            },
        ],
    },
    {
        symbol: 'KESm',
        name: 'Mento Kenyan Shilling',
        region: 'Africa',
        chains: [
            {
                chainId: NETWORKS.CELO_MAINNET.chainId,
                address: MAINNET_TOKENS.KESm,
                decimals: 18,
            },
            {
                chainId: NETWORKS.ALFAJORES.chainId,
                address: ALFAJORES_TOKENS.KESm,
                decimals: 18,
            },
        ],
    },
    {
        symbol: 'COPm',
        name: 'Mento Colombian Peso',
        region: 'LatAm',
        chains: [
            {
                chainId: NETWORKS.CELO_MAINNET.chainId,
                address: MAINNET_TOKENS.COPm,
                decimals: 18,
            },
            {
                chainId: NETWORKS.ALFAJORES.chainId,
                address: ALFAJORES_TOKENS.COPm,
                decimals: 18,
            },
        ],
    },
    {
        symbol: 'PHPm',
        name: 'Mento Philippine Peso',
        region: 'Asia',
        chains: [
            {
                chainId: NETWORKS.CELO_MAINNET.chainId,
                address: MAINNET_TOKENS.PHPm,
                decimals: 18,
            },
            {
                chainId: NETWORKS.ALFAJORES.chainId,
                address: ALFAJORES_TOKENS.PHPm,
                decimals: 18,
            },
        ],
    },
    {
        symbol: 'GHSm',
        name: 'Mento Ghana Cedi',
        region: 'Africa',
        chains: [
            {
                chainId: NETWORKS.CELO_MAINNET.chainId,
                address: MAINNET_TOKENS.GHSm,
                decimals: 18,
            },
            {
                chainId: NETWORKS.ALFAJORES.chainId,
                address: ALFAJORES_TOKENS.GHSm,
                decimals: 18,
            },
        ],
    },
    {
        symbol: 'GBPm',
        name: 'Mento British Pound',
        region: 'Europe',
        chains: [
            {
                chainId: NETWORKS.CELO_MAINNET.chainId,
                address: MAINNET_TOKENS.GBPm,
                decimals: 18,
            },
            {
                chainId: NETWORKS.ALFAJORES.chainId,
                address: ALFAJORES_TOKENS.GBPm,
                decimals: 18,
            },
        ],
    },
    {
        symbol: 'ZARm',
        name: 'Mento South African Rand',
        region: 'Africa',
        chains: [
            {
                chainId: NETWORKS.CELO_MAINNET.chainId,
                address: MAINNET_TOKENS.ZARm,
                decimals: 18,
            },
            {
                chainId: NETWORKS.ALFAJORES.chainId,
                address: ALFAJORES_TOKENS.ZARm,
                decimals: 18,
            },
        ],
    },
    {
        symbol: 'CADm',
        name: 'Mento Canadian Dollar',
        region: 'USA',
        chains: [
            {
                chainId: NETWORKS.CELO_MAINNET.chainId,
                address: MAINNET_TOKENS.CADm,
                decimals: 18,
            },
            {
                chainId: NETWORKS.ALFAJORES.chainId,
                address: ALFAJORES_TOKENS.CADm,
                decimals: 18,
            },
        ],
    },
    {
        symbol: 'AUDm',
        name: 'Mento Australian Dollar',
        region: 'Asia',
        chains: [
            {
                chainId: NETWORKS.CELO_MAINNET.chainId,
                address: MAINNET_TOKENS.AUDm,
                decimals: 18,
            },
            {
                chainId: NETWORKS.ALFAJORES.chainId,
                address: ALFAJORES_TOKENS.AUDm,
                decimals: 18,
            },
        ],
    },
    {
        symbol: 'NGNm',
        name: 'Mento Nigerian Naira',
        region: 'Africa',
        chains: [
            {
                chainId: NETWORKS.CELO_MAINNET.chainId,
                address: MAINNET_TOKENS.NGNm,
                decimals: 18,
            },
        ],
    },
    {
        symbol: 'JPYm',
        name: 'Mento Japanese Yen',
        region: 'Asia',
        chains: [
            {
                chainId: NETWORKS.CELO_MAINNET.chainId,
                address: MAINNET_TOKENS.JPYm,
                decimals: 18,
            },
        ],
    },
    {
        symbol: 'CHFm',
        name: 'Swiss Franc',
        region: 'Europe',
        chains: [
            {
                chainId: NETWORKS.CELO_MAINNET.chainId,
                address: MAINNET_TOKENS.CHFm,
                decimals: 18,
            },
        ],
    },
    {
        symbol: 'XOFm',
        name: 'Mento CFA Franc',
        region: 'Africa',
        chains: [
            {
                chainId: NETWORKS.CELO_MAINNET.chainId,
                address: MAINNET_TOKENS.XOFm,
                decimals: 18,
            },
        ],
    },
    {
        symbol: 'USDT',
        name: 'Tether USD',
        region: 'USA',
        chains: [
            {
                chainId: NETWORKS.CELO_MAINNET.chainId,
                address: MAINNET_TOKENS.USDT,
                decimals: 6,
            },
            {
                chainId: NETWORKS.ALFAJORES.chainId,
                address: ALFAJORES_TOKENS.USDT,
                decimals: 6,
            },
        ],
    },
    {
        symbol: 'G$',
        name: 'GoodDollar',
        region: 'Global',
        chains: [
            {
                chainId: NETWORKS.CELO_MAINNET.chainId,
                address: MAINNET_TOKENS['G$'],
                decimals: 18,
            },
            {
                chainId: NETWORKS.ALFAJORES.chainId,
                address: ALFAJORES_TOKENS['G$'],
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
    {
        symbol: 'USDY',
        name: 'Ondo US Dollar Yield',
        region: 'USA',
        chains: [
            {
                chainId: NETWORKS.ARBITRUM_ONE.chainId,
                address: ARBITRUM_TOKENS.USDY,
                decimals: 18,
            },
        ],
    },
    {
        symbol: 'SYRUPUSDC',
        name: 'Syrup USDC',
        region: 'USA',
        chains: [
            {
                chainId: NETWORKS.ARBITRUM_ONE.chainId,
                address: ARBITRUM_TOKENS.SYRUPUSDC,
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