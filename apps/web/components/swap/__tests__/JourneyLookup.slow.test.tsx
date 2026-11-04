/**
 * JourneyLookup — the walletless journey slot. Pins: the ≤16-word invite
 * line wired to the shared connect action, the in-place reveal with
 * client-side validation (invalid/cancel/Escape flows), the read-only
 * rail hand-off, and the honest empty/failure lines — never partial data.
 */

// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { JourneyLookup } from '../JourneyLookup';
import type { CapitalHistory } from '@diversifi/shared/src/services/capital-history';

const mockConnect = vi.fn();
vi.mock('@/components/wallet/WalletProvider', () => ({
  useWalletContext: () => ({ connect: mockConnect }),
}));

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => true };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const VALID = '0x005177Fe16b3a88796C2dd36f35B19AE90E907b2';

const history = (over: Partial<CapitalHistory> = {}): CapitalHistory => ({
  address: VALID,
  chainId: 42220,
  stations: [
    { symbol: 'USDm', firstSeen: '2023-05-01T00:00:00.000Z', lastSeen: '2024-01-01T00:00:00.000Z' },
    { symbol: 'KESm', firstSeen: '2024-02-01T00:00:00.000Z', lastSeen: '2024-06-01T00:00:00.000Z' },
  ],
  legs: [],
  complete: true,
  asOf: '2026-09-23T00:00:00.000Z',
  ...over,
});

function renderLookup(over: Partial<Parameters<typeof JourneyLookup>[0]> = {}) {
  const props = {
    lookupAddress: null,
    history: null,
    isLoading: false,
    error: false,
    onLookup: vi.fn(),
    onInspectJourney: vi.fn(),
    ...over,
  };
  render(<JourneyLookup {...props} />);
  return props;
}

describe('JourneyLookup — invite', () => {
  it('shows the invite line and stays under 16 words', () => {
    renderLookup();
    const line = screen.getByText('View any wallet →').closest('p')!;
    const words = (line.textContent ?? '').split(/\s+/).filter(Boolean);
    expect(words.length).toBeLessThanOrEqual(16);
    expect(line).toHaveTextContent(
      'Your own journey appears here when you connect',
    );
  });

  it('the connect copy triggers the shared connect action', () => {
    renderLookup();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Your own journey appears here when you connect',
      }),
    );
    expect(mockConnect).toHaveBeenCalledTimes(1);
  });
});

describe('JourneyLookup — reveal and validation', () => {
  it('reveals a single-line input in place — no card, no modal', () => {
    renderLookup();
    fireEvent.click(screen.getByRole('button', { name: 'View any wallet →' }));
    expect(
      screen.getByPlaceholderText('Paste a Celo address'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('rejects an invalid address with a one-line inline error', () => {
    const { onLookup } = renderLookup();
    fireEvent.click(screen.getByRole('button', { name: 'View any wallet →' }));
    fireEvent.change(screen.getByPlaceholderText('Paste a Celo address'), {
      target: { value: 'not-an-address' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    expect(
      screen.getByText(/doesn.t look like a Celo address\./),
    ).toBeInTheDocument();
    expect(onLookup).not.toHaveBeenCalled();
  });

  it('accepts a valid address via View', () => {
    const { onLookup } = renderLookup();
    fireEvent.click(screen.getByRole('button', { name: 'View any wallet →' }));
    fireEvent.change(screen.getByPlaceholderText('Paste a Celo address'), {
      target: { value: VALID },
    });
    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    expect(onLookup).toHaveBeenCalledWith(VALID);
  });

  it('Cancel collapses the input', () => {
    renderLookup();
    fireEvent.click(screen.getByRole('button', { name: 'View any wallet →' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(
      screen.queryByPlaceholderText('Paste a Celo address'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'View any wallet →' }),
    ).toBeInTheDocument();
  });

  it('Escape collapses the input', () => {
    renderLookup();
    fireEvent.click(screen.getByRole('button', { name: 'View any wallet →' }));
    fireEvent.keyDown(screen.getByPlaceholderText('Paste a Celo address'), {
      key: 'Escape',
    });
    expect(
      screen.queryByPlaceholderText('Paste a Celo address'),
    ).not.toBeInTheDocument();
  });
});

describe('JourneyLookup — viewed states', () => {
  it('renders the read-only rail for a wallet with history', () => {
    renderLookup({ lookupAddress: VALID, history: history() });
    const rail = screen.getByTestId('capital-journey');
    expect(rail).toHaveTextContent('Viewing 0x0051…b2 · read-only');
    expect(rail).not.toHaveTextContent('still held');
  });

  it('Clear on the rail returns to the invite', () => {
    const { onLookup } = renderLookup({
      lookupAddress: VALID,
      history: history(),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onLookup).toHaveBeenCalledWith(null);
  });

  it('shows the no-history line for an address with <2 stations', () => {
    renderLookup({
      lookupAddress: VALID,
      history: history({ stations: [] }),
    });
    expect(
      screen.getByText(/No currency history found for 0x0051…b2 on Celo\./),
    ).toBeInTheDocument();
  });

  it('shows the failure line on error — never partial data', () => {
    renderLookup({
      lookupAddress: VALID,
      history: history(),
      error: true,
    });
    expect(
      screen.getByText(/Couldn.t read that wallet right now\./),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('capital-journey')).not.toBeInTheDocument();
  });

  it('renders nothing interactive while the fetch is in flight', () => {
    renderLookup({ lookupAddress: VALID, isLoading: true });
    expect(screen.getByText('Reading that wallet…')).toBeInTheDocument();
    expect(screen.queryByTestId('capital-journey')).not.toBeInTheDocument();
  });
});
