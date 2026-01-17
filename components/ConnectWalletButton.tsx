
import React from 'react';
import { motion } from 'framer-motion';

interface ConnectWalletButtonProps {
    address: string | null;
    isConnecting: boolean;
    connectWallet: () => Promise<void>;
    formatAddress: (addr: string) => string;
    isInMiniPay: boolean;
}

export const ConnectWalletButton: React.FC<ConnectWalletButtonProps> = ({
    address,
    isConnecting,
    connectWallet,
    formatAddress,
    isInMiniPay
}) => {
    // 1. Connected State
    if (address) {
        return (
            <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                    navigator.clipboard.writeText(address);
                    // Optional: use a toast instead of alert for better UX
                    alert("Wallet address copied to clipboard!");
                }}
                className="flex items-center space-x-2 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full text-gray-800 shadow-sm border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-200"
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
                className="flex items-center space-x-2 bg-gray-100 px-4 py-2 rounded-full text-gray-500 shadow-inner cursor-wait"
            >
                <div className="w-4 h-4 border-2 border-gray-400 border-t-blue-500 rounded-full animate-spin" />
                <span className="text-sm font-medium">Connecting...</span>
            </button>
        );
    }

    // 3. MiniPay Auto-Connect State (Shouldn't theoretically happen often if auto-connect works, but good fallback)
    if (isInMiniPay) {
        return (
            <button
                onClick={connectWallet}
                className="flex items-center space-x-2 bg-blue-50 px-4 py-2 rounded-full text-blue-700 shadow-sm border border-blue-100"
            >
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-sm font-medium">MiniPay Detected</span>
            </button>
        )
    }

    // 4. Default: Connect Wallet (Web/Desktop)
    return (
        <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={connectWallet}
            className="group relative flex items-center justify-center px-5 py-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-300 overflow-hidden"
        >
            {/* Searchlight effect */}
            <div className="absolute top-0 -left-10 w-10 h-full bg-white/20 skew-x-[25deg] group-hover:animate-[shine_1s_infinite]" />

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
    );
};
