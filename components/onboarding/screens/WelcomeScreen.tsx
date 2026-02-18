import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { OnboardingScreenProps } from './types';
import { NETWORKS } from '../../../config';
import { useWalletContext } from '../../wallet/WalletProvider';

interface WelcomeScreenProps extends OnboardingScreenProps {
    onContinue: () => void;
    chainId?: number;
}

export function WelcomeScreen({ onContinue, onSkip, onConnectWallet, isWalletConnected, chainId }: WelcomeScreenProps) {
    const isTestnet = chainId && (chainId === NETWORKS.ALFAJORES.chainId || chainId === NETWORKS.ARC_TESTNET.chainId || chainId === NETWORKS.RH_TESTNET.chainId);
    const { switchNetwork, isConnected } = useWalletContext();
    const [isSwitching, setIsSwitching] = useState(false);
    const [switchDone, setSwitchDone] = useState(false);

    const handleSwitchToTestnet = async () => {
        if (isSwitching) return;
        setIsSwitching(true);
        try {
            await switchNetwork(NETWORKS.ARC_TESTNET.chainId);
            setSwitchDone(true);
        } catch {
            // user rejected or wallet not available — fall through
        } finally {
            setIsSwitching(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-10 text-center relative overflow-y-auto custom-scrollbar">
            {/* Mesh Gradient Background */}
            <div className="absolute inset-0 -z-10 opacity-30">
                <div className="absolute top-0 -left-1/4 w-full h-full bg-blue-400 dark:bg-blue-600 rounded-full blur-[120px] mix-blend-multiply" />
                <div className="absolute -bottom-1/4 -right-1/4 w-full h-full bg-purple-400 dark:bg-purple-600 rounded-full blur-[120px] mix-blend-multiply" />
            </div>

            {/* Premium Iconography / Shield Metaphor */}
            <motion.div
                className="mb-6 md:mb-10 relative mt-4 md:mt-0"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', duration: 1 }}
            >
                {/* Glow Ring */}
                <motion.div
                    className="absolute inset-0 bg-blue-500/20 dark:bg-blue-500/10 blur-3xl rounded-full"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                    transition={{ duration: 4, repeat: Infinity }}
                />

                <div className="size-24 md:size-32 bg-white dark:bg-gray-800 rounded-[2rem] md:rounded-[2.5rem] shadow-2xl flex items-center justify-center border border-gray-100 dark:border-gray-700 relative z-10 transition-transform hover:scale-105 duration-500">
                    <motion.div
                        className="text-5xl md:text-7xl select-none"
                        animate={{
                            rotateY: [0, 360],
                        }}
                        transition={{
                            duration: 15,
                            repeat: Infinity,
                            ease: 'linear',
                        }}
                    >
                        🛡️
                    </motion.div>
                </div>
            </motion.div>

            {/* Welcome Text with Refined Typography */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="px-4"
            >
                <h2 className="text-3xl md:text-4xl font-[900] tracking-tight text-gray-900 dark:text-white mb-2 md:mb-4 leading-tight">
                    Secure Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Wealth</span>
                </h2>
                <p className="text-base md:text-lg text-gray-500 dark:text-gray-400 mb-8 md:mb-10 max-w-sm mx-auto leading-relaxed font-medium">
                    Protect your savings across regions and cultures with tailored financial philosophies.
                </p>
            </motion.div>

            {/* Testnet Indicator — shown when already on a testnet */}
            {isTestnet && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mb-6 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 px-4 py-2 rounded-xl text-sm font-bold border border-amber-200 dark:border-amber-800 flex items-center gap-2"
                >
                    <span>🧪</span>
                    testnet mode active — play money only
                </motion.div>
            )}

            {/* Actions */}
            <motion.div
                className="space-y-3 md:space-y-4 w-full max-w-xs pb-8 md:pb-0"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
            >
                <motion.button
                    onClick={onContinue}
                    className="w-full px-8 py-4 md:py-5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-base md:text-lg font-black rounded-[1.5rem] md:rounded-3xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)] active:scale-95 transition-all"
                    whileHover={{ y: -2, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.4)" }}
                >
                    Get Started →
                </motion.button>

                {/* Test Drive entry point — for connected wallets: one-tap network switch */}
                {!isTestnet && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.55 }}
                        className="w-full bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-2xl overflow-hidden"
                    >
                        <div className="px-4 pt-3 pb-2">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-base">🧪</span>
                                <span className="text-xs font-black text-violet-700 dark:text-violet-400 uppercase tracking-wide">
                                    Test Drive — No Real Money
                                </span>
                            </div>
                            <p className="text-[10px] text-violet-600 dark:text-violet-500 leading-snug mb-3">
                                Try Arc Testnet with free USDC. Earn badges. Graduate to mainnet when ready.
                            </p>
                            {switchDone ? (
                                /* Step 2: switched — now guide to faucet */
                                <div className="space-y-2">
                                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span className="text-[10px] font-black">Switched to Arc Testnet!</span>
                                    </div>
                                    <a
                                        href="https://faucet.circle.com"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-2 w-full py-2 bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-black rounded-xl transition-colors"
                                    >
                                        <span>Get Free USDC from Faucet</span>
                                        <span>→</span>
                                    </a>
                                    <button
                                        onClick={onContinue}
                                        className="w-full py-1.5 text-[10px] font-bold text-violet-600 dark:text-violet-400 hover:text-violet-900 transition-colors"
                                    >
                                        Continue to App →
                                    </button>
                                </div>
                            ) : isConnected ? (
                                /* Step 1: wallet connected — one tap to switch */
                                <button
                                    onClick={handleSwitchToTestnet}
                                    disabled={isSwitching}
                                    className={`w-full py-2 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-2 ${
                                        isSwitching
                                            ? 'bg-violet-200 dark:bg-violet-900/40 text-violet-400 cursor-wait'
                                            : 'bg-violet-600 hover:bg-violet-700 text-white active:scale-95'
                                    }`}
                                >
                                    {isSwitching ? (
                                        <>
                                            <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                            <span>Switching…</span>
                                        </>
                                    ) : (
                                        <>⚡ Switch to Arc Testnet</>
                                    )}
                                </button>
                            ) : (
                                /* No wallet — prompt to connect first */
                                <div className="text-[10px] text-violet-500 dark:text-violet-400 text-center">
                                    Connect your wallet above, then tap here to switch to testnet
                                </div>
                            )}
                        </div>
                        {/* Footer: faucet links always visible */}
                        {!switchDone && (
                            <div className="px-4 pb-3 flex gap-3 text-[9px] text-violet-400 dark:text-violet-500 font-medium">
                                <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer" className="hover:text-violet-700 dark:hover:text-violet-300 transition-colors">Arc faucet →</a>
                                <a href="https://faucet.celo.org" target="_blank" rel="noopener noreferrer" className="hover:text-violet-700 dark:hover:text-violet-300 transition-colors">Celo faucet →</a>
                            </div>
                        )}
                    </motion.div>
                )}

                {onConnectWallet && !isWalletConnected && (
                    <motion.button
                        onClick={onConnectWallet}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 }}
                        className="w-full px-6 py-3 text-sm font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors flex items-center justify-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        Already have a wallet? Connect Now
                    </motion.button>
                )}
                {onSkip && (
                    <button
                        onClick={onSkip}
                        className="w-full px-6 py-2 text-xs font-[800] text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors uppercase tracking-widest"
                    >
                        Skip to App
                    </button>
                )}
            </motion.div>
        </div >
    );
}
