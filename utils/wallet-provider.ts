/**
 * Centralized Wallet Provider Utility
 * Single source of truth for wallet provider access across regular and Farcaster environments
 * Follows DRY principle and prevents code duplication
 */

import sdk from '@farcaster/miniapp-sdk';

/**
 * Get wallet provider with Farcaster support
 * Tries Farcaster SDK first, falls back to window.ethereum
 */
export async function getWalletProvider(): Promise<any> {
    // Try Farcaster SDK first if available
    if (typeof window !== 'undefined' && sdk && sdk.wallet) {
        try {
            const provider = await sdk.wallet.getEthereumProvider();
            if (provider) {
                console.log('[WalletProvider] Using Farcaster wallet provider');
                return provider;
            }
        } catch (err) {
            console.warn('[WalletProvider] Failed to get Farcaster provider:', err);
        }
    }

    // Fallback to window.ethereum
    if (typeof window !== 'undefined' && window.ethereum) {
        console.log('[WalletProvider] Using window.ethereum provider');
        return window.ethereum;
    }

    throw new Error('No wallet provider available');
}

/**
 * Check if any wallet provider is available
 */
export async function isWalletProviderAvailable(): Promise<boolean> {
    try {
        await getWalletProvider();
        return true;
    } catch {
        return false;
    }
}

/**
 * Setup wallet event listeners with cleanup
 */
export async function setupWalletEventListeners(
    onChainChanged: (chainId: string) => void,
    onAccountsChanged: (accounts: string[]) => void
): Promise<() => void> {
    try {
        const provider = await getWalletProvider();

        provider.on('chainChanged', onChainChanged);
        provider.on('accountsChanged', onAccountsChanged);

        return () => {
            provider.removeListener('chainChanged', onChainChanged);
            provider.removeListener('accountsChanged', onAccountsChanged);
        };
    } catch (err) {
        console.warn('[WalletProvider] Failed to setup event listeners:', err);
        return () => { }; // No-op cleanup
    }
}