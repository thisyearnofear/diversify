import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useWalletContext } from './WalletProvider';
import { useToast } from './Toast';

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
    formatAddress,
  } = useWalletContext();

  const { showToast } = useToast();

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
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={copyAddress}
        className={`flex items-center space-x-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm px-4 py-2 rounded-full text-gray-800 dark:text-white shadow-sm border border-gray-200 dark:border-gray-700 hover:border-blue-300 hover:shadow-md transition-all duration-200 ${className}`}
      >
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-sm font-medium font-mono">{formatAddress(address)}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 text-gray-400"
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
      </motion.button>
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