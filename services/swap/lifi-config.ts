/**
 * LiFi SDK Configuration
 * Centralized configuration for LiFi SDK to avoid initialization issues
 */

import { createConfig } from '@lifi/sdk';

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
        createConfig({
            integrator: 'diversifi-minipay',
            // Add additional configuration if needed
            apiUrl: 'https://li.quest/v1', // Ensure we're using the correct API endpoint
        });

        isConfigured = true;
        console.log('[LiFi Config] Successfully initialized LiFi SDK');
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
    if (typeof (window.ethereum as any).isConnected === 'function' && !(window.ethereum as any).isConnected()) {
        console.warn('[LiFi Config] Wallet is not connected');
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
                apiUrl: currentConfig.apiUrl
            });
        }

        // Check if window.ethereum is available for execution
        if (typeof window !== 'undefined' && window.ethereum) {
            console.log('[LiFi Config] Wallet provider detected:', {
                isMetaMask: window.ethereum.isMetaMask,
                chainId: window.ethereum.chainId,
                selectedAddress: window.ethereum.selectedAddress
            });
        }

    } catch (error) {
        console.error('[LiFi Config] Error checking execution providers:', error);
        throw new Error('Failed to verify LiFi SDK execution providers');
    }
}