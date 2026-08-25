import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion';
import { OnboardingScreenProps } from './types';
import { NETWORKS } from '../../../config';
import { useWalletContext } from '../../wallet/WalletProvider';
import { useCurrencyRisk } from '../../../hooks/use-currency-risk';
import { regionForCountry } from '../../../hooks/use-user-region';
import { trackFunnelEvent } from '../../../lib/analytics';
import { useStrategy } from '../../../context/app/StrategyContext';
import { useDemoMode } from '../../../context/app/DemoModeContext';
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
  CURRENCY_RISK_DATA_AS_OF,
  HORIZONS,
  exampleSavingsFor,
} from '../../../constants/currency-risk';
import { saveMoneyPurpose } from '../../../hooks/use-protection-profile';
import { MONEY_PURPOSES, type MoneyPurpose } from '../../../constants/money-purpose';
import { showTestnetUi, optIntoTestnetUi } from '../../../constants/testnet';

import { GuardianMascot } from '../../shared/GuardianMascot';
import { Coin, FloatingCoins } from '../../shared/FloatingCoins';
import { LensCoinSelector } from '../LensCoinSelector';
import { PlanPreviewCard } from '../../protection-cards/PlanPreviewCard';

// ── Animation variants ─────────────────────────────────────────────────
// Blur-swap phase transition (transitions.dev "text states swap" pattern)
// Uses filter: blur instead of y-offset for a more cinematic feel.

const phaseVariants: Variants = {
  initial: {
    opacity: 0,
    filter: 'blur(6px)',
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
    filter: 'blur(6px)',
    scale: 1.02,
    transition: {
      duration: 0.2,
      ease: [0.4, 0, 1, 1],
    },
  },
};

const staggerChild: Variants = {
  initial: { opacity: 0, y: 10, filter: 'blur(2px)' },
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
type Horizon = '1yr' | '3yr' | '5yr';
type ValuesLens = 'local' | 'community' | 'faith' | 'global' | 'custom';

const VALUES_LENSES: Array<{
  id: ValuesLens;
  label: string;
  description: string;
  archetypes: ArchetypeId[];
  glyph: string;
  accent: string;
}> = [
  {
    id: 'local',
    label: 'Local prosperity',
    description: 'Keep wealth connected to the economies and communities you know.',
    archetypes: ['africapitalism', 'pan_caribbean'],
    glyph: '🌍',
    accent: '#10b981',
  },
  {
    id: 'community',
    label: 'Community & balance',
    description: 'Balance personal resilience with people and place.',
    archetypes: ['buen_vivir', 'gotong_royong'],
    glyph: '🤝',
    accent: '#14b8a6',
  },
  {
    id: 'faith',
    label: 'Faith & ethics',
    description: 'Put clear ethical principles at the centre of your plan.',
    archetypes: ['islamic_finance', 'confucian'],
    glyph: '🕊️',
    accent: '#d4af37',
  },
  {
    id: 'global',
    label: 'Global resilience',
    description: 'Spread risk across regions and asset types.',
    archetypes: ['global_diversification'],
    glyph: '🌐',
    accent: '#0ea5e9',
  },
  {
    id: 'custom',
    label: 'Build my own',
    description: 'Start with your own allocation and priorities.',
    archetypes: ['custom'],
    glyph: '⚙️',
    accent: '#a78bfa',
  },
];

const PHILOSOPHY_CTA: Record<ArchetypeId, string> = {
  africapitalism: 'Begin building African wealth',
  buen_vivir: 'Start living in balance',
  pan_caribbean: 'Weather every storm',
  confucian: 'Begin with patience',
  gotong_royong: 'Start rising together',
  islamic_finance: 'Begin your Sharia-compliant journey',
  global_diversification: 'Start diversifying globally',
  custom: 'Build your own plan',
};

// Ambient wash per phase — the room's light shifts as the story moves from
// "where are you" (blue) → "here's the danger" (warm) → "here's your plan"
// (emerald). A gold floor glow echoes the coin motif throughout.
const PHASE_WASH: Record<Phase, string> = {
  detect:
    'radial-gradient(90% 55% at 50% 0%, rgba(59,130,246,0.14) 0%, transparent 70%), radial-gradient(70% 40% at 50% 100%, rgba(251,191,36,0.10) 0%, transparent 70%)',
  risk:
    'radial-gradient(90% 55% at 50% 0%, rgba(244,63,94,0.13) 0%, transparent 70%), radial-gradient(70% 40% at 50% 100%, rgba(251,146,60,0.10) 0%, transparent 70%)',
  philosophy:
    'radial-gradient(90% 55% at 50% 0%, rgba(16,185,129,0.13) 0%, transparent 70%), radial-gradient(70% 40% at 50% 100%, rgba(251,191,36,0.10) 0%, transparent 70%)',
};

// ── Coin-minting progress steps ────────────────────────────────────────
// Each phase mints a coin: numbered gold coin → emerald ✓ when complete.
// Completed coins are tappable, making back-navigation discoverable.

const STEPS: { id: Phase; label: string }[] = [
  { id: 'detect', label: 'You' },
  { id: 'risk', label: 'Risk' },
  { id: 'philosophy', label: 'Plan' },
];

function CoinSteps({ phase, onNavigate }: { phase: Phase; onNavigate: (p: Phase) => void }) {
  const idx = STEPS.findIndex((s) => s.id === phase);
  return (
    <div
      className="flex items-start justify-center mb-5 select-none"
      role="group"
      aria-label={`Onboarding step ${idx + 1} of ${STEPS.length}`}
    >
      {STEPS.map((s, i) => {
        const isDone = i < idx;
        const isActive = i === idx;
        return (
          <React.Fragment key={s.id}>
            {i > 0 && (
              <div className="w-10 h-[2px] rounded-full mt-[15px] mx-1 overflow-hidden bg-gray-200 dark:bg-gray-700">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300"
                  initial={false}
                  animate={{ width: i <= idx ? '100%' : '0%' }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            )}
            <button
              type="button"
              onClick={() => isDone && onNavigate(s.id)}
              disabled={!isDone}
              aria-current={isActive ? 'step' : undefined}
              aria-label={isDone ? `Go back to step ${i + 1}: ${s.label}` : `Step ${i + 1}: ${s.label}`}
              className={`min-w-11 min-h-11 flex flex-col items-center justify-center gap-0.5 rounded-lg px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 ${
                isDone ? 'cursor-pointer hover:-translate-y-0.5 transition-transform' : 'cursor-default'
              }`}
            >
              <span className="relative w-8 h-8 flex items-center justify-center">
                {isActive && (
                  <motion.span
                    className="absolute -inset-1 rounded-full border-2 border-amber-400/60"
                    animate={{ scale: [1, 1.25, 1], opacity: [0.7, 0, 0.7] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                )}
                {isDone ? (
                  <motion.span
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                    className="w-7 h-7 rounded-full bg-emerald-500 text-white text-xs font-black flex items-center justify-center shadow-sm"
                  >
                    ✓
                  </motion.span>
                ) : (
                  <Coin
                    size={isActive ? 30 : 26}
                    symbol={String(i + 1)}
                    variant="progress"
                    className={isActive ? '' : 'opacity-40 grayscale'}
                  />
                )}
              </span>
              <span
                className={`text-[10px] font-black uppercase tracking-widest ${
                  isActive
                    ? 'text-amber-500'
                    : isDone
                    ? 'text-emerald-500'
                    : 'text-gray-300 dark:text-gray-600'
                }`}
              >
                {s.label}
              </span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Archetype strip — compact flickable cards for the phase-3 stage ────
// One row, horizontal scroll: 2 archetypes or all 8 fit the same fixed
// stage without growing it. The active card's coin flips (minting motif);
// the accent border alone says "selected" — no badge.
function ArchetypeStrip({
  ids,
  activeId,
  onSelect,
  children,
}: {
  ids: ArchetypeId[];
  activeId: ArchetypeId | null;
  onSelect: (id: ArchetypeId) => void;
  /** Trailing node inside the scroll strip (e.g. a "See all" chip). */
  children?: React.ReactNode;
}) {
  return (
    <div
      className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 py-1"
      role="radiogroup"
      aria-label="Approaches"
    >
      {ids.map((id) => {
        const a = ARCHETYPES[id];
        const isActive = activeId === id;
        const isDimmed = activeId !== null && !isActive;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onSelect(id)}
            className={`w-[190px] flex-shrink-0 min-h-[44px] p-3 rounded-2xl border-2 text-left flex items-start gap-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${
              isActive
                ? 'bg-white dark:bg-gray-800'
                : isDimmed
                ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 opacity-40'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-emerald-300 dark:hover:border-emerald-600'
            }`}
            style={isActive ? { borderColor: a.accent, boxShadow: `0 8px 24px -12px ${a.accent}60` } : undefined}
          >
            {/* Archetype coin — flips like a freshly minted coin when selected */}
            <motion.span
              className="w-8 h-8 flex-shrink-0"
              animate={isActive ? { rotateY: 360, scale: 1.1 } : { rotateY: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 120, damping: 14 }}
              style={{ transformPerspective: 400 }}
            >
              <Coin size={32} symbol={a.name[0]} color={a.accent} variant="selection" />
            </motion.span>
            <span className="flex-1 min-w-0">
              <span className="block text-[13px] font-black text-gray-900 dark:text-white truncate">{a.name}</span>
              <span className="block mt-0.5 text-[11px] leading-snug text-gray-500 dark:text-gray-400 line-clamp-2">{a.philosophy}</span>
            </span>
          </button>
        );
      })}
      {children}
    </div>
  );
}

export function WelcomeScreen({ onSkip, onConnectWallet, isWalletConnected, chainId, onComplete }: WelcomeScreenProps) {
    const { switchNetwork, isConnected } = useWalletContext();
    const {
      riskData,
      isLoading: riskLoading,
      countryCode,
      setCountryOverride,
      getDepreciation,
      calculateCounterfactual,
      riskEvents,
      getPlanPreview,
      dataAsOf,
      isLive1yr,
    } = useCurrencyRisk();
    const { setFinancialStrategy } = useStrategy();
    const { enableDemoMode } = useDemoMode();
    const reduceMotion = useReducedMotion();

    const [isSwitching, setIsSwitching] = useState(false);
    const [switchDone, setSwitchDone] = useState(false);
    const [showTestDetails, setShowTestDetails] = useState(false);
    const [selectedArchetype, setSelectedArchetype] = useState<ArchetypeId | null>(null);
    const [selectedLens, setSelectedLens] = useState<ValuesLens | null>(null);
    const [showAllApproaches, setShowAllApproaches] = useState(false);
    const [manualCountrySearch, setManualCountrySearch] = useState('');
    const [showCountryPicker, setShowCountryPicker] = useState(false);
    const [selectedHorizon, setSelectedHorizon] = useState<Horizon>('5yr');
    const [showOnboardingDetails, setShowOnboardingDetails] = useState(false);
    const [showBusinessContext, setShowBusinessContext] = useState(false);
    const [openEventKey, setOpenEventKey] = useState<string | null>(null);
    const [waitlistEmail, setWaitlistEmail] = useState('');
    const [waitlistStatus, setWaitlistStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
    const [waitlistError, setWaitlistError] = useState<string | null>(null);
    const [moneyPurpose, setMoneyPurpose] = useState<MoneyPurpose | null>('long_term_savings');

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

    const handleArchetypeSelect = (id: ArchetypeId) => {
      setSelectedArchetype(id);
      setFinancialStrategy(STRATEGY_ID[id]);
      trackFunnelEvent('philosophy_chosen', {
        philosophy: id,
        ...(countryCode ? { country: countryCode } : {}),
      });
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

    const handleFinish = (country?: string | null) => {
      if (country && typeof window !== 'undefined') {
        const region = regionForCountry(country);
        if (region) localStorage.setItem('user-region', region);
      }
      saveMoneyPurpose(moneyPurpose);
      onComplete?.(countryCode ?? country ?? null);
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

    const planPreview = selectedArchetype
      ? getPlanPreview(selectedArchetype, localExample, 20)
      : null;

    // The lens currently open in the phase-3 stage (null in the coin view).
    const activeLens = selectedLens
      ? VALUES_LENSES.find((lens) => lens.id === selectedLens) ?? null
      : null;

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
                transition={{ type: 'spring', duration: 1 }}
            >
                {phase === 'detect' ? (
                  <div className="flex items-center justify-center gap-3 text-left">
                    <GuardianMascot
                      size={72}
                      mood={selectedArchetype ? 'happy' : 'neutral'}
                      className="shrink-0"
                    />
                    <div className="max-w-[210px]">
                      <div className="flex items-center gap-1.5 mb-1">
                          <div className="w-5 h-5 bg-blue-600 rounded-md flex items-center justify-center shadow-sm">
                              <span className="text-white text-xs font-black">D</span>
                          </div>
                          <span className="text-xs font-black text-gray-500 dark:text-gray-300 uppercase tracking-widest">DiversiFi</span>
                      </div>
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 leading-snug">
                        Currency protection that fits your values — never a lock-up.
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
                          <span className="text-sm font-black text-gray-400 uppercase tracking-widest">DiversiFi</span>
                      </div>
                  </div>
                )}
            </motion.div>

            <CoinSteps phase={phase} onNavigate={(p) => setStep(p)} />

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
                    Is your money quietly <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">losing value?</span>
                  </motion.h2>
                  <motion.p variants={staggerChild} className="text-sm text-gray-500 dark:text-gray-400 mb-5">
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

                  {riskData && (
                    <motion.button
                      variants={staggerChild}
                      onClick={() => setStep('risk')}
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
                  {/* No subtitle — the card footer carries the honesty line
                      ("history, not advice.") exactly once. */}
                  <motion.h2 variants={staggerChild} className="text-xl md:text-2xl font-black text-gray-900 dark:text-white mb-4 leading-tight">
                    Your <span className="text-blue-500">{riskData.flag} {riskData.code}</span> in context
                  </motion.h2>

                  <motion.div variants={staggerChild} className="bg-slate-900 text-white rounded-2xl p-4 mb-3 shadow-lg">
                    <p className="sr-only">
                      {riskData.countryName}&apos;s {riskData.code} moved {benchmarkRows
                        .map((row) => `${row.value}% against the ${BENCHMARKS[row.bench].label}`)
                        .join(', ')} over {HORIZONS[selectedHorizon].label}.
                    </p>
                    <div className="flex items-center justify-end gap-2 mb-3">
                      <div className="flex rounded-lg bg-white/10 p-0.5" role="group" aria-label="Comparison period">
                        {(['1yr', '3yr', '5yr'] as Horizon[]).map((horizon) => (
                          <button
                            key={horizon}
                            type="button"
                            onClick={() => setSelectedHorizon(horizon)}
                            aria-pressed={selectedHorizon === horizon}
                            className={`px-2 min-h-[44px] py-1 rounded-md text-[10px] font-black transition-colors ${
                              selectedHorizon === horizon ? 'bg-amber-400 text-slate-950' : 'text-slate-300 hover:text-white'
                            }`}
                          >
                            {HORIZONS[horizon].short}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Hero — the benchmark with the largest movement at this
                        horizon, as the single focal number. */}
                    {heroRow ? (
                      <div className="mb-3">
                        <AnimatedNumber
                          value={heroRow.value}
                          decimals={0}
                          suffix="%"
                          duration={0.8}
                          className={`text-4xl font-black tracking-tight ${heroRow.value < 0 ? 'text-amber-300' : 'text-emerald-300'}`}
                        />
                        <p className="mt-1 text-xs font-semibold text-slate-400">
                          vs {BENCHMARKS[heroRow.bench].flag} {BENCHMARKS[heroRow.bench].label} · {HORIZONS[selectedHorizon].label} — your {riskData.code} bought {Math.abs(heroRow.value)}% {heroRow.value < 0 ? 'less' : 'more'}
                        </p>
                      </div>
                    ) : (
                      <p className="mb-3 text-sm font-bold text-slate-300">
                        Roughly stable against all three benchmarks over {HORIZONS[selectedHorizon].label}.
                      </p>
                    )}

                    {/* Comparison bars — scaled to the hero&apos;s magnitude */}
                    {otherRows.length > 0 && (
                      <div className="space-y-2.5 mb-3">
                        {otherRows.map((row) => {
                          const b = BENCHMARKS[row.bench];
                          const pct = Math.max(4, Math.round((Math.abs(row.value) / maxAbs) * 100));
                          return (
                            <div key={row.bench} className="flex items-center gap-2">
                              <span className="w-[76px] flex-shrink-0 text-[11px] font-bold text-slate-300 whitespace-nowrap">
                                {b.flag} {b.label}
                              </span>
                              <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                <motion.div
                                  className="h-full rounded-full bg-white/40"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${pct}%` }}
                                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                                />
                              </div>
                              <span className="w-11 flex-shrink-0 text-right text-xs font-black text-slate-200">
                                {row.value > 0 ? '+' : row.value < 0 ? '-' : ''}{Math.abs(row.value)}%
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Counterfactual — a split you can see: five parts of the
                        example savings, one minted in gold, and the amount it
                        would have kept. The coins carry the "20%"; the number
                        carries the payoff. */}
                    {xauPreserved > 0 && (
                      <div
                        className="mb-3 rounded-xl bg-amber-400/10 border border-amber-400/20 px-3 py-2 flex items-center gap-3"
                        aria-label={`If 20% of ${localPrefix}${localExample.toLocaleString()} had followed gold: ${localPrefix}${Math.round(xauPreserved).toLocaleString()} more kept.`}
                      >
                        <div className="flex items-center gap-1 flex-shrink-0" aria-hidden="true">
                          {[0, 1, 2, 3].map((i) => (
                            <span key={i} className="opacity-45">
                              <Coin size={20} symbol={riskData.flag} color="#64748b" variant="asset" />
                            </span>
                          ))}
                          <motion.span
                            initial={{ scale: 0.6, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.5, type: 'spring', stiffness: 300, damping: 18 }}
                            className="drop-shadow-[0_0_6px_rgba(251,191,36,0.55)]"
                          >
                            <Coin size={24} symbol={BENCHMARKS.XAU.flag} color="#d4af37" variant="asset" />
                          </motion.span>
                        </div>
                        <p className="text-[11px] leading-snug text-amber-200">
                          20% in gold:{' '}
                          <AnimatedNumber
                            value={xauPreserved}
                            decimals={0}
                            prefix={localPrefix}
                            duration={1}
                            className="font-black text-amber-300"
                          />{' '}
                          more kept.
                        </p>
                      </div>
                    )}

                    {/* Context events — inside the card, so the whole data
                        story (numbers, why, provenance) is one object. The
                        phase outside reads: headline → card → disclosure →
                        button. Quiet white chips; amber only on open. */}
                    {riskEvents.length > 0 && (
                      <div className="mb-3">
                        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1" aria-label="Context events">
                          {riskEvents.map((ev) => {
                            const key = `${ev.year}-${ev.event}`;
                            const open = openEventKey === key;
                            return (
                              <button
                                key={key}
                                type="button"
                                onClick={() => setOpenEventKey(open ? null : key)}
                                aria-expanded={open}
                                className={`inline-flex items-center min-h-[44px] flex-shrink-0 whitespace-nowrap rounded-full border px-3 text-[10px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                                  open
                                    ? 'border-amber-400/60 bg-amber-400/10 text-amber-200'
                                    : 'border-white/15 bg-white/5 text-slate-300 hover:border-white/30'
                                }`}
                              >
                                {ev.year} · {ev.event}
                              </button>
                            );
                          })}
                        </div>
                        <AnimatePresence initial={false}>
                          {openEventKey &&
                            (() => {
                              const ev = riskEvents.find((e) => `${e.year}-${e.event}` === openEventKey);
                              if (!ev) return null;
                              return (
                                <motion.p
                                  key={openEventKey}
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="overflow-hidden text-left"
                                >
                                  <span className="block pt-1.5 text-[11px] leading-relaxed text-slate-400">{ev.impact}</span>
                                </motion.p>
                              );
                            })()}
                        </AnimatePresence>
                      </div>
                    )}

                    <div className="pt-2 border-t border-white/10 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                      {isLive1yr && (
                        <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider">● Live 1Y</span>
                      )}
                      {/* Date follows the selected horizon: only 1Y vsUSD is
                          live; 3Y/5Y (and 1Y EUR/XAU) are the curated set. */}
                      <span className="text-[9px] text-amber-400 font-bold uppercase tracking-wider">
                        Data as of {selectedHorizon === '1yr' && isLive1yr ? dataAsOf : CURRENCY_RISK_DATA_AS_OF}
                      </span>
                      <span className="text-[9px] text-slate-500">·</span>
                      <span className="text-[9px] text-slate-500">history, not advice.</span>
                    </div>
                  </motion.div>

                  {/* Single disclosure — everything secondary lives behind one
                      quiet tap: how protection works + business context. The
                      persuasion work (numbers, counterfactual, events) sits
                      above; this tier is for the curious. */}
                  <motion.div variants={staggerChild} className="mb-4">
                    <button
                      type="button"
                      onClick={() => setShowOnboardingDetails((shown) => !shown)}
                      aria-expanded={showOnboardingDetails}
                      className="w-full min-h-[44px] flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/60 px-3 py-3 text-left text-xs font-bold text-gray-700 dark:text-gray-200 hover:border-gray-300 dark:hover:border-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    >
                      <span>What this means for your money</span>
                      <span className="text-gray-400">{showOnboardingDetails ? '−' : '+'}</span>
                    </button>
                    <AnimatePresence initial={false}>
                      {showOnboardingDetails && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden border border-t-0 border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/60 rounded-b-xl px-3"
                        >
                          {/* How protection works — the old two paragraphs
                              (~70 words) drawn as three steps instead. */}
                          <div
                            className="pt-3 pb-1 flex items-start gap-1"
                            aria-label="How it works: buy stablecoins on any exchange or on-ramp, connect your wallet, and the Guardian allocates across stablecoins, gold-backed tokens, and yield vaults with every decision recorded on-chain."
                          >
                            {[
                              { glyph: '🏦', label: 'Buy stablecoins', color: '#94a3b8' },
                              { glyph: '🔌', label: 'Connect wallet', color: '#60a5fa' },
                              { glyph: '🛡️', label: 'Guardian allocates · on-chain', color: '#10b981' },
                            ].map((step, i) => (
                              <React.Fragment key={step.label}>
                                {i > 0 && (
                                  <div className="mt-[15px] h-px w-2 sm:w-4 flex-shrink-0 bg-gray-300 dark:bg-gray-600" aria-hidden="true" />
                                )}
                                <div className="flex-1 min-w-0 flex flex-col items-center gap-1 text-center">
                                  <Coin size={30} symbol={step.glyph} color={step.color} variant="asset" />
                                  <span className="text-[10px] font-bold leading-tight text-gray-600 dark:text-gray-300">{step.label}</span>
                                </div>
                              </React.Fragment>
                            ))}
                          </div>
                          <p className="pb-2 pt-1 text-[10px] leading-relaxed text-gray-500 dark:text-gray-400">
                            We don&apos;t convert fiat — step one happens on any exchange or on-ramp you trust. DiversiFi handles everything after.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              const opening = !showBusinessContext;
                              setShowBusinessContext(opening);
                              if (opening) {
                                trackFunnelEvent('business_hint_expanded', countryCode ? { country: countryCode } : undefined);
                              }
                            }}
                            className="w-full text-left py-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700"
                          >
                            {showBusinessContext ? '− Hide business context' : '+ How this can affect a business'}
                          </button>
                          <AnimatePresence initial={false}>
                            {showBusinessContext && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                              >
                                <p className="pb-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                                  When costs and sales settle in different currencies, exchange-rate changes can affect the margin between restocks.
                                </p>
                                <div className="pb-3 space-y-2">
                                  {waitlistStatus === 'success' ? (
                                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                      ✓ You&apos;re on the list — we&apos;ll email you when it&apos;s ready.
                                    </p>
                                  ) : (
                                    <>
                                      <p className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                        Want early access when business protection launches?
                                      </p>
                                      <div className="flex gap-2">
                                        <input
                                          type="email"
                                          inputMode="email"
                                          autoComplete="email"
                                          aria-label="Email address for waitlist"
                                          placeholder="you@business.com"
                                          value={waitlistEmail}
                                          onChange={(e) => { setWaitlistEmail(e.target.value); if (waitlistStatus === 'error') setWaitlistStatus('idle'); }}
                                          onKeyDown={(e) => { if (e.key === 'Enter' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(waitlistEmail)) handleJoinWaitlist(); }}
                                          disabled={waitlistStatus === 'submitting'}
                                          className="flex-1 min-w-0 min-h-[44px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-xs text-gray-900 dark:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                                        />
                                        <button
                                          type="button"
                                          onClick={handleJoinWaitlist}
                                          disabled={waitlistStatus === 'submitting' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(waitlistEmail)}
                                          className="shrink-0 min-h-[44px] rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 px-3 py-2 text-xs font-bold text-white transition-colors"
                                        >
                                          {waitlistStatus === 'submitting' ? 'Joining…' : 'Join waitlist'}
                                        </button>
                                      </div>
                                      {waitlistStatus === 'error' && waitlistError && (
                                        <p className="text-[11px] font-semibold text-red-500">{waitlistError}</p>
                                      )}
                                      <p className="text-[10px] leading-relaxed text-gray-400 dark:text-gray-500">
                                        We&apos;ll only use this to invite you to early access when business protection launches — no other emails, ever. You can ask us to delete it anytime.
                                      </p>
                                    </>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  <motion.button
                    variants={staggerChild}
                    onClick={() => setStep('philosophy')}
                    className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-offset-2"
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <ShimmerText>Choose Your Approach →</ShimmerText>
                  </motion.button>

                  {/* Reassurance demoted to a caption on the transition zone —
                      it reads with the button, not as a standalone block. */}
                  <motion.p variants={staggerChild} className="mt-2 text-[11px] font-semibold text-gray-400 dark:text-gray-500">
                    No lock-ups. No subscriptions. Your values, your plan.
                  </motion.p>

                  <motion.button
                    variants={staggerChild}
                    onClick={() => { setCountryOverride(null); setStep('detect'); }}
                    className="w-full min-h-[44px] py-2 mt-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
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
                    What do you <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">value?</span>
                  </motion.h2>
                  <motion.p variants={staggerChild} className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Flick or tap a coin — your values pick the plan.
                  </motion.p>

                  {/* Stage — a fixed-height box the choice transforms.
                      Coins (state A) swap in place for the lens detail
                      (state B): the tapped coin flies to the header, the
                      archetypes unfold beneath it, and nothing below the
                      stage (money purpose, CTA) ever moves. */}
                  <motion.div variants={staggerChild} className="relative h-[420px] mb-4">
                    <AnimatePresence initial={false}>
                      {!selectedLens && !showAllApproaches ? (
                        <motion.div
                          key="choose"
                          initial={{ opacity: 0, filter: 'blur(6px)' }}
                          animate={{ opacity: 1, filter: 'blur(0px)' }}
                          exit={{ opacity: 0, filter: 'blur(6px)', transition: { duration: 0.18 } }}
                          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                          className="absolute inset-0 flex flex-col items-center justify-center gap-5"
                        >
                          <LensCoinSelector
                            lenses={VALUES_LENSES}
                            selected={null}
                            onSelect={(id) => setSelectedLens(id as ValuesLens)}
                            coinLayoutId={reduceMotion ? undefined : (id) => `lens-coin-${id}`}
                          />
                          <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400 px-2">
                            Each coin is a way of thinking about money.
                          </p>
                        </motion.div>
                      ) : (
                        <motion.div
                          key={showAllApproaches ? 'all-approaches' : `lens-${selectedLens}`}
                          initial={{ opacity: 0, rotateX: -50, filter: 'blur(4px)' }}
                          animate={{ opacity: 1, rotateX: 0, filter: 'blur(0px)' }}
                          exit={{ opacity: 0, filter: 'blur(6px)', transition: { duration: 0.18 } }}
                          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                          style={{ transformOrigin: 'top center', perspective: 800 }}
                          className="absolute inset-0 flex flex-col"
                        >
                          {/* Lens header — the tapped coin lands here */}
                          <div className="flex items-center gap-3 mb-3">
                            {activeLens && !showAllApproaches && (
                              <motion.div
                                layoutId={reduceMotion ? undefined : `lens-coin-${activeLens.id}`}
                                className="w-11 h-11 flex-shrink-0"
                              >
                                <Coin size={44} symbol={activeLens.glyph} color={activeLens.accent} variant="selection" />
                              </motion.div>
                            )}
                            <div className="flex-1 min-w-0 text-left">
                              <p className="text-sm font-black text-gray-900 dark:text-white">
                                {showAllApproaches ? 'All approaches' : activeLens?.label}
                              </p>
                              <p className="text-[11px] leading-snug text-gray-500 dark:text-gray-400">
                                {showAllApproaches
                                  ? 'Every approach in one list — pick the one that reads like home.'
                                  : activeLens?.description}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => { setSelectedLens(null); setShowAllApproaches(false); }}
                              className="flex-shrink-0 min-h-[44px] px-2 rounded-lg text-[11px] font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
                            >
                              ← Coins
                            </button>
                          </div>

                          {/* Archetype strip — compact cards, one row */}
                          <ArchetypeStrip
                            ids={showAllApproaches ? ARCHETYPE_ORDER : activeLens?.archetypes ?? []}
                            activeId={selectedArchetype}
                            onSelect={handleArchetypeSelect}
                          >
                            {!showAllApproaches && (
                              <button
                                type="button"
                                onClick={() => setShowAllApproaches(true)}
                                className="flex-shrink-0 w-[76px] min-h-[44px] rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-[11px] font-bold text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-600 transition-colors"
                              >
                                See all →
                              </button>
                            )}
                          </ArchetypeStrip>

                          {/* Plan preview — the numeric payoff, or a quiet prompt */}
                          <div className="flex-1 min-h-0 mt-3 flex flex-col">
                            <AnimatePresence mode="wait" initial={false}>
                              {planPreview ? (
                                <motion.div
                                  key={`preview-${selectedArchetype}`}
                                  initial={{ opacity: 0, y: 8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                                  className="overflow-y-auto scrollbar-hide"
                                >
                                  <PlanPreviewCard preview={planPreview} currencyPrefix={localPrefix} />
                                </motion.div>
                              ) : (
                                <motion.p
                                  key="prompt"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                                  className="m-auto px-4 text-xs text-gray-400 dark:text-gray-500 text-center"
                                >
                                  Tap an approach to preview its plan.
                                </motion.p>
                              )}
                            </AnimatePresence>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  {/* Money purpose — one segmented row, same control as 1Y/3Y/5Y */}
                  <motion.div variants={staggerChild} className="mb-4">
                    <p className="text-xs font-black text-gray-700 dark:text-gray-300 mb-2 text-left">
                      When will you need it?
                    </p>
                    <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-100 dark:bg-slate-800/70 p-1" role="radiogroup" aria-label="Money purpose">
                      {MONEY_PURPOSES.map((purpose) => (
                        <button
                          key={purpose.value}
                          type="button"
                          role="radio"
                          aria-checked={moneyPurpose === purpose.value}
                          onClick={() => setMoneyPurpose(purpose.value)}
                          className={`min-h-[44px] rounded-lg px-1 py-2 text-[11px] font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                            moneyPurpose === purpose.value
                              ? 'bg-emerald-500 text-white shadow-sm'
                              : 'text-gray-600 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400'
                          }`}
                        >
                          {purpose.icon}{' '}
                          {purpose.value === 'everyday_buffer'
                            ? 'Soon'
                            : purpose.value === 'long_term_savings'
                            ? 'Years'
                            : 'By date'}
                        </button>
                      ))}
                    </div>
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.p
                        key={moneyPurpose ?? 'none'}
                        initial={{ opacity: 0, filter: 'blur(4px)' }}
                        animate={{ opacity: 1, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, filter: 'blur(4px)' }}
                        transition={{ duration: 0.2 }}
                        className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400 mt-2 text-left"
                      >
                        {MONEY_PURPOSES.find((p) => p.value === moneyPurpose)?.description}
                      </motion.p>
                    </AnimatePresence>
                  </motion.div>

                  {/* Actions — archetype-aware when a philosophy is selected */}
                  <motion.div variants={staggerChild} className="space-y-2">
                    {selectedArchetype ? (
                      <motion.button
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        onClick={async () => {
                          if (onConnectWallet && !isWalletConnected) {
                            try { await onConnectWallet(); } catch { /* fall through */ }
                          }
                          handleFinish(countryCode);
                        }}
                        className="w-full px-6 py-4 text-white font-black rounded-2xl shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:ring-offset-2"
                        style={{
                          background: `linear-gradient(135deg, ${ARCHETYPES[selectedArchetype].accent}, ${ARCHETYPES[selectedArchetype].accentSoft})`,
                          boxShadow: `0 12px 32px -12px ${ARCHETYPES[selectedArchetype].accent}80`,
                        }}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.97 }}
                      >
                        <ShimmerText>{PHILOSOPHY_CTA[selectedArchetype]} →</ShimmerText>
                      </motion.button>
                    ) : (
                      <>
                        {onConnectWallet && !isWalletConnected && (
                          <motion.button
                            onClick={async () => {
                              try { await onConnectWallet(); } catch { /* fall through */ }
                              handleFinish(countryCode);
                            }}
                            className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-offset-2"
                            whileHover={{ y: -2 }}
                            whileTap={{ scale: 0.97 }}
                          >
                            Connect Wallet to Get Started
                          </motion.button>
                        )}
                      </>
                    )}
                    <button
                      onClick={() => {
                        // Actually enable demo mode so the user gets the
                        // mock wallet + demo data, not just a route to
                        // Protect with an unconnected wallet.
                        enableDemoMode();
                        handleFinish(countryCode);
                      }}
                      className="w-full px-6 py-2.5 text-xs font-bold text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/60 rounded-lg"
                    >
                      Explore demo first
                    </button>
                    {riskData && (
                      <button
                        onClick={() => setStep('risk')}
                        className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/60 rounded-lg"
                      >
                        ← Back to risk data
                      </button>
                    )}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
            </div>
        </div>
    );
}
