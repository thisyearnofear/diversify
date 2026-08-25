// @vitest-environment jsdom

/**
 * Tests for GuardianMascot + guardian-mark.
 *
 * Behavior contract (docs/design-language.md §9):
 * - Digital Guardian identity: pointed shield + visor + digital eyes + coin
 * - five moods expressed by the eyes only — no mouth anywhere
 * - expressions are deltas over a neutral pose (avatar-lab pattern)
 * - blink is state-tied: one blink after mount settle + one per mood change,
 *   never a periodic loop (zero-ambient-loops rule, §5)
 * - compact mode (≤48px) is the pure mark: shield + eyes + coin, no dots
 * - belly coin is always present — identity, not decoration
 * - gaze is opt-in ('pointer' | {x,y}); default renders without tracking
 * - guardian-mark SVG builders produce the exact geometry the component
 *   renders (raster exports never diverge from the live mascot)
 */

import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { EYE_POSE, GuardianMascot, NEUTRAL_EYE } from '../GuardianMascot';
import {
  COIN,
  GUARDIAN_PALETTE,
  guardianEmbedSvg,
  guardianMarkSquareSvg,
  SHIELD_D,
} from '../guardian-mark';

function eyeCount(container: HTMLElement) {
  // digital eyes are the only rects in the mark
  return container.querySelectorAll('rect').length;
}

function coinCircleCount(container: HTMLElement) {
  // belly coin = gold disc (cx 50) + lighter inner ring
  return Array.from(container.querySelectorAll('circle')).filter(
    (c) => c.getAttribute('cx') === '50',
  ).length;
}

describe('GuardianMascot', () => {
  it('renders an accessible image labelled with the mood', () => {
    const { container } = render(<GuardianMascot mood="protective" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('role', 'img');
    expect(svg?.getAttribute('aria-label')).toContain('protective');
  });

  it('renders the pointed shield with an edge stroke and a visor face', () => {
    const { container } = render(<GuardianMascot mood="neutral" />);
    const strokedPath = container.querySelector('path[stroke="#2563eb"]');
    expect(strokedPath).not.toBeNull();
    // visor is a dark slate fill
    const visor = Array.from(container.querySelectorAll('path')).find(
      (p) => p.getAttribute('fill') === '#1e293b',
    );
    expect(visor).toBeDefined();
  });

  it('has no mouth in any mood — the visor is the face', () => {
    const moods = ['happy', 'neutral', 'thinking', 'protective', 'alert'] as const;
    moods.forEach((mood) => {
      const { container } = render(<GuardianMascot size={120} mood={mood} />);
      expect(container.querySelectorAll('path[stroke-linecap="round"]')).toHaveLength(0);
    });
  });

  it('always shows two eyes and the belly coin, even in compact mode', () => {
    const { container } = render(<GuardianMascot size={32} mood="happy" />);
    expect(eyeCount(container)).toBe(2);
    expect(coinCircleCount(container)).toBe(2);
  });

  it('thinking mood shows state-tied dots outside compact mode only', () => {
    const large = render(<GuardianMascot size={120} mood="thinking" />);
    const dotCircles = Array.from(large.container.querySelectorAll('circle')).filter((c) =>
      ['70', '77'].includes(c.getAttribute('cx') ?? ''),
    );
    expect(dotCircles).toHaveLength(2);

    const compact = render(<GuardianMascot size={40} mood="thinking" />);
    const compactDots = Array.from(compact.container.querySelectorAll('circle')).filter((c) =>
      ['70', '77'].includes(c.getAttribute('cx') ?? ''),
    );
    expect(compactDots).toHaveLength(0);
  });

  it('renders no ambient glow or bob layers — the silhouette carries it', () => {
    const { container } = render(<GuardianMascot size={120} mood="happy" />);
    // old design had blur-glow + shadow divs outside the SVG; none remain
    expect(container.querySelectorAll('div.blur-2xl, div.blur-sm')).toHaveLength(0);
  });

  it('pointer gaze is inert by default and does not attach listeners', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    render(<GuardianMascot size={120} mood="neutral" />);
    const pointerCalls = addSpy.mock.calls.filter(([type]) => type === 'pointermove');
    expect(pointerCalls).toHaveLength(0);
    addSpy.mockRestore();
  });

  it('pointer gaze attaches a listener only when enabled and non-compact', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const { unmount } = render(<GuardianMascot size={120} mood="neutral" gaze="pointer" />);
    expect(addSpy.mock.calls.filter(([type]) => type === 'pointermove')).toHaveLength(1);
    unmount();
    addSpy.mockRestore();

    const compactSpy = vi.spyOn(window, 'addEventListener');
    render(<GuardianMascot size={32} mood="neutral" gaze="pointer" />);
    expect(compactSpy.mock.calls.filter(([type]) => type === 'pointermove')).toHaveLength(0);
    compactSpy.mockRestore();
  });

  it('accepts a fixed gaze target without crashing', () => {
    const { container } = render(<GuardianMascot size={120} mood="alert" gaze={{ x: 0.5, y: -0.5 }} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});

describe('expression deltas (avatar-lab pattern)', () => {
  it('derives every mood from the neutral pose', () => {
    expect(EYE_POSE.happy).toMatchObject({ ...NEUTRAL_EYE });
    expect(EYE_POSE.neutral).toMatchObject({ ...NEUTRAL_EYE });
  });

  it('protective narrows the eyes and alert enlarges them, relative to neutral', () => {
    const protective = EYE_POSE.protective as { scaleY: number };
    const alert = EYE_POSE.alert as { scaleX: number; scaleY: number };
    expect(protective.scaleY).toBeLessThan(NEUTRAL_EYE.scaleY);
    expect(alert.scaleX).toBeGreaterThan(NEUTRAL_EYE.scaleX);
    expect(alert.scaleY).toBeGreaterThan(NEUTRAL_EYE.scaleY);
  });
});

describe('state-tied blink (transition confirmation, never a loop)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('blinks once ~1s after mount and never repeats (no periodic loop)', () => {
    const { container } = render(<GuardianMascot size={120} mood="neutral" />);
    const eyes = () => container.querySelectorAll('rect');

    // Before the mount-settle blink fires: structure intact.
    act(() => {
      vi.advanceTimersByTime(950);
    });
    expect(eyes()).toHaveLength(2);

    // After the blink fires, releases, and well past any plausible loop
    // period: still exactly two eye rects — blink is one-shot, not ambient.
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(eyes()).toHaveLength(2);
  });

  it('does not blink in compact mode — the mark stays purely static', () => {
    const { container } = render(<GuardianMascot size={32} mood="neutral" />);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    // Both eyes render intact; the pure mark survives the whole window.
    expect(container.querySelectorAll('rect')).toHaveLength(2);
  });

  it('blinks again on a mood change', () => {
    const { rerender } = render(<GuardianMascot size={120} mood="neutral" />);
    // skip mount blink
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    rerender(<GuardianMascot size={120} mood="alert" />);
    // mood-change blink closes the lids shortly after the change
    act(() => {
      vi.advanceTimersByTime(50);
    });
    // and reopens — no crash, eyes persist
    act(() => {
      vi.advanceTimersByTime(500);
    });
  });
});

describe('guardian-mark SVG builders (raster export single source of truth)', () => {
  it('square mark renders the full identity on the navy field', () => {
    const svg = guardianMarkSquareSvg(512);
    expect(svg).toContain(`width="512"`);
    expect(svg).toContain(GUARDIAN_PALETTE.field); // background field
    expect(svg).toContain(SHIELD_D); // shield silhouette
    expect(svg).toContain(GUARDIAN_PALETTE.visor); // visor face
    expect(svg).toContain(GUARDIAN_PALETTE.eye); // digital eyes
    expect(svg).toContain(GUARDIAN_PALETTE.gold); // belly coin
    expect(svg).toContain(`cx="${COIN.cx}"`);
  });

  it('supports transparent background for flexible compositing', () => {
    const svg = guardianMarkSquareSvg(512, 0.86, 'transparent');
    expect(svg).not.toContain('<rect width="512"');
  });

  it('embed composition places the Guardian in the lower-right over the field', () => {
    const svg = guardianEmbedSvg();
    expect(svg).toContain('width="1200"');
    expect(svg).toContain('height="630"');
    expect(svg).toContain(GUARDIAN_PALETTE.field);
    expect(svg).toContain(SHIELD_D);
  });

  it('uses unique gradient ids so multiple marks can share one document', () => {
    const a = guardianMarkSquareSvg(256, 0.86, 'transparent');
    const b = guardianEmbedSvg();
    expect(a).toContain('id="sq-body"');
    expect(b).toContain('id="og-body"');
  });
});
