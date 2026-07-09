import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { OnboardingScreenProps } from './types';
import { NETWORKS } from '../../../config';
import { useWalletContext } from '../../wallet/WalletProvider';
import { useCurrencyRisk } from '../../../hooks/use-currency-risk';
import { useStrategy } from '../../../context/app/StrategyContext';
import { useTilt } from '../../../hooks/use-tilt';
import { AnimatedNumber } from '../../shared/AnimatedNumber';
import { ShimmerText } from '../../shared/ShimmerText';
import {
  ARCHETYPES,
  ARCHETYPE_ORDER,
  type ArchetypeId,
} from '../../protection-cards/tokens';
import type { FinancialStrategy } from '@diversifi/shared';
import {
  BENCHMARKS,
  type Benchmark,
  CURRENCY_RISK_DATA,
} from '../../../constants/currency-risk';

import { GuardianMascot } from '../../shared/GuardianMascot';

// ── Animation variants ─────────────────────────────────────────────────
// Blur-swap phase transition (transitions.dev "text states swap" pattern)
// Uses filter: blur instead of y-offset for a more cinematic feel.

const phaseVariants: Variants = {
  initial: {
    opacity: 0,
    filter: 'blur(12px)',
    scale: 0.98,
  },
  animate: {
    opacity: 1,
    filter: 'blur(0px)',
    scale: 1,
    transition: {
      duration: 0.35,
      ease: [0.16, 1, 0.3, 1],
      staggerChildren: 0.06,
    },
  },
  exit: {
    opacity: 0,
    filter: 'blur(12px)',
    scale: 1.02,
    transition: {
      duration: 0.2,
      ease: [0.4, 0, 1, 1],
    },
  },
};

const staggerChild: Variants = {
  initial: { opacity: 0, y: 10, filter: 'blur(4px)' },
  animate: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
  },
};

interface WelcomeScreenProps extends OnboardingScreenProps {
    onContinue?: () => void;
    chainId?: number;
    onComplete?: (region: string | null) => void;
}

const STRATEGY_ID: Record<ArchetypeId, FinancialStrategy> = {
  africapitalism: 'africapitalism',
  buen_vivir: 'buen_vivir',
  pan_caribbean: 'pan_caribbean',
  confucian: 'confucian',
  gotong_royong: 'gotong_royong',
  islamic_finance: 'islamic',
  global_diversification: 'global',
  custom: 'custom',
};

type Phase = 'detect' | 'risk' | 'philosophy';

// ── Archetype card with 3D tilt ────────────────────────────────────────
function ArchetypeCard({
  id,
  isActive,
  onSelect,
  index,
}: {
  id: ArchetypeId;
  isActive: boolean;
  onSelect: (id: ArchetypeId) => void;
  index: number;
}) {
  const a = ARCHETYPES[id];
  const tilt = useTilt(3);

  return (
    <motion.div variants={staggerChild}>
      <button
        onClick={() => onSelect(id)}
        onMouseMove={tilt.onMouseMove}
        onMouseLeave={tilt.onMouseLeave}
        className={`w-full p-3 rounded-2xl border-2 text-left flex items-start gap-3 overflow-hidden ${
          isActive
            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-400'
            : 'border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-600 bg-white dark:bg-gray-800'
        }`}
        style={{
          ...tilt.style,
          transformStyle: 'preserve-3d',
          ...(isActive ? {
            boxShadow: `0 0 0 4px ${a.accent}20, 0 8px 24px -8px ${a.accent}40`,
          } : {}),
        }}
      >
        {/* Accent dot — uses the archetype's accent color */}
        <div
          className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-black transition-transform"
          style={{
            background: a.accent,
            transform: isActive ? 'scale(1.15)' : 'scale(1)',
          }}
        >
          {a.name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-gray-900 dark:text-white">{a.name}</span>
            {isActive && (
              <motion.span
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500 text-white font-bold tracking-wider"
              >
                SELECTED
              </motion.span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
            {a.philosophy}
          </p>
          <div className="flex flex-wrap gap-1 mt-1">
            {a.allocation.slice(0, 4).map((asset, i) => (
              <span
                key={i}
                className="text-[9px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-medium"
                style={isActive ? {
                  background: `${a.accent}15`,
                  color: a.accent,
                } : undefined}
              >
                {asset}
              </span>
            ))}
          </div>
        </div>
        {/* Accent glow line on active */}
        {isActive && (
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-0 left-0 right-0 h-1"
            style={{ background: `linear-gradient(90deg, ${a.accent}, ${a.accentSoft}, ${a.accent})` }}
          />
        )}
      </button>
    </motion.div>
  );
}

export function WelcomeScreen({ onSkip, onConnectWallet, isWalletConnected, chainId, onComplete }: WelcomeScreenProps) {
    const { switchNetwork, isConnected } = useWalletContext();
    const {
      riskData,
      isLoading: riskLoading,
      countryCode,
      currencyCode,
      setCountryOverride,
      getDepreciation,
      calculateCounterfactual,
      riskEvents,
      isBenchmarkCurrency,
    } = useCurrencyRisk();
    const { setFinancialStrategy } = useStrategy();

    const [isSwitching, setIsSwitching] = useState(false);
    const [switchDone, setSwitchDone] = useState(false);
    const [showTestDetails, setShowTestDetails] = useState(false);
    const [selectedArchetype, setSelectedArchetype] = useState<ArchetypeId | null>(null);
    const [manualCountrySearch, setManualCountrySearch] = useState('');
    const [showCountryPicker, setShowCountryPicker] = useState(false);

    // Local step state — the user controls phase transitions via button taps.
    // Auto-advances from 'detect' to 'risk' once riskData loads.
    const [step, setStep] = useState<Phase>('detect');

    // Auto-advance from detect → risk when risk data becomes available
    useEffect(() => {
      if (riskData && step === 'detect') {
        setStep('risk');
      }
    }, [riskData, step]);

    // Phase is now driven by the user's step, not derived from data state.
    // This ensures forward/back buttons actually change the screen.
    const phase: Phase = step;

    const handleSwitchToTestnet = async () => {
        if (isSwitching) return;
        setIsSwitching(true);
        try {
            await switchNetwork(NETWORKS.ARC_TESTNET.chainId);
            setSwitchDone(true);
        } catch { /* fall through */ } finally {
            setIsSwitching(false);
        }
    };

    const handleArchetypeSelect = (id: ArchetypeId) => {
      setSelectedArchetype(id);
      setFinancialStrategy(STRATEGY_ID[id]);
    };

    const handleFinish = (region?: string | null) => {
      if (region && typeof window !== 'undefined') {
        localStorage.setItem('user-region', region);
      }
      onComplete?.(countryCode ?? region ?? null);
    };

    const filteredCountries = useMemo(() => {
      if (!manualCountrySearch) return CURRENCY_RISK_DATA.slice(0, 12);
      const q = manualCountrySearch.toLowerCase();
      return CURRENCY_RISK_DATA.filter(
        (c) =>
          c.countryName.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q) ||
          c.iso2.toLowerCase().includes(q),
      );
    }, [manualCountrySearch]);

    // Precompute counterfactual for the risk card
    const xauPreserved = riskData
      ? calculateCounterfactual(10000, 20, 'XAU', '5yr')
      : 0;

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-10 text-center relative overflow-y-auto custom-scrollbar">
            {/* Mesh Gradient Background */}
            <div className="absolute inset-0 -z-10 opacity-30">
                <div className="absolute top-0 -left-1/4 w-full h-full bg-blue-400 dark:bg-blue-600 rounded-full blur-[120px] mix-blend-multiply" />
                <div className="absolute -bottom-1/4 -right-1/4 w-full h-full bg-purple-400 dark:bg-purple-600 rounded-full blur-[120px] mix-blend-multiply" />
            </div>

            {/* Brand and Mascot */}
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
                <GuardianMascot
                  size={100}
                  mood={phase === 'philosophy' ? 'happy' : phase === 'risk' ? 'alert' : 'neutral'}
                />
            </motion.div>

            <AnimatePresence mode="wait">
              {/* ── Phase 1: Detect & confirm ───────────────────────────── */}
              {phase === 'detect' && (
                <motion.div
                  key="phase-detect"
                  variants={phaseVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="w-full max-w-sm"
                >
                  <motion.h2 variants={staggerChild} className="text-xl md:text-2xl font-black text-gray-900 dark:text-white mb-2 leading-tight">
                    Understand Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Currency Risk</span>
                  </motion.h2>
                  <motion.p variants={staggerChild} className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                    Your local currency may be losing value. Let&apos;s check how much.
                  </motion.p>

                  {/* Detected country card */}
                  <motion.div variants={staggerChild}>
                    {riskLoading ? (
                      <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-6 mb-4 overflow-hidden">
                        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mx-auto mb-2"
                          style={{ animation: 'pulse 1.5s ease-in-out infinite' }} />
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mx-auto"
                          style={{ animation: 'pulse 1.5s ease-in-out 0.2s infinite' }} />
                      </div>
                    ) : riskData ? (
                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-2xl p-5 mb-4">
                        <p className="text-xs text-blue-600 dark:text-blue-400 font-bold mb-2">Detected</p>
                        <div className="text-4xl mb-2">{riskData.flag}</div>
                        <p className="text-lg font-black text-gray-900 dark:text-white">{riskData.countryName}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{riskData.code} — {currencyCode}</p>
                        <button
                          onClick={() => setShowCountryPicker(!showCountryPicker)}
                          className="mt-2 text-xs text-blue-500 hover:text-blue-600 font-medium"
                        >
                          Not your country? Pick another
                        </button>
                      </div>
                    ) : (
                      <div className="bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-5 mb-4">
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                          We couldn&apos;t detect your country automatically.
                        </p>
                        <button
                          onClick={() => setShowCountryPicker(true)}
                          className="text-sm text-blue-500 hover:text-blue-600 font-bold"
                        >
                          Select your country →
                        </button>
                      </div>
                    )}
                  </motion.div>

                  {/* Country picker */}
                  <AnimatePresence>
                    {showCountryPicker && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden mb-4"
                      >
                        <input
                          type="text"
                          placeholder="Search countries..."
                          value={manualCountrySearch}
                          onChange={(e) => setManualCountrySearch(e.target.value)}
                          className="w-full px-3 py-2 mb-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-blue-400 outline-none"
                        />
                        <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                          {filteredCountries.map((c) => (
                            <button
                              key={c.iso2}
                              onClick={() => {
                                setCountryOverride(c.iso2);
                                setShowCountryPicker(false);
                              }}
                              className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 bg-white dark:bg-gray-800 transition-all text-left"
                            >
                              <span className="text-lg">{c.flag}</span>
                              <div>
                                <div className="text-xs font-bold text-gray-900 dark:text-white">{c.countryName}</div>
                                <div className="text-[10px] text-gray-500">{c.code}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {riskData && (
                    <motion.button
                      variants={staggerChild}
                      onClick={() => setStep('risk')}
                      className="w-full px-8 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-base font-black rounded-2xl shadow-lg active:scale-95 transition-all"
                      whileHover={{ y: -1 }}
                    >
                      <ShimmerText>Understand Your Risk →</ShimmerText>
                    </motion.button>
                  )}

                  {/* Test funds toggle */}
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
                    <motion.button
                      variants={staggerChild}
                      onClick={onSkip}
                      className="w-full px-6 py-3 mt-2 text-xs font-bold text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                      Skip to App
                    </motion.button>
                  )}
                </motion.div>
              )}

              {/* ── Phase 2: Risk "aha" card ─────────────────────────────── */}
              {phase === 'risk' && riskData && (
                <motion.div
                  key="phase-risk"
                  variants={phaseVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="w-full max-w-sm"
                >
                  <motion.h2 variants={staggerChild} className="text-xl md:text-2xl font-black text-gray-900 dark:text-white mb-2 leading-tight">
                    Here&apos;s the reality for <span className="text-blue-500">{riskData.flag} {riskData.code}</span>
                  </motion.h2>

                  {/* Multi-benchmark depreciation card */}
                  <motion.div variants={staggerChild} className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-2 border-red-200 dark:border-red-800 rounded-2xl p-5 mb-4">
                    <p className="text-xs text-red-600 dark:text-red-400 font-bold mb-3">
                      {isBenchmarkCurrency
                        ? `${riskData.countryName}'s ${riskData.code} may be strong, but it still loses value against hard assets:`
                        : `${riskData.countryName}'s ${riskData.code} has lost value against:`}
                    </p>

                    {/* Benchmark rows with animated count-up */}
                    <div className="space-y-3">
                      {(['USD', 'EUR', 'XAU'] as Benchmark[]).map((bench, i) => {
                        const dep5yr = getDepreciation(bench, '5yr');
                        const dep3yr = getDepreciation(bench, '3yr');
                        const dep1yr = getDepreciation(bench, '1yr');
                        const b = BENCHMARKS[bench];
                        if (dep5yr === 0 && dep3yr === 0 && dep1yr === 0) return null;
                        return (
                          <motion.div
                            key={bench}
                            variants={staggerChild}
                            className="bg-white/60 dark:bg-gray-900/40 rounded-xl p-3 border border-red-100 dark:border-red-900/40"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-bold text-gray-900 dark:text-white">
                                {b.flag} {b.label}
                              </span>
                              <AnimatedNumber
                                value={dep5yr}
                                decimals={0}
                                suffix="%"
                                duration={1.4}
                                delay={i * 150}
                                className={`text-lg font-black ${Math.abs(dep5yr) >= 25 ? 'text-red-600 dark:text-red-400' : 'text-orange-500 dark:text-orange-400'}`}
                              />
                            </div>
                            <div className="flex gap-3 text-[10px] text-gray-500 dark:text-gray-400">
                              <span>1Y: {dep1yr.toFixed(0)}%</span>
                              <span>3Y: {dep3yr.toFixed(0)}%</span>
                              <span>5Y: {dep5yr.toFixed(0)}%</span>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>

                    {/* Counterfactual with animated count-up */}
                    <motion.div variants={staggerChild} className="mt-4 pt-3 border-t border-red-200 dark:border-red-800">
                      <p className="text-xs text-red-500 dark:text-red-300">
                        If <strong>20%</strong> of $10,000 had been in gold-backed assets 5 years ago,
                        you would have preserved{' '}
                        <AnimatedNumber
                          value={xauPreserved}
                          decimals={0}
                          prefix="$"
                          duration={1.8}
                          delay={600}
                          className="text-base font-black text-red-600 dark:text-red-400"
                        />{' '}
                        in real value.
                      </p>
                      <p className="text-[10px] text-red-400 dark:text-red-500 mt-1">
                        That&apos;s ~${(xauPreserved / (365 * 5)).toFixed(1)}/day — gone. Every day you wait.
                      </p>
                    </motion.div>
                  </motion.div>

                  {/* Risk events */}
                  {riskEvents.length > 0 && (
                    <motion.div variants={staggerChild} className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 mb-4">
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-bold mb-2">Risk Events</p>
                      {riskEvents.slice(0, 2).map((ev, i) => (
                        <div key={i} className="text-left mb-2 last:mb-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-amber-500 dark:text-amber-400">{ev.year}</span>
                            <span className="text-xs font-bold text-gray-900 dark:text-white">{ev.event}</span>
                          </div>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 ml-12">{ev.impact}</p>
                        </div>
                      ))}
                    </motion.div>
                  )}

                  {/* Neutral framing */}
                  <motion.div variants={staggerChild} className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-2 border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 mb-5">
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mb-1">
                      Different communities respond differently
                    </p>
                    <p className="text-sm font-black text-emerald-900 dark:text-emerald-100">
                      Choose a protection philosophy that matches your values.
                    </p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                      No lock-ups. No subscriptions. Your values, your plan.
                    </p>
                  </motion.div>

                  <motion.button
                    variants={staggerChild}
                    onClick={() => setStep('philosophy')}
                    className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl active:scale-95 transition-all shadow-lg"
                    whileHover={{ y: -1 }}
                  >
                    <ShimmerText>Choose Your Approach →</ShimmerText>
                  </motion.button>

                  <motion.button
                    variants={staggerChild}
                    onClick={() => { setCountryOverride(null); setStep('detect'); }}
                    className="w-full py-2 mt-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    ← Pick a different country
                  </motion.button>
                </motion.div>
              )}

              {/* ── Phase 3: Philosophy selection ───────────────────────── */}
              {phase === 'philosophy' && (
                <motion.div
                  key="phase-philosophy"
                  variants={phaseVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="w-full max-w-md"
                >
                  <motion.h2 variants={staggerChild} className="text-xl md:text-2xl font-black text-gray-900 dark:text-white mb-2 leading-tight">
                    Choose Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">Protection Philosophy</span>
                  </motion.h2>
                  <motion.p variants={staggerChild} className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                    Different communities have different relationships with money. Pick what resonates with you.
                  </motion.p>

                  {/* Archetype grid with staggered reveal + 3D tilt */}
                  <motion.div
                    variants={{
                      animate: { transition: { staggerChildren: 0.05 } },
                    }}
                    className="space-y-2 mb-5 max-h-[40vh] overflow-y-auto pr-1"
                  >
                    {ARCHETYPE_ORDER.map((id, i) => (
                      <ArchetypeCard
                        key={id}
                        id={id}
                        isActive={selectedArchetype === id}
                        onSelect={handleArchetypeSelect}
                        index={i}
                      />
                    ))}
                  </motion.div>

                  {/* Actions */}
                  <motion.div variants={staggerChild} className="space-y-2">
                    {onConnectWallet && !isWalletConnected && (
                      <motion.button
                        onClick={async () => {
                          try { await onConnectWallet(); } catch { /* fall through */ }
                          handleFinish(countryCode);
                        }}
                        className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl active:scale-95 transition-all shadow-lg"
                        whileHover={{ y: -1 }}
                      >
                        {selectedArchetype
                          ? `Start with ${ARCHETYPES[selectedArchetype].name} →`
                          : 'Connect Wallet to Get Started'}
                      </motion.button>
                    )}
                    <button
                      onClick={() => handleFinish(countryCode)}
                      className="w-full px-6 py-3 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white font-bold rounded-2xl active:scale-95 transition-all"
                    >
                      Explore Demo First
                    </button>
                    {!isBenchmarkCurrency && riskData && (
                      <button
                        onClick={() => { setSelectedArchetype(null); setStep('risk'); }}
                        className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      >
                        ← Back to risk data
                      </button>
                    )}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
        </div>
    );
}
