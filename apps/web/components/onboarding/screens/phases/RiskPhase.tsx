/**
 * RiskPhase — onboarding phase 2: the "aha" risk card.
 *
 * JSX extracted verbatim from WelcomeScreen; state stays with the
 * orchestrator and arrives as props.
 *
 * Scroll rule: this phase renders inside the dialog's single scroll
 * container — never add overflow-y-auto or justify-center here.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedNumber } from '../../../shared/AnimatedNumber';
import { ShimmerText } from '../../../shared/ShimmerText';
import { Coin } from '../../../shared/FloatingCoins';
import { QUIET_GRAY, GOLD_METAL } from '../../../shared/palette';
import { RiskSparkline } from './RiskSparkline';
import { phaseVariants, staggerChild, type Horizon } from './phase-config';
import {
  BENCHMARKS,
  CURRENCY_RISK_DATA_AS_OF,
  HORIZONS,
  type Benchmark,
} from '../../../../constants/currency-risk';
import { trackFunnelEvent } from '../../../../lib/analytics';

interface RiskPhaseProps {
  riskData: { flag: string; countryName: string; code: string } | null;
  benchmarkRows: Array<{ bench: Benchmark; value: number }>;
  heroRow: { bench: Benchmark; value: number } | null;
  otherRows: Array<{ bench: Benchmark; value: number }>;
  maxAbs: number;
  selectedHorizon: Horizon;
  setSelectedHorizon: (h: Horizon) => void;
  liveSeries: { values: number[] } | null;
  isLive1yr: boolean;
  dataAsOf: string;
  xauPreserved: number;
  localExample: number;
  localPrefix: string;
  riskEvents: Array<{ year: number; event: string; impact: string }>;
  openEventKey: string | null;
  setOpenEventKey: (key: string | null) => void;
  showBusinessContextOpen: boolean;
  setShowBusinessContextOpen: (open: boolean) => void;
  waitlistEmail: string;
  setWaitlistEmail: (v: string) => void;
  waitlistStatus: 'idle' | 'submitting' | 'success' | 'error';
  setWaitlistStatus: (s: 'idle' | 'submitting' | 'success' | 'error') => void;
  waitlistError: string | null;
  setWaitlistError: (v: string | null) => void;
  handleJoinWaitlist: () => void;
  countryCode: string | null;
  onAdvance: () => void;
}

export function RiskPhase({
  riskData,
  benchmarkRows,
  heroRow,
  otherRows,
  maxAbs,
  selectedHorizon,
  setSelectedHorizon,
  liveSeries,
  isLive1yr,
  dataAsOf,
  xauPreserved,
  localExample,
  localPrefix,
  riskEvents,
  openEventKey,
  setOpenEventKey,
  showBusinessContextOpen,
  setShowBusinessContextOpen,
  waitlistEmail,
  setWaitlistEmail,
  waitlistStatus,
  setWaitlistStatus,
  waitlistError,
  handleJoinWaitlist,
  countryCode,
  onAdvance,
}: RiskPhaseProps) {
  if (!riskData) return null;

  return (
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
                  <Coin size={20} symbol={riskData.flag} color={QUIET_GRAY} variant="asset" />
                </span>
              ))}
              <motion.span
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.5, type: 'spring', stiffness: 300, damping: 18 }}
                className="drop-shadow-[0_0_6px_rgba(251,191,36,0.55)]"
              >
                <Coin size={24} symbol={BENCHMARKS.XAU.flag} color={GOLD_METAL} variant="asset" />
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
        onClick={onAdvance}
        className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-offset-2"
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.97 }}
      >
        <ShimmerText>Choose Your Approach →</ShimmerText>
      </motion.button>
    </motion.div>
  );
}
