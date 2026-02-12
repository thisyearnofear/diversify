/**
 * Consolidated wallet hook
 * Single source of truth for connection state and provider operations.
 */

import { useEffect, useRef, useState } from 'react';
import { getAddChainParameter, isSupportedChainId, DEFAULT_CHAIN_ID, toHexChainId } from '../modules/wallet/core/chains';
import { connectWithWebAppKit, shouldUseWebAppKit } from '../modules/wallet/adapters/web-appkit';
import {
  getWalletEnvironment,
  getWalletProvider,
  setupWalletEventListenersForProvider,
} from '../utils/wallet-provider';

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

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const initWallet = async () => {
      if (typeof window === 'undefined') return;

      try {
        const environment = await getWalletEnvironment();
        setIsMiniPay(environment.isMiniPay);
        setIsFarcaster(environment.isFarcaster);
        setFarcasterContext(environment.farcasterContext);

        const provider = await getWalletProvider({ prefer: environment.isFarcaster ? 'farcaster' : 'auto' });
        providerRef.current = provider;

        const detectedChainId = await detectChainId(provider, environment.isMiniPay, environment.isFarcaster);

        if (!isSupportedChainId(detectedChainId) && (environment.isFarcaster || environment.isMiniPay)) {
          await switchToDefaultChain(provider);
          setChainId(DEFAULT_CHAIN_ID);
          cacheChainId(DEFAULT_CHAIN_ID);
        } else {
          setChainId(detectedChainId);
          cacheChainId(detectedChainId);
        }

        try {
          const method = environment.isFarcaster || environment.isMiniPay ? 'eth_requestAccounts' : 'eth_accounts';
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
    providerRef.current = provider;
    return provider;
  };

  const connect = async () => {
    try {
      setIsConnecting(true);
      setError(null);

      if (shouldUseWebAppKit(isMiniPay, isFarcaster)) {
        const appKitAccounts = await connectWithWebAppKit();
        if (appKitAccounts && appKitAccounts.length > 0) {
          const provider = await getActiveProvider();
          const chainIdHex = await provider.request({ method: 'eth_chainId' });

          setAddress(appKitAccounts[0]);
          setIsConnected(true);
          setChainId(parseInt(chainIdHex as string, 16));
          return;
        }
      }

      const provider = await getActiveProvider();
      const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[];

      if (accounts.length === 0) {
        setError('No accounts found');
        return;
      }

      setAddress(accounts[0]);
      setIsConnected(true);

      const chainIdHex = await provider.request({ method: 'eth_chainId' });
      const parsedChainId = parseInt(chainIdHex as string, 16);
      setChainId(parsedChainId);
      cacheChainId(parsedChainId);
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
  };

  const connectFarcasterWallet = async () => {
    if (!isFarcaster || !farcasterContext) {
      setError('Farcaster wallet connection is not available');
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);

      if (farcasterContext.connectedAddress) {
        setAddress(farcasterContext.connectedAddress);
        setIsConnected(true);
        return;
      }

      await connect();
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
