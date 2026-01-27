/**
 * Consolidated wallet hook
 * Handles wallet connection, account management, and MiniPay detection
 * Uses a single provider instance to ensure state consistency
 */

import { useEffect, useRef, useState } from 'react';
import { isMiniPayEnvironment } from '../utils/environment';
import { getWalletProvider, setupWalletEventListenersForProvider } from '../utils/wallet-provider';
import sdk from '@farcaster/miniapp-sdk';

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isMiniPay, setIsMiniPay] = useState(false);
  const [isFarcaster, setIsFarcaster] = useState(false);
  const [farcasterContext, setFarcasterContext] = useState<any | null>(null);

  // Single provider reference to ensure consistency across all operations
  const providerRef = useRef<any | null>(null);

  // Initialize wallet and environment
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const initWallet = async () => {
      if (typeof window === 'undefined') return;

      console.log('[Wallet] Initializing environment...');

      let detectedFarcaster = false;
      let provider: any | null = null;

      // 1. Detect Farcaster Environment
      try {
        if (sdk?.actions) {
          console.log('[Farcaster] SDK detected, signaling ready...');
          sdk.actions.ready();
        }

        // Try to get context with timeout (don't hang in non-Farcaster env)
        const contextPromise = sdk.context;
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 200)
        );

        try {
          const context = await Promise.race([contextPromise, timeoutPromise]) as any;
          if (context) {
            console.log('[Farcaster] Context resolved:', context);
            detectedFarcaster = true;
            setIsFarcaster(true);
            setFarcasterContext(context);

            // Get Farcaster provider
            try {
              provider = await sdk.wallet.getEthereumProvider();
              console.log('[Farcaster] Got Ethereum provider');
            } catch (walletErr) {
              console.warn('[Farcaster] Failed to get Ethereum provider:', walletErr);
            }
          }
        } catch {
          // Context timeout - not in Farcaster
          console.log('[Wallet] Not in Farcaster environment');
        }
      } catch (err) {
        console.log('[Farcaster] SDK lookup skipped or failed');
      }

      // 2. Fallback to window.ethereum if no Farcaster provider
      if (!provider && typeof window !== 'undefined' && (window as any).ethereum) {
        provider = (window as any).ethereum;
        console.log('[Wallet] Using window.ethereum provider');
      }

      if (!provider?.request) {
        console.log('[Wallet] No valid ethereum provider found');
        return;
      }

      // Store provider in ref for consistent use across all operations
      providerRef.current = provider;

      // 3. Detect MiniPay environment
      const inMiniPay = isMiniPayEnvironment();
      setIsMiniPay(inMiniPay);

      // 4. Get current chain ID with aggressive multi-strategy detection
      const detectChainWithFallback = async () => {
        // Strategy 1: Direct request with longer timeout
        try {
          const chainIdPromise = provider.request({ method: 'eth_chainId' });
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('timeout')), 2000)
          );
          
          const chainIdHex = await Promise.race([chainIdPromise, timeoutPromise]) as string;
          const parsedChainId = parseInt(chainIdHex, 16);
          console.log('[Wallet] Chain ID detected (direct):', parsedChainId);
          return parsedChainId;
        } catch (err) {
          console.warn('[Wallet] Direct chain detection failed:', err);
        }

        // Strategy 2: Read from provider.chainId property (Privy specific)
        try {
          if (provider.chainId) {
            const parsedChainId = typeof provider.chainId === 'string' 
              ? parseInt(provider.chainId, 16)
              : provider.chainId;
            console.log('[Wallet] Chain ID from provider property:', parsedChainId);
            return parsedChainId;
          }
        } catch (err) {
          console.warn('[Wallet] chainId property read failed:', err);
        }

        // Strategy 3: For Farcaster, assume Celo immediately
        if (detectedFarcaster || inMiniPay) {
          console.log('[Wallet] Farcaster/MiniPay detected, defaulting to Celo (42220)');
          return 42220;
        }

        // Strategy 4: Read from localStorage cache
        try {
          const cached = localStorage.getItem('diversifi-last-chain-id');
          if (cached) {
            const parsedChainId = parseInt(cached, 10);
            console.log('[Wallet] Chain ID from cache:', parsedChainId);
            return parsedChainId;
          }
        } catch {}

        // Final fallback to Celo
        console.log('[Wallet] Using final fallback: Celo (42220)');
        return 42220;
      };

      const detectedChainId = await detectChainWithFallback();
      setChainId(detectedChainId);

      // Cache for next load
      try {
        localStorage.setItem('diversifi-last-chain-id', detectedChainId.toString());
      } catch {}

      // 5. Auto-connect logic
      // - Farcaster/MiniPay: use eth_requestAccounts (auto-prompt is OK)
      // - Regular web: use eth_accounts (silent check, no prompt)
      try {
        const method = (detectedFarcaster || inMiniPay) ? 'eth_requestAccounts' : 'eth_accounts';
        const accounts = await provider.request({ method }) as string[];

        if (accounts && accounts.length > 0) {
          console.log('[Wallet] Connected:', accounts[0]);
          setAddress(accounts[0]);
          setIsConnected(true);
        }
      } catch (err) {
        console.warn('[Wallet] Auto-connect failed:', err);
      }

      // 6. Setup event listeners using the SAME provider instance
      cleanup = setupWalletEventListenersForProvider(
        provider,
        (chainIdHex: string) => {
          const newChainId = parseInt(chainIdHex, 16);
          setChainId(newChainId);
          // Cache the new chain ID
          try {
            localStorage.setItem('diversifi-last-chain-id', newChainId.toString());
          } catch {}
        },
        (accounts: string[]) => {
          if (accounts.length === 0) {
            setAddress(null);
            setIsConnected(false);
          } else {
            setAddress(accounts[0]);
            setIsConnected(true);
          }
        }
      );
    };

    initWallet();

    // Return cleanup function
    return () => {
      cleanup?.();
    };
  }, []);

  // Get the active provider (uses cached ref or fetches new one)
  const getActiveProvider = async () => {
    if (providerRef.current) {
      return providerRef.current;
    }

    // Fallback: get provider and cache it
    const provider = await getWalletProvider();
    providerRef.current = provider;
    return provider;
  };

  // Connect wallet function
  const connect = async () => {
    try {
      const provider = await getActiveProvider();

      setIsConnecting(true);
      setError(null);

      const accounts = await provider.request({
        method: 'eth_requestAccounts',
      });

      if (accounts && accounts.length > 0) {
        setAddress(accounts[0]);
        setIsConnected(true);

        // Get chain ID
        const chainIdHex = await provider.request({ method: 'eth_chainId' });
        setChainId(parseInt(chainIdHex as string, 16));

        console.log('[Wallet] Connected to wallet:', accounts[0]);
      } else {
        setError('No accounts found');
      }
    } catch (err: any) {
      console.error('[Wallet] Error connecting wallet:', err);
      setError(err.message || 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  // Switch network function
  const switchNetwork = async (targetChainId: number) => {
    try {
      const provider = await getActiveProvider();

      if (!provider?.request) {
        throw new Error('Provider does not support network switching');
      }

      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${targetChainId.toString(16)}` }],
      });

      // Update local state immediately
      setChainId(targetChainId);
    } catch (switchError: any) {
      // This error code indicates that the chain has not been added to the wallet
      if (switchError.code === 4902) {
        try {
          const provider = await getActiveProvider();
          let networkConfig;
          if (targetChainId === 44787) {
            networkConfig = {
              chainId: '0xaf13',
              chainName: 'Alfajores',
              nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
              rpcUrls: ['https://alfajores-forno.celo-testnet.org'],
              blockExplorerUrls: ['https://alfajores.celoscan.io'],
            };
          } else if (targetChainId === 5042002) {
            networkConfig = {
              chainId: '0x4ce6e6',
              chainName: 'Arc Testnet',
              nativeCurrency: { name: 'ARC', symbol: 'ARC', decimals: 18 },
              rpcUrls: ['https://rpc.testnet.arc.network'],
              blockExplorerUrls: ['https://explorer.testnet.arc.network'],
            };
          } else if (targetChainId === 42161) {
            networkConfig = {
              chainId: '0xa4b1',
              chainName: 'Arbitrum One',
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              rpcUrls: ['https://arb1.arbitrum.io/rpc'],
              blockExplorerUrls: ['https://arbiscan.io'],
            };
          } else {
            networkConfig = {
              chainId: '0xa4ec',
              chainName: 'Celo',
              nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
              rpcUrls: ['https://forno.celo.org'],
              blockExplorerUrls: ['https://explorer.celo.org/mainnet'],
            };
          }

          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [networkConfig],
          });

          // Update local state after adding chain
          setChainId(targetChainId);
        } catch (addError) {
          console.error('[Wallet] Error adding network:', addError);
          setError('Failed to add network');
        }
      } else {
        console.error('[Wallet] Error switching network:', switchError);
        setError('Failed to switch network');
      }
    }
  };

  // Log Farcaster user info for analytics
  const logFarcasterUserInfo = (context: { user?: { fid?: number; username?: string; displayName?: string; pfpUrl?: string } }) => {
    try {
      const user = context.user;
      if (!user) {
        console.log('[Farcaster Analytics] No user info available');
        return;
      }
      console.log('[Farcaster Analytics] User Info:', {
        fid: user.fid,
        username: user.username,
        displayName: user.displayName,
        hasProfilePicture: !!user.pfpUrl,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[Farcaster] Error logging user info:', error);
    }
  };

  // Format address for display
  const formatAddress = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  // Disconnect wallet function
  const disconnect = async () => {
    setAddress(null);
    setIsConnected(false);
    setChainId(null);
    setError(null);
    console.log('[Wallet] Wallet disconnected');
  };

  // Farcaster-specific connect function
  const connectFarcasterWallet = async () => {
    if (!isFarcaster || !farcasterContext) {
      setError('Farcaster wallet connection is not available');
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);

      // Check if Farcaster context already has a connected address
      if (farcasterContext.connectedAddress) {
        setAddress(farcasterContext.connectedAddress);
        setIsConnected(true);
        console.log('[Farcaster] Connected using existing Farcaster address:', farcasterContext.connectedAddress);
        return;
      }

      // Fall back to regular wallet connection
      console.log('[Farcaster] Requesting wallet connection...');
      await connect();

    } catch (error) {
      console.error('[Farcaster] Error connecting wallet:', error);
      setError(error instanceof Error ? error.message : 'Failed to connect Farcaster wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  // Enhanced error handling for Farcaster
  const getFarcasterErrorMessage = (error: any) => {
    if (!isFarcaster) return null;

    if (error.message?.includes('Farcaster')) {
      return `Farcaster: ${error.message}`;
    }

    if (error.code === 'FARCASTER_NOT_AVAILABLE') {
      return 'Farcaster wallet is not available in this context';
    }

    if (error.code === 'FARCASTER_CONNECTION_FAILED') {
      return 'Failed to connect Farcaster wallet. Please try again.';
    }

    return null;
  };

  return {
    address,
    isConnected,
    isConnecting,
    error,
    chainId,
    isMiniPay,
    isFarcaster,
    farcasterContext,
    connect,
    disconnect,
    switchNetwork,
    formatAddress,
    connectFarcasterWallet,
    getFarcasterErrorMessage,
  };
}
