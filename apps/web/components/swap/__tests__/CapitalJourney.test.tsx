/**
 * CapitalJourney — the journey rail under the pair stage. Pins: hidden
 * without ≥2 stations, held-vs-departed styling, the honest
 * "Since"/"Recent history" line, one-tap inspect, optimistic append
 * de-dupe, reduced-motion parity, and a ≤25-word resting budget.
 */

// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { CapitalJourney } from '../CapitalJourney';
import type { CapitalHistory } from '@diversifi/shared/src/services/capital-history';

const reducedMotionState = { on: false };
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => reducedMotionState.on };
});

const mockConnect = vi.fn();
vi.mock('@/components/wallet/WalletProvider', () => ({
  useWalletContext: () => ({ connect: mockConnect }),
}));

afterEach(() => {
  cleanup();
  reducedMotionState.on = false;
});

const history = (over: Partial<CapitalHistory> = {}): CapitalHistory => ({
  address: '0xabc',
  chainId: 42220,
  stations: [
    { symbol: 'USDm', firstSeen: '2023-05-01T00:00:00.000Z', lastSeen: '2024-01-01T00:00:00.000Z' },
    { symbol: 'KESm', firstSeen: '2024-02-01T00:00:00.000Z', lastSeen: '2024-06-01T00:00:00.000Z' },
    { symbol: 'NGNm', firstSeen: '2024-07-01T00:00:00.000Z', lastSeen: '2024-08-01T00:00:00.000Z' },
  ],
  legs: [],
  complete: true,
  asOf: '2026-09-23T00:00:00.000Z',
  ...over,
});

function renderRail(over: Partial<Parameters<typeof CapitalJourney>[0]> = {}) {
  const props = {
    history: history(),
    tokenBalances: { USDm: { value: 10 }, KESm: { value: 5 } },
    onInspectJourney: vi.fn(),
    ...over,
  };
  render(<CapitalJourney {...props} />);
  return props;
}

describe('CapitalJourney', () => {
  it('renders nothing with fewer than 2 stations', () => {
    renderRail({
      history: history({
        stations: [{ symbol: 'USDm', firstSeen: '2024-01-01T00:00:00.000Z', lastSeen: '2024-01-01T00:00:00.000Z' }],
      }),
    });
    expect(screen.queryByTestId('capital-journey')).not.toBeInTheDocument();
  });

  it('renders nothing with no history at all — walletless gets nothing', () => {
    renderRail({ history: null });
    expect(screen.queryByTestId('capital-journey')).not.toBeInTheDocument();
  });

  it('marks held vs departed stations via data-held', () => {
    renderRail();
    expect(screen.getByTestId('journey-station-USDm').dataset.held).toBe('true');
    expect(screen.getByTestId('journey-station-KESm').dataset.held).toBe('true');
    expect(screen.getByTestId('journey-station-NGNm').dataset.held).toBe('false');
  });

  it('says "Since" for complete history, "Recent history" when truncated', () => {
    renderRail();
    expect(screen.getByTestId('capital-journey')).toHaveTextContent(
      'Since May 2023 · 3 currencies · 2 still held',
    );
    cleanup();
    renderRail({ history: history({ complete: false }) });
    expect(screen.getByTestId('capital-journey')).toHaveTextContent(
      'Recent history · 3 currencies · 2 still held',
    );
    expect(screen.getByTestId('capital-journey')).not.toHaveTextContent('Since');
  });

  it('tapping the rail calls onInspectJourney', () => {
    const { onInspectJourney } = renderRail();
    fireEvent.click(screen.getByTestId('capital-journey'));
    expect(onInspectJourney).toHaveBeenCalledTimes(1);
  });

  it('appends a new settled destination optimistically, then de-dupes', () => {
    renderRail({ optimisticSymbol: 'EURm' });
    expect(screen.getByTestId('journey-station-EURm')).toBeInTheDocument();
    cleanup();
    // Once the chain data includes it, the optimistic symbol is not doubled.
    renderRail({
      optimisticSymbol: 'EURm',
      history: history({
        stations: [
          ...history().stations,
          { symbol: 'EURm', firstSeen: '2024-09-01T00:00:00.000Z', lastSeen: '2024-09-01T00:00:00.000Z' },
        ],
      }),
    });
    expect(screen.getAllByTestId('journey-station-EURm')).toHaveLength(1);
  });

  it('does not append an optimistic station already in history', () => {
    renderRail({ optimisticSymbol: 'NGNm' });
    expect(screen.getAllByTestId('journey-station-NGNm')).toHaveLength(1);
  });

  it('reduced motion renders the same content', () => {
    reducedMotionState.on = true;
    renderRail();
    expect(screen.getByTestId('capital-journey')).toHaveTextContent(
      'Where your savings have lived',
    );
    expect(screen.getByTestId('journey-station-USDm')).toBeInTheDocument();
    expect(screen.getByTestId('journey-station-NGNm')).toBeInTheDocument();
  });

  it('stays inside the 25-word resting budget', () => {
    renderRail();
    const words = (screen.getByTestId('capital-journey').textContent ?? '')
      .split(/\s+/)
      .filter(Boolean);
    expect(words.length).toBeLessThanOrEqual(25);
  });
});

describe('CapitalJourney — read-only public address', () => {
  const READ_ONLY = {
    address: '0x005177Fe16b3a88796C2dd36f35B19AE90E907b2',
    onClear: vi.fn(),
  };

  it('labels the rail read-only and drops held status entirely', () => {
    renderRail({ readOnly: READ_ONLY });
    const rail = screen.getByTestId('capital-journey');
    expect(rail).toHaveTextContent('Viewing 0x0051…b2 · read-only');
    // We don't know that wallet's balances — no held guessing, no
    // "still held" claim, no data-held marks.
    expect(rail).not.toHaveTextContent('still held');
    expect(rail.querySelectorAll('[data-held]')).toHaveLength(0);
    expect(rail).toHaveTextContent('3 currencies');
  });

  it('Clear returns to the invite state', () => {
    const onClear = vi.fn();
    renderRail({ readOnly: { ...READ_ONLY, onClear } });
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('the connect line uses the shared connect action', () => {
    renderRail({ readOnly: READ_ONLY });
    fireEvent.click(
      screen.getByRole('button', { name: 'Connect to act on it →' }),
    );
    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  it('still opens the journey inspector on tap', () => {
    const onInspectJourney = vi.fn();
    renderRail({ readOnly: READ_ONLY, onInspectJourney });
    fireEvent.click(screen.getByTestId('capital-journey'));
    expect(onInspectJourney).toHaveBeenCalledTimes(1);
  });

  it('stays inside the 30-word read-only budget', () => {
    renderRail({ readOnly: READ_ONLY });
    const words = (screen.getByTestId('capital-journey').textContent ?? '')
      .split(/\s+/)
      .filter(Boolean);
    expect(words.length).toBeLessThanOrEqual(30);
  });
});
