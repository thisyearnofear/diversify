import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useWalletContext } from './WalletProvider';
import { useToast } from '../ui/Toast';

type ButtonVariant = 'primary' | 'secondary' | 'inline' | 'minimal';

interface WalletButtonProps {
  variant?: ButtonVariant;
  className?: string;
  onConnect?: (address: string) => void;
}

export default function WalletButton({
  variant = 'primary',
  className = "",
  onConnect
}: WalletButtonProps) {
  const {
    address,
    isConnected,
    isConnecting,
    error: walletError,
    isMiniPay,
    connect,
    disconnect,
    formatAddress,
  } = useWalletContext();

  const { showToast } = useToast();
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (address && onConnect) {
      onConnect(address);
    }
  }, [address, onConnect]);

  const handleConnect = async () => {
    try {
      await connect();
    } catch (error) {
      console.error("Error in WalletButton handleConnect:", error);
    }
  };

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      showToast("Address copied to clipboard!", "success");
      setShowDropdown(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      showToast("Wallet disconnected", "success");
      setShowDropdown(false);
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
      showToast("Failed to disconnect wallet", "error");
    }
  };

  const getVariantClasses = () => {
    switch (variant) {
      case 'primary':
        return "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30";
      case 'secondary':
        return "bg-white dark:bg-gray-800 text-gray-800 dark:text-white border border-gray-200 dark:border-gray-700 hover:border-blue-300 shadow-sm";
      case 'inline':
        return "bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md";
      case 'minimal':
        return "bg-transparent text-blue-600 hover:underline px-0 py-0";
      default:
        return "";
    }
  };

  // 1. Connected State
  if (address) {
    return (
      <div className="relative">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowDropdown(!showDropdown)}
          className={`flex items-center space-x-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm min-w-[48px] min-h-[48px] px-4 py-3 rounded-full text-gray-900 dark:text-white shadow-sm border border-gray-200 dark:border-gray-700 hover:border-blue-300 hover:shadow-md transition-all duration-200 ${className}`}
          aria-label="Wallet menu"
          aria-expanded={showDropdown}
          aria-haspopup="true"
        >
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-medium font-mono">{formatAddress(address)}</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-4 w-4 text-gray-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </motion.button>

        {/* Dropdown Menu */}
        {showDropdown && (
          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
            <div className="py-1">
              <button
                onClick={copyAddress}
                className="flex items-center w-full min-h-[44px] px-4 py-2 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Copy wallet address"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 mr-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                Copy Address
              </button>
              <button
                onClick={handleDisconnect}
                className="flex items-center w-full min-h-[44px] px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                aria-label="Disconnect wallet"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 mr-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                Disconnect
              </button>
            </div>
          </div>
        )}

        {/* Click outside to close dropdown */}
        {showDropdown && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />
        )}
      </div>
    );
  }

  // 2. Connecting State
  if (isConnecting) {
    return (
      <button
        disabled
        className={`flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-full text-gray-500 dark:text-gray-400 shadow-inner cursor-wait ${className}`}
      >
        <div className="w-4 h-4 border-2 border-gray-400 border-t-blue-500 rounded-full animate-spin" />
        <span className="text-sm font-medium">Connecting...</span>
      </button>
    );
  }

  // 3. MiniPay Syncing State
  if (isMiniPay && !isConnected) {
    return (
      <div className={`inline-flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full ${className}`}>
        <svg className="animate-spin -ml-1 mr-3 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="text-sm">MiniPay Syncing...</span>
      </div>
    );
  }

  // 4. Default: Connect Wallet
  return (
    <div className="flex flex-col items-end">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleConnect}
        className={`group relative flex items-center justify-center px-5 py-2 rounded-full font-medium transition-all duration-300 overflow-hidden ${getVariantClasses()} ${className}`}
      >
        {variant === 'primary' && (
          <div className="absolute top-0 -left-10 w-10 h-full bg-white/20 skew-x-[25deg] group-hover:animate-[shine_1s_infinite]" />
        )}

        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 mr-2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        <span>Connect Wallet</span>
      </motion.button>
      {walletError && (
        <p className="text-red-500 text-[10px] mt-1 font-medium">{walletError}</p>
      )}
    </div>
  );
}