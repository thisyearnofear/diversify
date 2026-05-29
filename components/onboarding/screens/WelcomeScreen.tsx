import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { OnboardingScreenProps } from './types';
import { NETWORKS } from '../../../config';
import { useWalletContext } from '../../wallet/WalletProvider';

import { GuardianMascot } from '../../shared/GuardianMascot';

interface WelcomeScreenProps extends OnboardingScreenProps {
    onContinue: () => void;
    chainId?: number;
    /** Called when the user finishes onboarding (connect, demo). Receives the selected region. */
    onComplete?: (region: string | null) => void;
}

// Region data with inflation rates
const REGIONS = [
    { id: 'USA', label: 'USA', flag: '🗽', inflation: 3.5, lossPer10k: 350 },
    { id: 'Europe', label: 'Europe', flag: '🏰', inflation: 2.3, lossPer10k: 230 },
    { id: 'LatAm', label: 'LatAm', flag: '🌋', inflation: 10.4, lossPer10k: 1040 },
    { id: 'Africa', label: 'Africa', flag: '🌍', inflation: 15.8, lossPer10k: 1580 },
    { id: 'Asia', label: 'Asia', flag: '⛩️', inflation: 4.2, lossPer10k: 420 },
] as const;

export function WelcomeScreen({ onContinue, onSkip, onConnectWallet, isWalletConnected, chainId, onComplete }: WelcomeScreenProps) {
    const isTestnet = chainId && (chainId === NETWORKS.CELO_SEPOLIA.chainId || chainId === NETWORKS.ARC_TESTNET.chainId || chainId === NETWORKS.RH_TESTNET.chainId);
    const { switchNetwork, isConnected } = useWalletContext();
    const [isSwitching, setIsSwitching] = useState(false);
    const [switchDone, setSwitchDone] = useState(false);
    const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
    const [showTestDetails, setShowTestDetails] = useState(false);

    const selectedRegionData = REGIONS.find(r => r.id === selectedRegion);

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

    // Determine the onboarding phase
    const phase: 'regions' | 'impact' = selectedRegion ? 'impact' : 'regions';

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-10 text-center relative overflow-y-auto custom-scrollbar">
            {/* Mesh Gradient Background */}
            <div className="absolute inset-0 -z-10 opacity-30">
                <div className="absolute top-0 -left-1/4 w-full h-full bg-blue-400 dark:bg-blue-600 rounded-full blur-[120px] mix-blend-multiply" />
                <div className="absolute -bottom-1/4 -right-1/4 w-full h-full bg-purple-400 dark:bg-purple-600 rounded-full blur-[120px] mix-blend-multiply" />
            </div>

            {/* Brand and Mascot — always visible */}
            <motion.div
                className="mb-4 relative mt-6 md:mt-4"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', duration: 1 }}
            >
                <div className="flex items-center justify-center gap-1.5 mb-3">
                    <div className="w-5 h-5 bg-blue-600 rounded-md flex items-center justify-center shadow-sm">
                        <span className="text-white text-xs font-black">D</span>
                    </div>
                    <span className="text-xs font-black text-gray-400 uppercase tracking-widest">DiversiFi</span>
                </div>
                <GuardianMascot size={100} mood={phase === 'impact' ? 'happy' : 'neutral'} />
            </motion.div>


            {/* Phase 1: Region Selection */}
            {phase === 'regions' && (
                <motion.div
                    key="phase-regions"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="w-full max-w-sm"
                >
                    <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white mb-2 leading-tight">
                        Your Personal <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Guardian</span>
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                        Where are you based? Inflation hits differently everywhere.
                    </p>

                    <div className="grid grid-cols-2 gap-2 mb-6">
                        {REGIONS.map((region) => (
                            <button
                                key={region.id}
                                onClick={() => setSelectedRegion(region.id)}
                                className={`p-3 rounded-2xl border-2 text-left transition-all ${
                                    selectedRegion === region.id
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400'
                                        : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 bg-white dark:bg-gray-800'
                                }`}
                            >
                                <span className="text-xl block mb-1">{region.flag}</span>
                                <span className="text-xs font-black text-gray-900 dark:text-white block">{region.label}</span>
                                <span className="text-[10px] text-gray-500 dark:text-gray-400">{region.inflation}% inflation</span>
                            </button>
                        ))}
                    </div>

                    <motion.button
                        onClick={onContinue}
                        className="w-full px-8 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-base font-black rounded-2xl shadow-lg active:scale-95 transition-all"
                        whileHover={{ y: -1 }}
                    >
                        Let's Get Started →
                    </motion.button>

                    {/* Chain complexity hidden behind toggle */}
                    <div className="mt-4">
                        <button
                            onClick={() => setShowTestDetails(!showTestDetails)}
                            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors font-medium"
                        >
                            {showTestDetails ? '− Hide test details' : '+ Need test funds? (advanced)'}
                        </button>
                        <AnimatePresence>
                            {showTestDetails && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden mt-2"
                                >
                                    <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-xl p-3">
                                        <p className="text-xs text-violet-600 dark:text-violet-400 mb-2">
                                            Try with test funds (no real money):
                                        </p>
                                        <div className="flex gap-2 mb-2">
                                            <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer" className="text-xs text-violet-600 dark:text-violet-400 underline hover:no-underline">Arc faucet →</a>
                                            <a href="https://faucet.celo.org" target="_blank" rel="noopener noreferrer" className="text-xs text-violet-600 dark:text-violet-400 underline hover:no-underline">Celo faucet →</a>
                                        </div>
                                        {isConnected ? (
                                            <button
                                                onClick={handleSwitchToTestnet}
                                                disabled={isSwitching}
                                                className={`w-full py-2 rounded-xl text-xs font-black transition-all ${
                                                    switchDone
                                                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                                                        : 'bg-violet-600 hover:bg-violet-700 text-white active:scale-95'
                                                }`}
                                            >
                                                {switchDone ? '✓ Switched to Arc Testnet' : isSwitching ? 'Switching…' : '⚡ Switch to Arc Testnet'}
                                            </button>
                                        ) : (
                                            <p className="text-xs text-violet-500 dark:text-violet-400">Connect a wallet first, then switch to testnet.</p>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {onSkip && (
                        <button
                            onClick={onSkip}
                            className="w-full px-6 py-3 mt-2 text-xs font-bold text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                        >
                            Skip to App
                        </button>
                    )}
                </motion.div>
            )}

            {/* Phase 2: Aha Moment — Show personalized impact + connect/demo */}
            {phase === 'impact' && selectedRegionData && (
                <motion.div
                    key="phase-impact"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-sm"
                >
                    <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white mb-2 leading-tight">
                        Here's the reality in <span className="text-blue-500">{selectedRegionData.flag} {selectedRegionData.label}</span>
                    </h2>

                    {/* The aha moment: personalized impact card */}
                    <div className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-2 border-red-200 dark:border-red-800 rounded-2xl p-5 mb-5">
                        <p className="text-xs text-red-600 dark:text-red-400 font-bold mb-1">Every year, inflation silently takes</p>
                        <p className="text-4xl font-black text-red-600 dark:text-red-400 mb-2">
                            ${selectedRegionData.lossPer10k.toLocaleString()}
                        </p>
                        <p className="text-sm text-red-500 dark:text-red-300">
                            from every <strong>$10,000</strong> you keep in {selectedRegionData.label}.
                        </p>
                        <div className="mt-3 pt-3 border-t border-red-200 dark:border-red-800">
                            <p className="text-xs text-red-500 dark:text-red-300">
                                That's <strong>${(selectedRegionData.lossPer10k / 365).toFixed(1)}/day</strong> — gone. Every day you wait.
                            </p>
                        </div>
                    </div>

                    {/* Value prop: what DiversiFi does */}
                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-2 border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 mb-5">
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mb-1">DiversiFi protects you by</p>
                        <p className="text-base font-black text-emerald-900 dark:text-emerald-100">
                            spreading your stablecoins across stronger economies worldwide.
                        </p>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                            No lock-ups. No hidden fees. Pause anytime.
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="space-y-2">
                        {onConnectWallet && !isWalletConnected && (
                            <motion.button
                                onClick={async () => {
                                    try { await onConnectWallet(); } catch { /* user rejected — fall through */ }
                                    if (onComplete) onComplete(selectedRegion);
                                    else onSkip?.();
                                }}
                                className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg"
                                whileHover={{ y: -1 }}
                            >
                                <span>Connect Wallet to Start Protecting</span>
                            </motion.button>
                        )}
                        <button
                            onClick={() => {
                                if (onComplete) onComplete(selectedRegion);
                                else onSkip?.();
                            }}
                            className="w-full px-6 py-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white font-bold rounded-2xl active:scale-95 transition-all"
                        >
                            Explore Demo First
                        </button>
                        <button
                            onClick={() => setSelectedRegion(null)}
                            className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        >
                            ← Pick a different region
                        </button>
                    </div>
                </motion.div>
            )}
        </div>
    );
}
