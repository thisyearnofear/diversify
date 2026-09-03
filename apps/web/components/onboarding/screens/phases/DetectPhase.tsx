/**
 * DetectPhase — onboarding phase 1: detect & confirm the visitor's country.
 *
 * JSX extracted verbatim from WelcomeScreen; state stays with the
 * orchestrator and arrives as props.
 *
 * Scroll rule: this phase renders inside the dialog's single scroll
 * container — never add overflow-y-auto or justify-center here.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NETWORKS } from '../../../../config';
import { useWalletContext } from '../../../wallet/WalletProvider';
import { showTestnetUi, optIntoTestnetUi } from '../../../../constants/testnet';
import { ShimmerText } from '../../../shared/ShimmerText';
import { phaseVariants, staggerChild } from './phase-config';
import { BENCHMARKS, type Benchmark } from '../../../../constants/currency-risk';

interface DetectPhaseProps {
  riskLoading: boolean;
  riskData: { flag: string; countryName: string; code: string } | null;
  showCountryPicker: boolean;
  setShowCountryPicker: (open: boolean) => void;
  manualCountrySearch: string;
  setManualCountrySearch: (q: string) => void;
  filteredCountries: Array<{ iso2: string; flag: string; countryName: string; code: string }>;
  setCountryOverride: (iso2: string) => void;
  countryRequestCountry: string;
  setCountryRequestCountry: (v: string) => void;
  countryRequestStatus: 'idle' | 'submitting' | 'success' | 'error';
  setCountryRequestError: (v: string | null) => void;
  countryRequestError: string | null;
  handleCountryRequest: () => void;
  onAdvance: () => void;
  onSkip?: () => void;
}

export function DetectPhase({
  riskLoading,
  riskData,
  showCountryPicker,
  setShowCountryPicker,
  manualCountrySearch,
  setManualCountrySearch,
  filteredCountries,
  setCountryOverride,
  countryRequestCountry,
  setCountryRequestCountry,
  countryRequestStatus,
  setCountryRequestError,
  countryRequestError,
  handleCountryRequest,
  onAdvance,
  onSkip,
}: DetectPhaseProps) {
  const { switchNetwork, isConnected } = useWalletContext();
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchDone, setSwitchDone] = useState(false);
  const [showTestDetails, setShowTestDetails] = useState(false);

  const handleSwitchToTestnet = async () => {
    if (isSwitching) return;
    setIsSwitching(true);
    try {
      await switchNetwork(NETWORKS.ARC_TESTNET.chainId);
      optIntoTestnetUi();
      setSwitchDone(true);
    } catch { /* fall through */ } finally {
      setIsSwitching(false);
    }
  };

  return (
    <motion.div
      key="phase-detect"
      variants={phaseVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="w-full max-w-sm"
    >
      <motion.h2 variants={staggerChild} className="text-xl md:text-2xl font-black text-white mb-2 leading-tight">
        Is your money quietly{' '}
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-indigo-300">
          losing value?
        </span>
      </motion.h2>
      <motion.p variants={staggerChild} className="text-sm text-slate-300 mb-5">
        Find out in 30 seconds.
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
            <p className="text-xs text-blue-600 dark:text-blue-400 font-bold mb-2">Your country</p>
            <div className="text-4xl mb-2">{riskData.flag}</div>
            <p className="text-lg font-black text-gray-900 dark:text-white">{riskData.countryName}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Currency: {riskData.code}</p>
            <button
              onClick={() => setShowCountryPicker(!showCountryPicker)}
              className="mt-2 text-xs text-blue-500 hover:text-blue-600 font-bold"
            >
              Change country
            </button>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-2xl p-5 mb-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2.5">
              We&apos;ll measure your currency against the world&apos;s hardest benchmarks:
            </p>
            {/* Concrete preview of the free check — the actual draw */}
            <div className="flex items-center justify-center gap-1.5 mb-4">
              {(['USD', 'EUR', 'XAU'] as Benchmark[]).map((bench) => (
                <span
                  key={bench}
                  className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/70 dark:bg-gray-900/40 border border-blue-100 dark:border-blue-900/40 text-gray-700 dark:text-gray-200"
                >
                  <span>{BENCHMARKS[bench].flag}</span>
                  {BENCHMARKS[bench].label}
                </span>
              ))}
            </div>
            <button
              onClick={() => setShowCountryPicker(true)}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-black rounded-xl shadow-sm active:scale-[0.97] transition-[color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70"
            >
              Choose your country →
            </button>
          </div>
        )}
      </motion.div>

      {/* Country picker — an in-dialog sheet keeps discovery focused
          without turning the first phase into a long directory. */}
      <AnimatePresence>
        {showCountryPicker && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            role="dialog"
            aria-modal="true"
            aria-label="Choose your country"
            className="absolute inset-x-0 top-0 z-20 rounded-3xl border border-white/20 bg-slate-950/95 p-4 text-left shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-sm font-black text-white">Choose your country</p>
                <p className="text-xs text-slate-400 mt-0.5">We’ll use it to frame the comparison in your currency.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCountryPicker(false)}
                className="size-8 rounded-full bg-white/10 text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                aria-label="Close country picker"
              >
                ×
              </button>
            </div>
            <input
              type="text"
              placeholder="Search country or currency"
              value={manualCountrySearch}
              onChange={(e) => setManualCountrySearch(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Escape') setShowCountryPicker(false);
              }}
              className="w-full px-3 py-3 mb-3 text-sm rounded-xl border border-white/15 bg-white/10 text-white placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 outline-none"
            />
            <p className="text-[10px] uppercase tracking-widest font-black text-slate-500 mb-2">
              {manualCountrySearch ? 'Matches' : 'Suggested countries'}
            </p>
            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
              {filteredCountries.map((c) => (
                <button
                  key={c.iso2}
                  onClick={() => {
                    setCountryOverride(c.iso2);
                    setShowCountryPicker(false);
                    setManualCountrySearch('');
                  }}
                  className="min-h-11 flex items-center gap-2 p-2.5 rounded-xl border border-white/10 hover:border-blue-400/70 bg-white/5 hover:bg-blue-500/10 transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <span className="text-lg">{c.flag}</span>
                  <div>
                    <div className="text-xs font-bold text-white">{c.countryName}</div>
                    <div className="text-[10px] text-slate-400">{c.code}</div>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Request a country not listed — shown at the bottom of the
          picker so users who can't find their country can request
          it without leaving the dialog. */}
      {countryRequestStatus === 'success' ? (
        <p className="text-[10px] text-emerald-400 font-bold text-center py-2">
          ✓ Request sent — we'll add it soon.
        </p>
      ) : (
        <div className="mt-2 pt-2 border-t border-white/10">
          <p className="text-[10px] text-slate-400 text-center mb-1.5">
            Don't see your country?
          </p>
          <div className="flex items-center justify-center gap-2">
            <input
              type="text"
              maxLength={2}
              placeholder="UA"
              value={countryRequestCountry}
              onChange={(e) => {
                setCountryRequestCountry(e.target.value);
                setCountryRequestError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCountryRequest();
              }}
              className="w-12 px-2 py-1.5 text-[10px] font-bold text-center rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 outline-none uppercase"
            />
            <button
              type="button"
              onClick={handleCountryRequest}
              disabled={countryRequestStatus === 'submitting'}
              className="px-3 py-1.5 text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors rounded-lg border border-blue-400/20 hover:border-blue-400/40 disabled:opacity-50"
            >
              {countryRequestStatus === 'submitting' ? 'Sending…' : 'Request'}
            </button>
          </div>
          {countryRequestError && (
            <p className="text-[9px] text-rose-400 text-center mt-1">{countryRequestError}</p>
          )}
        </div>
      )}

      {riskData && (
        <motion.button
          variants={staggerChild}
          onClick={onAdvance}
          className="w-full px-8 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-base font-black rounded-2xl shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-offset-2"
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
        >
          <ShimmerText>Show me the numbers →</ShimmerText>
        </motion.button>
      )}

      {/* Friendly secondary path — for the curious, not a chore to skip */}
      {onSkip && (
        <motion.button
          variants={staggerChild}
          onClick={onSkip}
          className="w-full px-6 py-3 mt-3 text-xs font-bold text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/50 rounded-lg"
        >
          Just looking around? Explore the app →
        </motion.button>
      )}

      {/* Developer / testnet options — env-gated; production users never see this */}
      {showTestnetUi() && (
      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800/60">
        <button
          onClick={() => setShowTestDetails(!showTestDetails)}
          className="text-[11px] text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-colors font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/40 rounded"
        >
          {showTestDetails ? '− Hide developer options' : 'Developer options'}
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
                    Testnet faucets (no real money):
                </p>
                <div className="flex gap-2 mb-2">
                    <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer" className="text-xs text-violet-600 dark:text-violet-400 underline hover:no-underline">Arc faucet →</a>
                    <a href="https://faucet.celo.org" target="_blank" rel="noopener noreferrer" className="text-xs text-violet-600 dark:text-violet-400 underline hover:no-underline">Celo faucet →</a>
                </div>
                {isConnected ? (
                    <button
                        onClick={handleSwitchToTestnet}
                        disabled={isSwitching}
                        className={`w-full py-2 rounded-xl text-xs font-black transition-colors ${
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
      )}
    </motion.div>
  );
}
