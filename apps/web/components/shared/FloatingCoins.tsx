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
 *
 * `ShellCoinField` carries the motif into the app shell (post-onboarding).
 * It obeys design-language §5 — motion reveals/confirms, never idles — so
 * it settles ONCE on arrival and never drifts. See its doc comment below.
 */

import React, { useEffect, useId, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { springSoft, STAGGER_STEP_S } from '@/lib/motion-tokens';

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
  /** Assigns a visual job to the coin; compact roles deliberately remove
   * ornamental detail so hierarchy stays clear in dense UI. */
  variant?: 'ambient' | 'progress' | 'asset' | 'selection';
  /** Animate a specular shine band across the coin face. Off by default
   *  so the ambient drift field stays calm; `true` loops (hero moments);
   *  `"once"` is a single reveal sweep (waiting states). */
  shine?: boolean | "once";
  /** Shine loop period in seconds. */
  shineDuration?: number;
  /** Delay before the shine sweep starts (s) — coordinates the sweep with
   *  an entrance settle so the band crosses AFTER the coin lands. */
  shineDelay?: number;
}

export function Coin({
  size = 48,
  symbol = '$',
  color = GOLD,
  className = '',
  style,
  variant = 'selection',
  /** Animate the specular shine band across the coin face. Off by default
   *  so the ambient drift field stays calm; on for interactive/hero moments. */
  shine = false,
  /** Shine loop period in seconds. */
  shineDuration = 2.6,
  shineDelay = 0,
}: CoinProps) {
  const gradId = useId();
  const shineId = useId();
  const shineOn = Boolean(shine);
  const shineOnce = shine === "once";
  const light = mix(color, '#ffffff', 0.55);
  const dark = mix(color, '#000000', 0.35);
  const ink = mix(color, '#000000', 0.55);
  const compact = variant === 'progress' || variant === 'asset';
  const ambient = variant === 'ambient';

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
        {shineOn && !ambient && (
          <>
            {/* Specular shine band — a thin white wedge that travels left-to-right
                across the coin. The clip-path keeps it inside the coin's circle. */}
            <linearGradient id={shineId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="45%" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="0.85" />
              <stop offset="55%" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
            <clipPath id={`${shineId}-clip`}>
              <circle cx="32" cy="32" r={compact ? 27 : 30} />
            </clipPath>
          </>
        )}
      </defs>
      {/* Ambient coins keep the gradient + inner ring so they read as
          minted medallions, not as disabled UI tokens. Only the gloss
          ellipse is reserved for selection/hero moments. */}
      <circle
        cx="32"
        cy="32"
        r={compact ? 27 : 30}
        fill={`url(#${gradId})`}
        stroke={dark}
        strokeWidth={compact ? 1.5 : 2}
      />
      {!compact && (
        <circle
          cx="32"
          cy="32"
          r="23"
          fill="none"
          stroke={light}
          strokeWidth={ambient ? '1.2' : '2'}
          opacity={ambient ? 0.45 : 0.7}
        />
      )}
      {!compact && !ambient && (
        <ellipse cx="23" cy="17" rx="10" ry="4.5" fill="#ffffff" opacity="0.35" transform="rotate(-24 23 17)" />
      )}
      <text
        x="32"
        y="33.5"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={symbol.length > 1 ? (compact ? 16 : 18) : (compact ? 22 : 26)}
        fontWeight={800}
        fill={ink}
      >
        {symbol}
      </text>
      {/* Specular shine band — clipped to the coin circle, animated via CSS.
          The `<g>` carries the clip; the inner `<rect>` carries the gradient +
          animation. width=20 keeps the band thin. */}
      {shineOn && !ambient && (
        <g clipPath={`url(#${shineId}-clip)`} className={shineOnce ? "coin-shine-once" : "coin-shine"} style={{ ['--shine-duration' as string]: `${shineDuration}s`, ['--shine-delay' as string]: shineDelay ? `${shineDelay}s` : undefined } as React.CSSProperties}>
          <rect
            x="-30"
            y="0"
            width="20"
            height="64"
            fill={`url(#${shineId})`}
            transform="rotate(20 32 32)"
          />
        </g>
      )}
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

// Sparse edge-hugging field inside the onboarding panel. Opacity is
// tuned so the largest coins read as part of the scene (with the new
// ambient variant keeping its inner ring); smaller coins still recede so
// the dialog copy stays legible.
const PANEL_COINS: FloatSpec[] = [
  { left: '2%', top: '16%', size: 36, symbol: '$', duration: 10, delay: 0.4, opacity: 0.5 },
  { left: '88%', top: '10%', size: 28, symbol: '€', duration: 8.5, delay: 1.6, opacity: 0.45, tinted: true },
  { left: '90%', top: '52%', size: 42, symbol: '₹', duration: 12, delay: 0.8, opacity: 0.55 },
  { left: '3%', top: '66%', size: 24, symbol: '₱', duration: 9, delay: 2.4, opacity: 0.4, tinted: true },
  { left: '84%', top: '88%', size: 32, symbol: '¢', duration: 10.5, delay: 1.1, opacity: 0.42 },
  { left: '8%', top: '92%', size: 20, symbol: '€', duration: 7.5, delay: 3, opacity: 0.35, blur: 1, tinted: true },
];

export interface FloatingCoinsProps {
  variant?: 'backdrop' | 'panel';
  /** Archetype accent — tints a few coins to match the chosen philosophy. */
  accent?: string | null;
  className?: string;
}

export function FloatingCoins({ variant = 'panel', accent = null, className = '' }: FloatingCoinsProps) {
  const specs = variant === 'backdrop' ? BACKDROP_COINS : PANEL_COINS;
  // Pause the ambient drift while the page is backgrounded — decorative
  // loops never burn battery invisibly (Skills "optimize-web-animations").
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const onVisibility = () => setHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
  return (
    <div
      className={`floating-coins floating-coins--${variant} absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      data-coin-field={variant}
      data-testid={`coin-field-${variant}`}
      aria-hidden="true"
      style={hidden ? { visibility: 'hidden' } : undefined}
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
            variant="ambient"
          />
        </div>
      ))}
    </div>
  );
}

// ── Shell field — the in-app backdrop ─────────────────────────────────

interface ShellCoinSpec {
  left: string;
  top: string;
  size: number;
  symbol: string;
  opacity: number;
  /** Resting rotation (deg) — the scattered, minted feel without motion. */
  rotate: number;
  blur?: number;
  /** The one hero coin: richer variant + a single shine sweep after it
   *  lands (the `InstrumentWait` grammar — one sweep, never a loop). */
  hero?: boolean;
  /** Coins marked tinted take the `accent` color when one is provided. */
  tinted?: boolean;
}

// Desktop-margin field for the app shell (AppBackdrop). Coins hug the
// margins around the centered content column — where the AppBackdrop wash
// already lives — so they never sit under text (§1 surfaces stay solid).
// Deliberately quieter than the onboarding fields (opacity ≤ 0.36 vs
// 0.55): in-app, the tab's object owns the color (§2) and the motif drops
// to quiet. Blur stays within the ambient budget (≤ 3 coins, ≤ 3px).
const SHELL_COINS: ShellCoinSpec[] = [
  // Left margin (between the desktop rail and the content column).
  { left: '6%', top: '14%', size: 56, symbol: '$', opacity: 0.34, rotate: -10 },
  { left: '12%', top: '52%', size: 34, symbol: '€', opacity: 0.26, rotate: 8, tinted: true },
  { left: '4%', top: '80%', size: 24, symbol: '¢', opacity: 0.2, rotate: -6, blur: 2 },
  { left: '16%', top: '30%', size: 20, symbol: '¥', opacity: 0.18, rotate: 12, blur: 3 },
  // Right margin. The largest coins may tuck behind the column edge at
  // exactly-lg widths — that emergence from behind solid content is the
  // intended depth cue, never a readability risk (the coins are behind).
  { left: '89%', top: '10%', size: 44, symbol: '€', opacity: 0.3, rotate: -8 },
  { left: '83%', top: '44%', size: 62, symbol: '$', opacity: 0.36, rotate: 10, tinted: true, hero: true },
  { left: '92%', top: '72%', size: 28, symbol: '₱', opacity: 0.24, rotate: -12, blur: 2, tinted: true },
  { left: '79%', top: '88%', size: 22, symbol: '£', opacity: 0.18, rotate: 6 },
];

export interface ShellCoinFieldProps {
  /** Archetype accent — tints the marked coins to the chosen philosophy. */
  accent?: string | null;
  className?: string;
}

/**
 * ShellCoinField — the post-onboarding coin backdrop for the app shell.
 *
 * §5-compliant ambience: the field settles ONCE on arrival (a reveal —
 * the scene being set as onboarding hands off to the app) and re-settles
 * once when the philosophy accent changes (a confirmation, via the key
 * remount). It NEVER drifts: the onboarding `.coin-float` loop does not
 * cross into the app, where the motion budget belongs to the tab's one
 * expressive object. The 7° turn-in echoes the drift keyframes' rotation
 * range, so the settle rhymes with onboarding without looping. The one
 * hero coin plays a single shine sweep after it lands (`shine="once"`,
 * delayed past its settle) — the same one-sweep grammar as
 * `InstrumentWait`, then still.
 *
 * Desktop-only (`hidden lg:block`): mobile's full-width column would hide
 * the coins under solid cards while still costing compositor time — the
 * gradient wash is the mobile ambience. Reduced motion: the field renders
 * static at final opacity, no settle. No infinite animation means no
 * visibilitychange pause and zero idle compositor cost.
 */
export function ShellCoinField({ accent = null, className = '' }: ShellCoinFieldProps) {
  const reducedMotion = useReducedMotion();
  return (
    <div
      // Keying on the accent remounts the field when the philosophy
      // changes, replaying the one-shot settle in the new colour.
      key={accent ?? 'gold'}
      className={`absolute inset-0 hidden overflow-hidden pointer-events-none lg:block ${className}`}
      data-coin-field="shell"
      data-testid="coin-field-shell"
      aria-hidden="true"
    >
      {SHELL_COINS.map((c, i) => {
        const settleDelay = 0.15 + i * STAGGER_STEP_S;
        return (
          <motion.div
            key={i}
            className="absolute"
            style={{
              left: c.left,
              top: c.top,
              filter: c.blur ? `blur(${c.blur}px)` : undefined,
            }}
            initial={
              reducedMotion
                ? false
                : { opacity: 0, scale: 0.85, y: 12, rotate: c.rotate - 7 }
            }
            animate={{ opacity: c.opacity, scale: 1, y: 0, rotate: c.rotate }}
            transition={
              reducedMotion
                ? { duration: 0 }
                : { ...springSoft, delay: settleDelay }
            }
          >
            <Coin
              size={c.size}
              symbol={c.symbol}
              color={accent && c.tinted ? accent : GOLD}
              // The hero coin takes the richer selection treatment (gloss +
              // full ring) — this IS the hero moment the variant reserves.
              variant={c.hero ? 'selection' : 'ambient'}
              shine={c.hero && !reducedMotion ? 'once' : false}
              // Sweep starts as the coin lands: settle delay + the
              // springSoft settle (~0.6s to visually come to rest).
              shineDelay={c.hero ? settleDelay + 0.6 : 0}
            />
          </motion.div>
        );
      })}
    </div>
  );
}

