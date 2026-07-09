import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { OnboardingScreenProps } from './types';
import { NETWORKS } from '../../../config';
import { useWalletContext } from '../../wallet/WalletProvider';
import { useCurrencyRisk } from '../../../hooks/use-currency-risk';
import { useStrategy } from '../../../context/app/StrategyContext';
import {
  ARCHETYPES,
  ARCHETYPE_ORDER,
  type ArchetypeId,
} from '../../protection-cards/tokens';
import type { FinancialStrategy } from '@diversifi/shared';
import {
  BENCHMARKS,
  HORIZONS,
  type Benchmark,
  type Horizon,
  CURRENCY_RISK_DATA,
} from '../../../constants/currency-risk';

import { GuardianMascot } from '../../shared/GuardianMascot';

interface WelcomeScreenProps extends OnboardingScreenProps {
    onContinue: () => void;
    chainId?: number;
    /** Called when the user finishes onboarding (connect, demo). */
    onComplete?: (region: string | null) => void;
}

// Map design-token ArchetypeId → app FinancialStrategy
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

export function WelcomeScreen({ onContinue, onSkip, onConnectWallet, isWalletConnected, chainId, onComplete }: WelcomeScreenProps) {
    const { switchNetwork, isConnected } = useWalletContext();
    const {
      riskData,
      isLoading: riskLoading,
      countryCode,
      countryName,
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

    // Determine the onboarding phase
    const phase: Phase = useMemo(() => {
      if (riskLoading && !countryCode) return 'detect';
      if (riskData || isBenchmarkCurrency) {
        if (selectedArchetype) return 'philosophy';
        // If benchmark currency (USD/EUR), skip risk and go to philosophy
        if (isBenchmarkCurrency) return 'philosophy';
        return 'risk';
      }
      return 'detect';
    }, [riskLoading, countryCode, riskData, isBenchmarkCurrency, selectedArchetype]);

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

    const handleArchetypeSelect = (id: ArchetypeId) => {
      setSelectedArchetype(id);
      setFinancialStrategy(STRATEGY_ID[id]);
    };

    const handleFinish = (region?: string | null) => {
      if (region) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('user-region', region);
        }
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
                <GuardianMascot
                  size={100}
                  mood={phase === 'philosophy' ? 'happy' : phase === 'risk' ? 'alert' : 'neutral'}
                />
            </motion.div>

            <AnimatePresence mode="wait">
              {/* ── Phase 1: Detect & confirm country/currency ─────────── */}
              {phase === 'detect' && (
                <motion.div
                  key="phase-detect"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="w-full max-w-sm"
                >
                  <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white mb-2 leading-tight">
                    Understand Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Currency Risk</span>
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                    Your local currency may be losing value. Let&apos;s check how much.
                  </p>

                  {/* Detected country card */}
                  {riskLoading ? (
                    <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-6 mb-4 animate-pulse">
                      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mx-auto mb-2" />
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mx-auto" />
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
                      onClick={onContinue}
                      className="w-full px-8 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-base font-black rounded-2xl shadow-lg active:scale-95 transition-all"
                      whileHover={{ y: -1 }}
                    >
                      Understand Your Risk →
                    </motion.button>
                  )}

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

              {/* ── Phase 2: Risk "aha" card — multi-benchmark depreciation ─ */}
              {phase === 'risk' && riskData && (
                <motion.div
                  key="phase-risk"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="w-full max-w-sm"
                >
                  <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white mb-2 leading-tight">
                    Here&apos;s the reality for <span className="text-blue-500">{riskData.flag} {riskData.code}</span>
                  </h2>

                  {/* Multi-benchmark depreciation card */}
                  <div className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-2 border-red-200 dark:border-red-800 rounded-2xl p-5 mb-4">
                    <p className="text-xs text-red-600 dark:text-red-400 font-bold mb-3">
                      {riskData.countryName}&apos;s {riskData.code} has lost value against:
                    </p>

                    {/* Benchmark rows */}
                    <div className="space-y-3">
                      {(['USD', 'EUR', 'XAU'] as Benchmark[]).map((bench) => {
                        const dep5yr = getDepreciation(bench, '5yr');
                        const dep3yr = getDepreciation(bench, '3yr');
                        const dep1yr = getDepreciation(bench, '1yr');
                        const b = BENCHMARKS[bench];
                        return (
                          <div key={bench} className="bg-white/60 dark:bg-gray-900/40 rounded-xl p-3 border border-red-100 dark:border-red-900/40">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-bold text-gray-900 dark:text-white">
                                {b.flag} {b.label}
                              </span>
                              <span className={`text-lg font-black ${Math.abs(dep5yr) >= 25 ? 'text-red-600 dark:text-red-400' : 'text-orange-500 dark:text-orange-400'}`}>
                                {dep5yr.toFixed(0)}%
                              </span>
                            </div>
                            <div className="flex gap-3 text-[10px] text-gray-500 dark:text-gray-400">
                              <span>1Y: {dep1yr.toFixed(0)}%</span>
                              <span>3Y: {dep3yr.toFixed(0)}%</span>
                              <span>5Y: {dep5yr.toFixed(0)}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Counterfactual */}
                    <div className="mt-4 pt-3 border-t border-red-200 dark:border-red-800">
                      <p className="text-xs text-red-500 dark:text-red-300">
                        If <strong>20%</strong> of $10,000 had been in a diversified protection basket 5 years ago,
                        you would have preserved{' '}
                        <strong className="text-base">
                          ${(
                            calculateCounterfactual(10000, 20, 'USD', '5yr') +
                            calculateCounterfactual(10000, 20, 'EUR', '5yr') +
                            calculateCounterfactual(10000, 20, 'XAU', '5yr')
                          ).toFixed(0)}
                        </strong>{' '}
                        in real value.
                      </p>
                    </div>
                  </div>

                  {/* Risk events */}
                  {riskEvents.length > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 mb-4">
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
                    </div>
                  )}

                  {/* Neutral framing */}
                  <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-2 border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 mb-5">
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mb-1">
                      Different communities respond differently
                    </p>
                    <p className="text-sm font-black text-emerald-900 dark:text-emerald-100">
                      Choose a protection philosophy that matches your values.
                    </p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                      No lock-ups. No subscriptions. Your values, your plan.
                    </p>
                  </div>

                  <motion.button
                    onClick={onContinue}
                    className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl active:scale-95 transition-all shadow-lg"
                    whileHover={{ y: -1 }}
                  >
                    Choose Your Approach →
                  </motion.button>

                  <button
                    onClick={() => { setCountryOverride(null); onContinue(); }}
                    className="w-full py-2 mt-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    ← Pick a different country
                  </button>
                </motion.div>
              )}

              {/* ── Phase 3: Philosophy selection ───────────────────────── */}
              {phase === 'philosophy' && (
                <motion.div
                  key="phase-philosophy"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="w-full max-w-md"
                >
                  <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white mb-2 leading-tight">
                    Choose Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">Protection Philosophy</span>
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                    Different communities have different relationships with money. Pick what resonates with you.
                  </p>

                  {/* Archetype grid */}
                  <div className="space-y-2 mb-5 max-h-[40vh] overflow-y-auto pr-1">
                    {ARCHETYPE_ORDER.map((id) => {
                      const a = ARCHETYPES[id];
                      const isActive = selectedArchetype === id;
                      return (
                        <button
                          key={id}
                          onClick={() => handleArchetypeSelect(id)}
                          className={`w-full p-3 rounded-2xl border-2 text-left transition-all flex items-start gap-3 ${
                            isActive
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-400'
                              : 'border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-600 bg-white dark:bg-gray-800'
                          }`}
                        >
                          {/* Accent dot */}
                          <div
                            className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-black"
                            style={{ background: a.accent }}
                          >
                            {a.name[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-gray-900 dark:text-white">{a.name}</span>
                              {isActive && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500 text-white font-bold tracking-wider">
                                  SELECTED
                                </span>
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
                                >
                                  {asset}
                                </span>
                              ))}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Actions */}
                  <div className="space-y-2">
                    {onConnectWallet && !isWalletConnected && (
                      <motion.button
                        onClick={async () => {
                          try { await onConnectWallet(); } catch { /* user rejected — fall through */ }
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
                        onClick={() => { setSelectedArchetype(null); onContinue(); }}
                        className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      >
                        ← Back to risk data
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
        </div>
    );
}
