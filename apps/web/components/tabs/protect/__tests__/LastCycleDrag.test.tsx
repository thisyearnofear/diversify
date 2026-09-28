import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { lastCycleWindow } from '@diversifi/shared/src/services/fx-drag/representative-cycle';
import { LastCycleDrag } from '../LastCycleDrag';

// Flat mid-market at 15 local/USD — any achieved rate above it shows drag.
vi.mock('@diversifi/shared/src/services/fx-drag/rates-serverless', () => ({
  buildServerlessRateProvider: vi.fn(async () => ({
    getRate: () => 15,
    sourceNote: 'test',
  })),
}));

const mockTrack = vi.fn();
vi.mock('@/lib/analytics', () => ({
  trackFunnelEvent: (...args: unknown[]) => mockTrack(...args),
}));

const fill = (label: RegExp | string, value: string) => {
  const el = screen.getByLabelText(label instanceof RegExp ? label : new RegExp(label));
  fireEvent.change(el, { target: { value } });
};

const fillAndRun = () => {
  fill(/Earnings this cycle/, '100000');
  fill(/USD paid to suppliers/, '5000');
  fill(/Bank rate/, '16');
  fireEvent.click(screen.getByRole('button', { name: 'See what it cost' }));
};

describe('LastCycleDrag', () => {
  beforeEach(() => {
    mockTrack.mockClear();
  });

  it('starts empty — no sample prefill', () => {
    render(<LastCycleDrag currency="GHS" onCurrencyChange={() => {}} onTrackNext={() => {}} />);
    expect(screen.getByLabelText(/Earnings this cycle/)).toHaveValue('');
    expect(screen.getByLabelText(/USD paid to suppliers/)).toHaveValue('');
    expect(screen.getByLabelText(/Bank rate/)).toHaveValue('');
    expect(screen.getByLabelText(/Fees/)).toHaveValue('');
    expect(screen.getByLabelText('Local currency')).toHaveValue('GHS');
  });

  it('computes a result over the trailing window and states it explicitly', async () => {
    render(<LastCycleDrag currency="GHS" onCurrencyChange={() => {}} onTrackNext={() => {}} />);
    fillAndRun();
    const result = await screen.findByTestId('last-cycle-result');
    expect(result).toBeInTheDocument();
    // Drag hero: achieved 16 vs mid 15 → positive drag (bank spread > 0).
    expect(screen.getByTestId('last-cycle-drag-total')).toHaveTextContent(/^GHS \d/);
    expect(screen.getByText(/went to FX timing, bank spread and fees/)).toBeInTheDocument();
    const { start, end } = lastCycleWindow(new Date());
    const fmt = (iso: string) =>
      new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
        day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
      });
    expect(screen.getByText(new RegExp(`${fmt(start)}.+${fmt(end)}.+73 days`))).toBeInTheDocument();
    expect(mockTrack).toHaveBeenCalledWith('fx_drag_calculated', {
      currency: 'GHS',
      source: 'inspector',
    });
  });

  it('"Track your next payment" hands off the cycle to the forward report', async () => {
    const onTrackNext = vi.fn();
    render(<LastCycleDrag currency="GHS" onCurrencyChange={() => {}} onTrackNext={onTrackNext} />);
    fillAndRun();
    await screen.findByTestId('last-cycle-result');
    fireEvent.click(screen.getByRole('button', { name: /Track your next payment/ }));
    expect(onTrackNext).toHaveBeenCalledWith({ currency: 'GHS', paymentUsd: 5000 });
    expect(mockTrack).toHaveBeenCalledWith('fx_drag_handoff', {
      currency: 'GHS',
      target: 'cycle',
      source: 'inspector',
    });
  });

  it('invalid input shows an inline alert instead of silently no-oping', () => {
    render(<LastCycleDrag currency="GHS" onCurrencyChange={() => {}} onTrackNext={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'See what it cost' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter your earnings, the USD you paid and your bank rate — all above zero.',
    );
    expect(screen.queryByTestId('last-cycle-result')).not.toBeInTheDocument();
  });

  it('no separate "converting on arrival" counterfactual box remains', async () => {
    render(<LastCycleDrag currency="GHS" onCurrencyChange={() => {}} onTrackNext={() => {}} />);
    fillAndRun();
    await screen.findByTestId('last-cycle-result');
    expect(screen.queryByText(/converting on arrival/i)).not.toBeInTheDocument();
    // The percentage rides the hero sub-line instead.
    expect(screen.getByText(/% of what you paid went to FX timing/)).toBeInTheDocument();
  });

  it('came-out-ahead copy renders when timing beats converting on arrival', async () => {
    // Achieved rate below mid → drag is negative... wait, spread is
    // (achieved - mid) * usd → negative spread is possible; set achieved 14.
    render(<LastCycleDrag currency="GHS" onCurrencyChange={() => {}} onTrackNext={() => {}} />);
    fill(/Earnings this cycle/, '100000');
    fill(/USD paid to suppliers/, '5000');
    fill(/Bank rate/, '14');
    fireEvent.click(screen.getByRole('button', { name: 'See what it cost' }));
    await screen.findByTestId('last-cycle-result');
    expect(screen.getByText(/Timing worked in your favour/)).toBeInTheDocument();
  });
});
