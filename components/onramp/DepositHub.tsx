import React from "react";
import { useWalletContext } from "../wallet/WalletProvider";
import { NetworkOptimizedOnramp } from "./NetworkOptimizedOnramp";
import { useToast } from "../ui/Toast";

export function DepositHub({ className = "" }: { className?: string }) {
    const { address, isMiniPay, isConnected, connect } = useWalletContext();
    const { showToast } = useToast();

    const copyAddress = () => {
        if (address) {
            navigator.clipboard.writeText(address);
            showToast("Address copied!", "success");
        }
    };

    if (!isConnected) {
        return (
            <div className={`p-6 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30 text-center ${className}`}>
                <h3 className="text-sm font-black text-blue-900 dark:text-blue-100 mb-2 uppercase">Ready to get started?</h3>
                <p className="text-xs text-blue-700 dark:text-blue-300 mb-4 font-medium">Connect your wallet to see options for adding funds.</p>
                <button
                    onClick={connect}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-full text-sm font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all"
                >
                    Connect Wallet
                </button>
            </div>
        );
    }

    return (
        <div className={`space-y-4 ${className}`}>
            {/* Native MiniPay Promo */}
            {isMiniPay && (
                <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl text-white shadow-lg">
                    <div className="flex items-start gap-3">
                        <span className="text-2xl mt-1">📱</span>
                        <div>
                            <h3 className="font-black text-sm uppercase">MiniPay Detected</h3>
                            <p className="text-xs opacity-90 font-medium mt-1 mb-3">
                                Use the native "Add Cash" button in your MiniPay wallet for the fastest experience.
                            </p>
                            <button
                                onClick={() => showToast("Use the '+' button in your MiniPay app", "info")}
                                className="px-4 py-1.5 bg-white text-blue-600 rounded-lg text-xs font-bold"
                            >
                                How to find it
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Instant Buy - Integrated */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between">
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Instant Access</h3>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">Buy with Card/Transfer</p>
                    </div>
                    <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-[10px] font-black text-green-700 dark:text-green-400 rounded-md">
                        LOW KYC
                    </span>
                </div>
                <div className="p-4">
                    <NetworkOptimizedOnramp
                        showNetworkInfo={false}
                        variant="default"
                        className="w-full"
                    />
                    <p className="text-[10px] text-gray-400 mt-3 text-center italic">
                        Secured by regulated Swiss & EU infrastructure
                    </p>
                </div>
            </div>

            {/* Manual Deposit */}
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 border border-dashed border-gray-300 dark:border-gray-700">
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3 text-center">Transfer from Exchange</h3>
                <div className="flex flex-col items-center gap-3">
                    <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 w-full">
                        <div className="flex items-center justify-between gap-2">
                            <code className="text-[10px] font-mono text-gray-600 dark:text-gray-300 truncate flex-1">
                                {address}
                            </code>
                            <button
                                onClick={copyAddress}
                                className="p-1.5 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 rounded-lg hover:bg-blue-100 transition-colors"
                                title="Copy Address"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                            </button>
                        </div>
                    </div>
                    <p className="text-[10px] text-gray-500 text-center px-4 leading-relaxed">
                        Copy your address to send funds from Binance, Coinbase, or other exchanges.
                    </p>
                </div>
            </div>
        </div>
    );
}
