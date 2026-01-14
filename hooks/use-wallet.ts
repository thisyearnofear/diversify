import { useEffect, useState } from 'react';
import { createWalletClient, custom, type Address, type WalletClient } from 'viem';
import { celo, celoAlfajores } from 'viem/chains';
import { isMiniPayEnvironment } from '../utils/environment';

export function useWallet() {
  const [client, setClient] = useState<WalletClient | null>(null);
  const [address, setAddress] = useState<Address | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isMiniPay, setIsMiniPay] = useState(false);

  // Initialize wallet client
  useEffect(() => {
    const initWallet = async () => {
      try {
        // Check if we're in MiniPay environment
        const inMiniPay = isMiniPayEnvironment();
        setIsMiniPay(inMiniPay);

        // Check if ethereum provider exists
        if (typeof window === 'undefined' || !window.ethereum) {
          console.log('No ethereum provider found');
          return;
        }

        // Create wallet client
        const chain = process.env.NEXT_PUBLIC_USE_TESTNET === 'true' ? celoAlfajores : celo;
        const walletClient = createWalletClient({
          chain,
          transport: custom(window.ethereum),
        });

        setClient(walletClient);

        // Log for debugging
        console.log('Wallet client initialized', {
          inMiniPay,
          chain: chain.name,
          chainId: chain.id
        });

        // Auto-connect if in MiniPay
        if (inMiniPay) {
          connect();
        }

        // Listen for chain changes
        const handleChainChanged = (chainId: string) => {
          console.log('Chain changed:', chainId);
          setChainId(Number.parseInt(chainId, 16));
          // Reload the page to ensure all components use the new chain
          window.location.reload();
        };

        // Listen for account changes
        const handleAccountsChanged = (accounts: string[]) => {
          console.log('Accounts changed:', accounts);
          if (accounts.length === 0) {
            setAddress(null);
            setIsConnected(false);
          } else {
            setAddress(accounts[0] as Address);
            setIsConnected(true);
          }
        };

        // Add event listeners
        window.ethereum.on('chainChanged', handleChainChanged);
        window.ethereum.on('accountsChanged', handleAccountsChanged);

        // Get current chain ID
        const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
        setChainId(Number.parseInt(currentChainId as string, 16));

        // Cleanup
        return () => {
          window.ethereum?.removeListener('chainChanged', handleChainChanged);
          window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
        };
      } catch (err: any) {
        console.error('Error initializing wallet:', err);
        setError(err.message || 'Failed to initialize wallet');
      }
    };

    initWallet();
  }, []);

  // Connect wallet function
  const connect = async () => {
    if (!client) {
      setError('Wallet client not initialized');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Request accounts
      const accounts = await client.requestAddresses();

      if (accounts && accounts.length > 0) {
        setAddress(accounts[0]);
        setIsConnected(true);
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

  return {
    client,
    address,
    isConnected,
    isConnecting,
    error,
    chainId,
    isMiniPay,
    connect
  };
}
