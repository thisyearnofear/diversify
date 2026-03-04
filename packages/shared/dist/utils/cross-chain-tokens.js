"use strict";
/**
 * Cross-Chain Token Configuration
 * Defines which tokens are available on which chains for cross-chain swaps
 * Uses centralized token addresses from config to maintain single source of truth
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CROSS_CHAIN_TOKENS = void 0;
exports.getTokensForChain = getTokensForChain;
exports.getChainsForToken = getChainsForToken;
exports.isTokenAvailableOnChain = isTokenAvailableOnChain;
exports.getTokenAddress = getTokenAddress;
exports.getCrossChainRoutes = getCrossChainRoutes;
exports.getSupportedChainIds = getSupportedChainIds;
const config_1 = require("../config");
// Cross-chain token definitions
exports.CROSS_CHAIN_TOKENS = [
    {
        symbol: 'USDC',
        name: 'USD Coin',
        region: 'USA',
        chains: [
            {
                chainId: config_1.NETWORKS.ARBITRUM_ONE.chainId,
                address: config_1.ARBITRUM_TOKENS.USDC,
                decimals: 6,
            },
            {
                chainId: config_1.NETWORKS.ARC_TESTNET.chainId,
                address: config_1.ARC_TOKENS.USDC,
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
                chainId: config_1.NETWORKS.ARC_TESTNET.chainId,
                address: config_1.ARC_TOKENS.EURC,
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
                chainId: config_1.NETWORKS.CELO_MAINNET.chainId,
                address: config_1.MAINNET_TOKENS.USDm,
                decimals: 18,
            },
            {
                chainId: config_1.NETWORKS.CELO_SEPOLIA.chainId,
                address: config_1.CELO_SEPOLIA_TOKENS.USDm,
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
                chainId: config_1.NETWORKS.CELO_MAINNET.chainId,
                address: config_1.MAINNET_TOKENS.EURm,
                decimals: 18,
            },
            {
                chainId: config_1.NETWORKS.CELO_SEPOLIA.chainId,
                address: config_1.CELO_SEPOLIA_TOKENS.EURm,
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
                chainId: config_1.NETWORKS.CELO_MAINNET.chainId,
                address: config_1.MAINNET_TOKENS.BRLm,
                decimals: 18,
            },
            {
                chainId: config_1.NETWORKS.CELO_SEPOLIA.chainId,
                address: config_1.CELO_SEPOLIA_TOKENS.BRLm,
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
                chainId: config_1.NETWORKS.CELO_MAINNET.chainId,
                address: config_1.MAINNET_TOKENS.KESm,
                decimals: 18,
            },
            {
                chainId: config_1.NETWORKS.CELO_SEPOLIA.chainId,
                address: config_1.CELO_SEPOLIA_TOKENS.KESm,
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
                chainId: config_1.NETWORKS.CELO_MAINNET.chainId,
                address: config_1.MAINNET_TOKENS.COPm,
                decimals: 18,
            },
            {
                chainId: config_1.NETWORKS.CELO_SEPOLIA.chainId,
                address: config_1.CELO_SEPOLIA_TOKENS.COPm,
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
                chainId: config_1.NETWORKS.CELO_MAINNET.chainId,
                address: config_1.MAINNET_TOKENS.PHPm,
                decimals: 18,
            },
            {
                chainId: config_1.NETWORKS.CELO_SEPOLIA.chainId,
                address: config_1.CELO_SEPOLIA_TOKENS.PHPm,
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
                chainId: config_1.NETWORKS.CELO_MAINNET.chainId,
                address: config_1.MAINNET_TOKENS.GHSm,
                decimals: 18,
            },
            {
                chainId: config_1.NETWORKS.CELO_SEPOLIA.chainId,
                address: config_1.CELO_SEPOLIA_TOKENS.GHSm,
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
                chainId: config_1.NETWORKS.CELO_MAINNET.chainId,
                address: config_1.MAINNET_TOKENS.GBPm,
                decimals: 18,
            },
            {
                chainId: config_1.NETWORKS.CELO_SEPOLIA.chainId,
                address: config_1.CELO_SEPOLIA_TOKENS.GBPm,
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
                chainId: config_1.NETWORKS.CELO_MAINNET.chainId,
                address: config_1.MAINNET_TOKENS.ZARm,
                decimals: 18,
            },
            {
                chainId: config_1.NETWORKS.CELO_SEPOLIA.chainId,
                address: config_1.CELO_SEPOLIA_TOKENS.ZARm,
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
                chainId: config_1.NETWORKS.CELO_MAINNET.chainId,
                address: config_1.MAINNET_TOKENS.CADm,
                decimals: 18,
            },
            {
                chainId: config_1.NETWORKS.CELO_SEPOLIA.chainId,
                address: config_1.CELO_SEPOLIA_TOKENS.CADm,
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
                chainId: config_1.NETWORKS.CELO_MAINNET.chainId,
                address: config_1.MAINNET_TOKENS.AUDm,
                decimals: 18,
            },
            {
                chainId: config_1.NETWORKS.CELO_SEPOLIA.chainId,
                address: config_1.CELO_SEPOLIA_TOKENS.AUDm,
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
                chainId: config_1.NETWORKS.CELO_MAINNET.chainId,
                address: config_1.MAINNET_TOKENS.NGNm,
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
                chainId: config_1.NETWORKS.CELO_MAINNET.chainId,
                address: config_1.MAINNET_TOKENS.JPYm,
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
                chainId: config_1.NETWORKS.CELO_MAINNET.chainId,
                address: config_1.MAINNET_TOKENS.CHFm,
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
                chainId: config_1.NETWORKS.CELO_MAINNET.chainId,
                address: config_1.MAINNET_TOKENS.XOFm,
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
                chainId: config_1.NETWORKS.CELO_MAINNET.chainId,
                address: config_1.MAINNET_TOKENS.USDT,
                decimals: 6,
            },
            {
                chainId: config_1.NETWORKS.CELO_SEPOLIA.chainId,
                address: config_1.CELO_SEPOLIA_TOKENS.USDT,
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
                chainId: config_1.NETWORKS.CELO_MAINNET.chainId,
                address: config_1.MAINNET_TOKENS['G$'],
                decimals: 18,
            },
            {
                chainId: config_1.NETWORKS.CELO_SEPOLIA.chainId,
                address: config_1.CELO_SEPOLIA_TOKENS['G$'],
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
                chainId: config_1.NETWORKS.ARBITRUM_ONE.chainId,
                address: config_1.ARBITRUM_TOKENS.PAXG,
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
                chainId: config_1.NETWORKS.ARBITRUM_ONE.chainId,
                address: config_1.ARBITRUM_TOKENS.USDY,
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
                chainId: config_1.NETWORKS.ARBITRUM_ONE.chainId,
                address: config_1.ARBITRUM_TOKENS.SYRUPUSDC,
                decimals: 18,
            },
        ],
    },
    {
        symbol: 'ACME',
        name: 'Acme Corporation',
        region: 'USA',
        chains: [
            {
                chainId: config_1.NETWORKS.RH_TESTNET.chainId,
                address: config_1.RH_TESTNET_TOKENS.ACME,
                decimals: 18,
            },
        ],
    },
    {
        symbol: 'SPACELY',
        name: 'Spacely Sprockets',
        region: 'USA',
        chains: [
            {
                chainId: config_1.NETWORKS.RH_TESTNET.chainId,
                address: config_1.RH_TESTNET_TOKENS.SPACELY,
                decimals: 18,
            },
        ],
    },
    {
        symbol: 'WAYNE',
        name: 'Wayne Industries',
        region: 'USA',
        chains: [
            {
                chainId: config_1.NETWORKS.RH_TESTNET.chainId,
                address: config_1.RH_TESTNET_TOKENS.WAYNE,
                decimals: 18,
            },
        ],
    },
    {
        symbol: 'OSCORP',
        name: 'Oscorp Industries',
        region: 'USA',
        chains: [
            {
                chainId: config_1.NETWORKS.RH_TESTNET.chainId,
                address: config_1.RH_TESTNET_TOKENS.OSCORP,
                decimals: 18,
            },
        ],
    },
    {
        symbol: 'STARK',
        name: 'Stark Industries',
        region: 'USA',
        chains: [
            {
                chainId: config_1.NETWORKS.RH_TESTNET.chainId,
                address: config_1.RH_TESTNET_TOKENS.STARK,
                decimals: 18,
            },
        ],
    },
];
/**
 * Get all tokens available on a specific chain
 */
function getTokensForChain(chainId) {
    return exports.CROSS_CHAIN_TOKENS
        .filter(token => token.chains.some(chain => chain.chainId === chainId))
        .map(token => {
        const chainInfo = token.chains.find(chain => chain.chainId === chainId);
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
function getChainsForToken(symbol) {
    const token = exports.CROSS_CHAIN_TOKENS.find(t => t.symbol.toUpperCase() === symbol.toUpperCase());
    return token ? token.chains.map(chain => chain.chainId) : [];
}
/**
 * Check if a token is available on a specific chain
 */
function isTokenAvailableOnChain(symbol, chainId) {
    return getChainsForToken(symbol).includes(chainId);
}
/**
 * Get token address on a specific chain
 */
function getTokenAddress(symbol, chainId) {
    const token = exports.CROSS_CHAIN_TOKENS.find(t => t.symbol.toUpperCase() === symbol.toUpperCase());
    if (!token)
        return null;
    const chainInfo = token.chains.find(chain => chain.chainId === chainId);
    return chainInfo ? chainInfo.address : null;
}
/**
 * Get all possible cross-chain routes
 */
function getCrossChainRoutes() {
    const routes = [];
    // Generate all possible combinations
    exports.CROSS_CHAIN_TOKENS.forEach(fromToken => {
        fromToken.chains.forEach(fromChain => {
            exports.CROSS_CHAIN_TOKENS.forEach(toToken => {
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
function getSupportedChainIds() {
    const chainIds = new Set();
    exports.CROSS_CHAIN_TOKENS.forEach(token => {
        token.chains.forEach(chain => {
            chainIds.add(chain.chainId);
        });
    });
    return Array.from(chainIds);
}
//# sourceMappingURL=cross-chain-tokens.js.map