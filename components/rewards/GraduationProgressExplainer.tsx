/**
 * GraduationProgressExplainer - Visual guide for Testnet → Mainnet progression
 * 
 * Core Principles:
 * - USER-CENTRIC: Explains the "why" behind graduation milestones
 * - CLARITY: Shows clear path from learning to real value
 * - ENCOURAGEMENT: Celebrates progress, motivates next steps
 */

import React from 'react';
import { useStreakRewards } from '../../hooks/use-streak-rewards';
import { NETWORKS } from '../../config';
import { useWalletContext } from '../wallet/WalletProvider';

interface GraduationStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  chains: string[];
  requirement: string;
  reward: string;
}

const GRADUATION_STEPS: GraduationStep[] = [
  {
    id: 'learn',
    title: 'Learn',
    description: 'Practice with testnet tokens — no real money needed',
    icon: '📚',
    chains: ['Celo Sepolia', 'Arc Testnet', 'RH Testnet'],
    requirement: 'Complete 3+ swaps on any testnet',
    reward: 'Build confidence risk-free',
  },
  {
    id: 'prove',
    title: 'Prove',
    description: 'Demonstrate consistent safe behavior across chains',
    icon: '🎯',
    chains: ['Multiple testnets'],
    requirement: 'Activity on 2+ testnets + 7-day streak',
    reward: 'Unlock graduation eligibility',
  },
  {
    id: 'graduate',
    title: 'Graduate',
    description: 'Move to mainnet with real value protection',
    icon: '🎓',
    chains: ['Celo Mainnet', 'Arbitrum'],
    requirement: 'Pass graduation check',
    reward: 'Real inflation protection begins',
  },
];

interface GraduationProgressExplainerProps {
  className?: string;
  /** Show compact inline version */
  compact?: boolean;
}

export function GraduationProgressExplainer({ 
  className = '',
  compact = false 
}: GraduationProgressExplainerProps) {
  const { crossChainActivity, achievements, eligibleForGraduation } = useStreakRewards();
  const { switchNetwork } = useWalletContext();

  // Calculate progress
  const testnetSwaps = crossChainActivity?.testnet.totalSwaps ?? 0;
  const chainsUsed = crossChainActivity?.testnet.chainsUsed ?? [];
  const isGraduated = crossChainActivity?.graduation.isGraduated ?? false;
  
  // Determine current step
  const currentStep = isGraduated 
    ? 'graduate' 
    : testnetSwaps >= 3 && chainsUsed.length >= 2 
      ? 'prove' 
      : 'learn';

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {GRADUATION_STEPS.map((step, idx) => {
          const isActive = step.id === currentStep;
          const isComplete = GRADUATION_STEPS.findIndex(s => s.id === currentStep) > idx;
          
          return (
            <React.Fragment key={step.id}>
              <div 
                className={`
                  flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold
                  ${isComplete ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : ''}
                  ${isActive ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 ring-2 ring-violet-300 dark:ring-violet-700' : ''}
                  ${!isComplete && !isActive ? 'bg-gray-100 dark:bg-gray-800 text-gray-400' : ''}
                `}
                title={step.title}
              >
                {isComplete ? '✓' : step.icon}
              </div>
              {idx < GRADUATION_STEPS.length - 1 && (
                <div className={`w-6 h-0.5 ${isComplete ? 'bg-emerald-300 dark:bg-emerald-700' : 'bg-gray-200 dark:bg-gray-700'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50 dark:from-violet-900/20 dark:via-purple-900/20 dark:to-indigo-900/20 rounded-xl border border-violet-200 dark:border-violet-800 p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-violet-900 dark:text-violet-100">
          🎓 Your Journey to Mainnet
        </h3>
        {isGraduated && (
          <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-full">
            Graduated! 🎉
          </span>
        )}
      </div>

      {/* Progress Steps */}
      <div className="space-y-3">
        {GRADUATION_STEPS.map((step, idx) => {
          const isActive = step.id === currentStep;
          const isComplete = GRADUATION_STEPS.findIndex(s => s.id === currentStep) > idx;
          
          return (
            <div 
              key={step.id}
              className={`
                relative p-3 rounded-lg border transition-all
                ${isComplete 
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' 
                  : isActive 
                    ? 'bg-white dark:bg-gray-800 border-violet-300 dark:border-violet-700 shadow-sm' 
                    : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800 opacity-60'}
              `}
            >
              <div className="flex items-start gap-3">
                {/* Step icon/status */}
                <div className={`
                  flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg
                  ${isComplete ? 'bg-emerald-100 dark:bg-emerald-900/30' : ''}
                  ${isActive ? 'bg-violet-100 dark:bg-violet-900/30' : ''}
                  ${!isComplete && !isActive ? 'bg-gray-100 dark:bg-gray-800' : ''}
                `}>
                  {isComplete ? '✓' : step.icon}
                </div>

                {/* Step content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-sm font-bold ${isActive ? 'text-violet-900 dark:text-violet-100' : isComplete ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-600 dark:text-gray-400'}`}>
                      {step.title}
                    </span>
                    {isActive && !isComplete && (
                      <span className="px-1.5 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 text-xs font-bold rounded">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                    {step.description}
                  </p>
                  
                  {/* Chain badges */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {step.chains.map(chain => (
                      <span 
                        key={chain}
                        className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs rounded"
                      >
                        {chain}
                      </span>
                    ))}
                  </div>

                  {/* Requirement & Reward for active step */}
                  {isActive && !isComplete && (
                    <div className="space-y-1 pt-2 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Next:</span>
                        <span className="text-xs font-semibold text-violet-700 dark:text-violet-300">
                          {step.requirement}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Reward:</span>
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          {step.reward}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Connector line */}
              {idx < GRADUATION_STEPS.length - 1 && (
                <div className={`absolute left-7 bottom-0 w-0.5 h-3 ${isComplete ? 'bg-emerald-300 dark:bg-emerald-700' : 'bg-gray-200 dark:bg-gray-700'}`} style={{ transform: 'translateY(100%)' }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Current Progress Summary */}
      {!isGraduated && (
        <div className="mt-4 pt-3 border-t border-violet-200 dark:border-violet-800">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600 dark:text-gray-400">
              Your progress: <span className="font-bold text-violet-700 dark:text-violet-300">{testnetSwaps} swaps</span> on <span className="font-bold text-violet-700 dark:text-violet-300">{chainsUsed.length} chain{chainsUsed.length !== 1 ? 's' : ''}</span>
            </span>
            {achievements.length > 0 && (
              <span className="text-violet-600 dark:text-violet-400">
                {achievements.length} badge{achievements.length !== 1 ? 's' : ''} earned
              </span>
            )}
          </div>
        </div>
      )}

      {/* CTA for testnet */}
      {!isGraduated && testnetSwaps < 3 && (
        <div className="mt-3">
          <button
            onClick={() => switchNetwork?.(NETWORKS.CELO_SEPOLIA.chainId)}
            className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <span>🧪</span>
            <span>Start Learning on Testnet</span>
          </button>
          <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-2">
            Get free test tokens from <a href="https://faucet.celo.org" target="_blank" rel="noopener noreferrer" className="text-violet-600 dark:text-violet-400 hover:underline">celo.org/faucet</a>
          </p>
        </div>
      )}
    </div>
  );
}

export default GraduationProgressExplainer;
