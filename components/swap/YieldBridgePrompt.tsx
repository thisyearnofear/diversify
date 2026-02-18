/**
 * YieldBridgePrompt — cross-chain yield CTA for Celo users.
 *
 * Extracted from SwapTab. Single responsibility: invite the user to bridge
 * stablecoins to Arbitrum for yield-bearing RWAs. Persists dismissal in
 * localStorage so it never re-appears after the user says no.
 *
 * Self-contained — owns its own dismissed state.
 */
import React, { useState } from 'react';
import { NETWORKS } from '../../config';

const DISMISSED_KEY = 'diversifi-yield-prompt-dismissed';

interface YieldBridgePromptProps {
  /** Ref setter so SwapTab can pre-fill the swap interface on CTA click */
  onBridgeCTA: () => void;
}

export default function YieldBridgePrompt({ onBridgeCTA }: YieldBridgePromptProps) {
  const [isDismissed, setIsDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(DISMISSED_KEY) === 'true';
  });

  if (isDismissed) return null;

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem(DISMISSED_KEY, 'true');
  };

  return (
    <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-2xl p-4 text-white">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">💰</span>
            <span className="text-xs font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
              Boost Your Yield
            </span>
          </div>
          <h3 className="text-base font-black">Earn Up to 5% APY</h3>
          <p className="text-sm text-blue-100 mt-1 leading-relaxed">
            Bridge your stablecoins to Arbitrum and access tokenized US Treasuries with automatic yield
          </p>
          <div className="flex items-center gap-2 mt-3">
            <span className="bg-green-500/30 px-2 py-1 rounded-full text-xs">USDY 5%</span>
            <span className="bg-purple-500/30 px-2 py-1 rounded-full text-xs">SYRUPUSDC 4.5%</span>
            <span className="bg-amber-500/30 px-2 py-1 rounded-full text-xs">PAXG Gold</span>
          </div>
        </div>
        <div className="bg-white/10 p-2 rounded-xl ml-3">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4">
        <button
          onClick={onBridgeCTA}
          className="flex-1 py-3 bg-white text-blue-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
        >
          <span>Bridge to Arbitrum &amp; Earn</span>
          <span>→</span>
        </button>
        <button
          onClick={handleDismiss}
          className="ml-2 px-3 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white text-xs font-bold transition-colors"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
