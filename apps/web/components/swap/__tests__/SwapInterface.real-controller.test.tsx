/**
 * SwapInterface + the REAL useSwapController — the guard the mocked
 * controller tests can't provide. A regression that restores a non-empty
 * initial amount (the old "10" default) makes forcedTicket true on mount
 * and the pair stage disappears for every visitor.
 */

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';

// The controller's own dependencies are mocked; the controller itself is
// real so its initial state is the production initial state.
vi.mock('../../../hooks/use-swap', () => ({
  useSwap: () => ({
    swap: vi.fn(),
    error: null,
    errorClass: null,
    txHash: null,
    step: 'idle',
    reset: vi.fn(),
  }),
}));

vi.mock('../../../hooks/use-expected-amount-out', () => ({
  useExpectedAmountOut: () => ({
    expectedOutput: null,
    isLoading: false,
    quotedAt: null,
    refreshQuote: vi.fn(),
  }),
}));

vi.mock('../../../context/app/PortfolioContext', () => ({
  useSharedMultichainBalances: () => ({ tokenMap: {}, refresh: vi.fn() }),
}));

vi.mock('../../../hooks/use-inflation-data', () => ({
  useInflationData: () => ({
    getInflationRateForStablecoin: () => 0,
    getRegionForStablecoin: () => '',
    dataSource: 'static',
  }),
}));

vi.mock('../../../hooks/use-streak-rewards', () => ({
  useStreakRewards: () => ({ recordSwap: vi.fn() }),
}));

vi.mock('@/context/app/ExperienceContext', () => ({
  useExperience: () => ({
    experienceMode: 'advanced',
    shouldShowAdvancedFeatures: () => false,
    shouldShowIntermediateFeatures: () => true,
  }),
}));

vi.mock('@/context/app/StrategyContext', () => ({
  useStrategy: () => ({ financialStrategy: null }),
}));

vi.mock('@/hooks/use-advisor', () => ({
  useAdvisor: () => ({ askAdvisor: vi.fn() }),
}));

vi.mock('@/hooks/use-mobile', () => ({ useMobile: () => false }));

vi.mock('../../../hooks/use-corridor-signals', () => ({
  useCorridorSignals: () => null,
}));

vi.mock('../../../hooks/use-best-yield', () => ({
  useBestYield: () => ({ data: null }),
  yieldHintForDestination: () => null,
}));

vi.mock('../../../hooks/use-social-resolve', () => ({
  useSocialResolve: () => ({ resolveIdentifier: vi.fn() }),
}));

vi.mock('../../wallet/WalletProvider', () => ({
  useWalletContext: () => ({ address: null, connect: vi.fn() }),
}));

import SwapInterface from '../SwapInterface';

const TOKENS = [
  { symbol: 'KESm', name: 'Kenyan Shilling', region: 'Kenya' },
  { symbol: 'USDm', name: 'Mento Dollar', region: 'United States' },
  { symbol: 'EURm', name: 'Mento Euro', region: 'Europe' },
];

beforeEach(() => sessionStorage.clear());
afterEach(() => cleanup());

describe('SwapInterface — real controller initial state', () => {
  it('a fresh visitor rests on the pair stage, not the ticket', () => {
    // No mocked controller, no amount override — this exercises the real
    // useSwapController initial state end to end.
    render(<SwapInterface availableTokens={TOKENS} instrument />);
    expect(screen.getByTestId('pair-stage')).toBeInTheDocument();
    expect(screen.queryByLabelText('From amount')).not.toBeInTheDocument();
  });
});
