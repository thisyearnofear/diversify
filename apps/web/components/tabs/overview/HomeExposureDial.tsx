/**
 * HomeExposureDial — the Home tab's Tier-1 marquee.
 *
 * The hero's one expressive object: the user's savings as an interactive
 * regional dial. The hole is concentration (largest slice, or the selected
 * region) — not a second portfolio total. Tap a slice to inspect.
 *
 * Selection is controlled — ConnectedOverview owns the focus state so the
 * rest of the page can subscribe.
 */
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import AllocationRing, { type RingSlice } from '@/components/shared/AllocationRing';
import { useCountUp } from '@/hooks/use-count-up';
import { usePointerTilt } from '@/hooks/use-pointer-tilt';
import { TokenIcon } from '@/components/shared/TokenIcon';

interface Props {
  regionData: Array<{ region: string; value: number; color: string }>;
  totalValue: number;
  selectedRegion: string | null;
  onSelectRegion: (region: string | null) => void;
  /** Quiet sample-data mark. Does not compete with the hole number. */
  watermark?: string;
  /** Tokens sitting in each region — chips in the hole when that slice is selected. */
  tokensByRegion?: Record<string, string[]>;
  /** Regional inflation overlay for the selected hole. */
  inflationByRegion?: Record<string, number | null>;
  /** Visitor-currency risk line when the selected region is theirs. */
  selectedRiskHint?: string | null;
}

export function HomeExposureDial({
  regionData,
  totalValue,
  selectedRegion,
  onSelectRegion,
  watermark,
  tokensByRegion,
  inflationByRegion,
  selectedRiskHint,
}: Props) {
  const slices: RingSlice[] = useMemo(
    () =>
      regionData.map((r) => ({
        id: r.region,
        label: r.region,
        percent: totalValue > 0 ? (r.value / totalValue) * 100 : 0,
        color: r.color,
      })),
    [regionData, totalValue],
  );

  const selected = regionData.find((r) => r.region === selectedRegion) ?? null;
  const largest = useMemo(
    () =>
      regionData.reduce(
        (lead, r) => (r.value > lead.value ? r : lead),
        regionData[0] ?? { region: "", value: 0, color: "" },
      ),
    [regionData],
  );
  const selectedPct =
    selected && totalValue > 0 ? (selected.value / totalValue) * 100 : 0;
  const idlePct =
    totalValue > 0 && largest ? (largest.value / totalValue) * 100 : 0;
  const holePct = selected ? selectedPct : idlePct;
  const holeRegion = selected?.region ?? largest?.region ?? "";
  const selectedTokens = selected ? tokensByRegion?.[selected.region] ?? [] : [];
  const selectedInflation = selected ? inflationByRegion?.[selected.region] : undefined;
  const selectedHint = selected
    ? selectedRiskHint
      ?? (typeof selectedInflation === "number" ? `${selectedInflation.toFixed(1)}% inflation` : "of savings")
    : "largest region · tap a slice";

  const animatedHole = useCountUp(holePct, {
    format: (n) => `${Math.round(n)}%`,
  });
  const tilt = usePointerTilt(true);

  const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;
  const toggle = (region: string) =>
    onSelectRegion(selectedRegion === region ? null : region);

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
        Where your savings sit
      </h3>
      {watermark && (
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
          {watermark}
        </p>
      )}
      <div className="flex justify-center mt-2">
        <motion.div
          style={{ ...tilt.style, transformPerspective: 900 }}
          {...tilt.props}
        >
        <AllocationRing
          slices={slices}
          selectedId={selectedRegion}
          onSelect={toggle}
          size={210}
          thickness={24}
        >
          <>
            <span className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">
              <motion.span>{animatedHole}</motion.span>
            </span>
            <span className="text-sm font-bold text-gray-900 dark:text-white max-w-[120px] truncate">
              {holeRegion}
            </span>
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              {selectedHint}
            </span>
            {selectedTokens.length > 0 && (
              <span className="flex items-center justify-center gap-0.5 mt-0.5">
                {selectedTokens.slice(0, 4).map((symbol) => (
                  <TokenIcon key={symbol} symbol={symbol} size={14} />
                ))}
              </span>
            )}
          </>
        </AllocationRing>
        </motion.div>
      </div>

      {/* Legend — the same selection surface as the dial, in list form */}
      <div className="mt-3 divide-y divide-gray-100 dark:divide-white/[0.05]">
        {regionData.map((r) => {
          const pct = totalValue > 0 ? (r.value / totalValue) * 100 : 0;
          const isSelected = selectedRegion === r.region;
          return (
            <button
              key={r.region}
              type="button"
              onClick={() => toggle(r.region)}
              aria-pressed={isSelected}
              className={`w-full min-h-[44px] flex items-center gap-3 py-2.5 text-left rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 ${
                isSelected ? 'bg-gray-50 dark:bg-gray-700/40' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: r.color }}
              />
              <span className="flex-1 min-w-0 text-sm font-bold text-gray-900 dark:text-white truncate">
                {r.region}
              </span>
              <span className="text-sm font-black text-gray-900 dark:text-white tabular-nums">
                {Math.round(pct)}%
              </span>
              <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 tabular-nums w-20 text-right">
                {fmt(r.value)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
