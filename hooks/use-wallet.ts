/**
 * Consolidated wallet hook
 * Single source of truth for connection state and provider operations.
 * 
 * Priority order:
 * 1. Farcaster/MiniPay (auto-connect)
 * 2. Injected wallet (MetaMask/Coinbase)
 * 3. Privy (social login fallback)
 */

import { useEffect, useRef, useState } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { getAddChainParameter, isSupportedChainId, DEFAULT_CHAIN_ID, toHexChainId } from '../modules/wallet/core/chains';
import {
  getWalletEnvironment,
  getWalletProvider,
  setupWalletEventListenersForProvider,
} from '../utils/wallet-provider';
import { WALLET_FEATURES } from '../config/features';

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isMiniPay, setIsMiniPay] = useState(false);
  const [isFarcaster, setIsFarcaster] = useState(false);
  const [farcasterContext, setFarcasterContext] = useState<any | null>(null);

  const providerRef = useRef<any | null>(null);

  // Privy hooks (always call hooks, check enabled status separately)
  const privy = usePrivy();
  const { wallets: privyWallets } = useWallets();
  const privyEnabled = WALLET_FEATURES.PRIVY_ENABLED && WALLET_FEATURES.PRIVY_APP_ID;

  // Sync Privy wallet state with our wallet state
  useEffect(() => {
    console.log('[Wallet] Privy sync check:', {
      privyEnabled,
      ready: privy.ready,
      authenticated: privy.authenticated,
      walletsCount: privyWallets.length,
      currentAddress: address,
      user: privy.user ? 'exists' : 'null'
    });

    if (!privyEnabled) {
      console.log('[Wallet] Privy not enabled');
      return;
    }

    if (!privy.ready) {
      console.log('[Wallet] Privy not ready yet');
      return;
    }

    if (!privy.authenticated) {
      console.log('[Wallet] Privy not authenticated');
      return;
    }

    const syncPrivyWallet = async () => {
      console.log('[Wallet] Privy is ready and authenticated, checking wallets...');

      if (privyWallets.length > 0) {
        const embeddedWallet = privyWallets[0];
        const walletAddress = embeddedWallet.address;

        console.log('[Wallet] Found Privy wallet:', walletAddress);

        if (walletAddress) {
          console.log('[Wallet] Syncing Privy wallet to app state');
          setAddress(walletAddress);
          setIsConnected(true);
          cacheWalletPreference('privy', walletAddress);

          // Try to get chain ID from Privy wallet
          try {
            const provider = await embeddedWallet.getEthereumProvider();
            if (provider) {
              providerRef.current = provider;
              const chainIdHex = await provider.request({ method: 'eth_chainId' });
              const parsedChainId = parseInt(chainIdHex as string, 16);
              setChainId(parsedChainId);
              cacheChainId(parsedChainId);
              console.log('[Wallet] Privy wallet synced successfully, chainId:', parsedChainId);
            }
          } catch (err) {
            console.warn('[Wallet] Could not get Privy chain ID:', err);
          }
        }
      } else {
        console.log('[Wallet] Privy authenticated but no wallets found yet, waiting...');
      }
    };

    syncPrivyWallet();
  }, [privyEnabled, privy.ready, privy.authenticated, privyWallets, privy.user]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const initWallet = async () => {
      if (typeof window === 'undefined') return;

      try {
        const environment = await getWalletEnvironment();
        setIsMiniPay(environment.isMiniPay);
        setIsFarcaster(environment.isFarcaster);
        setFarcasterContext(environment.farcasterContext);

        const shouldAutoConnect = environment.isFarcaster || environment.isMiniPay;
        const provider = await getWalletProvider({
          prefer: environment.isFarcaster ? 'farcaster' : 'auto',
        });

        if (!provider) {
          return;
        }

        providerRef.current = provider;

        const detectedChainId = await detectChainId(provider, environment.isMiniPay, environment.isFarcaster);

        if (!isSupportedChainId(detectedChainId) && shouldAutoConnect) {
          await switchToDefaultChain(provider);
          setChainId(DEFAULT_CHAIN_ID);
          cacheChainId(DEFAULT_CHAIN_ID);
        } else {
          setChainId(detectedChainId);
          cacheChainId(detectedChainId);
        }

        try {
          const method = shouldAutoConnect ? 'eth_requestAccounts' : 'eth_accounts';
          const accounts = await provider.request({ method }) as string[];
          if (accounts.length > 0) {
            setAddress(accounts[0]);
            setIsConnected(true);
          }
        } catch (connectError) {
          console.warn('[Wallet] Auto-connect skipped:', connectError);
        }

        cleanup = setupWalletEventListenersForProvider(
          provider,
          (chainIdHex: string) => {
            const nextChainId = parseInt(chainIdHex, 16);
            setChainId(nextChainId);
            cacheChainId(nextChainId);
          },
          (accounts: string[]) => {
            if (accounts.length === 0) {
              setAddress(null);
              setIsConnected(false);
              return;
            }

            setAddress(accounts[0]);
            setIsConnected(true);
          }
        );
      } catch (initError) {
        console.warn('[Wallet] Wallet initialization skipped:', initError);
      }
    };

    initWallet();

    return () => {
      cleanup?.();
    };
  }, []);

  const getActiveProvider = async () => {
    if (providerRef.current) {
      return providerRef.current;
    }

    const provider = await getWalletProvider({ prefer: isFarcaster ? 'farcaster' : 'auto' });
    if (provider) {
      providerRef.current = provider;
    }
    return provider;
  };

  const connect = async () => {
    try {
      setIsConnecting(true);
      setError(null);

      // PRIORITY 1: Check for injected wallet FIRST (MetaMask, Coinbase, etc)
      const provider = await getActiveProvider();

      if (provider && typeof window !== 'undefined' && (window as any).ethereum) {
        // Injected wallet detected - use it directly (no Privy modal)
        console.log('[Wallet] Using detected injected wallet');
        try {
          const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[];

          if (accounts.length > 0) {
            setAddress(accounts[0]);
            setIsConnected(true);

            const chainIdHex = await provider.request({ method: 'eth_chainId' });
            const parsedChainId = parseInt(chainIdHex as string, 16);
            setChainId(parsedChainId);
            cacheChainId(parsedChainId);

            // Cache wallet preference
            cacheWalletPreference('injected', accounts[0]);
            return;
          }
        } catch (injectedError) {
          console.warn('[Wallet] Injected wallet rejected:', injectedError);
          // Fall through to Privy if user rejects
        }
      }

      // PRIORITY 2: No injected wallet or user rejected - use Privy for social login
      if (privyEnabled && privy.ready) {
        // Check if already authenticated
        if (privy.authenticated) {
          console.log('[Wallet] Already authenticated with Privy');

          // Check if wallet exists
          if (privyWallets.length > 0) {
            console.log('[Wallet] Privy wallet exists, syncing');
            const embeddedWallet = privyWallets[0];
            if (embeddedWallet.address) {
              setAddress(embeddedWallet.address);
              setIsConnected(true);
              cacheWalletPreference('privy', embeddedWallet.address);
            }
            return;
          } else {
            console.log('[Wallet] No Privy wallet found, creating one...');
            // Wallet doesn't exist yet - create it
            try {
              await privy.createWallet();
              console.log('[Wallet] Privy wallet created, waiting for sync...');
              // The useEffect will pick it up once created
              return;
            } catch (createError) {
              console.error('[Wallet] Failed to create Privy wallet:', createError);
              setError('Failed to create wallet. Please try again.');
              return;
            }
          }
        }

        console.log('[Wallet] Opening Privy modal (social login)');

        try {
          await privy.login();
          // After login, check if wallet needs to be created
          // The useEffect will handle syncing
          return;
        } catch (privyError: any) {
          // Handle user cancellation
          if (privyError?.message?.includes('User closed modal') ||
            privyError?.message?.includes('cancelled')) {
            console.log('[Wallet] Privy login cancelled by user');
            return;
          }

          console.warn('[Wallet] Privy login error:', privyError);
          setError('Social login failed. Please try again.');
          return;
        }
      }

      // No wallet available
      setError('No wallet found. Please install a wallet extension or enable social login.');
    } catch (connectError: any) {
      console.error('[Wallet] Connect error:', connectError);
      setError(connectError?.message || 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const switchNetwork = async (targetChainId: number) => {
    try {
      const provider = await getActiveProvider();
      if (!provider) {
        setError('No wallet connected');
        return;
      }
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: toHexChainId(targetChainId) }],
      });

      setChainId(targetChainId);
      cacheChainId(targetChainId);
    } catch (switchError: any) {
      if (switchError?.code === 4902) {
        try {
          const provider = await getActiveProvider();
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [getAddChainParameter(targetChainId)],
          });

          setChainId(targetChainId);
          cacheChainId(targetChainId);
          return;
        } catch (addError) {
          console.error('[Wallet] Failed adding chain:', addError);
          setError('Failed to add network');
          return;
        }
      }

      console.error('[Wallet] Failed switching network:', switchError);
      setError('Failed to switch network');
    }
  };

  const formatAddress = (addr: string) => `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;

  const disconnect = async () => {
    setAddress(null);
    setIsConnected(false);
    setChainId(null);
    setError(null);

    // Clear wallet preference from cache
    clearWalletPreference();

    // Logout from Privy if authenticated
    if (privyEnabled && privy.authenticated) {
      try {
        await privy.logout();
        console.log('[Wallet] Logged out from Privy');
      } catch (err) {
        console.warn('[Wallet] Error logging out from Privy:', err);
      }
    }

    console.log('[Wallet] Disconnected and cleared preferences');
  };

  const connectFarcasterWallet = async () => {
    if (!isFarcaster) {
      setError('Farcaster wallet connection is not available');
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);

      if (farcasterContext?.connectedAddress) {
        setAddress(farcasterContext.connectedAddress);
        setIsConnected(true);
        return;
      }

      const provider = await getWalletProvider({ prefer: 'farcaster' });
      if (!provider) {
        setError('Farcaster wallet provider not found');
        return;
      }

      const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[];
      if (!accounts || accounts.length === 0) {
        setError('No Farcaster accounts found');
        return;
      }

      providerRef.current = provider;
      setAddress(accounts[0]);
      setIsConnected(true);

      const chainIdHex = await provider.request({ method: 'eth_chainId' });
      setChainId(parseInt(chainIdHex as string, 16));
    } catch (farcasterError) {
      console.error('[Farcaster] Connect error:', farcasterError);
      setError(farcasterError instanceof Error ? farcasterError.message : 'Failed to connect Farcaster wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const getFarcasterErrorMessage = (farcasterError: any) => {
    if (!isFarcaster) return null;

    if (farcasterError?.message?.includes('Farcaster')) {
      return `Farcaster: ${farcasterError.message}`;
    }

    if (farcasterError?.code === 'FARCASTER_NOT_AVAILABLE') {
      return 'Farcaster wallet is not available in this context';
    }

    if (farcasterError?.code === 'FARCASTER_CONNECTION_FAILED') {
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

async function detectChainId(provider: any, isMiniPay: boolean, isFarcaster: boolean): Promise<number> {
  try {
    const chainIdHex = await provider.request({ method: 'eth_chainId' });
    return parseInt(chainIdHex as string, 16);
  } catch {
    // Continue to fallback checks.
  }

  if (provider?.chainId) {
    const chainId = typeof provider.chainId === 'string'
      ? parseInt(provider.chainId, 16)
      : Number(provider.chainId);

    if (!Number.isNaN(chainId)) {
      return chainId;
    }
  }

  if (isMiniPay || isFarcaster) {
    return DEFAULT_CHAIN_ID;
  }

  const cachedChainId = getCachedChainId();
  if (cachedChainId) {
    return cachedChainId;
  }

  return DEFAULT_CHAIN_ID;
}

async function switchToDefaultChain(provider: any): Promise<void> {
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: toHexChainId(DEFAULT_CHAIN_ID) }],
    });
  } catch {
    // Keep local fallback when switch is rejected/unavailable.
  }
}

function getCachedChainId(): number | null {
  if (typeof localStorage === 'undefined') return null;

  try {
    const value = localStorage.getItem('diversifi-last-chain-id');
    if (!value) return null;

    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
  } catch {
    return null;
  }
}

function cacheChainId(chainId: number): void {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.setItem('diversifi-last-chain-id', chainId.toString());
  } catch {
    // Optional cache only.
  }
}

function cacheWalletPreference(type: 'injected' | 'privy', address: string): void {
  if (typeof localStorage === 'undefined') return;

  try {
    const preference = {
      type,
      address,
      timestamp: Date.now(),
    };
    localStorage.setItem('diversifi-wallet-preference', JSON.stringify(preference));
    console.log(`[Wallet] Cached preference: ${type} wallet (${address.substring(0, 6)}...${address.substring(address.length - 4)})`);
  } catch {
    // Optional cache only.
  }
}

function getWalletPreference(): { type: 'injected' | 'privy'; address: string; timestamp: number } | null {
  if (typeof localStorage === 'undefined') return null;

  try {
    const stored = localStorage.getItem('diversifi-wallet-preference');
    if (!stored) return null;

    const preference = JSON.parse(stored);

    // Expire after 30 days
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - preference.timestamp > THIRTY_DAYS_MS) {
      clearWalletPreference();
      return null;
    }

    return preference;
  } catch {
    return null;
  }
}

function clearWalletPreference(): void {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.removeItem('diversifi-wallet-preference');
  } catch {
    // Optional cache only.
  }
}
