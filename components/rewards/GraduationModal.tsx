/**
 * GraduationModal - Testnet to Mainnet graduation flow
 * 
 * Core Principles:
 * - ENHANCEMENT FIRST: Extends existing rewards flow
 * - CONSOLIDATION: Located in rewards/ domain
 * - DRY: Uses useStreakRewards hook
 * - CLEAN: Presentation layer only
 */

import React, { useState, useEffect } from 'react';
import { useStreakRewards } from '../../hooks/use-streak-rewards';
import { useWalletContext } from '../wallet/WalletProvider';
import { NETWORKS } from '../../config';

// Human-readable network name for error messages
function getNetworkName(chainId: number): string {
  return Object.values(NETWORKS).find(n => n.chainId === chainId)?.name ?? `Chain ${chainId}`;
}

interface GraduationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGraduate: () => void;
}

export default function GraduationModal({ isOpen, onClose, onGraduate }: GraduationModalProps) {
  const { crossChainActivity, eligibleForGraduation } = useStreakRewards();
  const { switchNetwork } = useWalletContext();
  const [step, setStep] = useState<'preview' | 'celebration' | 'mainnet'>('preview');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) setStep('preview');
  }, [isOpen]);

  if (!isOpen || !crossChainActivity || !eligibleForGraduation) return null;

  const { testnet, mainnet, graduation } = crossChainActivity;

  const handleGraduate = async () => {
    setIsTransitioning(true);
    setStep('celebration');
    await new Promise(resolve => setTimeout(resolve, 2000));
    setStep('mainnet');
    setIsTransitioning(false);
  };

  const handleSwitchToMainnet = async (chainId: number) => {
    setIsTransitioning(true);
    setSwitchError(null);
    try {
      await switchNetwork?.(chainId);
      onGraduate();
    } catch (err: any) {
      // Surface the error inline — don't silently dismiss the modal
      const message = err?.message?.includes('rejected') || err?.code === 4001
        ? 'Switch rejected in wallet. Try again when ready.'
        : `Couldn't switch to ${getNetworkName(chainId)}. Please switch manually in your wallet.`;
      setSwitchError(message);
    } finally {
      setIsTransitioning(false);
    }
  };

  if (step === 'preview') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl overflow-hidden shadow-2xl mx-4">
          <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 p-6 text-white text-center">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl">🎓</div>
            <h2 className="text-2xl font-black mb-2">Ready to Graduate?</h2>
            <p className="text-purple-100 text-sm">You've mastered the testnets. Time for the real thing.</p>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 text-center">
                <div className="text-3xl font-black text-violet-600">{testnet.totalSwaps + testnet.totalClaims}</div>
                <div className="text-xs text-gray-500 mt-1">Testnet Actions</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 text-center">
                <div className="text-3xl font-black text-violet-600">{testnet.chainsUsed.length}</div>
                <div className="text-xs text-gray-500 mt-1">Chains Explored</div>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              {[
                { icon: '💰', text: 'Real $G UBI claims every day' },
                { icon: '🌍', text: 'Access to regional stablecoins' },
                { icon: '📈', text: 'Yield-bearing RWA tokens' },
                { icon: '🔐', text: 'Your activity history carries over' },
              ].map((benefit, i) => (
                <div key={i} className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3">
                  <span className="text-xl">{benefit.icon}</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300">{benefit.text}</span>
                </div>
              ))}
            </div>

            <button
              onClick={handleGraduate}
              disabled={isTransitioning}
              className="w-full py-4 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold rounded-2xl hover:from-violet-700 hover:to-purple-700 transition-all shadow-lg"
            >
              {isTransitioning ? 'Preparing...' : 'Graduate to Mainnet →'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'celebration') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl overflow-hidden shadow-2xl mx-4 p-12 text-center">
          <div className="w-32 h-32 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6 text-6xl animate-pulse">
            🎉
          </div>
          <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">Congratulations!</h2>
          <p className="text-gray-600 dark:text-gray-400">You've completed your testnet journey</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl overflow-hidden shadow-2xl mx-4">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white text-center">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl">🚀</div>
          <h2 className="text-2xl font-black mb-2">Welcome to Mainnet</h2>
          <p className="text-emerald-100 text-sm">Real transactions. Real rewards. Real impact.</p>
        </div>

        <div className="p-6">
          <div className="space-y-3 mb-4">
            <button
              onClick={() => handleSwitchToMainnet(NETWORKS.CELO_MAINNET.chainId)}
              disabled={isTransitioning}
              className="w-full p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border-2 border-transparent hover:border-emerald-500 disabled:opacity-50 transition-all text-left"
            >
              <div className="font-bold text-gray-900 dark:text-white">Celo Mainnet</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Regional stablecoins + $G UBI claims</div>
            </button>
            <button
              onClick={() => handleSwitchToMainnet(NETWORKS.ARBITRUM_ONE.chainId)}
              disabled={isTransitioning}
              className="w-full p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border-2 border-transparent hover:border-blue-500 disabled:opacity-50 transition-all text-left"
            >
              <div className="font-bold text-gray-900 dark:text-white">Arbitrum One</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Yield-bearing tokens + gold-backed assets</div>
            </button>
          </div>

          {/* Inline error — never silently dismiss */}
          {switchError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 flex items-start gap-2">
              <span className="text-red-500 text-sm mt-0.5">⚠️</span>
              <p className="text-xs text-red-700 dark:text-red-400 font-medium leading-relaxed">{switchError}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
