/**
 * BaseCard — shared 1080×1080 frame for every Protection Plan card.
 *
 * v2 composition (top → bottom):
 *   • Per-archetype pattern background (woven, stepped, tessellated…)
 *   • Duotone tonal wash anchored to the archetype accent
 *   • Kicker chip (top-left)         — "PROTECTION PLAN · <NAME>"
 *   • Oversized archetype display name + cultural sub-mark
 *   • Hero motif                     — archetype-specific (heroes.tsx)
 *   • Philosophy pull-quote          — bigger, bolder
 *   • Allocation pill row            — 3–5 asset chips, accent-tinted
 *   • Footer: TrustMark + DIVERSIFI wordmark + Verifiable + date
 */

import React from 'react';
import {
  Archetype,
  CARD_SIZE,
  TOKENS,
  alpha,
} from './tokens';
import { TrustMark } from './TrustMark';

const FONT = 'Space Grotesk';

export interface BaseCardProps {
  archetype: Archetype;
  hero: React.ReactNode;
  /** Per-archetype background pattern, rendered behind the hero. */
  pattern: React.ReactNode;
  /** Native-script or culturally-resonant sub-mark shown under the display name. */
  subMark?: string;
}

export function BaseCard({
  archetype,
  hero,
  pattern,
  subMark,
}: BaseCardProps) {
  // Per-archetype surface gradient (135°) — each culture has its own register.
  const surface = `linear-gradient(135deg, ${archetype.surface.start} 0%, ${archetype.surface.mid} 50%, ${archetype.surface.end} 100%)`;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: CARD_SIZE,
        height: CARD_SIZE,
        background: surface,
        borderRadius: 36,
        padding: 64,
        fontFamily: FONT,
        color: TOKENS.foreground,
        border: `4px solid ${alpha(archetype.accent, 0.85)}`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Per-archetype pattern layer (cranked) */}
      {pattern}

      {/* Tonal washes — deepen corners for contrast, lift center for hero focus */}
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at 100% 0%, ${alpha(archetype.accentSoft, 0.55)} 0%, transparent 50%)`,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at 0% 100%, ${alpha(archetype.surface.start, 0.55)} 0%, transparent 50%)`,
          pointerEvents: 'none',
        }}
      />
      {/* Vignette — pulls focus to center */}
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at center, transparent 30%, ${alpha(archetype.surface.start, 0.40)} 100%)`,
          pointerEvents: 'none',
        }}
      />
      {/* Top color bar — bolder identity stripe */}
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 14,
          background: `linear-gradient(90deg, ${archetype.accent}, ${archetype.accentSoft}, ${archetype.accent})`,
        }}
      />

      {/* Header row: kicker + sub-mark */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          width: '100%',
        }}
      >
        <div
          style={{
            display: 'flex',
            padding: '10px 22px',
            background: alpha(archetype.accent, 0.28),
            border: `1.5px solid ${alpha(archetype.accent, 0.65)}`,
            borderRadius: 999,
          }}
        >
          <span
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: alpha(TOKENS.foreground, 0.96),
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
            }}
          >
            {archetype.kicker}
          </span>
        </div>
        {subMark && (
          <div
            style={{
              display: 'flex',
              fontSize: 38,
              fontWeight: 500,
              color: alpha(archetype.accentSoft, 0.85),
              letterSpacing: '0.04em',
            }}
          >
            {subMark}
          </div>
        )}
      </div>

      {/* Display name — oversized, accent-shadowed */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          marginTop: 18,
        }}
      >
        <span
          style={{
            fontSize: 86,
            fontWeight: 700,
            lineHeight: 1.0,
            letterSpacing: '-0.035em',
            color: TOKENS.foreground,
          }}
        >
          {archetype.name}
        </span>
      </div>

      {/* Hero motif */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          marginTop: 8,
        }}
      >
        {hero}
      </div>

      {/* Philosophy */}
      <div
        style={{
          display: 'flex',
          fontSize: 38,
          lineHeight: 1.22,
          fontWeight: 500,
          color: alpha(TOKENS.foreground, 0.95),
          letterSpacing: '-0.015em',
          marginBottom: 30,
          maxWidth: 920,
        }}
      >
        {archetype.philosophy}
      </div>

      {/* Allocation row */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 14,
          marginBottom: 32,
        }}
      >
        {archetype.allocation.map((pill) => (
          <div
            key={pill}
            style={{
              display: 'flex',
              padding: '10px 22px',
              borderRadius: 999,
              background: alpha(archetype.accent, 0.20),
              border: `1.5px solid ${alpha(archetype.accent, 0.60)}`,
            }}
          >
            <span
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: alpha(TOKENS.foreground, 0.95),
                letterSpacing: '0.04em',
              }}
            >
              {pill}
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          paddingTop: 26,
          borderTop: `1px solid ${alpha(archetype.accent, 0.40)}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <TrustMark size={24} color={archetype.accent} />
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: alpha(TOKENS.foreground, 0.85),
              letterSpacing: '0.20em',
            }}
          >
            DIVERSIFI
          </span>
          <span
            style={{
              fontSize: 16,
              fontWeight: 500,
              color: alpha(TOKENS.foreground, 0.55),
              letterSpacing: '0.06em',
            }}
          >
            · Verifiable on-chain
          </span>
        </div>
        <span
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: alpha(archetype.accentSoft, 0.85),
            letterSpacing: '0.18em',
          }}
        >
          ANCHORED ON 0G STORAGE
        </span>
      </div>
    </div>
  );
}
