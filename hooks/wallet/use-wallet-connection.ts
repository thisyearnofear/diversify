import { useState, useEffect } from "react";
import { isMiniPayEnvironment } from "../../utils/environment";

export function useWalletConnection() {
  const [isInMiniPay, setIsInMiniPay] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if we're in MiniPay environment
    const checkMiniPay = async () => {
      if (typeof window === "undefined") return;

      const inMiniPay = isMiniPayEnvironment();
      setIsInMiniPay(inMiniPay);

      console.log("MiniPay detection:", {
        inMiniPay,
        userAgent: navigator.userAgent,
        hasEthereum: !!window.ethereum,
        inIframe: window !== window.parent,
        referrer: document.referrer || "None",
      });

      // Auto-connect if in MiniPay or if ethereum provider exists
      if (window.ethereum) {
        if (inMiniPay) {
          console.log("MiniPay detected, connecting automatically...");
        }
        connectWallet();
      }
    };

    // Small delay to ensure everything is loaded
    setTimeout(checkMiniPay, 500);

    // Listen for account changes
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length > 0) {
        setAddress(accounts[0]);
      } else {
        setAddress(null);
      }
    };

    // Listen for chain changes
    const handleChainChanged = (chainId: string) => {
      setChainId(Number.parseInt(chainId, 16));
      // Reload the page to ensure all components use the new chain
      window.location.reload();
    };

    if (typeof window !== "undefined" && window.ethereum) {
      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("chainChanged", handleChainChanged);
    }

    return () => {
      // Clean up listeners
      if (typeof window !== "undefined" && window.ethereum) {
        window.ethereum.removeListener(
          "accountsChanged",
          handleAccountsChanged
        );
        window.ethereum.removeListener("chainChanged", handleChainChanged);
      }
    };
  }, []);

  const connectWallet = async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      setError("No Ethereum provider found");
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Request accounts
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
        params: [],
      });

      if (accounts && accounts.length > 0) {
        setAddress(accounts[0]);

        // Get chain ID
        const chainIdHex = await window.ethereum.request({
          method: "eth_chainId",
        });

        const chainIdNum = Number.parseInt(chainIdHex as string, 16);
        setChainId(chainIdNum);

        console.log("Connected to wallet:", {
          address: accounts[0],
          chainId: chainIdNum,
        });
      } else {
        setError("No accounts found");
      }
    } catch (err: any) {
      console.error("Error connecting wallet:", err);
      setError(err.message || "Failed to connect wallet");
    } finally {
      setIsConnecting(false);
    }
  };

  // Format address for display
  const formatAddress = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  return {
    isInMiniPay,
    address,
    chainId,
    isConnecting,
    error,
    connectWallet,
    formatAddress,
  };
}
