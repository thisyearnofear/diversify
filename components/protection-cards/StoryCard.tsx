/**
 * StoryCard — 1080×1920 vertical share format.
 *
 * Same archetype tokens / hero motifs / background patterns as the
 * square BaseCard, restacked for Instagram/Reels/TikTok 9:16. Built
 * to make the "one definition, three surfaces" claim concrete:
 * in-app card (1080² inside the app), share image (1080²), now also
 * a story share (1080×1920) — all from the same archetype data.
 */

import React from 'react';
import {
  Archetype,
  TOKENS,
  alpha,
} from './tokens';
import { TrustMark } from './TrustMark';

const FONT = 'Space Grotesk';
const STORY_W = 1080;
const STORY_H = 1920;

export interface StoryCardProps {
  archetype: Archetype;
  hero: React.ReactNode;
  /** Per-archetype background pattern, rendered behind the hero. */
  pattern: React.ReactNode;
  subMark?: string;
}

export function StoryCard({
  archetype,
  hero,
  pattern,
  subMark,
}: StoryCardProps) {
  const surface = `linear-gradient(135deg, ${archetype.surface.start} 0%, ${archetype.surface.mid} 50%, ${archetype.surface.end} 100%)`;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: STORY_W,
        height: STORY_H,
        background: surface,
        padding: 80,
        fontFamily: FONT,
        color: TOKENS.foreground,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Per-archetype pattern (cranked) */}
      {pattern}

      {/* Tonal washes — sunrise corner + deep horizon corner */}
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
      {/* Vignette */}
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at center, transparent 30%, ${alpha(archetype.surface.start, 0.35)} 100%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Top accent bar */}
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 18,
          background: `linear-gradient(90deg, ${archetype.accent}, ${archetype.accentSoft}, ${archetype.accent})`,
        }}
      />
      {/* Bottom accent bar */}
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 18,
          background: `linear-gradient(90deg, ${archetype.accent}, ${archetype.accentSoft}, ${archetype.accent})`,
        }}
      />

      {/* Header: identity + position mark */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <TrustMark size={28} color={archetype.accent} />
          <span
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: alpha(TOKENS.foreground, 0.85),
              letterSpacing: '0.2em',
            }}
          >
            DIVERSIFI
          </span>
        </div>
        {subMark && (
          <span
            style={{
              display: 'flex',
              fontSize: 38,
              fontWeight: 500,
              color: alpha(archetype.accentSoft, 0.85),
              letterSpacing: '0.04em',
            }}
          >
            {subMark}
          </span>
        )}
      </div>

      {/* Kicker chip */}
      <div
        style={{
          display: 'flex',
          alignSelf: 'flex-start',
          marginTop: 50,
          padding: '12px 26px',
          background: alpha(archetype.accent, 0.28),
          border: `1.5px solid ${alpha(archetype.accent, 0.65)}`,
          borderRadius: 999,
        }}
      >
        <span
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: alpha(TOKENS.foreground, 0.96),
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
          }}
        >
          {archetype.kicker}
        </span>
      </div>

      {/* Display name — even larger for story format */}
      <div
        style={{
          display: 'flex',
          marginTop: 28,
        }}
      >
        <span
          style={{
            fontSize: 130,
            fontWeight: 700,
            lineHeight: 1.0,
            letterSpacing: '-0.04em',
            color: TOKENS.foreground,
          }}
        >
          {archetype.name}
        </span>
      </div>

      {/* Hero motif (centered in remaining vertical space) */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          marginTop: 20,
        }}
      >
        {hero}
      </div>

      {/* Philosophy */}
      <div
        style={{
          display: 'flex',
          fontSize: 50,
          lineHeight: 1.22,
          fontWeight: 500,
          color: alpha(TOKENS.foreground, 0.96),
          letterSpacing: '-0.02em',
          marginBottom: 36,
          maxWidth: 920,
        }}
      >
        {archetype.philosophy}
      </div>

      {/* Allocation pills */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 40,
        }}
      >
        {archetype.allocation.map((pill) => (
          <div
            key={pill}
            style={{
              display: 'flex',
              padding: '14px 26px',
              borderRadius: 999,
              background: alpha(archetype.accent, 0.22),
              border: `1.5px solid ${alpha(archetype.accent, 0.65)}`,
            }}
          >
            <span
              style={{
                fontSize: 24,
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

      {/* Footer CTA */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          paddingTop: 28,
          borderTop: `1px solid ${alpha(archetype.accent, 0.40)}`,
        }}
      >
        <span
          style={{
            fontSize: 26,
            fontWeight: 700,
            color: alpha(TOKENS.foreground, 0.92),
            letterSpacing: '0.04em',
          }}
        >
          diversifiapp.vercel.app
        </span>
        <span
          style={{
            fontSize: 16,
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

export const STORY_SIZE = { w: STORY_W, h: STORY_H };
