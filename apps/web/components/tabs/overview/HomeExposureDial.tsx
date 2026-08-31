/**
 * HomeExposureDial — the Home tab's Tier-1 marquee.
 *
 * The hero's one expressive object: the user's savings as an interactive
 * regional dial. Tap a slice (or its legend row) to see how concentrated
 * that region is and jump into Shield or Guardian with the region in focus.
 *
 * Selection is controlled — ConnectedOverview owns the focus state so the
 * rest of the page can subscribe.
 */
import React, { useMemo } from 'react';
import AllocationRing, { type RingSlice } from '@/components/shared/AllocationRing';

interface Props {
  regionData: Array<{ region: string; value: number; color: string }>;
  totalValue: number;
  selectedRegion: string | null;
  onSelectRegion: (region: string | null) => void;
}

export function HomeExposureDial({
  regionData,
  totalValue,
  selectedRegion,
  onSelectRegion,
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
  const selectedPct =
    selected && totalValue > 0 ? (selected.value / totalValue) * 100 : 0;

  const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;
  const toggle = (region: string) =>
    onSelectRegion(selectedRegion === region ? null : region);

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
        Where your savings sit
      </h3>
      <div className="flex justify-center mt-2">
        <AllocationRing
          slices={slices}
          selectedId={selectedRegion}
          onSelect={toggle}
          size={210}
          thickness={24}
        >
          {selected ? (
            <>
              <span className="text-sm font-bold text-gray-900 dark:text-white max-w-[120px] truncate">
                {selected.region}
              </span>
              <span className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">
                {fmt(selected.value)}
              </span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                {Math.round(selectedPct)}% of savings
              </span>
            </>
          ) : (
            <>
              <span className="text-2xl font-black text-gray-900 dark:text-white tabular-nums">
                {fmt(totalValue)}
              </span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                {regionData.length} region{regionData.length !== 1 ? 's' : ''} · tap a slice
              </span>
            </>
          )}
        </AllocationRing>
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
