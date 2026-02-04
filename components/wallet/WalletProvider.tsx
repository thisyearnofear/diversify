import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useWallet } from "../../hooks/use-wallet";
import { useAppState } from "../../context/AppStateContext";

// Define the context type (Standard 2026)
interface FarcasterContext {
  user?: {
    fid: number;
    username: string;
    displayName: string;
    pfpUrl: string;
  };
  location?: unknown;
  client?: unknown;
  added?: boolean;
  safeAreaInsets?: unknown;
  [key: string]: unknown;
}

interface WalletContextType {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  chainId: number | null;
  isMiniPay: boolean;
  isFarcaster: boolean;
  farcasterContext: FarcasterContext | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  switchNetwork: (chainId: number) => Promise<void>;
  formatAddress: (addr: string) => string;
  connectFarcasterWallet: () => Promise<void>;
  getFarcasterErrorMessage: (error: unknown) => string | null;
}

// Create the context with default values
const WalletContext = createContext<WalletContextType>({
  address: null,
  isConnected: false,
  isConnecting: false,
  error: null,
  chainId: null,
  isMiniPay: false,
  isFarcaster: false,
  farcasterContext: null,
  connect: async () => { },
  disconnect: async () => { },
  switchNetwork: async () => { },
  formatAddress: (addr: string) => addr,
  connectFarcasterWallet: async () => { },
  getFarcasterErrorMessage: () => null,
});

// Provider component
export function WalletProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet();

  // Integrate with app state context to sync chainId
  const { setChainId } = useAppState();

  // Update app state when wallet chainId changes
  useEffect(() => {
    if (wallet.chainId !== null) {
      setChainId(wallet.chainId);
    }
  }, [wallet.chainId, setChainId]);

  return (
    <WalletContext.Provider value={wallet}>{children}</WalletContext.Provider>
  );
}

// Hook to use the wallet context
export function useWalletContext() {
  return useContext(WalletContext);
}
