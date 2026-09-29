/**
 * StampSeal — a circular fact seal: glyph + one big value in the centre,
 * SOURCE · DATE riding the rim on an SVG textPath, the fact's line under
 * the seal. Every stamp is a curated, dated, cited fact (lib/stamps.ts) —
 * the seal never carries user text.
 *
 * A real <button>: aria-pressed toggles it on/off a postcard and the
 * aria-label reads the whole fact including source and date.
 */
import React, { useId } from 'react';
import type { Stamp } from '@/lib/stamps';

interface StampSealProps {
  stamp: Stamp;
  /** tokenColor of the side the fact is about. */
  color: string;
  /** Diameter in px — ~72 in the tray, ~56 pressed on the postcard. */
  size?: number;
  pressed?: boolean;
  onToggle?: () => void;
  showLine?: boolean;
}

/** Deterministic press rotation, −8°..8° from the id — a stamped seal
 *  never lands machine-straight. */
export function stampRotation(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (h % 160) / 10 - 8;
}

export function StampSealFace({
  stamp,
  color,
  size = 72,
}: {
  stamp: Stamp;
  color: string;
  size?: number;
}) {
  const rimId = useId().replace(/:/g, '');
  // Rim text rides an arc inside the stroke. fontSize is in viewBox
  // units, so it scales with the seal — keep it at the 3xs floor.
  const rimFont = 7;
  const rim = `${stamp.source} · ${stamp.dateLabel}`.toUpperCase();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 72 72"
      aria-hidden="true"
      className="block shrink-0"
    >
      <circle cx="36" cy="36" r="34" fill="none" stroke={color} strokeWidth="2.5" />
      <circle cx="36" cy="36" r="27.5" fill="none" stroke={color} strokeWidth="0.75" opacity="0.45" />
      <defs>
        <path id={`rim-${rimId}`} d="M 36,36 m -30.5,0 a 30.5,30.5 0 1,1 61,0 a 30.5,30.5 0 1,1 -61,0" />
      </defs>
      <text fontSize={rimFont} fill={color} letterSpacing="0.8" fontWeight={600}>
        <textPath href={`#rim-${rimId}`}>{rim}</textPath>
      </text>
      <text x="36" y="31" textAnchor="middle" fontSize="15">
        {stamp.glyph}
      </text>
      <text
        x="36"
        y="48"
        textAnchor="middle"
        fontSize="13"
        fontWeight={800}
        fill="currentColor"
        className="text-gray-900 dark:text-white"
      >
        {stamp.value}
      </text>
    </svg>
  );
}

export default function StampSeal({
  stamp,
  color,
  size = 72,
  pressed = false,
  onToggle,
  showLine = true,
}: StampSealProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={`${stamp.value} — ${stamp.line}. Source: ${stamp.source}, ${stamp.dateLabel}.`}
      onClick={onToggle}
      data-stamp-id={stamp.id}
      className="flex w-[76px] shrink-0 snap-start flex-col items-center gap-1 rounded-xl p-1 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-white/5"
    >
      <StampSealFace stamp={stamp} color={color} size={size} />
      {showLine && (
        <span className="line-clamp-2 max-w-[76px] text-center text-3xs leading-tight text-gray-500 dark:text-gray-400">
          {stamp.line}
        </span>
      )}
    </button>
  );
}
