/**
 * PairStage — the resting Exchange object: two coins on a balance beam.
 *
 * Pins the honesty contract: the tilt is data (the corridor's 5y drift —
 * weaker side sits lower, level when the pair held level or has nothing
 * to say), the coin flip is provenance (only coins with a story flip,
 * one at a time), and the resting word budget stays under 60.
 */

// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import PairStage from '../PairStage';
import type { TokenPickerItem } from '../TokenPickerSheet';

afterEach(() => cleanup());
beforeEach(() => sessionStorage.clear());

const item = (symbol: string): TokenPickerItem => ({
  symbol,
  name: symbol,
  compliant: true,
});

const ITEMS = ['KESm', 'PAXG', 'USDm', 'USDC', 'EURm', 'GBPm', 'ETH'].map(item);

function renderStage(overrides: Partial<Parameters<typeof PairStage>[0]> = {}) {
  const props = {
    fromToken: 'KESm',
    toToken: 'PAXG',
    fromItems: ITEMS,
    toItems: ITEMS,
    onFromChange: vi.fn(),
    onToChange: vi.fn(),
    onSwitch: vi.fn(),
    onWake: vi.fn(),
    signals: null,
    ctaLabel: 'Move savings',
    ...overrides,
  };
  render(<PairStage {...props} />);
  return props;
}

describe('PairStage', () => {
  it('renders both coins and their labels', () => {
    renderStage();
    expect(screen.getByRole('button', { name: 'About KESm' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About PAXG' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change KESm' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change PAXG' })).toBeInTheDocument();
  });

  it('tilts the beam toward the weaker side (from)', () => {
    // KES lost ~97% to gold in 5y — drift weaker:'from' → negative tilt.
    renderStage({ fromToken: 'KESm', toToken: 'PAXG' });
    const tilt = Number(screen.getByTestId('pair-beam').dataset.tilt);
    expect(tilt).toBeLessThan(0);
    expect(tilt).toBeGreaterThanOrEqual(-14);
  });

  it('tilts the beam toward the weaker side (to)', () => {
    renderStage({ fromToken: 'PAXG', toToken: 'KESm' });
    expect(Number(screen.getByTestId('pair-beam').dataset.tilt)).toBeGreaterThan(0);
  });

  it('is level when the pair roughly held level — no invented winner', () => {
    renderStage({ fromToken: 'EURm', toToken: 'GBPm' });
    expect(screen.getByTestId('pair-beam').dataset.tilt).toBe('0');
  });

  it('is level when the pair has no corridor at all', () => {
    renderStage({ fromToken: 'USDC', toToken: 'USDm' });
    expect(screen.getByTestId('pair-beam').dataset.tilt).toBe('0');
  });

  it('flipping a coin rewrites its label area to the provenance back', () => {
    renderStage();
    fireEvent.click(screen.getByRole('button', { name: 'About KESm' }));
    const stage = screen.getByTestId('pair-stage');
    expect(stage).toHaveTextContent("Kenya's floating shilling");
    expect(stage).toHaveTextContent('Mento');
    expect(screen.queryByRole('button', { name: 'Change KESm' })).not.toBeInTheDocument();
  });

  it('only one coin is flipped at a time, and tapping again flips back', () => {
    renderStage();
    fireEvent.click(screen.getByRole('button', { name: 'About KESm' }));
    expect(screen.getByTestId('pair-stage')).toHaveTextContent('Mento');
    fireEvent.click(screen.getByRole('button', { name: 'About PAXG' }));
    const stage = screen.getByTestId('pair-stage');
    expect(stage).toHaveTextContent('Paxos Trust Company');
    // The un-flipped side keeps its label button — only one back shows.
    expect(screen.getByRole('button', { name: 'Change KESm' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'About PAXG' }));
    expect(screen.getByRole('button', { name: 'Change PAXG' })).toBeInTheDocument();
  });

  it('coins without provenance are not buttons', () => {
    renderStage({ fromToken: 'ETH', toToken: 'KESm' });
    expect(screen.queryByRole('button', { name: 'About ETH' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'About KESm' })).toBeInTheDocument();
  });

  it('a label opens the picker and selecting calls onFromChange', () => {
    const { onFromChange } = renderStage();
    fireEvent.click(screen.getByRole('button', { name: 'Change KESm' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    // The sheet shows held/recommended first; unfold the full list.
    fireEvent.click(screen.getByTestId('token-picker-show-all'));
    fireEvent.click(screen.getByRole('button', { name: /^USDm/ }));
    expect(onFromChange).toHaveBeenCalledWith('USDm');
  });

  it('the pivot swaps the sides', () => {
    const { onSwitch } = renderStage();
    fireEvent.click(screen.getByRole('button', { name: 'Switch tokens' }));
    expect(onSwitch).toHaveBeenCalledTimes(1);
  });

  it('the CTA wakes the ticket', () => {
    const { onWake } = renderStage();
    fireEvent.click(screen.getByTestId('pair-stage-wake'));
    expect(onWake).toHaveBeenCalledTimes(1);
  });

  it('stays inside the resting word budget', () => {
    renderStage();
    const words = (screen.getByTestId('pair-stage').textContent ?? '')
      .split(/\s+/)
      .filter(Boolean);
    expect(words.length).toBeLessThanOrEqual(60);
  });
});
