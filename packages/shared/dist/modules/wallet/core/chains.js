"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CHAIN_ID = exports.SUPPORTED_CHAIN_IDS = void 0;
exports.getDefaultChainId = getDefaultChainId;
exports.isSupportedChainId = isSupportedChainId;
exports.getAddChainParameter = getAddChainParameter;
exports.toHexChainId = toHexChainId;
const config_1 = require("../../../config");
exports.SUPPORTED_CHAIN_IDS = [
    config_1.NETWORKS.CELO_MAINNET.chainId,
    config_1.NETWORKS.CELO_SEPOLIA.chainId,
    config_1.NETWORKS.ARBITRUM_ONE.chainId,
    config_1.NETWORKS.ARC_TESTNET.chainId,
    config_1.NETWORKS.RH_TESTNET.chainId,
];
// Default chain selection is environment-sensitive for onboarding/test-drive.
// - Farcaster Mini App: prefer Celo mainnet
// - Otherwise: prefer Arbitrum One mainnet
function getDefaultChainId(opts) {
    if (opts?.isFarcaster)
        return config_1.NETWORKS.CELO_MAINNET.chainId;
    return config_1.NETWORKS.ARBITRUM_ONE.chainId;
}
// Back-compat: keep a constant export, but DO NOT use it for onboarding defaults.
// (Some non-onboarding flows may still import it.)
exports.DEFAULT_CHAIN_ID = config_1.NETWORKS.ARBITRUM_ONE.chainId;
function isSupportedChainId(chainId) {
    return exports.SUPPORTED_CHAIN_IDS.includes(chainId);
}
function getAddChainParameter(targetChainId) {
    if (targetChainId === config_1.NETWORKS.CELO_SEPOLIA.chainId) {
        return {
            chainId: toHexChainId(config_1.NETWORKS.CELO_SEPOLIA.chainId),
            chainName: config_1.NETWORKS.CELO_SEPOLIA.name,
            nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
            rpcUrls: [config_1.NETWORKS.CELO_SEPOLIA.rpcUrl],
            blockExplorerUrls: [config_1.NETWORKS.CELO_SEPOLIA.explorerUrl],
        };
    }
    if (targetChainId === config_1.NETWORKS.ARC_TESTNET.chainId) {
        return {
            chainId: '0x4cef52',
            chainName: 'Arc Testnet',
            nativeCurrency: { name: 'ARC', symbol: 'ARC', decimals: 18 },
            rpcUrls: [config_1.NETWORKS.ARC_TESTNET.rpcUrl],
            blockExplorerUrls: [config_1.NETWORKS.ARC_TESTNET.explorerUrl],
        };
    }
    if (targetChainId === config_1.NETWORKS.ARBITRUM_ONE.chainId) {
        return {
            chainId: '0xa4b1',
            chainName: 'Arbitrum One',
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: [config_1.NETWORKS.ARBITRUM_ONE.rpcUrl],
            blockExplorerUrls: [config_1.NETWORKS.ARBITRUM_ONE.explorerUrl],
        };
    }
    if (targetChainId === config_1.NETWORKS.RH_TESTNET.chainId) {
        return {
            chainId: `0x${config_1.NETWORKS.RH_TESTNET.chainId.toString(16)}`,
            chainName: 'Robinhood Chain Testnet',
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: [config_1.NETWORKS.RH_TESTNET.rpcUrl],
            blockExplorerUrls: [config_1.NETWORKS.RH_TESTNET.explorerUrl],
        };
    }
    return {
        chainId: '0xa4ec',
        chainName: 'Celo',
        nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
        rpcUrls: [config_1.NETWORKS.CELO_MAINNET.rpcUrl],
        blockExplorerUrls: [config_1.NETWORKS.CELO_MAINNET.explorerUrl],
    };
}
function toHexChainId(chainId) {
    return `0x${chainId.toString(16)}`;
}
//# sourceMappingURL=chains.js.map