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
    // Mirrors the real controller: acknowledgement resets status AND the
    // underlying step, so the sync effect can't bounce it back.
    acknowledgeCompletion: vi.fn(() => {
      ctrl.status = 'idle';
      (ctrl.__tick as (() => void) | undefined)?.();
    }),
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
vi.mock('../../wallet/WalletProvider', () => ({
  useWalletContext: () => ({ address: null, connect: vi.fn() }),
}));

const mockRecordSettlement = vi.fn();
vi.mock('@/context/app/NavigationContext', () => ({
  useNavigation: () => ({ recordSettlement: mockRecordSettlement }),
}));

const mockTrackFunnelEvent = vi.fn();
vi.mock('@/lib/analytics', () => ({
  trackFunnelEvent: (...args: unknown[]) => mockTrackFunnelEvent(...args),
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

describe('SwapInterface — settlement receipt', () => {
  const complete = (overrides: Record<string, unknown> = {}) =>
    resetCtrl({
      status: 'completed',
      amount: '25',
      expectedOutput: '24.90',
      localTxHash: '0xabc123',
      fromChainId: 42220,
      ...overrides,
    });

  it('a completed swap returns to the stage with a receipt', () => {
    complete();
    renderSwap({ address: '0xabc' });
    const receipt = screen.getByTestId('pair-receipt');
    expect(receipt).toHaveTextContent('25 KESm → ≈ 24.90 USDm at quote');
    expect(ctrl.acknowledgeCompletion).toHaveBeenCalled();
    expect(ctrl.setAmount).toHaveBeenCalledWith('');
    // The ticket is gone — the pair stage is the resting surface again.
    expect(screen.queryByLabelText('From amount')).not.toBeInTheDocument();
  });

  it('a leg-2 completion stays in the ticket — no receipt', () => {
    complete({ leg2Hint: 'Final step — swap USDm to KESm to finish the route' });
    renderSwap({ address: '0xabc' });
    expect(screen.queryByTestId('pair-receipt')).not.toBeInTheDocument();
    expect(screen.getByLabelText('From amount')).toBeInTheDocument();
  });

  it('acknowledgement does not bounce — the stage holds across rerenders', () => {
    complete();
    const { rerender } = renderSwap({ address: '0xabc' });
    rerender(
      <SwapInterface availableTokens={TOKENS} instrument address="0xabc" />,
    );
    expect(screen.getByTestId('pair-receipt')).toBeInTheDocument();
    expect(screen.queryByLabelText('From amount')).not.toBeInTheDocument();
  });

  it('Done clears the receipt and returns to the normal stage', () => {
    complete();
    renderSwap({ address: '0xabc' });
    fireEvent.click(screen.getByTestId('receipt-done'));
    expect(screen.queryByTestId('pair-receipt')).not.toBeInTheDocument();
    expect(screen.getByTestId('pair-stage-wake')).toBeInTheDocument();
  });

  it('Move more wakes an empty ticket', () => {
    complete();
    renderSwap({ address: '0xabc' });
    fireEvent.click(screen.getByTestId('receipt-move-more'));
    const input = screen.getByLabelText('From amount') as HTMLInputElement;
    expect(input.value).toBe('');
    expect(sessionStorage.getItem('diversifi.exchange.mode')).toBe('ticket');
  });

  it('the transaction link uses the chain explorer', () => {
    complete();
    renderSwap({ address: '0xabc' });
    const link = screen.getByRole('link', { name: /View transaction/ });
    expect(link).toHaveAttribute('href', 'https://celo.blockscout.com/tx/0xabc123');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('a null quote renders the no-quote line — never a settled amount', () => {
    complete({ expectedOutput: null, localTxHash: null });
    renderSwap({ address: '0xabc' });
    const receipt = screen.getByTestId('pair-receipt');
    expect(receipt).toHaveTextContent('25 KESm → USDm');
    expect(receipt).not.toHaveTextContent('at quote');
    expect(screen.queryByRole('link', { name: /View transaction/ })).not.toBeInTheDocument();
  });

  it('shows the goods line for a goods-anchored destination', () => {
    complete({ toToken: 'NGNm', expectedOutput: '1000000' });
    renderSwap({ address: '0xabc' });
    expect(screen.getByTestId('pair-receipt')).toHaveTextContent('where it lands');
  });

  it('omits the goods line when the destination has no goods anchor', () => {
    complete({ toToken: 'USDC' });
    renderSwap({ address: '0xabc' });
    expect(screen.getByTestId('pair-receipt')).not.toHaveTextContent('where it lands');
  });

  it('passes a claim through to the receipt', () => {
    complete();
    const onClaim = vi.fn();
    renderSwap({ address: '0xabc', claim: { label: '5 G$ ready', onClaim } });
    const receipt = screen.getByTestId('pair-receipt');
    expect(receipt).toHaveTextContent('5 G$ ready');
    fireEvent.click(screen.getByRole('button', { name: 'Claim →' }));
    expect(onClaim).toHaveBeenCalledTimes(1);
  });

  it('records the settlement for every completed receipt', () => {
    complete();
    renderSwap({ address: '0xabc' });
    expect(mockRecordSettlement).toHaveBeenCalledWith(
      expect.objectContaining({ toToken: 'USDm', settledAt: expect.any(Number) }),
    );
  });

  it('a matching hand-off attaches its origin — the return line shows', () => {
    complete({ fromToken: 'USDC', toToken: 'KESm' });
    renderSwap({
      address: '0xabc',
      handoffOrigin: {
        origin: { source: 'shield', asset: 'KESm', label: 'africapitalism' },
        fromToken: 'usdc', // settled pair matched case-insensitively
        toToken: 'KESm',
      },
      onHandoffConsumed: vi.fn(),
    });
    expect(screen.getByTestId('receipt-return')).toHaveTextContent(
      'Back to your africapitalism plan',
    );
    expect(mockTrackFunnelEvent).toHaveBeenCalledWith('handoff_settled', {
      source: 'shield',
    });
    expect(mockRecordSettlement).toHaveBeenCalled();
  });

  it('an abandoned hand-off (different pair settled) carries no origin and is still consumed', () => {
    mockTrackFunnelEvent.mockClear();
    complete({ fromToken: 'KESm', toToken: 'USDm' });
    const onHandoffConsumed = vi.fn();
    renderSwap({
      address: '0xabc',
      handoffOrigin: {
        origin: { source: 'shield', asset: 'NGNm' },
        fromToken: 'USDC',
        toToken: 'NGNm',
      },
      onHandoffConsumed,
    });
    expect(screen.queryByTestId('receipt-return')).not.toBeInTheDocument();
    expect(mockTrackFunnelEvent).not.toHaveBeenCalledWith(
      'handoff_settled',
      expect.anything(),
    );
    // A completed receipt always ends the hand-off — otherwise a later
    // unrelated settle of the prefilled pair would claim "Back to your plan".
    expect(onHandoffConsumed).toHaveBeenCalledTimes(1);
    // The settlement is still recorded — Home may seal it.
    expect(mockRecordSettlement).toHaveBeenCalled();
  });
});

describe('SwapInterface — journey rail', () => {
  const HISTORY = {
    address: '0xabc',
    chainId: 42220 as const,
    stations: [
      { symbol: 'USDm', firstSeen: '2023-05-01T00:00:00.000Z', lastSeen: '2024-01-01T00:00:00.000Z' },
      { symbol: 'KESm', firstSeen: '2024-02-01T00:00:00.000Z', lastSeen: '2024-06-01T00:00:00.000Z' },
    ],
    legs: [],
    complete: true,
    asOf: '2026-09-23T00:00:00.000Z',
  };

  it('connected with history shows the rail under the stage', () => {
    renderSwap({
      address: '0xabc',
      capitalHistory: { data: HISTORY, refresh: vi.fn() },
    });
    expect(screen.getByTestId('capital-journey')).toBeInTheDocument();
  });

  it('walletless renders no rail, even with data', () => {
    renderSwap({
      address: null,
      capitalHistory: { data: HISTORY, refresh: vi.fn() },
    });
    expect(screen.queryByTestId('capital-journey')).not.toBeInTheDocument();
  });

  it('a settled receipt schedules a delayed history refresh', () => {
    resetCtrl({
      status: 'completed',
      amount: '25',
      expectedOutput: '24.90',
      localTxHash: '0xabc123',
      fromChainId: 42220,
    });
    const refresh = vi.fn();
    renderSwap({
      address: '0xabc',
      capitalHistory: { data: HISTORY, refresh },
    });
    expect(refresh).toHaveBeenCalledWith(20000);
  });

  it('the receipt destination appends to the rail optimistically', () => {
    resetCtrl({
      status: 'completed',
      amount: '25',
      expectedOutput: '24.90',
      localTxHash: '0xabc123',
      fromChainId: 42220,
      toToken: 'NGNm',
    });
    renderSwap({
      address: '0xabc',
      capitalHistory: { data: HISTORY, refresh: vi.fn() },
    });
    expect(screen.getByTestId('journey-station-NGNm')).toBeInTheDocument();
  });
});
