/**
 * SwapInterface — the pair is the resting object, the ticket its acting
 * mode. Rest shows the beam stage, not the form; the CTA wakes the
 * ticket (and remembers it for the session); real intent (an amount,
 * a quote in flight, a leg-2 hint, a recipient) forces the ticket so a
 * prefill never lands on the stage. "← Pair" collapses back.
 */

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';

// ── Mutable controller state ─────────────────────────────────────────
const TOKENS = [
  { symbol: 'KESm', name: 'Kenyan Shilling', region: 'Kenya' },
  { symbol: 'USDm', name: 'Mento Dollar', region: 'United States' },
  { symbol: 'EURm', name: 'Mento Euro', region: 'Europe' },
  { symbol: 'USDC', name: 'USD Coin', region: 'United States' },
  { symbol: 'NGNm', name: 'Nigerian Naira', region: 'Nigeria' },
  { symbol: 'PAXG', name: 'PAX Gold', region: 'Commodities' },
];

let ctrl: Record<string, unknown>;

// The controller is React state in production — the mock setters must
// trigger a rerender so the forced-ticket effect sees the new amount.
const setField = (key: string) =>
  vi.fn((v: unknown) => {
    ctrl[key] = v;
    (ctrl.__tick as (() => void) | undefined)?.();
  });

function resetCtrl(overrides: Record<string, unknown> = {}) {
  ctrl = {
    fromToken: 'KESm',
    setFromToken: setField('fromToken'),
    toToken: 'USDm',
    setToToken: setField('toToken'),
    amount: '',
    setAmount: setField('amount'),
    slippageTolerance: 0.5,
    setSlippageTolerance: vi.fn(),
    recipientAddress: null,
    setRecipientAddress: vi.fn(),
    phoneNumber: null,
    setPhoneNumber: setField('phoneNumber'),
    fromChainId: 42220,
    setFromChainId: vi.fn(),
    toChainId: 42220,
    setToChainId: vi.fn(),
    status: 'idle',
    localError: null,
    localErrorClass: null,
    localTxHash: null,
    isLoading: false,
    mounted: true,
    routeProvider: 'squid',
    signatureCount: 0,
    viaHub: null,
    applyViaHub: vi.fn(),
    leg2Hint: null,
    availableFromTokens: TOKENS,
    availableToTokens: TOKENS,
    tokenBalances: {},
    expectedOutput: null,
    quotedAt: null,
    refreshQuote: vi.fn(),
    inflationDataSource: 'api',
    fromTokenInflationRate: null,
    toTokenInflationRate: null,
    fromTokenRegion: 'Kenya',
    toTokenRegion: 'United States',
    inflationDifference: null,
    hasInflationBenefit: false,
    handleSwitchTokens: vi.fn(),
    executeSwap: vi.fn(),
    refreshBalances: vi.fn(),
    ...overrides,
  };
}

vi.mock('../../../hooks/use-swap-controller', () => ({
  useSwapController: () => {
    const [, tick] = React.useReducer((x: number) => x + 1, 0);
    ctrl.__tick = tick;
    return ctrl;
  },
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

vi.mock('../ExpectedOutputCard', () => ({ default: () => null }));
vi.mock('../SwapStatus', () => ({ default: () => null }));
vi.mock('../InflationInsightRow', () => ({ default: () => null }));
vi.mock('../ChainSelector', () => ({ default: () => null }));
vi.mock('../SocialContactPicker', () => ({ SocialContactPicker: () => null }));
vi.mock('../SwapActionButton', () => ({
  default: () => React.createElement('button', { type: 'button' }, 'swap'),
}));
vi.mock('../../wallet/WalletButton', () => ({
  default: () => React.createElement('button', { type: 'button' }, 'connect'),
}));

import SwapInterface from '../SwapInterface';

beforeEach(() => {
  sessionStorage.clear();
  resetCtrl();
});
afterEach(() => cleanup());

function renderSwap(props: Record<string, unknown> = {}, ref?: React.Ref<unknown>) {
  return render(
    <SwapInterface
      ref={ref as never}
      availableTokens={TOKENS}
      instrument
      {...props}
    />,
  );
}

describe('SwapInterface — pair stage at rest', () => {
  it('rests on the pair stage with no amount input', () => {
    renderSwap({ address: null });
    expect(screen.getByTestId('pair-stage')).toBeInTheDocument();
    expect(screen.queryByLabelText('From amount')).not.toBeInTheDocument();
    expect(screen.getByTestId('pair-stage-wake')).toHaveTextContent('Move savings');
  });

  it('the CTA wakes the ticket and remembers it for the session', () => {
    renderSwap({ address: null });
    fireEvent.click(screen.getByTestId('pair-stage-wake'));
    expect(screen.getByLabelText('From amount')).toBeInTheDocument();
    expect(sessionStorage.getItem('diversifi.exchange.mode')).toBe('ticket');
  });

  it('session memory restores the ticket on remount', () => {
    sessionStorage.setItem('diversifi.exchange.mode', 'ticket');
    renderSwap({ address: null });
    expect(screen.queryByTestId('pair-stage')).not.toBeInTheDocument();
    expect(screen.getByLabelText('From amount')).toBeInTheDocument();
  });

  it('a setTokens prefill with an amount lands directly in the ticket', () => {
    const ref = React.createRef<{
      setTokens: (f: string, t: string, amount?: string) => void;
    }>();
    renderSwap({ address: '0xabc' }, ref);
    expect(screen.getByTestId('pair-stage')).toBeInTheDocument();
    act(() => {
      ref.current!.setTokens('KESm', 'USDC', '5');
    });
    expect(screen.getByLabelText('From amount')).toBeInTheDocument();
    expect(screen.queryByTestId('pair-stage')).not.toBeInTheDocument();
  });

  it('collapses back to the stage and clears the amount', () => {
    renderSwap({ address: null });
    fireEvent.click(screen.getByTestId('pair-stage-wake'));
    fireEvent.click(screen.getByRole('button', { name: 'Back to pair view' }));
    expect(screen.getByTestId('pair-stage')).toBeInTheDocument();
    expect(sessionStorage.getItem('diversifi.exchange.mode')).toBeNull();
    expect(ctrl.setAmount).toHaveBeenCalledWith('');
  });

  it('a swap in flight forces the ticket — no stage flicker', () => {
    resetCtrl({ isLoading: true });
    renderSwap({ address: '0xabc' });
    expect(screen.queryByTestId('pair-stage')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back to pair view' })).not.toBeInTheDocument();
  });

  it('the ticket is still: no beat rotation, and no collapse while acting', () => {
    renderSwap({ address: null });
    fireEvent.click(screen.getByTestId('pair-stage-wake'));
    // Still shows the corridor context as status…
    expect(screen.getByTestId('corridor-line')).toBeInTheDocument();
  });
});

describe('SwapInterface — story strip', () => {
  it('connected: held tokens lead the strip, signature pairs follow', () => {
    resetCtrl({
      tokenBalances: {
        NGNm: { formattedBalance: '100.00', value: 65 },
        PAXG: { formattedBalance: '0.05', value: 300 },
      },
    });
    renderSwap({ address: '0xabc' });
    // PAXG has the higher value → it leads, paired against USDm.
    const chips = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-pressed') !== null && / → /.test(b.textContent ?? ''));
    expect(chips[0]).toHaveTextContent('PAXG → USDm');
    expect(chips[1]).toHaveTextContent('NGNm → USDm');
  });

  it('walletless: the visitor region token leads when it has a story', () => {
    renderSwap({ address: null, preferredFromRegion: 'Kenya' });
    const chips = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-pressed') !== null && / → /.test(b.textContent ?? ''));
    expect(chips[0]).toHaveTextContent('KESm → USDm');
  });

  it('the strip renders under the stage, not in ticket mode', () => {
    renderSwap({ address: null });
    expect(screen.getByRole('button', { name: 'KESm to USDm' })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('pair-stage-wake'));
    expect(screen.queryByRole('button', { name: 'KESm to USDm' })).not.toBeInTheDocument();
  });
});
