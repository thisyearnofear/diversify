/**
 * TokenIcon — real token logo with a branded fallback.
 *
 * Resolves the symbol against the token-logo registry (Trust Wallet
 * assets, incl. Celo/Mento regional stablecoins). Anything unknown —
 * or any logo that fails to load — renders as the Coin motif in a
 * deterministic per-symbol color, so every asset chip gets an icon
 * and nothing ever shows a broken image.
 */

import React, { useState } from 'react';
import { Coin } from './FloatingCoins';
import { TOKEN_LOGOS, tokenLogoKey } from '../../constants/token-logos';

// Curated coin tints for fallback icons — warm, saturated, legible on
// both light and dark chip backgrounds.
const FALLBACK_TINTS = [
  '#f59e0b', // gold
  '#0d9488', // teal
  '#0284c7', // sky
  '#b91c1c', // cinnabar
  '#ea580c', // tangerine
  '#7c3aed', // violet
  '#be185d', // magenta
  '#059669', // emerald
];

function tintFor(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = (hash * 31 + label.charCodeAt(i)) | 0;
  }
  return FALLBACK_TINTS[Math.abs(hash) % FALLBACK_TINTS.length];
}

export interface TokenIconProps {
  /** Display label as it appears in the UI, e.g. "cUSD" or "USDC (Sharia)". */
  symbol: string;
  size?: number;
  className?: string;
}

export function TokenIcon({ symbol, size = 16, className = '' }: TokenIconProps) {
  const [errored, setErrored] = useState(false);
  const src = TOKEN_LOGOS[tokenLogoKey(symbol)];

  if (!src || errored) {
    return (
      <Coin
        size={size}
        symbol={symbol.trim().charAt(0).toUpperCase()}
        color={tintFor(tokenLogoKey(symbol))}
        className={`flex-shrink-0 ${className}`}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny remote chip icon; next/image adds no value here
    <img
      src={src}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      loading="lazy"
      onError={() => setErrored(true)}
      className={`rounded-full flex-shrink-0 ${className}`}
    />
  );
}
