/**
 * Coin + FloatingCoins — the stablecoin motif system.
 *
 * `Coin` is a self-contained SVG coin: radial-gradient face, embossed
 * inner ring, glossy highlight, and a stamped currency glyph. Pass any
 * accent color and the light/dark facets are derived automatically, so
 * archetype-tinted coins stay on-palette. Deliberately no mascot-like
 * face — this is a finance app, not a rewards app, so the motif reads
 * as a minted medallion, not a character.
 *
 * `FloatingCoins` scatters a deterministic field of drifting coins for
 * ambient backdrops. Deterministic layout keeps SSR hydration safe;
 * the drift animation lives in globals.css (.coin-float) and is
 * disabled under prefers-reduced-motion. Purely decorative:
 * pointer-events-none + aria-hidden.
 */

import React, { useId } from 'react';

/** Linear-interpolate two hex colors. t=0 → a, t=1 → b. */
function mix(hexA: string, hexB: string, t: number): string {
  const a = parseInt(hexA.replace('#', ''), 16);
  const b = parseInt(hexB.replace('#', ''), 16);
  const ch = (sa: number, sb: number) => Math.round(sa + (sb - sa) * t);
  const r = ch((a >> 16) & 255, (b >> 16) & 255);
  const g = ch((a >> 8) & 255, (b >> 8) & 255);
  const bl = ch(a & 255, b & 255);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
}

const GOLD = '#f59e0b';

export interface CoinProps {
  size?: number | string;
  /** Currency glyph (or step number) stamped on the face. */
  symbol?: string;
  /** Base color of the coin; facets are derived. Defaults to warm gold. */
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function Coin({
  size = 48,
  symbol = '$',
  color = GOLD,
  className = '',
  style,
}: CoinProps) {
  const gradId = useId();
  const light = mix(color, '#ffffff', 0.55);
  const dark = mix(color, '#000000', 0.35);
  const ink = mix(color, '#000000', 0.55);

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={gradId} cx="35%" cy="30%" r="85%">
          <stop offset="0%" stopColor={light} />
          <stop offset="55%" stopColor={color} />
          <stop offset="100%" stopColor={dark} />
        </radialGradient>
      </defs>
      {/* Face */}
      <circle cx="32" cy="32" r="30" fill={`url(#${gradId})`} stroke={dark} strokeWidth="2" />
      {/* Embossed inner ring */}
      <circle cx="32" cy="32" r="23" fill="none" stroke={light} strokeWidth="2" opacity="0.7" />
      {/* Glossy highlight */}
      <ellipse
        cx="23"
        cy="17"
        rx="10"
        ry="4.5"
        fill="#ffffff"
        opacity="0.35"
        transform="rotate(-24 23 17)"
      />
      <text
        x="32"
        y="33.5"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={symbol.length > 1 ? 18 : 26}
        fontWeight={800}
        fill={ink}
      >
        {symbol}
      </text>
    </svg>
  );
}

interface FloatSpec {
  left: string;
  top: string;
  size: number;
  symbol: string;
  duration: number;
  delay: number;
  opacity: number;
  blur?: number;
  /** Coins marked tinted take the `accent` color when one is provided. */
  tinted?: boolean;
}

// Full-screen field behind the onboarding modal. Blurred coins read as
// depth-of-field; positions hug the edges so the dialog stays clear.
const BACKDROP_COINS: FloatSpec[] = [
  { left: '5%', top: '12%', size: 44, symbol: '$', duration: 11, delay: 0, opacity: 0.5 },
  { left: '86%', top: '8%', size: 30, symbol: '€', duration: 9, delay: 1.2, opacity: 0.42, blur: 1, tinted: true },
  { left: '10%', top: '70%', size: 58, symbol: '$', duration: 13, delay: 0.6, opacity: 0.55 },
  { left: '80%', top: '74%', size: 38, symbol: '₱', duration: 10, delay: 2, opacity: 0.45, tinted: true },
  { left: '46%', top: '88%', size: 26, symbol: '¢', duration: 8, delay: 0.3, opacity: 0.35, blur: 2 },
  { left: '92%', top: '44%', size: 48, symbol: '$', duration: 12, delay: 1.8, opacity: 0.4, blur: 1 },
  { left: '2%', top: '42%', size: 22, symbol: '€', duration: 7.5, delay: 2.6, opacity: 0.3, blur: 2, tinted: true },
  { left: '64%', top: '3%', size: 20, symbol: '¥', duration: 8.5, delay: 3.2, opacity: 0.32, blur: 2 },
  { left: '28%', top: '5%', size: 34, symbol: '£', duration: 10.5, delay: 1.5, opacity: 0.45, tinted: true },
  { left: '35%', top: '76%', size: 18, symbol: '$', duration: 7, delay: 4, opacity: 0.28, blur: 3 },
];

// Sparse edge-hugging field inside the onboarding panel — low opacity so
// copy stays legible.
const PANEL_COINS: FloatSpec[] = [
  { left: '2%', top: '16%', size: 32, symbol: '$', duration: 10, delay: 0.4, opacity: 0.35 },
  { left: '88%', top: '10%', size: 24, symbol: '€', duration: 8.5, delay: 1.6, opacity: 0.3, blur: 1, tinted: true },
  { left: '90%', top: '52%', size: 38, symbol: '₹', duration: 12, delay: 0.8, opacity: 0.4 },
  { left: '3%', top: '66%', size: 22, symbol: '₱', duration: 9, delay: 2.4, opacity: 0.28, blur: 1, tinted: true },
  { left: '84%', top: '88%', size: 28, symbol: '¢', duration: 10.5, delay: 1.1, opacity: 0.32 },
  { left: '8%', top: '92%', size: 18, symbol: '€', duration: 7.5, delay: 3, opacity: 0.25, blur: 2 },
];

export interface FloatingCoinsProps {
  variant?: 'backdrop' | 'panel';
  /** Archetype accent — tints a few coins to match the chosen philosophy. */
  accent?: string | null;
  className?: string;
}

export function FloatingCoins({ variant = 'panel', accent = null, className = '' }: FloatingCoinsProps) {
  const specs = variant === 'backdrop' ? BACKDROP_COINS : PANEL_COINS;
  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      {specs.map((c, i) => (
        <div
          key={i}
          className="absolute coin-float"
          style={{
            left: c.left,
            top: c.top,
            opacity: c.opacity,
            filter: c.blur ? `blur(${c.blur}px)` : undefined,
            '--coin-duration': `${c.duration}s`,
            '--coin-delay': `${c.delay}s`,
          } as React.CSSProperties}
        >
          <Coin
            size={c.size}
            symbol={c.symbol}
            color={accent && c.tinted ? accent : GOLD}
          />
        </div>
      ))}
    </div>
  );
}
