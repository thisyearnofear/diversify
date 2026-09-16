/**
 * CorridorContext — the two currencies behind a swap pair and what they
 * mean to each other.
 *
 * CorridorLine sits under the ticket as a quiet status line (tappable →
 * the pair inspector). CorridorDetail is the inspector body: each side's
 * track and latest risk event. Both render nothing when the pair has no
 * fiat meaning — absence is honest.
 */
import React from 'react';
import { corridorFor, type CorridorSide } from '@/lib/corridor-context';

export function CorridorLine({
  fromToken,
  toToken,
  onInspect,
}: {
  fromToken: string;
  toToken: string;
  onInspect?: () => void;
}) {
  const corridor = corridorFor(fromToken, toToken);
  if (!corridor) return null;
  if (!onInspect) {
    return (
      <p data-testid="corridor-line" className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
        {corridor.line}
      </p>
    );
  }
  return (
    <button
      type="button"
      data-testid="corridor-line"
      onClick={onInspect}
      className="mt-1 text-left text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 min-h-[32px] transition-colors"
    >
      {corridor.line} <span className="font-semibold text-blue-600 dark:text-blue-400">→</span>
    </button>
  );
}

function SideTrack({ side }: { side: CorridorSide }) {
  if (!side.entry) {
    return (
      <div>
        <p className="text-xs font-semibold text-gray-900 dark:text-white">
          {side.flag} {side.name}
        </p>
        <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
          The benchmark everything here is measured against.
        </p>
      </div>
    );
  }
  const e = side.entry;
  const latest = e.riskEvents[e.riskEvents.length - 1];
  const isAnchor = e.depreciation.vsUSD['5yr'] === 0;
  return (
    <div>
      <p className="text-xs font-semibold text-gray-900 dark:text-white">
        {side.flag} {e.countryName} — {e.code}
      </p>
      <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
        {isAnchor
          ? `The anchor — still ${e.depreciation.vsXAU['5yr']}% vs gold (5y)`
          : `${e.depreciation.vsUSD['5yr']}% vs USD · ${e.depreciation.vsXAU['5yr']}% vs gold (5y)`}
      </p>
      {latest && (
        <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">
          {latest.year}: {latest.event} — {latest.impact}
        </p>
      )}
      {e.goodsAnchor && (
        <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
          Risk is priced in {e.goodsAnchor.unit} locally.
        </p>
      )}
    </div>
  );
}

export function CorridorDetail({
  fromToken,
  toToken,
}: {
  fromToken: string;
  toToken: string;
}) {
  const corridor = corridorFor(fromToken, toToken);
  if (!corridor) return null;
  return (
    <div data-testid="corridor-detail" className="mt-4 border-t border-gray-100 dark:border-gray-800 pt-3 space-y-3">
      <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
        {corridor.line}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <SideTrack side={corridor.from} />
        <SideTrack side={corridor.to} />
      </div>
    </div>
  );
}
