import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { StruckMedallion } from '../StruckMedallion';
import { patinaFor } from '@/lib/foundry';

// framer-motion reads prefers-reduced-motion once via a cached
// matchMedia — drive it through useReducedMotion instead.
const reducedMotionState = { on: false };
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => reducedMotionState.on };
});

/** The band and the core are the only circles struck at those radii. */
function circleAt(r: number) {
  return Array.from(document.querySelectorAll<SVGCircleElement>('circle')).find(
    (c) => Number(c.getAttribute('r')) === r
  )!;
}

afterEach(() => {
  cleanup();
  reducedMotionState.on = false;
});

describe('StruckMedallion — the share artefact’s struck object', () => {
  it('strikes each half from the metal its token actually is', () => {
    render(<StruckMedallion from="NGNm" to="USDm" mode="moved" />);
    // Living band, machined core — both from FoundryDefs' shared paints.
    expect(circleAt(88)).toHaveAttribute('fill', expect.stringMatching(/^url\(#metal-living-/));
    expect(circleAt(56)).toHaveAttribute('fill', expect.stringMatching(/^url\(#metal-machined-/));
  });

  it('weathers the band with the plan ring’s verdigris, scaled by the real 5yr record', () => {
    render(<StruckMedallion from="NGNm" to="USDm" mode="moved" />);
    const patina = screen.getByTestId('medallion-patina');
    const wash = Number(patina.querySelector('circle')!.getAttribute('opacity'));
    // A whisper, not grime: well under the ring's 0.8 arc overlay.
    expect(wash).toBeGreaterThan(0);
    expect(wash).toBeLessThan(0.4);
    expect(wash).toBeCloseTo(patinaFor('NGNm') * 0.3, 5);

    cleanup();
    render(<StruckMedallion from="KESm" to="USDm" mode="moved" />);
    const halfWash = Number(
      screen.getByTestId('medallion-patina').querySelector('circle')!.getAttribute('opacity')
    );
    expect(halfWash).toBeLessThan(wash);
  });

  it('leaves calm metal unweathered — no overlay, no invented patina', () => {
    render(<StruckMedallion from="USDm" to="BRLm" mode="moved" />);
    expect(screen.queryByTestId('medallion-patina')).toBeNull();
    expect(circleAt(88)).toHaveAttribute('fill', expect.stringMatching(/^url\(#metal-machined-/));
  });

  it('engraves the pair in canonical casing', () => {
    render(<StruckMedallion from="NGNm" to="USDm" mode="moved" />);
    expect(document.querySelector('textPath')!.textContent).toBe('NGNm → USDm');
  });

  it('punches the mark on the rim only when the move happened', () => {
    const { unmount } = render(<StruckMedallion from="NGNm" to="USDm" mode="moved" />);
    // Depression = three lips (lit, shadowed, floor) drawn along one path.
    expect(screen.getByTestId('medallion-mark').querySelectorAll('path')).toHaveLength(3);
    expect(screen.queryByTestId('medallion-ghost')).toBeNull();
    unmount();

    render(<StruckMedallion from="NGNm" to="USDm" mode="watching" />);
    expect(screen.queryByTestId('medallion-mark')).toBeNull();
    const ghost = screen.getByTestId('medallion-ghost');
    expect(ghost.querySelectorAll('path')).toHaveLength(2);
    // The ghost channel is the only thing the watching state adds.
    expect(ghost.querySelector('path')!.getAttribute('stroke')).toBeTruthy();
  });

  it('says what it is, including whether it was struck', () => {
    render(<StruckMedallion from="NGNm" to="USDm" mode="moved" />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe(
      'NGNm ring over USDm core, weathered — struck'
    );
    cleanup();
    render(<StruckMedallion from="USDm" to="BRLm" mode="watching" />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe(
      'USDm ring over BRLm core — not yet struck'
    );
  });

  it('re-strikes once when the cause changes', () => {
    const { rerender } = render(
      <StruckMedallion from="NGNm" to="USDm" mode="moved" strikeKey="a" />
    );
    const first = screen.getByTestId('medallion-mark');
    // The blow rings through the band — a shock circle that only exists
    // while it is playing.
    expect(first.querySelector('circle')).not.toBeNull();

    rerender(<StruckMedallion from="NGNm" to="USDm" mode="moved" strikeKey="b" />);
    expect(screen.getByTestId('medallion-mark')).not.toBe(first);
  });

  it('lands the finished object under reduced motion — struck, not ringing', () => {
    reducedMotionState.on = true;
    render(<StruckMedallion from="NGNm" to="USDm" mode="moved" strikeKey="a" />);
    const mark = screen.getByTestId('medallion-mark');
    // The mark is there, fully punched; the shock ring never mounts.
    expect(mark.querySelectorAll('path')).toHaveLength(3);
    expect(mark.querySelector('circle')).toBeNull();
  });
});
