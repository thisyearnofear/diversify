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
import { COIN_TINTS } from './palette';

function tintFor(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = (hash * 31 + label.charCodeAt(i)) | 0;
  }
  return COIN_TINTS[Math.abs(hash) % COIN_TINTS.length];
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

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {!src || errored ? (
      <Coin
        size={size}
        symbol={symbol.trim().charAt(0).toUpperCase()}
        color={tintFor(tokenLogoKey(symbol))}
        variant="asset"
        className="block"
      />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- tiny remote chip icon; next/image adds no value here
        <img
          src={src}
          width={size}
          height={size}
          alt=""
          loading="lazy"
          onError={() => setErrored(true)}
          className="rounded-full"
        />
      )}
    </span>
  );
}
