import { useEffect } from "react";
import { useWalletContext } from "./WalletProvider";

interface WalletButtonProps {
  onConnect?: (address: string) => void;
}

export default function WalletButton({ onConnect }: WalletButtonProps) {
  const {
    address,
    isConnected,
    isConnecting,
    error: walletError,
    isMiniPay,
    connect,
  } = useWalletContext();

  useEffect(() => {
    // Call onConnect when address changes and is valid
    if (address && onConnect) {
      onConnect(address);
    }
  }, [address, onConnect]);

  const connectWallet = async () => {
    try {
      await connect();
    } catch (error) {
      console.error("Error in WalletButton connectWallet:", error);
    }
  };

  // If in MiniPay and connected, don't show the button
  if (isMiniPay && isConnected) {
    return null;
  }

  // If in MiniPay but not yet connected, show a loading state
  if (isMiniPay && !isConnected) {
    return (
      <div className="inline-flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded">
        <svg
          className="animate-spin -ml-1 mr-3 size-5 text-gray-700"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        Connecting to MiniPay...
      </div>
    );
  }

  // Show error if there is one
  if (walletError) {
    return (
      <div className="flex flex-col items-start">
        <button
          onClick={connectWallet}
          disabled={isConnecting}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isConnecting ? (
            <span className="flex items-center">
              <svg
                className="animate-spin -ml-1 mr-3 size-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Connecting...
            </span>
          ) : (
            "Try Again"
          )}
        </button>
        <p className="text-red-600 text-sm mt-1">{walletError}</p>
      </div>
    );
  }

  // Regular connect button for non-MiniPay environments
  return (
    <button
      onClick={connectWallet}
      disabled={isConnecting}
      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isConnecting ? (
        <span className="flex items-center">
          <svg
            className="animate-spin -ml-1 mr-3 size-5 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Connecting...
        </span>
      ) : isConnected ? (
        `Connected: ${address?.slice(0, 6)}...${address?.slice(-4)}`
      ) : (
        "Connect Wallet"
      )}
    </button>
  );
}
