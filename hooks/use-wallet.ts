/**
 * Consolidated wallet hook
 * Handles wallet connection, account management, and MiniPay detection
 */

import { useEffect, useState } from 'react';
import { isMiniPayEnvironment } from '../utils/environment';
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

  // Initialize wallet and environment
  useEffect(() => {
    const initWallet = async () => {
      if (typeof window === 'undefined') return;

      // 1. Detect Farcaster Environment (Standard 2026)
      try {
        const context = await sdk.context;
        if (context) {
          setIsFarcaster(true);
          setFarcasterContext(context);
          sdk.actions.ready(); // Signal that frame is ready
          console.log('[Farcaster] Frame initialized with context:', context);
        }
      } catch (err) {
        // Not in Farcaster environment, continue
      }

      // 2. Detect MiniPay environment
      const inMiniPay = isMiniPayEnvironment();
      setIsMiniPay(inMiniPay);

      if (!window.ethereum) {
        console.log('No ethereum provider found');
        return;
      }

      // Get current chain ID
      try {
        if (!window.ethereum.request) {
          console.warn('window.ethereum.request is not available');
          return;
        }
        const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
        setChainId(parseInt(chainIdHex as string, 16));
      } catch (err) {
        console.warn('Error getting chain ID:', err);
      }

      // Auto-connect if in MiniPay or Farcaster
      if (inMiniPay) {
        connect();
      }

      // Event handlers
      const handleChainChanged = (chainId: string) => {
        setChainId(parseInt(chainId, 16));
        // Removed page reload to preserve UI state
        // Chain changes will be handled gracefully through state updates
      };

      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          setAddress(null);
          setIsConnected(false);
        } else {
          setAddress(accounts[0]);
          setIsConnected(true);
        }
      };

      // Add listeners
      window.ethereum.on('chainChanged', handleChainChanged);
      window.ethereum.on('accountsChanged', handleAccountsChanged);

      // Cleanup
      return () => {
        window.ethereum?.removeListener('chainChanged', handleChainChanged);
        window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
      };
    };

    // Small delay to ensure everything is loaded
    setTimeout(initWallet, 500);
  }, []);

  // Connect wallet function
  const connect = async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      setError('No Ethereum provider found');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      if (!window.ethereum.request) {
        setError('Ethereum provider does not support request method');
        setIsConnecting(false);
        return;
      }
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (accounts && accounts.length > 0) {
        setAddress(accounts[0]);
        setIsConnected(true);

        // Get chain ID
        const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
        setChainId(parseInt(chainIdHex as string, 16));

        console.log('Connected to wallet:', accounts[0]);
      } else {
        setError('No accounts found');
      }
    } catch (err: any) {
      console.error('Error connecting wallet:', err);
      setError(err.message || 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  // Switch network function
  const switchNetwork = async (targetChainId: number) => {
    if (typeof window === 'undefined' || !window.ethereum) {
      setError('No Ethereum provider found');
      return;
    }

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${targetChainId.toString(16)}` }],
      });
    } catch (switchError: any) {
      // This error code indicates that the chain has not been added to MetaMask.
      if (switchError.code === 4902) {
        try {
          let networkConfig;
          if (targetChainId === 44787) {
            networkConfig = {
              chainId: '0xaf13',
              chainName: 'Celo Alfajores',
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
          } else {
            networkConfig = {
              chainId: '0xa4ec',
              chainName: 'Celo Mainnet',
              nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
              rpcUrls: ['https://forno.celo.org'],
              blockExplorerUrls: ['https://explorer.celo.org/mainnet'],
            };
          }

          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [networkConfig],
          });
        } catch (addError) {
          console.error('Error adding network:', addError);
          setError('Failed to add network');
        }
      } else {
        console.error('Error switching network:', switchError);
        setError('Failed to switch network');
      }
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
    console.log('Wallet disconnected');
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
  };
}
