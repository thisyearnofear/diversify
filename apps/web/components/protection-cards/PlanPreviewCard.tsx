/**
 * PlanPreviewCard — compact read-only allocation preview for the
 * onboarding phase-3 stage. Currency-localized: amounts use the
 * visitor's own currency (same language as the phase-2 stage).
 *
 * Tapping a chip morphs the card's header into the selected currency's
 * own object — icon, share, region, why, one risk line — with the
 * ribbon dimmed around it. Chips stay mounted so switching is one tap;
 * the InspectorSheet is gone (it hid the source object behind a generic
 * header and three paragraphs). Preview-only is stated, never implied.
 */
import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { resolvePlan, type Exposure, type PlanPreview } from './plan-preview';
import { ARCHETYPES } from './tokens';
import { TokenIcon } from '../shared/TokenIcon';
import { displayToken } from '@/lib/plan-legs';
import { useDismissibleLayer } from '@/hooks/use-dismissible-layer';
import { controlMotion, reveal } from '@/lib/motion-tokens';
import { haptics } from '@/lib/haptics';

export interface PlanPreviewCardProps {
  preview: PlanPreview;
  className?: string;
  /** Currency prefix for the amounts (e.g. "$", "NGN ", "KES "). Defaults to USD. */
  currencyPrefix?: string;
}

const EXPOSURE_NAMES: Partial<Record<Exposure, string>> = {
  KES: 'Kenyan shilling',
  USD: 'US dollar',
  EUR: 'Euro',
  XAU: 'Gold',
  BRL: 'Brazilian real',
  COP: 'Colombian peso',
  PHP: 'Philippine peso',
};

function riskLineFor(exposure: Exposure | null): string {
  if (exposure === 'XAU') return 'Gold prices, issuer reliability and liquidity can affect this holding.';
  if (exposure === 'USD' || exposure === 'EUR') return 'Peg, issuer and liquidity risks remain.';
  return 'Currency, issuer and liquidity risks remain.';
}

export function PlanPreviewCard({ preview, className = '', currencyPrefix = '$' }: PlanPreviewCardProps) {
  const archetype = ARCHETYPES[preview.archetypeId];
  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  const reducedMotion = useReducedMotion();
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  useEffect(() => {
    setSelectedToken(null);
    setShowAll(false);
  }, [preview.archetypeId]);
  const legs = resolvePlan({ strategy: preview.archetypeId }).legs;
  const labelFor = (token: string) => {
    const leg = legs.find((item) => item.token === token);
    return leg ? `${(leg.exposure && EXPOSURE_NAMES[leg.exposure]) ?? leg.label ?? displayToken(token)} · ${leg.region}` : displayToken(token);
  };
  /** Currency name only — the heading; country lives in the meta line. */
  const nameFor = (token: string) => {
    const leg = legs.find((item) => item.token === token);
    return (leg?.exposure && EXPOSURE_NAMES[leg.exposure]) ?? leg?.label ?? displayToken(token);
  };
  const selectedSlice = preview.slices.find((s) => s.token === selectedToken) ?? null;
  const selectedLeg = legs.find((leg) => leg.token === selectedToken) ?? null;

  const clearSelection = () => {
    const token = selectedToken;
    setSelectedToken(null);
    if (token) chipRefs.current[token]?.focus();
  };
  useDismissibleLayer(Boolean(selectedToken), clearSelection);

  // Top-N aggregation: this moment needs the *flavor* of the plan, not
  // the ledger — leading four chips, the tail named by count.
  const MAX_CHIPS = 4;
  const visible = showAll ? preview.slices : preview.slices.slice(0, MAX_CHIPS);
  const hiddenCount = preview.slices.length - visible.length;

  return (
    <div
      className={`rounded-xl border border-slate-600 px-3 py-2.5 text-left bg-slate-900 text-slate-100 ${className}`}
    >
      {preview.slices.length > 0 ? (
        <>
          {/* Header area — rest state names the example; selecting a chip
              morphs it into the currency's own object. */}
          <AnimatePresence mode="wait" initial={false}>
            {selectedToken && selectedSlice ? (
              <motion.div
                key={selectedToken}
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                transition={reducedMotion ? { duration: 0 } : reveal}
              >
                <motion.button
                  type="button"
                  onClick={clearSelection}
                  {...controlMotion(Boolean(reducedMotion))}
                  className="min-h-tap text-xs font-semibold text-slate-300 hover:text-white rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400"
                >
                  ← Allocation
                </motion.button>
                <div className="flex items-center justify-center gap-4 py-3">
                  <TokenIcon symbol={displayToken(selectedToken)} size={64} />
                  <div>
                    <p className="text-4xl font-black tabular-nums text-white">{selectedSlice.percent}%</p>
                    <p className="text-xs text-slate-300">of this allocation</p>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-center text-white">{nameFor(selectedToken)}</h3>
                <p className="text-center text-xs text-slate-300">
                  {selectedLeg?.region} · {displayToken(selectedToken)} · Preview only
                </p>
                {selectedLeg?.why && (
                  <p className="mt-3 text-center text-sm text-slate-200">{selectedLeg.why}</p>
                )}
                <p className="mt-1 text-center text-xs text-slate-400">
                  {riskLineFor(selectedLeg?.exposure ?? null)}
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="rest"
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                transition={reducedMotion ? { duration: 0 } : reveal}
              >
                <p className="text-sm text-slate-100 mb-1">
                  Example: <strong>{preview.shieldPercent}%</strong> of{' '}
                  <strong className="text-white">
                    {currencyPrefix}{fmt(preview.savingsAmount)}
                  </strong>{' '}
                  allocated
                </p>
                <p className="text-xs text-slate-300 mb-2">Shares within that allocation</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Proportional ribbon — presentational only (aria-hidden); the
              chips below stay the single interactive legend. On selection
              the chosen share keeps its accent, the rest dim. */}
          <div className="mb-2 flex h-6 gap-1 items-stretch" aria-hidden="true">
            {preview.slices.map((slice, i) => (
              <span
                key={slice.token}
                className="min-w-0 rounded-md transition-opacity duration-150"
                style={{
                  flexGrow: slice.percent,
                  flexBasis: 0,
                  backgroundColor: archetype.accent,
                  opacity: selectedToken
                    ? slice.token === selectedToken ? 1 : 0.25
                    : [1, 0.75, 0.55][i % 3],
                }}
              />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {visible.map((slice) => {
              const isSelected = slice.token === selectedToken;
              return (
                <motion.button
                  type="button"
                  key={slice.token}
                  ref={(el) => { chipRefs.current[slice.token] = el; }}
                  onClick={() => {
                    if (slice.token === selectedToken) return;
                    haptics.tap();
                    setSelectedToken(slice.token);
                  }}
                  aria-label={`Inspect ${labelFor(slice.token)}, ${slice.percent}% of the allocation`}
                  aria-pressed={isSelected}
                  {...controlMotion(Boolean(reducedMotion))}
                  className={`min-h-tap flex flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2 text-xs font-semibold text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 ${
                    isSelected ? 'bg-blue-700' : 'bg-slate-800'
                  }`}
                  style={{ borderColor: isSelected ? '#93c5fd' : `${archetype.accent}4d` }}
                >
                  <span className="inline-flex items-center gap-1">
                    <TokenIcon symbol={displayToken(slice.token)} size={16} />
                    {legs.find((leg) => leg.token === slice.token)?.exposure ?? displayToken(slice.token)}
                  </span>
                  <span className="tabular-nums text-slate-100">
                    {slice.percent}%
                  </span>
                </motion.button>
              );
            })}
            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="min-h-tap inline-flex items-center px-2.5 py-1 text-sm font-semibold text-slate-300"
              >
                +{hiddenCount} more
              </button>
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-300">
          Set your own allocation in Shield. No wallet needed to explore.
        </p>
      )}
    </div>
  );
}
