/**
 * RiskPhase — the before/after purchasing-power object.
 *
 * Asserts the semantic contract: same local amount, benchmark units at
 * period start vs horizon, one headline, one CTA. Arithmetic itself is
 * settled in lib/narrative/__tests__/currency-moment.test.ts — these
 * tests use the verified values (GHS −63 → US$37, +7 → 107, 0 → same).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { RiskPhase } from '../RiskPhase';
import type { Horizon } from '../phase-config';

const motionPreference = { reduced: false };
vi.mock('framer-motion', async (importOriginal) => {
  const mod = await importOriginal<typeof import('framer-motion')>();
  return { ...mod, useReducedMotion: () => motionPreference.reduced };
});
vi.mock('@/lib/haptics', () => ({ haptics: { tap: vi.fn(), confirm: vi.fn() } }));
import { haptics } from '@/lib/haptics';

const ghs = { flag: '🇬🇭', countryName: 'Ghana', code: 'GHS' };

function makeProps(overrides: Partial<Parameters<typeof RiskPhase>[0]> = {}) {
  return {
    riskData: ghs,
    benchmark: 'USD' as const,
    delta: -63,
    selectedHorizon: '5yr' as Horizon,
    setSelectedHorizon: vi.fn(),
    isLive: false,
    dataAsOf: '2026-09-26',
    onAdvance: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  motionPreference.reduced = false;
});
afterEach(cleanup);

describe('RiskPhase — the purchasing-power object', () => {
  it('renders the verified GHS 5yr story: US$100 → US$37, headline "less", period labels honest', () => {
    render(<RiskPhase {...makeProps()} />);
    expect(screen.getByText('Same money. Less buying power.')).toBeInTheDocument();
    expect(screen.getByText('US$100')).toBeInTheDocument();
    expect(screen.getAllByText('US$37').length).toBeGreaterThanOrEqual(1); expect(screen.getByText('US$37', { selector: '.sr-only' })).toBeInTheDocument();
    expect(screen.getByText('Start of period')).toBeInTheDocument();
    expect(screen.getByText('5 years later')).toBeInTheDocument();
    expect(screen.queryByText(/today/i)).not.toBeInTheDocument();
    // The removed clutter never returns.
    for (const gone of [/gold/i, /counterfactual/i, /business/i, /waitlist/i, /DiversiFi never holds/i]) {
      expect(screen.queryByText(gone)).not.toBeInTheDocument();
    }
    expect(screen.getByText('🇬🇭 Ghana · GHS')).toBeInTheDocument();
    expect(screen.getByText('What the same amount of GHS could buy in US dollars.')).toBeInTheDocument();
  });

  it('a positive delta shows "more" and the settled 107 figure', () => {
    render(<RiskPhase {...makeProps({ delta: 7, selectedHorizon: '1yr' })} />);
    expect(screen.getByText('Same money. More buying power.')).toBeInTheDocument();
    expect(screen.getByText('US$107', { selector: '.sr-only' })).toBeInTheDocument();
    expect(screen.getByText('1 year later')).toBeInTheDocument();
  });

  it('a zero delta reads "similar" and keeps both ends at US$100', () => {
    render(<RiskPhase {...makeProps({ delta: 0 })} />);
    expect(screen.getByText('Same money. Similar buying power.')).toBeInTheDocument();
    expect(screen.getAllByText('US$100').length).toBeGreaterThanOrEqual(2);
  });

  it('USD visitors compare in euros, never against themselves', () => {
    render(
      <RiskPhase
        {...makeProps({
          riskData: { flag: '🇺🇸', countryName: 'United States', code: 'USD' },
          benchmark: 'EUR',
          delta: -10,
        })}
      />,
    );
    expect(screen.getByText('€100')).toBeInTheDocument();
    expect(screen.getByText('€90', { selector: '.sr-only' })).toBeInTheDocument();
    expect(screen.getByText('What the same amount of USD could buy in euros.')).toBeInTheDocument();
  });

  it('null and NaN deltas show the honest fallback and keep the CTA live', () => {
    const onAdvance = vi.fn();
    const { rerender } = render(<RiskPhase {...makeProps({ delta: null, onAdvance })} />);
    expect(screen.getByText('See your currency more clearly.')).toBeInTheDocument();
    expect(screen.getByText('This comparison is unavailable. You can still explore a plan.')).toBeInTheDocument();
    expect(screen.queryByText('US$100')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Explore my options/ }));
    expect(onAdvance).toHaveBeenCalledTimes(1);

    rerender(<RiskPhase {...makeProps({ delta: NaN, onAdvance })} />);
    expect(screen.getByText('This comparison is unavailable. You can still explore a plan.')).toBeInTheDocument();
  });

  it('the curated set never claims live data, even with a recent asOf', () => {
    render(<RiskPhase {...makeProps({ isLive: false, dataAsOf: '2026-10-01' })} />);
    expect(screen.getByText(/Approximate history · reviewed 2026-09-26/)).toBeInTheDocument();
    expect(screen.queryByText(/Historical FX · as of/)).not.toBeInTheDocument();
  });

  it('live readings cite the feed date instead of the review date', () => {
    render(<RiskPhase {...makeProps({ isLive: true, dataAsOf: '2026-10-01' })} />);
    expect(screen.getByText('Historical FX · as of 2026-10-01')).toBeInTheDocument();
  });

  it('the details disclosure opens closed and carries the balance/CPI qualifier', () => {
    render(<RiskPhase {...makeProps()} />);
    const details = screen.getByText('How to read this').closest('details')!;
    expect(details).not.toHaveAttribute('open');
    expect(screen.getByText(/not a bank balance or a forecast/)).toBeInTheDocument();
  });

  it('the period control is a real set of buttons: one tap, one haptic, same-tap ignored', () => {
    const setSelectedHorizon = vi.fn();
    render(<RiskPhase {...makeProps({ setSelectedHorizon })} />);
    const yr3 = screen.getByRole('button', { name: '3Y' });
    expect(yr3).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(yr3);
    expect(setSelectedHorizon).toHaveBeenCalledTimes(1);
    expect(setSelectedHorizon).toHaveBeenCalledWith('3yr');
    expect(haptics.tap).toHaveBeenCalledTimes(1);

    // Tapping the already-selected period is a no-op — no tween, no haptic.
    fireEvent.click(screen.getByRole('button', { name: '5Y' }));
    expect(setSelectedHorizon).toHaveBeenCalledTimes(1);
    expect(haptics.tap).toHaveBeenCalledTimes(1);
  });

  it('reduced motion keeps the story identical — semantic text lands immediately', () => {
    motionPreference.reduced = true;
    render(<RiskPhase {...makeProps()} />);
    expect(screen.getAllByText('US$37').length).toBeGreaterThanOrEqual(1); expect(screen.getByText('US$37', { selector: '.sr-only' })).toBeInTheDocument();
    expect(screen.getByText('Same money. Less buying power.')).toBeInTheDocument();
    // The selection plate renders statically — a plain span, no motion
    // layout machinery under reduced motion.
    const yr5 = screen.getByRole('button', { name: '5Y' });
    const plate = yr5.querySelector('span.bg-blue-600');
    expect(plate).not.toBeNull();
    expect(plate!.tagName).toBe('SPAN');
  });
});
