import React, { useEffect, useState, useMemo, useId, Fragment } from 'react';
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
import {
  LensCoinSelector,
  COMBINE_VARIANT_COUNT,
  COMBINE_PANEL_DELAY,
  combineOriginX,
  useLensCoinMetrics,
} from '../LensCoinSelector';
import type { TargetAndTransition, Transition } from 'framer-motion';
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
}: {
  ids: ArchetypeId[];
  activeId: ArchetypeId | null;
  onSelect: (id: ArchetypeId) => void;
}) {
  // Short lists (a lens shows 1-3 archetypes) centre instead of hugging the
  // left edge — scrolling is only needed for the "All 8" view.
  const centerWhenShort = ids.length <= 2 ? 'justify-center' : '';
  return (
    <div
      className={`flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 py-1 ${centerWhenShort}`}
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
    </div>
  );
}

// ── RiskSparkline — the real 12-month path of a currency ────────────────
// Drawn from sampled daily tables (indexed to 100 at the start of the
// window): a real path, never an interpolated curve. A declining line =
// the currency bought less USD over the year.
function RiskSparkline({ values, code }: { values: number[]; code: string }) {
  const reduceMotion = useReducedMotion();
  const gradId = useId();
  const W = 100;
  const H = 30;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * W,
    H - 3 - ((v - min) / span) * (H - 6),
  ]);
  const d = pts
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(' ');
  const area = `${d} L${W},${H} L0,${H} Z`;
  const declining = values[values.length - 1] < values[0];
  const stroke = declining ? '#fbbf24' : '#34d399'; // amber-400 / emerald-400

  return (
    <div className="mb-3">
      <div className="flex items-center justify-center gap-2 mb-1">
        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
          12-month path vs USD
        </span>
        <span className="text-[9px] text-slate-500">· live · indexed to 100</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-12"
        role="img"
        aria-label={`${code} purchasing power against the US dollar over the last 12 months, indexed to 100 at the start of the window. Live data, ${declining ? 'declining' : 'holding or rising'}.`}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradId})`} />
        <motion.path
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          initial={reduceMotion ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: 'easeOut', delay: 0.15 }}
        />
      </svg>
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
      liveSeries,
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
    // Which combine choreography the stage plays next — cycles 0→1→2 on
    // each selection so every pick gets a different trick, not a template.
    const [lensVariant, setLensVariant] = useState(0);
    // Bump when returning to the coin row so the coins burst back out of
    // the point the previous pick collapsed into.
    const [emergeKey, setEmergeKey] = useState(0);
    const [manualCountrySearch, setManualCountrySearch] = useState('');
    const [showCountryPicker, setShowCountryPicker] = useState(false);
    const [selectedHorizon, setSelectedHorizon] = useState<Horizon>('5yr');
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

    // Tap a coin → the row combines into it (a different variation each
    // time) and the detail opens from the same point.
    const handleLensSelect = (id: ValuesLens) => {
      setLensVariant((v) => (v + 1) % COMBINE_VARIANT_COUNT);
      setSelectedLens(id);
    };

    // Back to the row → the coins burst back out of the chosen point.
    const handleBackToCoins = () => {
      setSelectedLens(null);
      setShowAllApproaches(false);
      setEmergeKey((k) => k + 1);
    };

    // Plan preview — only when the selected archetype actually belongs
    // to the lens panel currently open (or the "all approaches" view),
    // so browsing another lens never shows a stale pick's plan.
    const planPreview =
      selectedArchetype &&
      activeLens &&
      (showAllApproaches || activeLens.archetypes.includes(selectedArchetype))
        ? getPlanPreview(selectedArchetype, localExample, 20)
        : null;

    // Panel entrance — one per combine variant, timed off the hand-off
    // the coins exported. V0: the panel is revealed by an expanding
    // circle centred on the chosen coin (the "sprout"). V1: a soft
    // drop-in behind the dissolving pick. V2: an eruption from it.
    const panelEntrance: {
      initial: TargetAndTransition;
      animate: TargetAndTransition;
      transition: Transition;
    } = reduceMotion
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.15 } }
      : lensVariant === 0
      ? {
          initial: { opacity: 1, clipPath: `circle(0px at ${bloomOrigin} 50%)` },
          animate: { opacity: 1, clipPath: `circle(560px at ${bloomOrigin} 50%)` },
          transition: { duration: 0.55, delay: panelDelay, ease: [0.16, 1, 0.3, 1] },
        }
      : lensVariant === 1
      ? {
          initial: { opacity: 0, y: -14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.45, delay: panelDelay, ease: [0.16, 1, 0.3, 1] },
        }
      : {
          initial: { opacity: 0, scale: 0.4 },
          animate: { opacity: 1, scale: 1 },
          transition: { type: 'spring', stiffness: 240, damping: 20, delay: panelDelay },
        };

    // Content turns: V1 cascades downward, V2 assembles outward from the
    // pick, V0 needs nothing (the circle mask does the reveal).
    const panelChildMotion = (i: number): {
      initial: TargetAndTransition | false;
      animate: TargetAndTransition;
      transition: Transition;
    } => {
      if (reduceMotion || lensVariant === 0) {
        return { initial: false, animate: { opacity: 1 }, transition: { duration: 0.1 } };
      }
      if (lensVariant === 1) {
        return {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.4, delay: panelDelay + 0.08 * i, ease: [0.16, 1, 0.3, 1] },
        };
      }
      return {
        initial: { opacity: 0, y: 10, scale: 0.65 },
        animate: { opacity: 1, y: 0, scale: 1 },
        transition: { type: 'spring', stiffness: 300, damping: 22, delay: panelDelay + 0.06 * i },
      };
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
                transition={{ type: 'spring', duration: 1 }}
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
                          <span className="text-sm font-black text-white uppercase tracking-widest">DiversiFi</span>
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
                  className="w-full max-w-sm text-center"
                >
                  {/* No subtitle — the card footer carries the honesty line
                      ("history, not advice.") exactly once. */}
                  <motion.h2 variants={staggerChild} className="text-xl md:text-2xl font-black text-white mb-4 leading-tight">
                    Your <span className="text-blue-300">{riskData.flag} {riskData.code}</span> in context
                  </motion.h2>

                  <motion.div variants={staggerChild} className="bg-slate-900 text-white rounded-2xl p-4 mb-3 shadow-lg">
                    <p className="sr-only">
                      {riskData.countryName}&apos;s {riskData.code} moved {benchmarkRows
                        .map((row) => `${row.value}% against the ${BENCHMARKS[row.bench].label}`)
                        .join(', ')} over {HORIZONS[selectedHorizon].label}.
                    </p>
                    <div className="flex items-center justify-center gap-2 mb-3">
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

                    {/* Live 12-month path — only at the 1Y horizon, only when
                        the feed has a real series; 3Y/5Y stay on the bars
                        (the curated set has three points, not a path). */}
                    {selectedHorizon === '1yr' && liveSeries && (
                      <RiskSparkline values={liveSeries.values} code={riskData.code} />
                    )}

                    {/* Comparison bars — only at the 1Y horizon where the
                        sparkline carries the path; 3Y/5Y are three points and
                        a bars chart would just repeat the hero number twice.
                        The whole bar block is centred (max-w) so the bars
                        unit reads as one object, not a left-pinned chart. */}
                    {selectedHorizon === '1yr' && otherRows.length > 0 && (
                      <div className="space-y-2.5 mb-3 mx-auto max-w-[280px]">
                        {otherRows.map((row) => {
                          const b = BENCHMARKS[row.bench];
                          const pct = Math.max(4, Math.round((Math.abs(row.value) / maxAbs) * 100));
                          return (
                            <div key={row.bench} className="flex items-center gap-2">
                              <span className="w-[64px] flex-shrink-0 text-[11px] font-bold text-slate-300 whitespace-nowrap text-left">
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
                              <span className="w-11 flex-shrink-0 text-xs font-black text-slate-200">
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
                        carries the payoff. Stacked (coins above text) so the
                        whole block centres as one unit. */}
                    {xauPreserved > 0 && (
                      <div
                        className="mb-3 rounded-xl bg-amber-400/10 border border-amber-400/20 px-3 py-3 flex flex-col items-center gap-2"
                        aria-label={`If 20% of ${localPrefix}${localExample.toLocaleString()} had followed gold: ${localPrefix}${Math.round(xauPreserved).toLocaleString()} more kept.`}
                      >
                        <div className="flex items-center gap-1" aria-hidden="true">
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

                    {/* Context events — collapsed to a single quiet line in
                        the data footer. Tapping expands a stacked year list
                        with the explanation for each. Stays inside the card
                        so the whole data story (numbers, why, provenance)
                        is one object. */}
                    {riskEvents.length > 0 && (
                      <div className="pt-2 border-t border-white/10">
                        <button
                          type="button"
                          onClick={() => setOpenEventKey(openEventKey === '__events__' ? null : '__events__')}
                          aria-expanded={openEventKey === '__events__'}
                          className="w-full min-h-[28px] flex items-center justify-center gap-1.5 text-[10px] text-slate-400 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded"
                        >
                          <span>
                            Context: {riskEvents.map((ev) => ev.year).join(', ')}
                          </span>
                          <span className="text-slate-500">{openEventKey === '__events__' ? '−' : '+'}</span>
                        </button>
                        <AnimatePresence initial={false}>
                          {openEventKey === '__events__' && (
                            <motion.ul
                              key="events"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden text-left space-y-1 pt-1.5"
                            >
                              {riskEvents.map((ev) => (
                                <li key={`${ev.year}-${ev.event}`} className="text-[11px] leading-relaxed text-slate-300">
                                  <span className="font-black text-slate-100">{ev.year}</span>
                                  <span className="text-slate-500"> · </span>
                                  <span className="text-slate-400">{ev.event}</span>
                                  <span className="block text-slate-400/80">{ev.impact}</span>
                                </li>
                              ))}
                            </motion.ul>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
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

                  {/* One quiet line — the how-it-works diagram is moved to the
                      Phase 3 (philosophy) stage, so this tier is just the
                      business sub-disclosure. Tap once for context, tap again
                      for the email capture. */}
                  <motion.div variants={staggerChild} className="mb-4">
                    <p className="text-[11px] leading-relaxed text-slate-300">
                      DiversiFi never holds your fiat — buy stablecoins anywhere you trust, we allocate from there.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const opening = !showBusinessContextOpen;
                        setShowBusinessContextOpen(opening);
                        if (opening) {
                          trackFunnelEvent('business_hint_expanded', countryCode ? { country: countryCode } : undefined);
                        }
                      }}
                      className="mt-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
                    >
                      {showBusinessContextOpen ? '− Hide business context' : '+ How this can affect a business'}
                    </button>
                    <AnimatePresence initial={false}>
                      {showBusinessContextOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-2 bg-white/70 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
                            <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                              When costs and sales settle in different currencies, exchange-rate changes can affect the margin between restocks.
                            </p>
                            <div className="mt-2 space-y-2">
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
                          </div>
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
                  <motion.h2 variants={staggerChild} className="text-xl md:text-2xl font-black text-white mb-2 leading-tight">
                    How will you protect your{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-teal-300">
                      savings?
                    </span>
                  </motion.h2>
                  <motion.p variants={staggerChild} className="text-sm text-slate-300 mb-4">
                    Tap a coin to see what it means — tap again to make it yours. Flick left or right to browse.
                  </motion.p>

                  {/* Stage — a fixed-height canvas holding BOTH the coin
                      row and the lens detail as overlapping layers. Tap a
                      coin: the others combine into it (the choreography
                      cycles through three variations), then the detail
                      blooms out of the chosen coin's exact slot. Fixed
                      height + overlapping layers — nothing below the
                      stage ever moves. */}
                  <motion.div variants={staggerChild} className="relative h-[300px] mb-4">
                    {/* Coin row — the combine choreography lives inside. */}
                    <LensCoinSelector
                      presentation="stage"
                      lenses={VALUES_LENSES}
                      selected={selectedLens}
                      onSelect={(id) => handleLensSelect(id as ValuesLens)}
                      combineVariant={lensVariant}
                      emergeKey={emergeKey}
                    />

                    {/* Flash ring — a radial burst of the pick's accent at
                        the convergence point, fired just as the panel
                        takes over. Bloom + burst variants only. */}
                    <AnimatePresence>
                      {activeLens && !reduceMotion && lensVariant !== 1 && (
                        <motion.span
                          key={`flash-${activeLens.id}-${lensVariant}`}
                          aria-hidden="true"
                          className="pointer-events-none absolute w-14 h-14 rounded-full z-20"
                          style={{
                            left: bloomOrigin,
                            top: '50%',
                            x: '-50%',
                            y: '-50%',
                            border: `2px solid ${activeLens.accent}`,
                          }}
                          initial={{ scale: 0.25, opacity: 0.9 }}
                          animate={{ scale: 3.4, opacity: 0 }}
                          transition={{ duration: 0.6, ease: 'easeOut', delay: Math.max(0, panelDelay - 0.1) }}
                        />
                      )}
                    </AnimatePresence>

                    {/* Lens detail — sprouts out of the chosen coin. Full
                        width: no pinned mini-row, no dead corner. */}
                    <AnimatePresence>
                      {activeLens && (
                        <motion.div
                          key="lens-panel"
                          initial={panelEntrance.initial}
                          animate={panelEntrance.animate}
                          exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
                          transition={panelEntrance.transition}
                          className="absolute inset-0 flex flex-col justify-center px-2 z-10"
                        >
                          {/* Lens detail sits on a SOLID panel — the coin row
                              stays mounted behind it for the bloom
                              choreography, but nothing shows through
                              (solid-ground rule: glass loses to the backdrop). */}
                          <div className="rounded-3xl bg-slate-900 ring-1 ring-white/10 shadow-xl p-3">
                          {/* Lens header — stacked: label on its own line,
                              description under it (both were truncate-clipped
                              when sharing one row). Escape hatches stay right. */}
                          <motion.div {...panelChildMotion(0)} className="flex items-start justify-between gap-2 mb-2">
                            <div className="min-w-0 text-left">
                              <p className="text-sm font-black text-white truncate">
                                {showAllApproaches ? 'All approaches' : activeLens.label}
                              </p>
                              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                {showAllApproaches
                                  ? 'Every approach in one list.'
                                  : activeLens.description}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
                              {!showAllApproaches && (
                                <button
                                  type="button"
                                  onClick={() => setShowAllApproaches(true)}
                                  className="min-h-[44px] px-1 text-[11px] font-bold text-slate-400 hover:text-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 rounded"
                                >
                                  All 8 →
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={handleBackToCoins}
                                className="min-h-[44px] px-2 rounded-lg text-[11px] font-bold text-slate-400 hover:text-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
                              >
                                ← Coins
                              </button>
                            </div>
                          </motion.div>

                          {/* Archetype strip — the user's actual choice. */}
                          <motion.div {...panelChildMotion(1)}>
                            <ArchetypeStrip
                              ids={showAllApproaches ? ARCHETYPE_ORDER : activeLens.archetypes}
                              activeId={selectedArchetype}
                              onSelect={handleArchetypeSelect}
                            />
                          </motion.div>

                          {/* Plan preview — the numeric payoff, or a quiet prompt. */}
                          <motion.div {...panelChildMotion(2)} className="mt-2.5">
                            <AnimatePresence mode="wait" initial={false}>
                              {planPreview ? (
                                <motion.div
                                  key={`preview-${selectedArchetype}`}
                                  initial={{ opacity: 0, y: 8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                                >
                                  <PlanPreviewCard preview={planPreview} currencyPrefix={localPrefix} />
                                </motion.div>
                              ) : (
                                <motion.p
                                  key="prompt"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                                  className="px-2 text-[11px] text-slate-400 text-center"
                                >
                                  Tap an approach to preview its plan.
                                </motion.p>
                              )}
                            </AnimatePresence>
                          </motion.div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Caption — names the next action, not a philosophy
                        lecture. Hidden when the lens detail is showing. */}
                    <AnimatePresence>
                      {!activeLens && (
                        <motion.p
                          key="coin-caption"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1, transition: { delay: 0.2 } }}
                          exit={{ opacity: 0, transition: { duration: 0.1 } }}
                          className="absolute bottom-2 left-0 right-0 text-center text-[11px] leading-snug text-slate-400 px-2"
                        >
                          Tap a coin to see the plan, or ← Back to risk data.
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  {/* Money purpose — compact single-line segmented control.
                      Icon + label per chip; the heading + description caption
                      are gone (chip labels already say it). */}
                  <motion.div variants={staggerChild} className="mb-4">
                    <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-100 dark:bg-slate-800/70 p-1" role="radiogroup" aria-label="When you will need this money">
                      {MONEY_PURPOSES.map((purpose) => (
                        <button
                          key={purpose.value}
                          type="button"
                          role="radio"
                          aria-checked={moneyPurpose === purpose.value}
                          onClick={() => setMoneyPurpose(purpose.value)}
                          aria-label={purpose.label}
                          className={`min-h-[44px] rounded-lg px-1 py-2 text-[11px] font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                            moneyPurpose === purpose.value
                              ? 'bg-emerald-500 text-white shadow-sm'
                              : 'text-gray-600 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400'
                          }`}
                        >
                          <span aria-hidden="true">{purpose.icon}</span>{' '}
                          {purpose.value === 'everyday_buffer'
                            ? 'Soon'
                            : purpose.value === 'long_term_savings'
                            ? 'Years'
                            : 'By date'}
                        </button>
                      ))}
                    </div>
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
