/**
 * WelcomeScreen — the onboarding orchestrator.
 *
 * Owns the shared state (currency risk, philosophy selection, waitlist,
 * money purpose) and renders the phase for the current step. The phase
 * JSX lives in `phases/` (DetectPhase / RiskPhase / PhilosophyPhase);
 * shared variants, copy, and types live in `phases/phase-config`.
 *
 * Scroll rule: the parent dialog (StrategyModal) is the single scroll
 * container. Never add overflow-y-auto or justify-center here — the
 * my-auto wrapper below centers short content and top-aligns tall content.
 */

import { readMomentHorizon, writeMomentBenchmark, writeMomentHorizon } from '@/constants/moment-horizon';
import { useCallback, useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { OnboardingScreenProps } from './types';
import { useCurrencyRisk } from '../../../hooks/use-currency-risk';
import { regionForCountry } from '../../../hooks/use-user-region';
import { trackFunnelEvent } from '../../../lib/analytics';
import { useDemoMode } from '../../../context/app/DemoModeContext';
import {
  ARCHETYPES,
  type ArchetypeId,
} from '../../protection-cards/tokens';
import {
  CURRENCY_RISK_DATA,
  exampleSavingsFor,
  type Benchmark,
} from '../../../constants/currency-risk';
import { useProtectionProfile } from '../../../hooks/use-protection-profile';
import type { MoneyPurpose } from '../../../constants/money-purpose';
import type { FinancialStrategy } from '@diversifi/shared/src/types/strategy';

import { GuardianMascot } from '../../shared/GuardianMascot';
import { FloatingCoins } from '../../shared/FloatingCoins';
import {
  COMBINE_PANEL_DELAY,
  combineOriginX,
  useLensCoinMetrics,
} from '../LensCoinSelector';
import type { TargetAndTransition, Transition } from 'framer-motion';
import { getPlanPreview, type PlanPreview } from '../../protection-cards/plan-preview';

import {
  STRATEGY_ID,
  VALUES_LENSES,
  PHASE_WASH,
  type Phase,
  type Horizon,
  type ValuesLens,
} from './phases/phase-config';
import { CoinSteps } from './phases/CoinSteps';
import { DetectPhase } from './phases/DetectPhase';
import { RiskPhase } from './phases/RiskPhase';
import { PhilosophyPhase } from './phases/PhilosophyPhase';
import { springSoft } from "@/lib/motion-tokens";
import { haptics } from "@/lib/haptics";
import { seedPaymentCycleDraft } from '@/hooks/use-payment-cycle';

export interface OnboardingSelection {
    philosophy?: FinancialStrategy;
    moneyPurpose?: MoneyPurpose;
}

interface WelcomeScreenProps extends OnboardingScreenProps {
    onContinue?: () => void;
    chainId?: number;
    onComplete?: (region: string | null, selection?: OnboardingSelection) => void;
}

export function WelcomeScreen({ onSkip, onComplete }: WelcomeScreenProps) {
    const {
      riskData,
      isLoading: riskLoading,
      countryCode,
      setCountryOverride,
      getDepreciation,
      calculateCounterfactual,
      riskEvents,
      getPlanPreview: getPlanPreviewFor,
      dataAsOf,
      isLive1yr,
      liveSeries,
    } = useCurrencyRisk();
    const { config: profileConfig } = useProtectionProfile();
    const { enableDemoMode, setDemoStrategy } = useDemoMode();
    const reduceMotion = useReducedMotion();

    const [selectedArchetype, setSelectedArchetype] = useState<ArchetypeId | null>(null);
    const [selectedLens, setSelectedLens] = useState<ValuesLens | null>(null);
    const [showAllApproaches, setShowAllApproaches] = useState(false);
    // One consistent selection choreography; the financial draft stays local.
    const lensVariant = 0;
    // Bump when returning to the coin row so the coins burst back out of
    // the point the previous pick collapsed into.
    const [emergeKey, setEmergeKey] = useState(0);
    const [manualCountrySearch, setManualCountrySearch] = useState('');
    const [showCountryPicker, setShowCountryPicker] = useState(false);
    const [selectedHorizon, setSelectedHorizonState] = useState<Horizon>(() => readMomentHorizon() ?? '5yr');
    // Home continues the story the visitor read here (constants/moment-horizon).
    const setSelectedHorizon = useCallback((h: Horizon) => {
        setSelectedHorizonState(h);
    }, []);
    useEffect(() => { writeMomentHorizon(selectedHorizon); }, [selectedHorizon]);
    const [showBusinessContextOpen, setShowBusinessContextOpen] = useState(false);
    const [openEventKey, setOpenEventKey] = useState<string | null>(null);
    const [waitlistEmail, setWaitlistEmail] = useState('');
    const [waitlistStatus, setWaitlistStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
    const [waitlistError, setWaitlistError] = useState<string | null>(null);
    const [moneyPurpose, setMoneyPurpose] = useState<MoneyPurpose | null>('long_term_savings');
    const [countryRequestCountry, setCountryRequestCountry] = useState('');
    const [countryRequestStatus, setCountryRequestStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
    const [countryRequestError, setCountryRequestError] = useState<string | null>(null);

    // Local step state — user taps to advance (no auto-advance on detect).
    const [step, setStep] = useState<Phase>('detect');

    const phase: Phase = step;

    // Cold-start funnel: one event per phase view so we learn where
    // legitimacy-check visitors drop off. Anonymous + fire-and-forget.
    useEffect(() => {
      const event = phase === 'detect' ? 'onboarding_viewed' : phase === 'risk' ? 'risk_moment_viewed' : null;
      if (event) trackFunnelEvent(event, countryCode ? { country: countryCode } : undefined);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase]);

    const handleArchetypeSelect = (id: ArchetypeId) => {
      setSelectedArchetype(id);
    };

    const handleJoinWaitlist = async () => {
      if (waitlistStatus === 'submitting' || waitlistStatus === 'success') return;
      setWaitlistStatus('submitting');
      setWaitlistError(null);
      try {
        const res = await fetch('/api/waitlist/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: waitlistEmail,
            feature: 'sme_fx',
            source: 'onboarding_business_hint',
            userRegion: countryCode ? regionForCountry(countryCode) ?? undefined : undefined,
            consentAcknowledged: true,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setWaitlistError(data.error || "Couldn't join the waitlist — please try again.");
          setWaitlistStatus('error');
          return;
        }
        setWaitlistStatus('success');
        setWaitlistEmail('');
        trackFunnelEvent('waitlist_joined', {
          feature: 'sme_fx',
          ...(countryCode ? { country: countryCode } : {}),
        });
      } catch {
        setWaitlistError("Couldn't join the waitlist — please try again.");
        setWaitlistStatus('error');
      }
    };

    const handleFinish = (selection?: OnboardingSelection) => {
      const region = countryCode ? regionForCountry(countryCode) ?? null : null;
      onComplete?.(region, selection);
    };

    const handleUsePlan = () => {
      if (!selectedArchetype || !planPreview) return;
      haptics.confirm();
      trackFunnelEvent('philosophy_chosen', {
        philosophy: selectedArchetype,
        ...(countryCode ? { country: countryCode } : {}),
      });
      handleFinish({
        philosophy: STRATEGY_ID[selectedArchetype],
        ...(moneyPurpose ? { moneyPurpose } : {}),
      });
    };

    const handleExploreDemo = () => {
      setDemoStrategy(selectedArchetype && planPreview ? STRATEGY_ID[selectedArchetype] : null);
      enableDemoMode();
      handleFinish();
    };

    const handleCountryRequest = async () => {
      if (countryRequestStatus === 'submitting' || countryRequestStatus === 'success') return;
      const code = countryRequestCountry.trim().toUpperCase();
      if (!code || code.length !== 2) {
        setCountryRequestError('Enter a 2-letter country code (e.g. UA).');
        return;
      }
      setCountryRequestStatus('submitting');
      setCountryRequestError(null);
      try {
        const res = await fetch('/api/country-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ country: code, source: 'onboarding' }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.success === false) {
          setCountryRequestError(data.error || "Couldn't send the request — try again.");
          setCountryRequestStatus('error');
          return;
        }
        setCountryRequestStatus('success');
        setCountryRequestCountry('');
        trackFunnelEvent('country_request_requested', {
          country: code,
          ...(countryCode ? { detected_country: countryCode } : {}),
        });
      } catch {
        setCountryRequestError("Couldn't send the request — try again.");
        setCountryRequestStatus('error');
      }
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

    // Precompute counterfactual for the risk card, denominated in the
    // visitor's own currency so no mental FX is required.
    const localExample = riskData ? exampleSavingsFor(riskData.code) : 10000;
    const localPrefix = riskData && riskData.code !== 'USD' ? `${riskData.code} ` : '$';

    // Hero + comparison bars — the benchmark with the largest |depreciation|
    // at the selected horizon becomes the single focal number; the rest
    // render as bars scaled to the hero's magnitude, so bar length alone
    // tells the comparison story.
    const benchmarkRows = riskData
      ? (['USD', 'EUR', 'XAU'] as Benchmark[]).map((bench) => ({
          bench,
          value: getDepreciation(bench, selectedHorizon),
        })).filter((row) => row.value !== 0)
      : [];
    const heroRow = benchmarkRows.reduce(
      (worst, row) => (!worst || Math.abs(row.value) > Math.abs(worst.value) ? row : worst),
      null as { bench: Benchmark; value: number } | null,
    );
    const otherRows = heroRow ? benchmarkRows.filter((row) => row.bench !== heroRow.bench) : [];
    const maxAbs = heroRow ? Math.abs(heroRow.value) : 1;

    // Counterfactual, horizon-aware and in the visitor's own money.
    const xauPreserved = riskData
      ? calculateCounterfactual(localExample, 20, 'XAU', selectedHorizon)
      : 0;

    // The lens currently open in the phase-3 stage (null in the coin view).
    const activeLens = selectedLens
      ? VALUES_LENSES.find((lens) => lens.id === selectedLens) ?? null
      : null;
    const activeLensIndex = activeLens
      ? VALUES_LENSES.findIndex((lens) => lens.id === activeLens.id)
      : -1;
    // The point on the stage the detail blooms out of: the chosen coin's
    // own slot centre. Pitch comes from the same metrics hook the row
    // uses, so the bloom can never drift from the rendered spacing.
    const { pitch: lensPitch } = useLensCoinMetrics();
    const bloomOrigin = combineOriginX(
      activeLensIndex >= 0 ? activeLensIndex : (VALUES_LENSES.length - 1) / 2,
      VALUES_LENSES.length,
      lensPitch,
    );
    const panelDelay = COMBINE_PANEL_DELAY[lensVariant % COMBINE_PANEL_DELAY.length];

    // Tap a coin → open its detail from the same point every time.
    const handleLensSelect = (id: ValuesLens) => {
      setSelectedArchetype(null);
      setShowAllApproaches(false);
      setSelectedLens(id);
    };

    // Back to the row → the coins burst back out of the chosen point.
    const handleBackToCoins = () => {
      setSelectedLens(null);
      setSelectedArchetype(null);
      setShowAllApproaches(false);
      setEmergeKey((k) => k + 1);
    };

    // Plan preview — only when the selected archetype actually belongs
    // to the lens panel currently open (or the "all approaches" view),
    // so browsing another lens never shows a stale pick's plan.
    const planPreview: PlanPreview | null =
      selectedArchetype &&
      activeLens &&
      (showAllApproaches || activeLens.archetypes.includes(selectedArchetype))
        ? getPlanPreviewFor(selectedArchetype, localExample, 20, profileConfig.riskTolerance)
        : null;

    // The panel opens from the chosen coin; reduced motion is instant.
    const panelEntrance: {
      initial: TargetAndTransition;
      animate: TargetAndTransition;
      transition: Transition;
    } = reduceMotion
      ? { initial: { opacity: 1 }, animate: { opacity: 1 }, transition: { duration: 0 } }
      : {
          initial: { opacity: 1, clipPath: `circle(0px at ${bloomOrigin} 50%)` },
          animate: { opacity: 1, clipPath: `circle(560px at ${bloomOrigin} 50%)` },
          transition: { duration: 0.55, delay: panelDelay, ease: [0.16, 1, 0.3, 1] },
        };

    // The panel reveal owns the motion budget; its children stay still.
    const panelChildMotion = (_i: number): {
      initial: TargetAndTransition | false;
      animate: TargetAndTransition;
      transition: Transition;
    } => {
      return { initial: false, animate: { opacity: 1 }, transition: { duration: 0 } };
    };

    return (
        // Scrolling lives on the parent dialog (single scroll container).
        // justify-center is gone — with it, overflowing content extended above
        // the scrollable area and could never be reached. The my-auto wrapper
        // below centers short content and top-aligns tall content instead.
        <div className="flex-1 flex flex-col items-center p-6 md:p-10 text-center relative">
            {/* Ambient backdrop — phase-tinted wash + drifting coin motifs */}
            <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden="true">
                <AnimatePresence>
                    <motion.div
                        key={`wash-${phase}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.7, ease: 'easeOut' }}
                        className="absolute inset-0"
                        style={{ background: PHASE_WASH[phase] }}
                    />
                </AnimatePresence>
                <FloatingCoins
                    variant="panel"
                    accent={selectedArchetype ? ARCHETYPES[selectedArchetype].accent : null}
                />
            </div>

            <div className="my-auto w-full flex flex-col items-center">

            {/* Brand lockup — the Guardian and promise read as one identity, not
                as separate decorations above the task. */}
            <motion.div
                className="mb-5 relative mt-4 md:mt-2"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={springSoft}
            >
                {phase === 'detect' ? (
                  <div className="flex items-center justify-center gap-3 text-left">
                    <GuardianMascot
                      size={72}
                      mood={selectedArchetype ? 'happy' : 'neutral'}
                      gaze="pointer"
                      className="shrink-0"
                    />
                    <div className="max-w-[210px]">
                      <div className="flex items-center gap-1.5 mb-1">
                          <div className="w-5 h-5 bg-blue-600 rounded-md flex items-center justify-center shadow-sm">
                              <span className="text-white text-xs font-black">D</span>
                          </div>
                          <span className="text-xs font-black text-white uppercase tracking-widest">DiversiFi</span>
                      </div>
                      <p className="text-xs font-semibold text-slate-300 leading-snug">
                        Understand your currency. Choose your next move.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 mb-2">
                      <GuardianMascot
                        size={40}
                        mood={phase === 'risk' ? 'alert' : selectedArchetype ? 'happy' : 'thinking'}
                      />
                      <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center shadow-sm">
                              <span className="text-white text-sm font-black">D</span>
                          </div>
                          <span className="text-sm font-black text-white uppercase tracking-widest">DiversiFi</span>
                      </div>
                  </div>
                )}
            </motion.div>

            <CoinSteps phase={phase} onNavigate={(p) => setStep(p)} />

            <AnimatePresence mode="wait">
              {phase === 'detect' && (
                <DetectPhase
                  key="phase-detect"
                  riskLoading={riskLoading}
                  riskData={riskData}
                  showCountryPicker={showCountryPicker}
                  setShowCountryPicker={setShowCountryPicker}
                  manualCountrySearch={manualCountrySearch}
                  setManualCountrySearch={setManualCountrySearch}
                  filteredCountries={filteredCountries}
                  setCountryOverride={setCountryOverride}
                  countryRequestCountry={countryRequestCountry}
                  setCountryRequestCountry={setCountryRequestCountry}
                  countryRequestStatus={countryRequestStatus}
                  setCountryRequestError={setCountryRequestError}
                  countryRequestError={countryRequestError}
                  handleCountryRequest={handleCountryRequest}
                  moneyPurpose={moneyPurpose}
                  setMoneyPurpose={setMoneyPurpose}
                  onAdvance={() => {
                    if (moneyPurpose === 'upcoming_payment') {
                      if (riskData?.code) seedPaymentCycleDraft({ localCurrency: riskData.code });
                      handleFinish({ moneyPurpose });
                    } else {
                      setStep('risk');
                    }
                  }}
                  onSkip={onSkip}
                />
              )}

              {phase === 'risk' && (
                <RiskPhase
                  key="phase-risk"
                  riskData={riskData}
                  benchmarkRows={benchmarkRows}
                  heroRow={heroRow}
                  otherRows={otherRows}
                  maxAbs={maxAbs}
                  selectedHorizon={selectedHorizon}
                  setSelectedHorizon={setSelectedHorizon}
                  liveSeries={liveSeries}
                  isLive1yr={isLive1yr}
                  dataAsOf={dataAsOf}
                  xauPreserved={xauPreserved}
                  localExample={localExample}
                  localPrefix={localPrefix}
                  riskEvents={riskEvents}
                  openEventKey={openEventKey}
                  setOpenEventKey={setOpenEventKey}
                  showBusinessContextOpen={showBusinessContextOpen}
                  setShowBusinessContextOpen={setShowBusinessContextOpen}
                  waitlistEmail={waitlistEmail}
                  setWaitlistEmail={setWaitlistEmail}
                  waitlistStatus={waitlistStatus}
                  setWaitlistStatus={setWaitlistStatus}
                  waitlistError={waitlistError}
                  setWaitlistError={setWaitlistError}
                  handleJoinWaitlist={handleJoinWaitlist}
                  countryCode={countryCode}
                  onAdvance={() => {
                    if (riskData && heroRow) writeMomentBenchmark(riskData.code, heroRow.bench);
                    setStep('philosophy');
                  }}
                />
              )}

              {phase === 'philosophy' && (
                <PhilosophyPhase
                  key="phase-philosophy"
                  selectedArchetype={selectedArchetype}
                  handleArchetypeSelect={handleArchetypeSelect}
                  selectedLens={selectedLens}
                  handleLensSelect={handleLensSelect}
                  handleBackToCoins={handleBackToCoins}
                  lensVariant={lensVariant}
                  emergeKey={emergeKey}
                  activeLens={activeLens}
                  bloomOrigin={bloomOrigin}
                  panelDelay={panelDelay}
                  panelEntrance={panelEntrance}
                  panelChildMotion={panelChildMotion}
                  reduceMotion={Boolean(reduceMotion)}
                  showAllApproaches={showAllApproaches}
                  setShowAllApproaches={setShowAllApproaches}
                  planPreview={planPreview}
                  localPrefix={localPrefix}
                  handleUsePlan={handleUsePlan}
                  handleExploreDemo={handleExploreDemo}
                  riskData={riskData}
                  onBackToRisk={() => setStep('risk')}
                />
              )}
            </AnimatePresence>
            </div>
        </div>
    );
}
