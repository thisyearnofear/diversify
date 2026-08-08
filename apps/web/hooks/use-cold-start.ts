/**
 * useColdStart — detects why a connected wallet shows $0 and returns
 * a contextual message + action for the empty state.
 *
 * Scenarios:
 *   - Wallet on Celo/Arbitrum, no funds  → "Fund your wallet"
 *   - Wallet on Ethereum mainnet          → "Bridge to Arbitrum"
 *   - Wallet on other chain               → "Switch to Celo or Arbitrum"
 *   - Unknown chain / no chainId          → generic "Get started"
 */
import { useMemo } from 'react';
import { NETWORKS } from '@/config';

export interface ColdStartContext {
    /** Short headline explaining why the user sees $0 */
    headline: string;
    /** Friendly explanation */
    body: string;
    /** Emoji for the state */
    emoji: string;
    /** The wallet's current chain name (or null if unknown) */
    currentChainName: string | null;
    /** True if the wallet is already on a chain DiversiFi supports */
    isOnSupportedChain: boolean;
    /** The chain ID the user should switch to (null if already there) */
    suggestedChainId: number | null;
    /** Suggested chain name */
    suggestedChainName: string | null;
}

const SUPPORTED_MAINNETS = [
    NETWORKS.CELO_MAINNET.chainId,
    NETWORKS.ARBITRUM_ONE.chainId,
];

const CHAIN_NAMES: Record<number, string> = {
    [NETWORKS.CELO_MAINNET.chainId]: NETWORKS.CELO_MAINNET.name,
    [NETWORKS.CELO_SEPOLIA.chainId]: NETWORKS.CELO_SEPOLIA.name,
    [NETWORKS.ARC_TESTNET.chainId]: NETWORKS.ARC_TESTNET.name,
    [NETWORKS.ARBITRUM_ONE.chainId]: NETWORKS.ARBITRUM_ONE.name,
    [NETWORKS.BASE_MAINNET.chainId]: NETWORKS.BASE_MAINNET.name,
    [NETWORKS.ETHEREUM_MAINNET.chainId]: NETWORKS.ETHEREUM_MAINNET.name,
};

export function useColdStart(chainId: number | null): ColdStartContext {
    return useMemo(() => {
        const chainName = chainId != null ? (CHAIN_NAMES[chainId] ?? null) : null;
        const isOnSupported = chainId != null && (SUPPORTED_MAINNETS as readonly number[]).includes(chainId);

        // Already on a supported chain — just needs funds
        if (isOnSupported) {
            return {
                headline: 'No funds on this network yet',
                body: 'Your wallet is on the right network. Add funds to start protecting your savings from inflation.',
                emoji: '💳',
                currentChainName: chainName,
                isOnSupportedChain: true,
                suggestedChainId: null,
                suggestedChainName: null,
            };
        }

        // On Ethereum mainnet — specific bridge message
        if (chainId === NETWORKS.ETHEREUM_MAINNET.chainId) {
            return {
                headline: 'Your assets are on Ethereum',
                body: 'Your ETH and ERC-20 tokens are on Ethereum mainnet. We protect savings on Celo and Arbitrum. Switch to Arbitrum to get started.',
                emoji: '🌉',
                currentChainName: 'Ethereum',
                isOnSupportedChain: false,
                suggestedChainId: NETWORKS.ARBITRUM_ONE.chainId,
                suggestedChainName: NETWORKS.ARBITRUM_ONE.name,
            };
        }

        // Known chain but not supported
        if (chainName) {
            return {
                headline: `Your wallet is on ${chainName}`,
                body: `We currently support Celo and Arbitrum. Switch to one of these networks to start protecting your savings.`,
                emoji: '🔄',
                currentChainName: chainName,
                isOnSupportedChain: false,
                suggestedChainId: NETWORKS.CELO_MAINNET.chainId,
                suggestedChainName: NETWORKS.CELO_MAINNET.name,
            };
        }

        // Unknown chain or no chainId
        return {
            headline: 'Ready to activate your protection plan?',
            body: 'Connect to Celo or Arbitrum to put your chosen philosophy into action. Your savings will be shielded across chains.',
            emoji: '🛡️',
            currentChainName: null,
            isOnSupportedChain: false,
            suggestedChainId: NETWORKS.ARBITRUM_ONE.chainId,
            suggestedChainName: NETWORKS.ARBITRUM_ONE.name,
        };
    }, [chainId]);
}
