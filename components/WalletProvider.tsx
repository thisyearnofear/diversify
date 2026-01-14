import { createContext, useContext, type ReactNode } from "react";
import { useWallet } from "../hooks/use-wallet";
import type { Address, WalletClient } from "viem";

// Define the context type
interface WalletContextType {
  client: WalletClient | null;
  address: Address | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  chainId: number | null;
  isMiniPay: boolean;
  connect: () => Promise<void>;
}

// Create the context with default values
const WalletContext = createContext<WalletContextType>({
  client: null,
  address: null,
  isConnected: false,
  isConnecting: false,
  error: null,
  chainId: null,
  isMiniPay: false,
  connect: async () => {},
});

// Provider component
export function WalletProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet();

  return (
    <WalletContext.Provider value={wallet}>{children}</WalletContext.Provider>
  );
}

// Hook to use the wallet context
export function useWalletContext() {
  return useContext(WalletContext);
}
