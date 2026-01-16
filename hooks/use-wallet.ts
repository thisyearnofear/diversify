/**
 * Consolidated wallet hook
 * Handles wallet connection, account management, and MiniPay detection
 */

import { useEffect, useState } from 'react';
import { isMiniPayEnvironment } from '../utils/environment';

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isMiniPay, setIsMiniPay] = useState(false);

  // Initialize wallet
  useEffect(() => {
    const initWallet = async () => {
      if (typeof window === 'undefined') return;

      // Detect MiniPay environment
      const inMiniPay = isMiniPayEnvironment();
      setIsMiniPay(inMiniPay);

      if (!window.ethereum) {
        console.log('No ethereum provider found');
        return;
      }

      // Get current chain ID
      try {
        const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
        setChainId(parseInt(chainIdHex as string, 16));
      } catch (err) {
        console.warn('Error getting chain ID:', err);
      }

      // Auto-connect if in MiniPay
      if (inMiniPay) {
        connect();
      }

      // Event handlers
      const handleChainChanged = (chainId: string) => {
        setChainId(parseInt(chainId, 16));
        window.location.reload();
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

  // Format address for display
  const formatAddress = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  return {
    address,
    isConnected,
    isConnecting,
    error,
    chainId,
    isMiniPay,
    connect,
    formatAddress,
  };
}
