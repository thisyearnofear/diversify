/**
 * CurrencyInstrument — one currency as an object you can read at a glance.
 *
 * The disc is not decoration: each of its three arcs is the currency's
 * buying power retained against one benchmark (dollar, euro, gold), so an
 * emptied arc IS the loss. Changing the horizon re-sweeps the arcs; picking
 * a benchmark turns the ring and opens the record behind it.
 *
 * Depth layers (design-language §5): the disc and its one number are L0,
 * one curated reading is L1, and the inspector is L2 — the dated trail in
 * the currency's own canonical wording, the onchain token's provenance,
 * and the stamps this currency can press onto a postcard.
 *
 * No prose is written here. Every sentence wraps a number the dataset owns,
 * and a currency without a curated voice, staple, token, or record simply
 * renders less — never a filled-in guess.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  useVelocity,
  type MotionValue,
} from 'framer-motion';
import { InstrumentShell } from '@/components/shared/InstrumentShell';
import { InspectorSheet } from '@/components/shared/InspectorSheet';
import { RouteLink } from '@/components/shared/RouteLink';
import { BENCHMARK_COLORS } from '@/components/shared/palette';
import { useCountUp } from '@/hooks/use-count-up';
import { useGeoCountry } from '@/hooks/use-geo-country';
import { useMotionBudget } from '@/hooks/use-motion-budget';
import { featureDenied } from '@diversifi/shared/src/config/jurisdictions';
import { press, springPress, springSoft } from '@/lib/motion-tokens';
import { haptics } from '@/lib/haptics';
import {
  BENCHMARK_LABEL,
  HORIZONS,
  HORIZON_LABEL,
  type Benchmark,
  type CurrencyInstrument as Instrument,
} from '@/lib/currency-instrument';
import type { Horizon } from '@/lib/corridor-context';

/** Ring geometry — outermost is the dollar, the benchmark most savers
 *  actually think in; gold sits innermost as the hard-asset check. */
const RING_SPEC: Array<{ benchmark: Benchmark; radius: number; width: number }> = [
  { benchmark: 'USD', radius: 84, width: 13 },
  { benchmark: 'EUR', radius: 65, width: 10 },
  { benchmark: 'XAU', radius: 48, width: 8 },
];

function TweenedLine({
  value,
  format,
  suffix,
}: {
  value: number;
  format?: (n: number) => string;
  suffix: string;
}) {
  const shown = useCountUp(value, { format });
  return (
    <>
      <motion.span className="tabular-nums">{shown}</motion.span>
      {suffix}
    </>
  );
}

/**
 * One benchmark's arc.
 *
 * The sweep is a motion value rather than a declarative target because the
 * smear needs the arc's own velocity: blur is a function of how fast the
 * number is travelling, and it is exactly zero at rest — so the ring is
 * completely still the moment the person has acted. Only the arc being
 * read smears; the dimmed context settles plainly behind it (one blurred
 * layer, never three).
 */
function Arc({
  value,
  radius,
  width,
  color,
  dimmed,
  smear,
  animated,
}: {
  value: number;
  radius: number;
  width: number;
  color: string;
  dimmed: boolean;
  smear: boolean;
  animated: boolean;
}) {
  const circumference = 2 * Math.PI * radius;
  const sweep = useMotionValue(value);
  // Read through a ref so the transform never captures a stale flag
  // (a new closure would resubscribe the transform on every selection).
  const smearRef = useRef(smear);
  smearRef.current = smear;

  useEffect(() => {
    if (!animated) {
      sweep.set(value);
      return;
    }
    const controls = animate(sweep, value, springSoft);
    return () => controls.stop();
  }, [animated, sweep, value]);

  const offset = useTransform(sweep, (v) => circumference * (1 - v / 100));
  const velocity = useVelocity(sweep);
  const filter = useTransform(velocity, (v) => {
    if (!smearRef.current) return 'none';
    // Percentage points per second → px, capped so a horizon change smears
    // and a benchmark nudge does not.
    const px = Math.min(5, Math.abs(v) / 45);
    return px < 0.4 ? 'none' : `blur(${px.toFixed(2)}px)`;
  });

  return (
    <g>
      <circle
        cx="100"
        cy="100"
        r={radius}
        fill="none"
        stroke="currentColor"
        className="text-line"
        strokeWidth={width}
      />
      <motion.circle
        cx="100"
        cy="100"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={circumference}
        style={{ strokeDashoffset: offset, filter }}
        initial={false}
        animate={{ opacity: dimmed ? 0.42 : 1 }}
        transition={animated ? springSoft : { duration: 0 }}
        transform="rotate(-90 100 100)"
      />
    </g>
  );
}

function Disc({
  instrument,
  horizon,
  active,
  onSelect,
}: {
  instrument: Instrument;
  horizon: Horizon;
  active: Benchmark;
  onSelect: (benchmark: Benchmark) => void;
}) {
  const budget = useMotionBudget();
  const ring = instrument.rings.find((r) => r.benchmark === active);
  const retained = ring?.retained[horizon] ?? 0;

  return (
    <div className="relative mx-auto w-full max-w-[248px]">
      <svg
        viewBox="0 0 200 200"
        className="h-auto w-full"
        role="img"
        aria-label={`${instrument.flag} ${instrument.code}: ${Math.round(retained)}% of buying power kept against ${BENCHMARK_LABEL[active]} over ${HORIZON_LABEL[horizon]}`}
      >
        {RING_SPEC.map(({ benchmark, radius, width }) => (
          <Arc
            key={benchmark}
            value={instrument.rings.find((r) => r.benchmark === benchmark)?.retained[horizon] ?? 0}
            radius={radius}
            width={width}
            color={BENCHMARK_COLORS[benchmark]}
            dimmed={benchmark !== active}
            smear={budget.velocityBlur && benchmark === active}
            animated={budget.motion}
          />
        ))}
        {/* The arcs are one object; the legend rows below are the
            accessible controls, so the disc itself stays out of the tab
            order and only answers pointer taps. */}
        {RING_SPEC.map(({ benchmark, radius, width }) => (
          <circle
            key={`hit-${benchmark}`}
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="transparent"
            strokeWidth={width + 8}
            className="cursor-pointer"
            onClick={() => onSelect(benchmark)}
          />
        ))}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span aria-hidden="true" className="text-lg leading-none">
          {instrument.flag}
        </span>
        <span className="mt-1 text-4xl font-bold tabular-nums text-ink">
          {Math.round(retained)}%
        </span>
        <span className="mt-0.5 max-w-[92px] text-center text-3xs leading-tight text-ink-muted">
          kept vs {BENCHMARK_LABEL[active]}
        </span>
      </div>
    </div>
  );
}

function Segmented({
  value,
  onChange,
}: {
  value: Horizon;
  onChange: (horizon: Horizon) => void;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <div
      role="group"
      aria-label="Time horizon"
      className="flex items-center justify-center gap-1"
    >
      {HORIZONS.map((h) => (
        <motion.button
          key={h}
          type="button"
          aria-pressed={value === h}
          onClick={() => {
            haptics.tap();
            onChange(h);
          }}
          whileTap={reducedMotion ? undefined : press}
          transition={springPress}
          className={`min-h-tap min-w-tap rounded-full px-3 text-xs font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
            value === h
              ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
          }`}
        >
          {HORIZON_LABEL[h]}
        </motion.button>
      ))}
    </div>
  );
}

/** L2 — everything the disc cannot say without becoming a wall of text. */
function Record({ instrument }: { instrument: Instrument }) {
  return (
    <div className="space-y-5 pb-2">
      {instrument.facts.length > 0 && (
        <section>
          <h3 className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
            The record
          </h3>
          <ol className="mt-2 space-y-3">
            {instrument.facts.map((fact) => (
              <li key={fact.id} className="border-l-2 border-line pl-3">
                <p className="text-2xs font-semibold text-ink-muted">
                  {fact.dateLabel} · {fact.ageLabel}
                </p>
                <p className="text-sm font-semibold text-ink">{fact.title}</p>
                <p className="mt-0.5 text-xs text-ink-muted">{fact.detail}</p>
                <p className="mt-1 text-3xs text-ink-subtle">
                  {fact.source} · checked {fact.asOf}
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {instrument.provenance && (
        <section>
          <h3 className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
            The token behind it
          </h3>
          <p className="mt-1 text-sm font-semibold text-ink">
            {instrument.token} — {instrument.provenance.phrase}
          </p>
          <dl className="mt-2 space-y-1.5 text-xs">
            <div>
              <dt className="text-ink-subtle">Backing</dt>
              <dd className="text-ink-muted">{instrument.provenance.backing}</dd>
            </div>
            <div>
              <dt className="text-ink-subtle">Keys</dt>
              <dd className="text-ink-muted">{instrument.provenance.keys}</dd>
            </div>
          </dl>
          <p className="mt-1.5 text-3xs text-ink-subtle">
            {instrument.provenance.sources[0]?.label ?? 'Curated provenance'} · checked{' '}
            {instrument.provenance.asOf}
          </p>
        </section>
      )}

      {instrument.stamps.length > 0 && instrument.token && (
        <section>
          <h3 className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
            Keep a fact
          </h3>
          <ul className="mt-2 space-y-1.5">
            {instrument.stamps.slice(0, 3).map((stamp) => (
              <li key={stamp.id}>
                <RouteLink
                  href={`/postcard/${instrument.token}/USDm?s=${encodeURIComponent(stamp.id)}&m=watching`}
                  className="flex min-h-tap items-center gap-2 rounded-lg px-1 text-left text-xs text-ink-muted hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <span aria-hidden="true" className="text-sm">
                    {stamp.glyph}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{stamp.line}</span>
                  <span className="text-3xs text-ink-subtle">{stamp.dateLabel}</span>
                </RouteLink>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-3xs text-ink-subtle">
            Seals are curated facts with a named source — never your own words.
          </p>
        </section>
      )}
    </div>
  );
}

export function CurrencyInstrument({ instrument }: { instrument: Instrument }) {
  const [horizon, setHorizon] = useState<Horizon>('5yr');
  const [active, setActive] = useState<Benchmark>('USD');
  const [inspecting, setInspecting] = useState(false);
  const country = useGeoCountry();
  const promoDenied = featureDenied('thesis', country);
  const reducedMotion = !useMotionBudget().motion;

  const whatIf = instrument.whatIf[horizon];
  const ring = instrument.rings.find((r) => r.benchmark === active);
  const lost = Math.round(ring?.lost[horizon] ?? 0);

  // The goods sentence must name where the savings were held — otherwise it
  // reads as if local savings bought MORE, which is the opposite claim.
  const reading = whatIf?.goods
    ? `Savings that buy ${whatIf.goods.kept} ${whatIf.goods.unit} today would have bought about `
    : `Kept in ${instrument.code} since ${whatIf?.startYear ?? ''}, buying power against the dollar sits at `;

  const select = (benchmark: Benchmark) => {
    haptics.tap();
    setActive(benchmark);
    setInspecting(true);
  };

  return (
    <InstrumentShell
      inspector={
        <InspectorSheet
          selectedId={inspecting ? active : null}
          onClose={() => setInspecting(false)}
          title={`${instrument.flag} ${instrument.code} vs ${BENCHMARK_LABEL[active]}`}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {HORIZONS.map((h) => (
                <div key={h} className="rounded-lg bg-gray-50 px-2 py-1.5 text-center dark:bg-gray-800">
                  <p className="text-3xs text-ink-subtle">{HORIZON_LABEL[h]}</p>
                  <p className="text-sm font-bold tabular-nums text-ink">
                    {Math.round(ring?.retained[h] ?? 0)}%
                  </p>
                  <p className="text-3xs text-ink-muted">
                    {Math.round(ring?.lost[h] ?? 0)} pts lost
                  </p>
                </div>
              ))}
            </div>
            <Record instrument={instrument} />
          </div>
        </InspectorSheet>
      }
      inspectorOpen={inspecting}
      object={
        <div className="instrument-composition">
          <div className="instrument-artifact">
            <Disc
              instrument={instrument}
              horizon={horizon}
              active={active}
              onSelect={select}
            />
          </div>

          <div className="instrument-reading mt-4 sm:mt-0">
            {instrument.epithet && (
              <p className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                {instrument.epithet}
              </p>
            )}
            <p className="mt-1 text-base font-semibold leading-snug text-ink">
              {whatIf ? (
                <>
                  {reading}
                  <TweenedLine
                    value={whatIf.goods ? whatIf.goods.moved : whatIf.retainedPct}
                    format={(n) =>
                      whatIf.goods ? (Math.round(n * 10) / 10).toString() : `${Math.round(n)}%`
                    }
                    suffix={whatIf.goods ? ` ${whatIf.goods.unit}` : '.'}
                  />
                  {whatIf.goods ? ', had the savings been held in dollars.' : null}
                </>
              ) : (
                <>
                  {instrument.name} roughly held level against the dollar over{' '}
                  {HORIZON_LABEL[horizon]}.
                </>
              )}
            </p>
            <p className="mt-1.5 text-2xs text-ink-muted">
              {whatIf
                ? `${HORIZON_LABEL[horizon]} · from ${whatIf.startYear} · curated figures, not a forecast`
                : 'Curated figures, not a forecast'}
            </p>

            {instrument.token && !promoDenied && (
              <RouteLink
                href={`/?tab=exchange&from=${instrument.token}&to=USDm&src=currency`}
                className="mt-3 inline-flex min-h-tap items-center rounded-full bg-action-fill px-4 text-xs font-bold text-white transition-colors hover:bg-action-fill-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Weigh this on Exchange
              </RouteLink>
            )}
          </div>

          <div className="instrument-controls mt-4 space-y-2">
            <Segmented value={horizon} onChange={setHorizon} />
            <div className="space-y-1">
              {instrument.rings.map((r) => {
                const isActive = r.benchmark === active;
                return (
                  <button
                    key={r.benchmark}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => select(r.benchmark)}
                    className={`flex min-h-tap w-full items-center gap-2 rounded-lg px-2 text-left transition-colors ${
                      isActive
                        ? 'bg-gray-50 dark:bg-gray-800'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: BENCHMARK_COLORS[r.benchmark] }}
                    />
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">
                      {BENCHMARK_LABEL[r.benchmark]}
                    </span>
                    <motion.span
                      key={`${r.benchmark}-${horizon}`}
                      initial={reducedMotion ? false : { opacity: 0.4, y: 2 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={reducedMotion ? { duration: 0 } : springSoft}
                      className="text-xs font-bold tabular-nums text-ink-muted"
                    >
                      {Math.round(r.retained[horizon])}%
                    </motion.span>
                    <span className="text-3xs tabular-nums text-ink-subtle">
                      −{Math.round(r.lost[horizon])} pts
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      }
      status={
        <p className="text-3xs leading-relaxed text-ink-subtle">
          {instrument.flag} {instrument.countryName} · curated readings reviewed{' '}
          {instrument.asOfLabel}
          {instrument.stale
            ? ' · past its 90-day review window, so treat it as historical'
            : ` · ${instrument.ageDays} days old, re-verified every 90 days`}
          {instrument.watch && !instrument.stale ? ` · next: ${instrument.watch.title}, ${instrument.watch.dateLabel}` : ''}
          . Directionally accurate, not live FX, not investment advice.
        </p>
      }
    />
  );
}

export default CurrencyInstrument;
