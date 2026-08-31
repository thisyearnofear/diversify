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
  onProtect: (region: string) => void;
  onAskGuardian?: (region: string) => void;
}

export function HomeExposureDial({
  regionData,
  totalValue,
  selectedRegion,
  onSelectRegion,
  onProtect,
  onAskGuardian,
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
      <div className="flex justify-center">
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
              className={`w-full flex items-center gap-3 py-2.5 text-left rounded-lg transition-colors ${
                isSelected ? 'bg-white/70 dark:bg-gray-700/40' : 'hover:bg-white/60 dark:hover:bg-gray-700/30'
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

      {/* Selected-region detail — the one CTA lives here */}
      {selected && (
        <div className="mt-3 rounded-xl bg-white/85 dark:bg-gray-900/85 border border-gray-200/70 dark:border-white/[0.08] p-3 text-left backdrop-blur-sm">
          <p className="text-xs text-gray-700 dark:text-gray-200 mb-2">
            {selectedPct >= 50 ? (
              <>
                More than half your savings sit in <strong>{selected.region}</strong> —
                one region&apos;s currency risk carries most of your plan.
              </>
            ) : selectedPct >= 30 ? (
              <>
                <strong>{Math.round(selectedPct)}%</strong> of your savings sit in{' '}
                <strong>{selected.region}</strong> — meaningful exposure worth watching.
              </>
            ) : (
              <>
                A light <strong>{Math.round(selectedPct)}%</strong> of your savings sit in{' '}
                <strong>{selected.region}</strong>.
              </>
            )}
          </p>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => onProtect(selected.region)}
              className="min-h-[44px] w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 transition-colors"
            >
              Strengthen {selected.region} coverage in Shield
            </button>
            {onAskGuardian && (
              <button
                type="button"
                onClick={() => onAskGuardian(selected.region)}
                className="min-h-[44px] w-full rounded-xl text-xs font-semibold text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
              >
                Ask Guardian about my {selected.region} exposure →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
