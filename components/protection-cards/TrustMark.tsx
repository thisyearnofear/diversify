/**
 * TrustMark — the "this is verifiable" footer mark.
 *
 * Small shield-shaped glyph tinted with the archetype accent. Pairs with
 * the DIVERSIFI wordmark in the card footer to signal that the plan is
 * recorded on-chain (the verifiable AI trust surface described in
 * docs/product.md §8).
 *
 * Pure CSS-drawn — no SVG, no font glyphs — so it round-trips through
 * satori 0.26 reliably. Avoids the tofu-box risk we hit with ⚽ and ✦
 * during the SportWarren build.
 */

import React from 'react';
import { TOKENS, alpha } from './tokens';

export interface TrustMarkProps {
  size?: number;
  color: string;
}

export function TrustMark({ size = 18, color }: TrustMarkProps) {
  const inner = size * 0.45;
  const innerOffset = (size - inner) / 2;

  return (
    <div
      style={{
        display: 'flex',
        position: 'relative',
        width: size,
        height: size,
        borderRadius: size / 2,
        background: alpha(color, 0.22),
        border: `1.5px solid ${alpha(color, 0.85)}`,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          width: inner,
          height: inner,
          borderRadius: inner / 2,
          background: color,
          position: 'absolute',
          top: innerOffset,
          left: innerOffset,
        }}
      />
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          inset: -3,
          borderRadius: (size + 6) / 2,
          border: `1px solid ${alpha(TOKENS.foreground, 0.08)}`,
        }}
      />
    </div>
  );
}
