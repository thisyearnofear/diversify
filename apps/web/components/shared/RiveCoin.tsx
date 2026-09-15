'use client';

/**
 * RiveCoin — the Rive-rendered mint coin (drop, flip, land, shine).
 *
 * Scoped exception per design-language §5: Rive owns the inside of this
 * self-contained object; framer-motion still owns all UI motion. Reduced
 * motion and pre-hydration render the static `Coin` primitive instead —
 * the canvas is never mounted, so the WASM runtime is never fetched.
 */

import React from 'react';
import dynamic from 'next/dynamic';
import { useReducedMotion } from 'framer-motion';
import { Coin } from './FloatingCoins';
import { STATUS_COLORS } from './palette';

const RiveCoinCanvas = dynamic(() => import('./RiveCoinCanvas'), { ssr: false });

interface RiveCoinProps {
  /** Canvas edge in px; the coin face occupies ~68% of it. */
  size?: number;
  /** Glyph on the static fallback coin. */
  symbol?: string;
  /**
   * Base accent (hex). On the Rive path it binds into the face gradient;
   * on the reduced-motion path it tints the static Coin.
   */
  color?: string;
}

export default function RiveCoin({ size = 120, symbol = '✓', color = STATUS_COLORS.good }: RiveCoinProps) {
  const reducedMotion = useReducedMotion();
  if (reducedMotion) {
    // Coin's size is the face diameter; the Rive canvas is ~32% larger.
    return <Coin size={Math.round(size * 0.68)} symbol={symbol} color={color} />;
  }
  return <RiveCoinCanvas size={size} color={color} />;
}
