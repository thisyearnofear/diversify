import { createContext, useContext, type ReactNode } from "react";
import { useWallet } from "../hooks/use-wallet";

// Define the context type
interface WalletContextType {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  chainId: number | null;
  isMiniPay: boolean;
  connect: () => Promise<void>;
  formatAddress: (addr: string) => string;
}

// Create the context with default values
const WalletContext = createContext<WalletContextType>({
  address: null,
  isConnected: false,
  isConnecting: false,
  error: null,
  chainId: null,
  isMiniPay: false,
  connect: async () => { },
  formatAddress: (addr: string) => addr,
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
