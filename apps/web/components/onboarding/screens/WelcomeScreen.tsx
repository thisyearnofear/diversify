/**
 * WelcomeScreen — the onboarding orchestrator.
 *
 * Owns the shared state (currency risk, philosophy selection, money
 * purpose) plus the session-scoped onboarding draft. and renders the phase for the current step. The phase
 * JSX lives in `phases/` (DetectPhase / RiskPhase / PhilosophyPhase);
 * shared variants, copy, and types live in `phases/phase-config`.
 *
 * Scroll rule: the parent dialog (StrategyModal) is the single scroll
 * container. Never add overflow-y-auto or justify-center here — the
 * my-auto wrapper below centers short content and top-aligns tall content.
 */

import { readMomentHorizon, writeMomentBenchmark, writeMomentHorizon } from '@/constants/moment-horizon';
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
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
} from '../../../constants/currency-risk';
import { useProtectionProfile } from '../../../hooks/use-protection-profile';
import { getCurrencyRisk } from '../../../constants/currency-risk';
import {
  COUNTRY_OPTIONS,
  filterCountryOptions,
} from '@/constants/country-options';
import {
  readOnboardingDraft,
  writeOnboardingDraft,
  clearOnboardingDraft,
} from '../onboarding-draft';
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
import { HANDOFF_ORIGIN_ATTR, stashHandoff } from '../../shared/protagonist-anchor';
import { seedPaymentCycleDraft } from '@/hooks/use-payment-cycle';

export interface OnboardingSelection {
    philosophy?: FinancialStrategy;
    moneyPurpose?: MoneyPurpose;
}

interface WelcomeScreenProps extends OnboardingScreenProps {
    onContinue?: () => void;
    chainId?: number;
    onComplete?: (region: string | null, selection?: OnboardingSelection) => void;
    /** The scroll container (StrategyModal) resets to top each time a
     *  phase's heading mounts — forward or back. */
    onPhaseEntered?: () => void;
}

export function WelcomeScreen({ onSkip, onComplete, onPhaseEntered }: WelcomeScreenProps) {
    const {
      riskData,
      isLoading: riskLoading,
      countryCode,
      setCountryOverride,
      getDepreciation,
      getPlanPreview: getPlanPreviewFor,
      dataAsOf,
      isLive1yr,
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
    const [moneyPurpose, setMoneyPurpose] = useState<MoneyPurpose | null>('long_term_savings');

    // Local step state — user taps to advance (no auto-advance on detect).
    const [step, setStep] = useState<Phase>('detect');
    // +1 forward, −1 back — every path into a phase goes through
    // changePhase so the transition direction and the tap feel stay
    // consistent no matter which control moves the visitor.
    const [phaseDirection, setPhaseDirection] = useState(1);
    const changePhase = useCallback((next: Phase) => {
      if (next === step) return;
      const order: Phase[] = ['detect', 'risk', 'philosophy'];
      setPhaseDirection(order.indexOf(next) > order.indexOf(step) ? 1 : -1);
      haptics.tap();
      setStep(next);
    }, [step]);

    // Draft resilience — a reload/remount (idle tab, HMR, navigation away
    // and back) restores where the visitor actually was instead of
    // restarting them at step 1 while keeping their country. sessionStorage
    // only; nothing here commits anything.
    const [draftReady, setDraftReady] = useState(false);
    const finishedRef = useRef(false);
    useEffect(() => {
      const draft = readOnboardingDraft();
      if (draft) {
        setStep(draft.phase);
        setMoneyPurpose(draft.moneyPurpose);
        setSelectedLens(draft.selectedLens);
        setSelectedArchetype(draft.selectedArchetype);
        setShowAllApproaches(draft.showAllApproaches);
        // If the stored country no longer matches the effective country,
        // the visitor changed it elsewhere — never clobber the newer
        // choice. The saved override wins over the first-render IP guess:
        // useCurrencyRisk applies the override in an effect, so reading
        // `countryCode` here would race it.
        let storedCountry: string | null = null;
        try { storedCountry = localStorage.getItem('user-country-code')?.toUpperCase() ?? null; } catch { /* best effort */ }
        const draftCountry = draft.countryCode?.toUpperCase() ?? null;
        const restoredCountry = storedCountry ?? draftCountry ?? countryCode;
        if (draftCountry && storedCountry && draftCountry !== storedCountry) {
          setStep('detect');
        } else if (draft.phase === 'risk' && restoredCountry && !getCurrencyRisk(restoredCountry)) {
          setStep('detect');
        }
      }
      setDraftReady(true);
      // Mount-only restore; deps intentionally excluded.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // Persist on real changes only after restore — first-render defaults
    // must never overwrite the recovered draft.
    useEffect(() => {
      if (!draftReady || finishedRef.current) return;
      writeOnboardingDraft({
        version: 1,
        phase: step,
        moneyPurpose,
        selectedLens,
        selectedArchetype,
        showAllApproaches,
        countryCode,
      });
    }, [draftReady, step, moneyPurpose, selectedLens, selectedArchetype, showAllApproaches, countryCode]);

    const phase: Phase = step;

    // Phase entry: once per phase, focus the incoming heading (it
    // announces the step) and let the scroll container reset. Within-phase
    // state (horizon, coin, country) never re-triggers it.
    const phaseRef = useRef<HTMLDivElement>(null);
    const enteredPhaseRef = useRef<Phase | null>(null);
    const enterPhase = useCallback(() => {
      if (enteredPhaseRef.current === phase) return;
      // Scoped to the entering phase's own heading — during a mode="wait"
      // transition the outgoing phase is still mounted, and focusing its
      // heading would latch `enteredPhaseRef` on the wrong screen.
      const heading = phaseRef.current?.querySelector<HTMLElement>(`[data-phase-heading="${phase}"]`);
      if (!heading) return;
      enteredPhaseRef.current = phase;
      onPhaseEntered?.();
      heading.focus({ preventScroll: true });
    }, [phase, onPhaseEntered]);
    useEffect(() => { enterPhase(); }, [enterPhase]);

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

    const handleFinish = (selection?: OnboardingSelection) => {
      finishedRef.current = true;
      clearOnboardingDraft();
      const region = countryCode ? regionForCountry(countryCode) ?? null : null;
      onComplete?.(region, selection);
    };

    const handleUsePlan = () => {
      if (!selectedArchetype || !planPreview) return;
      haptics.confirm();
      // The chosen coin carries into the app: Shield's ring absorbs it.
      const coin = document.querySelector(`[${HANDOFF_ORIGIN_ATTR}="${selectedArchetype}"]`);
      const r = coin?.getBoundingClientRect();
      if (r && r.width > 0) {
        stashHandoff({
          from: { x: r.left + r.width / 2, y: r.top + r.height / 2, size: Math.min(r.width, r.height) },
          symbol: ARCHETYPES[selectedArchetype].name[0],
          color: ARCHETYPES[selectedArchetype].accent,
        });
      }
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


    const filteredCountries = useMemo(
      () => filterCountryOptions(manualCountrySearch),
      [manualCountrySearch],
    );
    const selectedCountry =
      COUNTRY_OPTIONS.find((c) => c.iso2 === countryCode) ?? null;
    // The picker is the directory; riskData only exists for researched
    // countries — never let a stale comparison pose as the new pick.
    const matchingRiskData =
      selectedCountry && riskData && selectedCountry.hasHistory && selectedCountry.code === riskData.code
        ? riskData
        : null;

    // Precompute the savings example for the plan preview, denominated in
    // the visitor's own currency so no mental FX is required.
    const localExample = matchingRiskData ? exampleSavingsFor(matchingRiskData.code) : 10000;
    const localPrefix = matchingRiskData && matchingRiskData.code !== 'USD' ? `${matchingRiskData.code} ` : 'US$ ';

    // One before/after object on the risk step: same local amount, measured
    // in benchmark units at period start vs horizon. USD self-comparison
    // never happens — a US visitor sees euros instead. Only the 1yr USD
    // reading can carry live feed data; everything else is curated.
    const riskBenchmark: 'USD' | 'EUR' = riskData?.code === 'USD' ? 'EUR' : 'USD';
    const riskDelta = riskData ? getDepreciation(riskBenchmark, selectedHorizon) : null;
    const riskUsesLive = riskBenchmark === 'USD' && selectedHorizon === '1yr' && isLive1yr && riskDelta !== null && Number.isFinite(riskDelta);

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

    if (!draftReady) return null;

    return (
        // Scrolling lives on the parent dialog (single scroll container).
        // justify-center is gone — with it, overflowing content extended above
        // the scrollable area and could never be reached. The my-auto wrapper
        // below centers short content and top-aligns tall content instead.
        <div className="flex-1 flex flex-col items-center pt-20 pb-8 px-5 sm:px-8 text-center relative">
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
                className="mb-4 relative mt-4 md:mt-2"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={springSoft}
            >
                {phase === 'detect' ? (
                  <div className="flex items-center justify-center gap-3">
                    <GuardianMascot
                      size={56}
                      mood={selectedArchetype ? 'happy' : 'neutral'}
                      gaze="pointer"
                      className="shrink-0"
                    />
                    <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 bg-blue-600 rounded-md flex items-center justify-center shadow-sm">
                            <span className="text-white text-xs font-black">D</span>
                        </div>
                        <span className="text-xs font-black text-white uppercase tracking-widest">DiversiFi</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 mb-2">
                      <GuardianMascot
                        size={32}
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

            <CoinSteps phase={phase} onNavigate={changePhase} />

            <div ref={phaseRef} className="w-full flex flex-col items-center">
            <AnimatePresence mode="wait" custom={phaseDirection}>
              {phase === 'detect' && (
                <DetectPhase
                  key="phase-detect"
                  direction={phaseDirection}
                  riskLoading={riskLoading && !selectedCountry}
                  riskData={matchingRiskData}
                  showCountryPicker={showCountryPicker}
                  setShowCountryPicker={setShowCountryPicker}
                  manualCountrySearch={manualCountrySearch}
                  setManualCountrySearch={setManualCountrySearch}
                  filteredCountries={filteredCountries}
                  setCountryOverride={setCountryOverride}
                  selectedCountry={selectedCountry}
                  moneyPurpose={moneyPurpose}
                  setMoneyPurpose={setMoneyPurpose}
                  onAdvance={() => {
                    if (!matchingRiskData) {
                      // No researched history — the plan is still explorable.
                      changePhase('philosophy');
                      return;
                    }
                    if (moneyPurpose === 'upcoming_payment') {
                      seedPaymentCycleDraft({ localCurrency: matchingRiskData.code });
                      handleFinish({ moneyPurpose });
                    } else {
                      changePhase('risk');
                    }
                  }}
                  onSkip={onSkip}
                  onEntered={enterPhase}
                />
              )}

              {phase === 'risk' && (
                <RiskPhase
                  key="phase-risk"
                  riskData={matchingRiskData}
                  benchmark={riskBenchmark}
                  delta={riskDelta}
                  selectedHorizon={selectedHorizon}
                  setSelectedHorizon={setSelectedHorizon}
                  isLive={riskUsesLive}
                  dataAsOf={dataAsOf}
                  direction={phaseDirection}
                  onAdvance={() => {
                    if (riskData) writeMomentBenchmark(riskData.code, riskBenchmark);
                    changePhase('philosophy');
                  }}
                  onEntered={enterPhase}
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
                  direction={phaseDirection}
                  onBackToRisk={() => changePhase('risk')}
                  onEntered={enterPhase}
                />
              )}
            </AnimatePresence>
            </div>
            </div>
        </div>
    );
}
