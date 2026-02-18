/**
 * TestnetSimulationBanner
 *
 * Shown when the user is on Arc Testnet (5042002) or Robinhood Chain Testnet (46630)
 * and pool contracts are not yet deployed. Instead of letting the swap silently fail
 * with a generic error, this banner:
 *
 * 1. Explains the current testnet status in plain language.
 * 2. Offers a "Simulate Swap" button that calls recordActivity() directly so the
 *    user still earns testnet achievements and progresses toward graduation.
 * 3. Leaves the real swap UI visible below — users can still try it.
 *
 * Core Principles:
 * - ENHANCEMENT FIRST: Adds to SwapTab without touching its core logic.
 * - CLEAN: Presentation layer only; all side-effects via the hook.
 * - MODULAR: Drop-in, zero dependencies beyond the streak hook.
 * - PERFORMANT: Renders nothing on mainnet / Alfajores.
 */

import React, { useState } from 'react';
import { useStreakRewards } from '../../hooks/use-streak-rewards';
import { NETWORKS } from '../../config';

const ARC_CHAIN_ID = NETWORKS.ARC_TESTNET.chainId;   // 5042002
const RH_CHAIN_ID  = NETWORKS.RH_TESTNET.chainId;    // 46630

const CHAIN_META: Record<number, {
  name: string; icon: string; color: string; border: string;
  description: string; faucetUrl: string; faucetLabel: string;
}> = {
  [ARC_CHAIN_ID]: {
    name: 'Arc Testnet',
    icon: '⚡',
    color: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    description: 'Arc AMM pools are being deployed. Simulate swaps now to earn achievements and progress toward graduation.',
    faucetUrl: 'https://faucet.circle.com',
    faucetLabel: 'Get USDC on Arc →',
  },
  [RH_CHAIN_ID]: {
    name: 'Robinhood Chain Testnet',
    icon: '📈',
    color: 'bg-violet-50 dark:bg-violet-900/20',
    border: 'border-violet-200 dark:border-violet-800',
    description: 'The RWA Market Maker is being deployed. Simulate stock swaps now to unlock the Stock Trader badge.',
    faucetUrl: 'https://faucet.testnet.chain.robinhood.com',
    faucetLabel: 'Get ETH on Robinhood →',
  },
};

interface Props {
  /** Accepts number | null | undefined — renders nothing for null/undefined. */
  chainId: number | null | undefined;
  /** Called after simulation is successfully recorded — use to trigger SwapSuccessCelebration */
  onSimulated?: () => void;
}

export function TestnetSimulationBanner({ chainId, onSimulated }: Props) {
  const { recordActivity } = useStreakRewards();
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulated, setSimulated] = useState(false);

  // Only render for chains that need simulation
  if (!chainId || !CHAIN_META[chainId]) return null;

  const meta = CHAIN_META[chainId];

  const handleSimulate = async () => {
    if (isSimulating || simulated) return;
    setIsSimulating(true);

    // Record a simulated swap — earns the same achievements as a real swap
    const ok = await recordActivity({
      action: 'swap',
      chainId,
      networkType: 'testnet',
      usdValue: 10, // Fixed $10 notional for simulation
    });

    setIsSimulating(false);
    if (ok) {
      setSimulated(true);
      onSimulated?.();
    }
  };

  return (
    <div className={`mb-3 p-3 ${meta.color} rounded-xl border ${meta.border}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl mt-0.5 flex-shrink-0">{meta.icon}</span>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              {meta.name} — Simulation Mode
            </span>
            <span className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-[9px] font-black uppercase rounded">
              Contracts Pending
            </span>
          </div>

          {/* Description */}
          <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed mb-3">
            {meta.description}
          </p>

          {/* CTA */}
          <div className="flex items-center gap-3 flex-wrap">
            {!simulated ? (
              <button
                onClick={handleSimulate}
                disabled={isSimulating}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                  isSimulating
                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-wait'
                    : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:opacity-90 active:scale-95'
                }`}
              >
                {isSimulating ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Simulating…
                  </span>
                ) : (
                  'Simulate Swap →'
                )}
              </button>
            ) : (
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-xs font-black">Swap recorded — achievement progress updated!</span>
              </div>
            )}

            <a
              href={meta.faucetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-bold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors underline-offset-2 hover:underline"
            >
              {meta.faucetLabel}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
