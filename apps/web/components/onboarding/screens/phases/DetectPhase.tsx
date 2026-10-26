/**
 * DetectPhase — onboarding phase 1: detect & confirm the visitor's country.
 *
 * JSX extracted verbatim from WelcomeScreen; state stays with the
 * orchestrator and arrives as props.
 *
 * Scroll rule: this phase renders inside the dialog's single scroll
 * container — never add overflow-y-auto or justify-center here.
 */

import { useEffect, useId, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion, LayoutGroup } from 'framer-motion';
import { NETWORKS } from '../../../../config';
import { useWalletContext } from '../../../wallet/WalletProvider';
import { showTestnetUi } from '../../../../constants/testnet';
import { ShimmerText } from '../../../shared/ShimmerText';
import { Coin } from '../../../shared/FloatingCoins';
import { phaseVariants, staggerChild } from './phase-config';
import { springPress, controlMotion } from "@/lib/motion-tokens";
import { haptics } from '@/lib/haptics';
import { MONEY_PURPOSES, type MoneyPurpose } from '@/constants/money-purpose';
import { CountryPickerSheet } from '../../../tabs/overview/CountryPicker';
import type { CountryOption } from '@/constants/country-options';

// The purpose picker's coin marks — abstract verbs, not currency glyphs.
const PURPOSE_GLYPH: Record<MoneyPurpose, string> = {
  everyday_buffer: '≈',
  long_term_savings: '↗',
  upcoming_payment: '⇄',
};
const PURPOSE_HEADING: Record<MoneyPurpose, string> = {
  everyday_buffer: 'A little breathing room.',
  long_term_savings: 'Your money. Your next chapter.',
  upcoming_payment: 'Your next payment. In perspective.',
};
const PURPOSE_CAPTION: Record<MoneyPurpose, string> = {
  everyday_buffer: 'Keep everyday needs within reach.',
  long_term_savings: 'Make room for the future you have in mind.',
  upcoming_payment: 'See the currency exposure behind your next invoice.',
};

interface DetectPhaseProps {
  riskLoading: boolean;
  riskData: { flag: string; countryName: string; code: string } | null;
  showCountryPicker: boolean;
  setShowCountryPicker: (open: boolean) => void;
  manualCountrySearch: string;
  setManualCountrySearch: (q: string) => void;
  filteredCountries: CountryOption[];
  setCountryOverride: (iso2: string) => void;
  /** The effective country — may differ from riskData when it has no
   *  researched currency history. */
  selectedCountry: CountryOption | null;
  onAdvance: () => void;
  moneyPurpose: MoneyPurpose | null;
  setMoneyPurpose: (purpose: MoneyPurpose) => void;
  /** Kept for callers; the modal's "Explore app" pill is the one exit now. */
  onSkip?: () => void;
  /** Phase travel direction (+1 forward, −1 back) — drives the phaseVariants
   *  custom transition. */
  direction?: number;
  /** Fires once when the phase mounts — WelcomeScreen moves focus to the
   *  phase heading and resets the screen's scroll. */
  onEntered?: () => void;
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
  selectedCountry,
  onAdvance,
  moneyPurpose,
  setMoneyPurpose,
  direction = 1,
  onEntered,
}: DetectPhaseProps) {
  useEffect(() => { onEntered?.(); }, [onEntered]);
  const { switchNetwork, isConnected } = useWalletContext();
  const reducedMotion = useReducedMotion();
  const purposeGroupId = useId();
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchDone, setSwitchDone] = useState(false);
  const [showTestDetails, setShowTestDetails] = useState(false);

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

  return (
    <motion.div
      key="phase-detect"
      custom={direction}
      variants={reducedMotion ? undefined : phaseVariants}
      initial={reducedMotion ? false : "initial"}
      animate="animate"
      exit="exit"
      className="journey-phase"
    >
      <motion.h2
        variants={staggerChild}
        data-phase-heading="detect"
        tabIndex={-1}
        className="journey-title text-white mb-3 focus:outline-none"
      >
        {PURPOSE_HEADING[moneyPurpose ?? 'long_term_savings']}
      </motion.h2>
      <motion.p variants={staggerChild} className="text-sm text-slate-300 mb-5">
        {moneyPurpose === 'upcoming_payment' ? 'Start with the currency you earn.' : 'Start with the currency you use.'}
      </motion.p>

      <motion.div variants={staggerChild} className="mb-4 text-left">
        <p id="money-purpose-label" className="text-xs font-semibold text-slate-200 mb-2">
          What is this money for?
        </p>
        <LayoutGroup id={purposeGroupId}>
        <div
          className="grid grid-cols-3 gap-2"
          role="radiogroup"
          aria-labelledby="money-purpose-label"
          onKeyDown={(event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const index = Math.max(0, MONEY_PURPOSES.findIndex((purpose) => purpose.value === moneyPurpose));
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? MONEY_PURPOSES.length - 1
              : (index + (event.key === 'ArrowRight' ? 1 : -1) + MONEY_PURPOSES.length) % MONEY_PURPOSES.length;
            if (MONEY_PURPOSES[next].value !== moneyPurpose) {
              haptics.tap();
              setMoneyPurpose(MONEY_PURPOSES[next].value);
            }
            event.currentTarget.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
          }}
        >
          {MONEY_PURPOSES.map((purpose) => {
            const selected = moneyPurpose === purpose.value;
            return (
              <motion.button
                key={purpose.value}
                type="button"
                role="radio"
                aria-checked={selected}
                tabIndex={selected || (!moneyPurpose && purpose === MONEY_PURPOSES[0]) ? 0 : -1}
                onClick={() => {
                  if (purpose.value === moneyPurpose) return;
                  haptics.tap();
                  setMoneyPurpose(purpose.value);
                }}
                {...controlMotion(Boolean(reducedMotion))}
                className="journey-purpose text-xs sm:text-sm font-semibold"
              >
                {/* One shared plate slides to the pick — the same selection
                    choreography the risk period control uses. */}
                {selected &&
                  (reducedMotion ? (
                    <span aria-hidden="true" className="absolute inset-0 -z-10 rounded-[inherit] bg-blue-700" />
                  ) : (
                    <motion.span
                      aria-hidden="true"
                      layoutId="purpose-selection"
                      transition={springPress}
                      className="absolute inset-0 -z-10 rounded-[inherit] bg-blue-700"
                    />
                  ))}
                <span aria-hidden="true">
                  <Coin
                    variant="asset"
                    size={30}
                    symbol={PURPOSE_GLYPH[purpose.value]}
                    color={selected ? '#bfdbfe' : '#f59e0b'}
                  />
                </span>
                {purpose.value === 'everyday_buffer' ? 'Buffer' : purpose.value === 'long_term_savings' ? 'Long term' : 'Supplier payment'}
              </motion.button>
            );
          })}
        </div>
        </LayoutGroup>
        <p aria-live="polite" className="journey-purpose-caption text-center">
          {PURPOSE_CAPTION[moneyPurpose ?? 'long_term_savings']}
        </p>
      </motion.div>

      {/* Detected country card — onboarding is intentionally a night
          vault: solid slate, light text, whatever the app theme says. */}
      <motion.div variants={staggerChild}>
        {riskLoading ? (
          <div className="bg-slate-900 border border-slate-600 rounded-2xl p-4 mb-4">
            <div className="h-5 bg-slate-700 rounded w-1/2 mx-auto mb-2" />
            <div className="h-4 bg-slate-800 rounded w-2/3 mx-auto" />
            <p role="status" className="mt-3 text-xs text-slate-400">
              Finding your currency…
            </p>
          </div>
        ) : selectedCountry ? (
          <div className="bg-slate-900 border border-slate-600 rounded-2xl p-4 mb-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 text-left">
                <span className="text-3xl" aria-hidden="true">{selectedCountry.flag}</span>
                <div className="min-w-0">
                  <p className="text-base font-black text-white leading-tight">{selectedCountry.countryName}</p>
                  {riskData ? (
                    <p className="text-xs text-slate-400">Currency: {riskData.code}</p>
                  ) : (
                    <p className="text-xs text-slate-400">Currency history isn&apos;t available here yet. You can still explore plans.</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowCountryPicker(!showCountryPicker)}
                className="min-h-tap px-2 shrink-0 text-xs text-blue-300 hover:text-blue-200 font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 rounded"
              >
                Change country
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-600 rounded-2xl p-4 mb-4">
            <p className="text-sm text-slate-300 mb-4">
              A clear view of your currency against dollars, euros and gold.
            </p>
            <motion.button
              type="button"
              onClick={() => setShowCountryPicker(true)}
              {...controlMotion(Boolean(reducedMotion))}
              className="journey-action w-full px-6 bg-blue-600 hover:bg-blue-700 text-white text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70"
            >
              Choose your country
              <span className="journey-action-arrow" aria-hidden="true">→</span>
            </motion.button>
          </div>
        )}
      </motion.div>

      {/* The shared picker sheet — full ISO directory, honest
          "history unavailable" rows, keyboard focus kept inside. */}
      <CountryPickerSheet
        isOpen={showCountryPicker}
        onClose={() => { setShowCountryPicker(false); setManualCountrySearch(''); }}
        onSelect={(iso2) => {
          haptics.tap();
          setCountryOverride(iso2);
          setShowCountryPicker(false);
          setManualCountrySearch('');
        }}
        options={filteredCountries}
        selectedIso2={selectedCountry?.iso2 ?? null}
        query={manualCountrySearch}
        onQueryChange={setManualCountrySearch}
        hasQuery={manualCountrySearch.trim().length > 0}
        tone="vault"
      />

      {selectedCountry && (
        <motion.button
          variants={staggerChild}
          onClick={onAdvance}
          className="journey-action w-full px-8 bg-blue-600 hover:bg-blue-700 text-white text-base shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-offset-2"
          {...controlMotion(Boolean(reducedMotion))}
        >
          <ShimmerText>
            {riskData
              ? moneyPurpose === 'upcoming_payment' ? 'Review a payment →' : 'Show me the numbers →'
              : 'Explore plans →'}
          </ShimmerText>
        </motion.button>
      )}

      {/* Developer / testnet options — env-gated; production users never see this */}
      {showTestnetUi() && (
      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800/60">
        <button
          onClick={() => setShowTestDetails(!showTestDetails)}
          className="text-2xs text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 transition-colors font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/40 rounded"
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
