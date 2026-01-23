/**
 * LiFi SDK Configuration
 * Centralized configuration for LiFi SDK to avoid initialization issues
 */

import { createConfig, EVM } from '@lifi/sdk';
import { createWalletClient, custom } from 'viem';
import { arbitrum, celo, celoAlfajores } from 'viem/chains';

let isConfigured = false;

/**
 * Initialize LiFi SDK configuration
 * Safe to call multiple times - will only configure once
 */
export function initializeLiFiConfig(): void {
    if (isConfigured) {
        return;
    }

    try {
        // Define supported chains
        const supportedChains = [arbitrum, celo, celoAlfajores];

        createConfig({
            integrator: 'diversifi-minipay',
            apiUrl: 'https://li.quest/v1',
            providers: [
                EVM({
                    getWalletClient: async () => {
                        if (typeof window === 'undefined' || !window.ethereum) {
                            throw new Error('No wallet provider available');
                        }

                        // Get current chain ID from the wallet
                        let chainId: number;
                        try {
                            const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
                            chainId = parseInt(chainIdHex, 16);
                        } catch (error) {
                            console.warn('[LiFi Config] Could not get chain ID, defaulting to Arbitrum');
                            chainId = 42161; // Default to Arbitrum
                        }

                        // Find the matching chain configuration
                        const chain = supportedChains.find(c => c.id === chainId) || arbitrum;

                        // Create a wallet client using the browser's ethereum provider
                        const walletClient = createWalletClient({
                            chain,
                            transport: custom(window.ethereum),
                        });

                        console.log('[LiFi Config] Created wallet client for chain:', chain.name, 'ID:', chainId);
                        return walletClient;
                    },
                    switchChain: async (chainId) => {
                        if (typeof window === 'undefined' || !window.ethereum) {
                            throw new Error('No wallet provider available for chain switching');
                        }

                        console.log('[LiFi Config] Switching to chain:', chainId);

                        // Request chain switch via wallet
                        try {
                            await window.ethereum.request({
                                method: 'wallet_switchEthereumChain',
                                params: [{ chainId: `0x${chainId.toString(16)}` }],
                            });

                            // Find the matching chain configuration
                            const chain = supportedChains.find(c => c.id === chainId) || arbitrum;

                            // Return a new wallet client for the switched chain
                            const walletClient = createWalletClient({
                                chain,
                                transport: custom(window.ethereum),
                            });

                            console.log('[LiFi Config] Successfully switched to chain:', chain.name);
                            return walletClient;
                        } catch (error: any) {
                            // If chain is not added, try to add it
                            if (error.code === 4902) {
                                const chain = supportedChains.find(c => c.id === chainId);
                                if (chain) {
                                    console.log('[LiFi Config] Adding new chain:', chain.name);
                                    await window.ethereum.request({
                                        method: 'wallet_addEthereumChain',
                                        params: [{
                                            chainId: `0x${chainId.toString(16)}`,
                                            chainName: chain.name,
                                            rpcUrls: [chain.rpcUrls.default.http[0]],
                                            blockExplorerUrls: chain.blockExplorers?.default ? [chain.blockExplorers.default.url] : undefined,
                                            nativeCurrency: {
                                                name: chain.nativeCurrency.name,
                                                symbol: chain.nativeCurrency.symbol,
                                                decimals: chain.nativeCurrency.decimals,
                                            },
                                        }],
                                    });

                                    return createWalletClient({
                                        chain,
                                        transport: custom(window.ethereum),
                                    });
                                }
                            }
                            console.error('[LiFi Config] Chain switch failed:', error);
                            throw error;
                        }
                    },
                }),
            ],
        });

        isConfigured = true;
        console.log('[LiFi Config] Successfully initialized LiFi SDK with EVM provider');
    } catch (error) {
        console.error('[LiFi Config] Failed to initialize LiFi SDK:', error);
        // Don't throw here - let the strategies handle the error
    }
}

/**
 * Check if LiFi SDK is configured
 */
export function isLiFiConfigured(): boolean {
    return isConfigured;
}

/**
 * Reset configuration state (useful for testing)
 */
export function resetLiFiConfig(): void {
    isConfigured = false;
}

/**
 * Ensure wallet is connected and ready for LiFi operations
 */
export async function ensureWalletConnection(): Promise<void> {
    if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error('No wallet provider available');
    }

    try {
        // Request accounts to ensure wallet is connected
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });

        if (!accounts || accounts.length === 0) {
            // Try to request connection
            const requestedAccounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            if (!requestedAccounts || requestedAccounts.length === 0) {
                throw new Error('No wallet accounts available. Please connect your wallet.');
            }
        }

        // Get current chain
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        console.log('[LiFi Config] Wallet connection verified:', {
            accounts: accounts.length,
            chainId: parseInt(chainId, 16),
            selectedAddress: window.ethereum.selectedAddress
        });

    } catch (error: any) {
        console.error('[LiFi Config] Wallet connection failed:', error);
        if (error.code === 4001) {
            throw new Error('Wallet connection was rejected by user');
        }
        throw new Error('Failed to connect to wallet: ' + error.message);
    }
}
/**
 * Ensure wallet provider is available before using LiFi SDK
 */
export function validateWalletProvider(): void {
    if (typeof window === 'undefined') {
        throw new Error('LiFi SDK requires a browser environment');
    }

    if (!window.ethereum) {
        throw new Error('No wallet provider found. Please install MetaMask or another Web3 wallet.');
    }

    // Additional checks for common wallet properties
    if (!window.ethereum.request) {
        throw new Error('Wallet provider is missing required methods. Please ensure you have a compatible Web3 wallet.');
    }

    // Check if wallet is connected (if the method exists)
    if (typeof (window.ethereum as any).isConnected === 'function') {
        const isConnected = (window.ethereum as any).isConnected();
        if (!isConnected) {
            console.warn('[LiFi Config] Wallet is not connected');
        }
    }

    // Check if we have accounts
    if (window.ethereum.selectedAddress) {
        console.log('[LiFi Config] Wallet connected with address:', window.ethereum.selectedAddress);
    } else {
        console.warn('[LiFi Config] No wallet address selected');
    }

    console.log('[LiFi Config] Wallet provider validation passed');
}
/**
 * Check if LiFi SDK can detect execution providers
 */
export async function checkExecutionProviders(): Promise<void> {
    try {
        // Import the config to check available providers
        const { config } = await import('@lifi/sdk');

        // Check if we can access the config
        if (config && typeof config.get === 'function') {
            const currentConfig = config.get();
            console.log('[LiFi Config] Current LiFi configuration:', {
                integrator: currentConfig.integrator,
                apiUrl: currentConfig.apiUrl,
                providersCount: currentConfig.providers?.length || 0
            });
        }

        // Check if window.ethereum is available for execution
        if (typeof window !== 'undefined' && window.ethereum) {
            // Get current accounts
            let accounts: string[] = [];
            try {
                accounts = await window.ethereum.request({ method: 'eth_accounts' });
            } catch (error) {
                console.warn('[LiFi Config] Could not get accounts:', error);
            }

            console.log('[LiFi Config] Wallet provider detected:', {
                isMetaMask: window.ethereum.isMetaMask,
                isMiniPay: window.ethereum.isMiniPay,
                chainId: window.ethereum.chainId,
                selectedAddress: window.ethereum.selectedAddress,
                accountsCount: accounts.length,
                hasRequest: typeof window.ethereum.request === 'function'
            });

            // Ensure we have at least one account
            if (accounts.length === 0) {
                console.warn('[LiFi Config] No accounts found. Wallet may not be connected.');
            }
        } else {
            throw new Error('No wallet provider available');
        }

    } catch (error) {
        console.error('[LiFi Config] Error checking execution providers:', error);
        throw new Error('Failed to verify LiFi SDK execution providers');
    }
}