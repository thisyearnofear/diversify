/**
 * UnconnectedStateShell — Reusable layout shell for every tab's unconnected state.
 *
 * Provides a consistent structure: heroCard → proof card → how-it-works → demo CTA.
 * Each tab provides its own heroCard (the main value proposition / CTA) and
 * optionally howItWorks steps, demo CTA, and additional children.
 *
 * Per the Core Principles:
 *   - DRY: the layout lives in one place; every tab's empty state is a thin wrapper.
 *   - CONSOLIDATION: replaces the duplicate inline layouts in NotConnectedState,
 *     ProtectionNotConnected, ExchangeTab, and AgentTab.
 *   - MODULAR: explicit props, no implicit state, no side effects.
 *   - CLEAN: the component has NO data fetching. Data dependencies (LiveProofCard,
 *     WalletButton) are passed in via props or imported directly.
 *   - PERFORMANT: no new fetches, no new hooks.
 *   - ORGANIZED: lives in components/shared/ so any tab can import it.
 */

import React from 'react';
import { Card } from './TabComponents';
import { LiveProofCard } from './LiveProofCard';

export interface HowItWorksStep {
  icon: string;
  title: string;
  text: string;
}

export interface UnconnectedStateShellProps {
  /** Tab-specific hero card — the main value proposition, calculator, or CTA */
  heroCard: React.ReactNode;
  /** Additional CSS classes on the outer container (e.g. "pb-6" for bottom padding) */
  className?: string;
  /** Whether to show the LiveProofCard trust surface (default: true) */
  showProofCard?: boolean;
  /** Where to place the proof card relative to the hero card. "below" (default) renders
   *  hero → proof → how-it-works. "above" renders proof → hero → how-it-works. */
  proofCardSide?: 'above' | 'below';
  /** Whether to show the demo mode CTA (default: true) */
  showDemoCta?: boolean;
  /** Callback for enabling demo mode — required when showDemoCta is true */
  onEnableDemo?: () => void;
  /** "How it works" steps — optional but recommended for consistency */
  howItWorks?: HowItWorksStep[];
  /** Whether to hide the "How it works" section when it exists (e.g. when onboarding is active) */
  hideHowItWorks?: boolean;
  /** Additional CSS classes forwarded to the "How it works" Card (e.g. "mb-2") */
  howItWorksCardClassName?: string;
  /** Additional CSS classes forwarded to the demo CTA Card (e.g. "mt-4") */
  demoCtaCardClassName?: string;
  /** Additional content rendered below the shared sections */
  children?: React.ReactNode;
}

export function UnconnectedStateShell({
  heroCard,
  className = '',
  showProofCard = true,
  proofCardSide = 'below',
  showDemoCta = true,
  onEnableDemo,
  howItWorks,
  hideHowItWorks = false,
  howItWorksCardClassName = '',
  demoCtaCardClassName = '',
  children,
}: UnconnectedStateShellProps) {
  const proofCard = showProofCard ? <LiveProofCard /> : null;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 1. Tab-specific hero card + proof card (order controlled by proofCardSide) */}
      {proofCardSide === 'above' && proofCard}
      {heroCard}
      {proofCardSide === 'below' && proofCard}

      {/* 3. How it works steps */}
      {howItWorks && howItWorks.length > 0 && !hideHowItWorks && (
        <Card padding="p-4" className={howItWorksCardClassName}>
          <h3 className="text-xs font-black uppercase text-gray-400 tracking-widest mb-3">
            How It Works
          </h3>
          <div className="space-y-3">
            {howItWorks.map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-base flex-shrink-0">
                  {item.icon}
                </div>
                <div>
                  <p className="text-xs font-black text-gray-900 dark:text-white">
                    {item.title}
                  </p>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {item.text}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 4. Demo mode CTA */}
      {showDemoCta && onEnableDemo && (
        <Card padding="p-4" className={`border border-blue-200 dark:border-blue-800 ${demoCtaCardClassName}`.trim()}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-gray-900 dark:text-white">
                🎮 Try Demo Mode
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Explore the full flow with sample data — no wallet needed
              </p>
            </div>
            <button
              onClick={onEnableDemo}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition-colors whitespace-nowrap"
            >
              Open Demo
            </button>
          </div>
        </Card>
      )}

      {/* 5. Additional tab-specific content */}
      {children}
    </div>
  );
}
