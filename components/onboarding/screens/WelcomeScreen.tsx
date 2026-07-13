import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { OnboardingScreenProps } from './types';
import { NETWORKS } from '../../../config';
import { useWalletContext } from '../../wallet/WalletProvider';
import { useCurrencyRisk } from '../../../hooks/use-currency-risk';
import { regionForCountry } from '../../../hooks/use-user-region';
import { trackFunnelEvent } from '../../../lib/analytics';
import { useStrategy } from '../../../context/app/StrategyContext';
import { useDemoMode } from '../../../context/app/DemoModeContext';
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
  exampleSavingsFor,
} from '../../../constants/currency-risk';
import { saveMoneyPurpose } from '../../../hooks/use-protection-profile';
import { MONEY_PURPOSES, type MoneyPurpose } from '../../../constants/money-purpose';
import { showTestnetUi, optIntoTestnetUi } from '../../../constants/testnet';

import { GuardianMascot } from '../../shared/GuardianMascot';
import { Coin, FloatingCoins } from '../../shared/FloatingCoins';
import { TokenIcon } from '../../shared/TokenIcon';
import { PlanPreviewCard } from '../../protection-cards/PlanPreviewCard';
import { PhilosophyPromptCard } from '../../protection-cards/PhilosophyPromptCard';

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
}> = [
  {
    id: 'local',
    label: 'Local prosperity',
    description: 'Keep wealth connected to the economies and communities you know.',
    archetypes: ['africapitalism', 'pan_caribbean'],
  },
  {
    id: 'community',
    label: 'Community & balance',
    description: 'Balance personal resilience with people and place.',
    archetypes: ['buen_vivir', 'gotong_royong'],
  },
  {
    id: 'faith',
    label: 'Faith & ethics',
    description: 'Put clear ethical principles at the centre of your plan.',
    archetypes: ['islamic_finance', 'confucian'],
  },
  {
    id: 'global',
    label: 'Global resilience',
    description: 'Spread risk across regions and asset types.',
    archetypes: ['global_diversification'],
  },
  {
    id: 'custom',
    label: 'Build my own',
    description: 'Start with your own allocation and priorities.',
    archetypes: ['custom'],
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

// ── Archetype card with 3D tilt ────────────────────────────────────────
function ArchetypeCard({
  id,
  isActive,
  isDimmed,
  onSelect,
  index,
}: {
  id: ArchetypeId;
  isActive: boolean;
  isDimmed: boolean;
  onSelect: (id: ArchetypeId) => void;
  index: number;
}) {
  const a = ARCHETYPES[id];
  const tilt = useTilt(3);

  return (
    <motion.div variants={staggerChild} whileTap={{ scale: 0.98 }}>
      <button
        onClick={() => onSelect(id)}
        onMouseMove={tilt.onMouseMove}
        onMouseLeave={tilt.onMouseLeave}
        className={`w-full p-3 rounded-2xl border-2 text-left flex items-start gap-3 overflow-hidden transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${
          isActive
            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-400 scale-[1.02]'
            : isDimmed
            ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 opacity-40'
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
        {/* Archetype coin — flips like a freshly minted coin when selected */}
        <motion.div
          className="w-9 h-9 flex-shrink-0"
          animate={isActive ? { rotateY: 360, scale: 1.12 } : { rotateY: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 120, damping: 14 }}
          style={{ transformPerspective: 400 }}
        >
          <Coin size={36} symbol={a.name[0]} color={a.accent} variant="selection" />
        </motion.div>
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
          {isActive && (
            <div className="flex flex-wrap gap-1 mt-1">
              {a.allocation.slice(0, 4).map((asset, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-medium"
                  style={{ background: `${a.accent}15`, color: a.accent }}
                >
                  <TokenIcon symbol={asset} size={12} />
                  {asset}
                </span>
              ))}
            </div>
          )}
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
      setCountryOverride,
      getDepreciation,
      calculateCounterfactual,
      riskEvents,
      isBenchmarkCurrency,
      getPlanPreview,
    } = useCurrencyRisk();
    const { setFinancialStrategy } = useStrategy();
    const { enableDemoMode } = useDemoMode();

    const [isSwitching, setIsSwitching] = useState(false);
    const [switchDone, setSwitchDone] = useState(false);
    const [showTestDetails, setShowTestDetails] = useState(false);
    const [selectedArchetype, setSelectedArchetype] = useState<ArchetypeId | null>(null);
    const [selectedLens, setSelectedLens] = useState<ValuesLens | null>(null);
    const [showAllApproaches, setShowAllApproaches] = useState(false);
    const [manualCountrySearch, setManualCountrySearch] = useState('');
    const [showCountryPicker, setShowCountryPicker] = useState(false);
    const [selectedHorizon, setSelectedHorizon] = useState<Horizon>('5yr');
    const [showHistoricalExample, setShowHistoricalExample] = useState(false);
    const [showBusinessContext, setShowBusinessContext] = useState(false);
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
    const xauPreserved = riskData
      ? calculateCounterfactual(localExample, 20, 'XAU', '5yr')
      : 0;

    const planPreview = selectedArchetype
      ? getPlanPreview(selectedArchetype, 10000, 20)
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
                    Find out in 30 seconds — then pick a way to protect it that matches how you think about money.
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
                  <motion.h2 variants={staggerChild} className="text-xl md:text-2xl font-black text-gray-900 dark:text-white mb-2 leading-tight">
                    Your <span className="text-blue-500">{riskData.flag} {riskData.code}</span> in context
                  </motion.h2>
                  <motion.p variants={staggerChild} className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Compare how it has moved against selected benchmarks. Historical data, not a projection.
                  </motion.p>

                  <motion.div variants={staggerChild} className="bg-slate-900 text-white rounded-2xl p-4 mb-4 shadow-lg">
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <p className="text-xs font-bold text-slate-300">
                        {isBenchmarkCurrency
                          ? `${riskData.countryName}'s ${riskData.code} compared with hard assets`
                          : `${riskData.countryName}'s ${riskData.code} compared with`}
                      </p>
                      <div className="flex rounded-lg bg-white/10 p-0.5" role="group" aria-label="Comparison period">
                        {(['1yr', '3yr', '5yr'] as Horizon[]).map((horizon) => (
                          <button
                            key={horizon}
                            type="button"
                            onClick={() => setSelectedHorizon(horizon)}
                            className={`px-2 min-h-[44px] py-1 rounded-md text-[10px] font-black transition-colors ${
                              selectedHorizon === horizon ? 'bg-amber-400 text-slate-950' : 'text-slate-300 hover:text-white'
                            }`}
                          >
                            {horizon.replace('yr', 'Y')}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {(['USD', 'EUR', 'XAU'] as Benchmark[]).map((bench, i) => {
                        const value = getDepreciation(bench, selectedHorizon);
                        const b = BENCHMARKS[bench];
                        if (value === 0) return null;
                        return (
                          <motion.div key={bench} variants={staggerChild} className="flex items-center justify-between rounded-xl bg-white/8 px-3 py-3 border border-white/10">
                            <span className="text-sm font-bold">{b.flag} {b.label}</span>
                            <AnimatedNumber
                              value={value}
                              decimals={0}
                              suffix="%"
                              duration={0.7}
                              delay={i * 100}
                              className="text-lg font-black text-amber-300"
                            />
                          </motion.div>
                        );
                      })}
                    </div>
                    <p className="mt-3 text-[10px] leading-relaxed text-slate-400">
                      A negative figure means {riskData.code} bought less of that benchmark over this period.
                    </p>
                  </motion.div>

                  <motion.div variants={staggerChild} className="space-y-2 mb-4">
                    <button
                      type="button"
                      onClick={() => setShowHistoricalExample((shown) => !shown)}
                      className="w-full flex items-center justify-between rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/15 px-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                    >
                      <span className="text-xs font-bold text-amber-800 dark:text-amber-200">See a historical example</span>
                      <span className="text-amber-700 dark:text-amber-300">{showHistoricalExample ? '−' : '+'}</span>
                    </button>
                    <AnimatePresence initial={false}>
                      {showHistoricalExample && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden rounded-xl bg-amber-50/70 dark:bg-amber-900/10 px-3">
                          <p className="py-3 text-xs leading-relaxed text-amber-900 dark:text-amber-100">
                            Historically, if 20% of {localPrefix}{localExample.toLocaleString()} had followed gold&apos;s five-year comparison,
                            the difference would have been{' '}
                            <AnimatedNumber value={xauPreserved} decimals={0} prefix={localPrefix} duration={1} className="font-black" />.
                            This is a past comparison, not a recommendation or forecast.
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <button
                      type="button"
                      onClick={() => {
                        const opening = !showBusinessContext;
                        setShowBusinessContext(opening);
                        if (opening) {
                          trackFunnelEvent('business_hint_expanded', countryCode ? { country: countryCode } : undefined);
                        }
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700"
                    >
                      {showBusinessContext ? '− Hide business context' : '+ How this can affect a business'}
                    </button>
                    <AnimatePresence initial={false}>
                      {showBusinessContext && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                          <p className="px-3 pb-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                            When costs and sales settle in different currencies, exchange-rate changes can affect the margin between restocks.
                          </p>
                          <div className="px-3 pb-3 space-y-2">
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

                  {riskEvents.length > 0 && (
                    <motion.div variants={staggerChild} className="border-l-2 border-amber-300 dark:border-amber-600 pl-3 mb-4 text-left">
                      <p className="text-[10px] uppercase tracking-widest font-black text-amber-700 dark:text-amber-300 mb-2">Context events</p>
                      {riskEvents.slice(0, 2).map((ev) => (
                        <div key={`${ev.year}-${ev.event}`} className="mb-3 last:mb-0">
                          <p className="text-xs font-bold text-gray-900 dark:text-white"><span className="text-amber-600 dark:text-amber-400">{ev.year}</span> · {ev.event}</p>
                          <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400 mt-0.5">{ev.impact}</p>
                        </div>
                      ))}
                    </motion.div>
                  )}

                  {/* Neutral framing */}
                  <motion.div variants={staggerChild}>
                    <PhilosophyPromptCard variant="panel" className="mb-5" />
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
                    Start with what <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">matters to you</span>
                  </motion.h2>
                  <motion.p variants={staggerChild} className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                    Pick a values lens first. You can always explore every approach afterwards.
                  </motion.p>

                  {!selectedLens && !showAllApproaches ? (
                    <motion.div
                      variants={{ animate: { transition: { staggerChildren: 0.05 } } }}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4"
                    >
                      {VALUES_LENSES.map((lens) => (
                        <motion.button
                          key={lens.id}
                          variants={staggerChild}
                          type="button"
                          onClick={() => setSelectedLens(lens.id)}
                          className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-slate-800/70 p-3 text-left transition-colors hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                        >
                          <p className="text-sm font-black text-gray-900 dark:text-white">{lens.label}</p>
                          <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400 mt-1">{lens.description}</p>
                        </motion.button>
                      ))}
                    </motion.div>
                  ) : (
                    <motion.div
                      variants={{ animate: { transition: { staggerChildren: 0.05 } } }}
                      className="space-y-2 mb-4"
                    >
                      <div className="flex items-center justify-between px-1">
                        <p className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                          {showAllApproaches ? 'All approaches' : VALUES_LENSES.find((lens) => lens.id === selectedLens)?.label}
                        </p>
                        <button type="button" onClick={() => { setSelectedLens(null); setShowAllApproaches(false); }} className="text-xs font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white">
                          Values lenses
                        </button>
                      </div>
                      {(showAllApproaches
                        ? ARCHETYPE_ORDER
                        : VALUES_LENSES.find((lens) => lens.id === selectedLens)?.archetypes ?? []
                      ).map((id, i) => (
                        <ArchetypeCard
                          key={id}
                          id={id}
                          isActive={selectedArchetype === id}
                          isDimmed={selectedArchetype !== null && selectedArchetype !== id}
                          onSelect={handleArchetypeSelect}
                          index={i}
                        />
                      ))}
                      {!showAllApproaches && <button
                        type="button"
                        onClick={() => setShowAllApproaches(true)}
                        className="w-full py-2 text-xs font-bold text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400"
                      >
                        See all approaches
                      </button>}
                    </motion.div>
                  )}

                  {planPreview && (
                    <motion.div variants={staggerChild} className="mb-5">
                      <PlanPreviewCard preview={planPreview} />
                    </motion.div>
                  )}

                  <motion.div variants={staggerChild} className="mb-5 text-left">
                    <p className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                      What is this money for?
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">
                      Philosophy answers what you value. Money purpose answers when you need it.
                    </p>
                    <div className="space-y-2">
                      {MONEY_PURPOSES.map((purpose) => (
                        <button
                          key={purpose.value}
                          type="button"
                          onClick={() => setMoneyPurpose(purpose.value)}
                          className={`w-full text-left rounded-xl border px-3 py-2.5 transition-colors ${
                            moneyPurpose === purpose.value
                              ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                          }`}
                        >
                          <span className="text-sm font-bold text-gray-900 dark:text-white">
                            {purpose.icon} {purpose.label}
                          </span>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                            {purpose.description}
                          </p>
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
                      className={`w-full px-6 py-3 font-bold rounded-2xl active:scale-[0.97] transition-[color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400/60 ${
                        selectedArchetype
                          ? 'bg-transparent border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 text-sm'
                          : 'bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white'
                      }`}
                    >
                      {selectedArchetype ? 'Explore demo first' : 'Explore Demo First'}
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
