/**
 * LiFi SDK Configuration
 * Centralized configuration for LiFi SDK to avoid initialization issues
 * Fixed to handle frontend wallet integration properly with Farcaster support
 */

import { createConfig, EVM } from '@lifi/sdk';
import { createWalletClient, custom } from 'viem';
import { arbitrum, celo, celoAlfajores } from 'viem/chains';
import { getWalletProvider } from '../../utils/wallet-provider';

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
                        const provider = await getWalletProvider();
                        if (!provider) {
                            throw new Error('Wallet not connected');
                        }

                        // Ensure wallet is connected first and get accounts
                        let accounts: string[];
                        try {
                            accounts = await provider.request({ method: 'eth_accounts' });
                            if (!accounts || accounts.length === 0) {
                                // For Farcaster, try requesting accounts again
                                console.log('[LiFi Config] No accounts found, requesting connection...');
                                accounts = await provider.request({ method: 'eth_requestAccounts' });
                                if (!accounts || accounts.length === 0) {
                                    throw new Error('Wallet not connected');
                                }
                            }
                        } catch (error) {
                            console.error('[LiFi Config] Wallet connection check failed:', error);
                            throw new Error('Wallet connection required');
                        }

                        // Get current chain ID from the wallet with retry logic
                        let chainId: number = 42161; // Default to Arbitrum
                        let retryCount = 0;
                        const maxRetries = 3;

                        while (retryCount < maxRetries) {
                            try {
                                const chainIdHex = await provider.request({ method: 'eth_chainId' });
                                chainId = parseInt(chainIdHex, 16);
                                break;
                            } catch (error) {
                                retryCount++;
                                console.warn(`[LiFi Config] Chain ID fetch attempt ${retryCount} failed:`, error);
                                if (retryCount < maxRetries) {
                                    await new Promise(resolve => setTimeout(resolve, 500));
                                } else {
                                    console.warn('[LiFi Config] Could not get chain ID, using default Arbitrum');
                                    // chainId already initialized to default above
                                }
                            }
                        }

                        // Find the matching chain configuration
                        const chain = supportedChains.find(c => c.id === chainId) || arbitrum;

                        // Create a wallet client using the browser's ethereum provider
                        const walletClient = createWalletClient({
                            account: accounts[0] as `0x${string}`, // Ensure account is properly set
                            chain,
                            transport: custom(provider),
                        });

                        console.log('[LiFi Config] Created wallet client for chain:', chain.name, 'ID:', chainId);
                        return walletClient;
                    },
                    switchChain: async (chainId) => {
                        const provider = await getWalletProvider();
                        if (!provider) {
                            throw new Error('Wallet not connected');
                        }

                        console.log('[LiFi Config] Switching to chain:', chainId);

                        try {
                            await provider.request({
                                method: 'wallet_switchEthereumChain',
                                params: [{ chainId: `0x${chainId.toString(16)}` }],
                            });

                            // Wait a bit for chain switch to complete in Farcaster
                            await new Promise(resolve => setTimeout(resolve, 1000));

                            // Get accounts after chain switch with retry
                            let accounts: string[] = [];
                            let retryCount = 0;
                            const maxRetries = 3;

                            while (retryCount < maxRetries && (!accounts || accounts.length === 0)) {
                                try {
                                    accounts = await provider.request({ method: 'eth_accounts' });
                                    if (accounts && accounts.length > 0) break;
                                } catch (err) {
                                    console.warn(`[LiFi Config] Account fetch attempt ${retryCount + 1} failed:`, err);
                                }

                                retryCount++;
                                if (retryCount < maxRetries) {
                                    await new Promise(resolve => setTimeout(resolve, 500));
                                }
                            }

                            if (!accounts || accounts.length === 0) {
                                throw new Error('Wallet not connected after chain switch');
                            }

                            // Find the matching chain configuration
                            const chain = supportedChains.find(c => c.id === chainId) || arbitrum;

                            // Return a new wallet client for the switched chain
                            const walletClient = createWalletClient({
                                account: accounts[0] as `0x${string}`, // Ensure account is properly set
                                chain,
                                transport: custom(provider),
                            });

                            console.log('[LiFi Config] Successfully switched to chain:', chain.name);
                            return walletClient;
                        } catch (error: any) {
                            // If chain is not added, try to add it
                            if (error.code === 4902) {
                                const chain = supportedChains.find(c => c.id === chainId);
                                if (chain) {
                                    console.log('[LiFi Config] Adding new chain:', chain.name);
                                    await provider.request({
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

                                    // Get accounts after adding chain
                                    const accounts = await provider.request({ method: 'eth_accounts' });
                                    if (!accounts || accounts.length === 0) {
                                        throw new Error('Wallet not connected after adding chain');
                                    }

                                    return createWalletClient({
                                        account: accounts[0] as `0x${string}`, // Ensure account is properly set
                                        chain,
                                        transport: custom(provider),
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
 * Initialize LiFi for route discovery only (no wallet needed)
 * Use this for getting quotes without wallet connection
 */
export function initializeLiFiForQuotes(): void {
    if (isConfigured) {
        return;
    }

    try {
        createConfig({
            integrator: 'diversifi-minipay',
            apiUrl: 'https://li.quest/v1',
            // No providers needed for route discovery
        });

        isConfigured = true;
        console.log('[LiFi Config] Successfully initialized LiFi SDK for quotes');
    } catch (error) {
        console.error('[LiFi Config] Failed to initialize LiFi SDK for quotes:', error);
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
    const provider = await getWalletProvider();
    if (!provider) {
        throw new Error('No wallet provider available. Please connect your wallet.');
    }

    try {
        // Request accounts to ensure wallet is connected
        const accounts = await provider.request({ method: 'eth_accounts' });

        if (!accounts || accounts.length === 0) {
            // Try to request connection
            const requestedAccounts = await provider.request({ method: 'eth_requestAccounts' });
            if (!requestedAccounts || requestedAccounts.length === 0) {
                throw new Error('No wallet accounts available. Please connect your wallet.');
            }
        }

        // Get current chain
        const chainId = await provider.request({ method: 'eth_chainId' });
        console.log('[LiFi Config] Wallet connection verified:', {
            accounts: accounts.length,
            chainId: parseInt(chainId, 16),
            selectedAddress: (provider as any).selectedAddress
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
export async function validateWalletProvider(): Promise<void> {
    try {
        const provider = await getWalletProvider();
        if (!provider) {
            throw new Error('Wallet provider is missing. Please ensure you have a compatible Web3 wallet.');
        }

        // Additional checks for common wallet properties
        if (!provider.request) {
            throw new Error('Wallet provider is missing required methods. Please ensure you have a compatible Web3 wallet.');
        }

        // Check if wallet is connected (if the method exists)
        if (typeof (provider as any).isConnected === 'function') {
            const isConnected = (provider as any).isConnected();
            if (!isConnected) {
                console.warn('[LiFi Config] Wallet is not connected');
            }
        }

        // Check if we have accounts
        if ((provider as any).selectedAddress) {
            console.log('[LiFi Config] Wallet connected with address:', (provider as any).selectedAddress);
        } else {
            console.warn('[LiFi Config] No wallet address selected');
        }

        console.log('[LiFi Config] Wallet provider validation passed');
    } catch (error) {
        console.error('[LiFi Config] Wallet provider validation failed:', error);
        throw error;
    }
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

        // Check if wallet provider is available for execution
        try {
            const provider = await getWalletProvider();
            if (!provider) {
                console.warn('[LiFi Config] No wallet provider available');
                return;
            }

            // Get current accounts
            let accounts: string[] = [];
            try {
                accounts = await provider.request({ method: 'eth_accounts' });
            } catch (error) {
                console.warn('[LiFi Config] Could not get accounts:', error);
            }

            console.log('[LiFi Config] Wallet provider detected:', {
                isMetaMask: (provider as any).isMetaMask,
                isMiniPay: (provider as any).isMiniPay,
                chainId: (provider as any).chainId,
                selectedAddress: (provider as any).selectedAddress,
                accountsCount: accounts.length,
                hasRequest: typeof provider.request === 'function'
            });

            // Ensure we have at least one account
            if (accounts.length === 0) {
                console.warn('[LiFi Config] No accounts found. Wallet may not be connected.');
            }
        } catch (error) {
            console.warn('[LiFi Config] No wallet provider available:', error);
        }

    } catch (error) {
        console.error('[LiFi Config] Error checking execution providers:', error);
        throw new Error('Failed to verify LiFi SDK execution providers');
    }
}