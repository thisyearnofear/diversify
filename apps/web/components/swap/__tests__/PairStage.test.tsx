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
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import PairStage, { type PairReceipt } from '../PairStage';
import type { TokenPickerItem } from '../TokenPickerSheet';

// framer-motion reads prefers-reduced-motion once via a cached
// matchMedia — drive it through useReducedMotion instead.
const reducedMotionState = { on: false };
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => reducedMotionState.on };
});

const mockNavigateWithIntent = vi.fn();
vi.mock('@/context/app/NavigationContext', () => ({
  useNavigation: () => ({ navigateWithIntent: mockNavigateWithIntent }),
}));

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
  const view = render(<PairStage {...props} />);
  return { ...props, rerender: view.rerender };
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

describe('PairStage — the pair time machine', () => {
  it('renders the horizon control only when the pair has a what-if', () => {
    renderStage({ fromToken: 'NGNm', toToken: 'USDm' });
    expect(screen.getByTestId('horizon-control')).toBeInTheDocument();
    cleanup();
    // Held level at every horizon — nothing honest to say, no control.
    renderStage({ fromToken: 'EURm', toToken: 'GBPm' });
    expect(screen.queryByTestId('horizon-control')).not.toBeInTheDocument();
  });

  it('rests on 5y — the corridor line reads as before', () => {
    renderStage({ fromToken: 'NGNm', toToken: 'USDm' });
    const five = screen.getByRole('radio', { name: '5y' });
    expect(five).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('corridor-line')).toHaveTextContent(
      'NGN lost ~60% to USD',
    );
    expect(screen.queryByTestId('pair-whatif')).not.toBeInTheDocument();
  });

  it('tapping 3y re-weighs the beam to the 3y drift and pins the what-if', () => {
    renderStage({ fromToken: 'NGNm', toToken: 'USDm' });
    const before = screen.getByTestId('pair-beam').dataset.tilt;
    fireEvent.click(screen.getByRole('radio', { name: '3y' }));
    const after = Number(screen.getByTestId('pair-beam').dataset.tilt);
    // 3y drift is ~55pts vs 5y's ~60pts — still tilted from, but less.
    expect(after).toBeLessThan(0);
    expect(String(after)).not.toBe(before);
    const whatIf = screen.getByTestId('pair-whatif');
    expect(whatIf).toHaveTextContent('in 2022');
    expect(whatIf).toHaveTextContent('bags of rice');
    expect(whatIf).toHaveTextContent('What if · data to Jul 2025');
  });

  it('the pinned what-if does not rotate away once explored', () => {
    vi.useFakeTimers();
    try {
      renderStage({ fromToken: 'NGNm', toToken: 'USDm' });
      fireEvent.click(screen.getByRole('radio', { name: '5y' }));
      expect(screen.getByTestId('pair-whatif')).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(30000);
      });
      expect(screen.getByTestId('pair-whatif')).toBeInTheDocument();
      expect(screen.getByTestId('corridor-line').textContent).not.toContain(
        'Watch',
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('a pair change resets the horizon and the pin', () => {
    const props = renderStage({ fromToken: 'NGNm', toToken: 'USDm' });
    fireEvent.click(screen.getByRole('radio', { name: '3y' }));
    expect(screen.getByTestId('pair-whatif')).toHaveTextContent('in 2022');
    props.rerender(
      <PairStage {...props} fromToken="KESm" toToken="USDm" />,
    );
    expect(screen.getByRole('radio', { name: '5y' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.queryByTestId('pair-whatif')).not.toBeInTheDocument();
  });

  it('the USD→NGN what-if is honest about losing — a smaller number', () => {
    renderStage({ fromToken: 'USDm', toToken: 'NGNm' });
    fireEvent.click(screen.getByRole('radio', { name: '5y' }));
    expect(screen.getByTestId('pair-whatif')).toHaveTextContent(
      'every 100 USD would be ~40 USD',
    );
  });

  it('reduced motion shows the same pinned content', () => {
    reducedMotionState.on = true;
    renderStage({ fromToken: 'NGNm', toToken: 'USDm' });
    fireEvent.click(screen.getByRole('radio', { name: '3y' }));
    expect(screen.getByTestId('pair-whatif')).toHaveTextContent('in 2022');
    reducedMotionState.on = false;
  });

  it('the explored stage stays inside a 70-word budget', () => {
    renderStage({ fromToken: 'NGNm', toToken: 'USDm' });
    fireEvent.click(screen.getByRole('radio', { name: '5y' }));
    const words = (screen.getByTestId('pair-stage').textContent ?? '')
      .split(/\s+/)
      .filter(Boolean);
    expect(words.length).toBeLessThanOrEqual(70);
  });
});

describe('PairStage — settlement receipt', () => {
  const receiptFor = (over: Partial<PairReceipt> = {}): PairReceipt => ({
    fromToken: 'USDm',
    toToken: 'NGNm',
    amountIn: '100',
    quotedOut: '61.20',
    txHash: '0xabc123',
    chainId: 42220,
    settledAt: 1,
    ...over,
  });

  const renderReceipt = (
    receipt: Partial<PairReceipt> | null = {},
    props: Partial<Parameters<typeof PairStage>[0]> = {},
  ) =>
    renderStage({
      fromToken: 'USDm',
      toToken: 'NGNm',
      receipt: receipt === null ? null : receiptFor(receipt),
      onDismissReceipt: vi.fn(),
      onMoveMore: vi.fn(),
      ...props,
    });

  it('replaces the corridor line with the sealed record', () => {
    renderReceipt();
    const receipt = screen.getByTestId('pair-receipt');
    expect(receipt).toHaveTextContent('Moved from');
    expect(receipt).toHaveTextContent('100 USDm → ≈ 61.20 NGNm at quote');
    expect(receipt).toHaveTextContent('Settled on Celo');
    expect(screen.queryByTestId('corridor-line')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pair-stage-wake')).not.toBeInTheDocument();
  });

  it('announces the settlement politely', () => {
    renderReceipt();
    const live = screen.getByTestId('pair-receipt');
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live).toHaveTextContent('Settled: 100 USDm to NGNm');
  });

  it('links the transaction to the chain explorer', () => {
    renderReceipt();
    const link = screen.getByRole('link', { name: /View transaction/ });
    expect(link).toHaveAttribute('href', 'https://celo.blockscout.com/tx/0xabc123');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('renders the no-quote line when quotedOut is null — never a settled amount', () => {
    renderReceipt({ quotedOut: null, txHash: null });
    const receipt = screen.getByTestId('pair-receipt');
    expect(receipt).toHaveTextContent('100 USDm → NGNm');
    expect(receipt).not.toHaveTextContent('at quote');
    expect(screen.queryByRole('link', { name: /View transaction/ })).not.toBeInTheDocument();
  });

  it.each(['NGNm', 'GHSm', 'KESm'])(
    'shows the goods line for the %s destination',
    (toToken) => {
      renderStage({
        fromToken: 'USDm',
        toToken,
        receipt: receiptFor({ toToken, quotedOut: '1000000' }),
      });
      expect(screen.getByTestId('pair-receipt')).toHaveTextContent('where it lands');
    },
  );

  it('omits the goods line when the destination has no goods anchor', () => {
    renderStage({
      fromToken: 'NGNm',
      toToken: 'USDC',
      receipt: receiptFor({ toToken: 'USDC' }),
    });
    expect(screen.getByTestId('pair-receipt')).not.toHaveTextContent('where it lands');
  });

  it('shows the claim line and its action when claimable', () => {
    const onClaim = vi.fn();
    renderReceipt({}, { claim: { label: '5 G$ ready', onClaim } });
    expect(screen.getByTestId('pair-receipt')).toHaveTextContent('5 G$ ready');
    fireEvent.click(screen.getByRole('button', { name: 'Claim →' }));
    expect(onClaim).toHaveBeenCalledTimes(1);
  });

  it('seals the destination coin — the mint-mark becomes a persistent ✓', () => {
    renderReceipt();
    // The flag mint-mark is swapped for the emerald check for the
    // receipt's lifetime; the travel coin + seal ring play once.
    expect(screen.getByTestId('pair-stage')).toHaveTextContent('✓');
    expect(screen.getByTestId('receipt-travel')).toBeInTheDocument();
    expect(screen.getByTestId('receipt-seal')).toBeInTheDocument();
  });

  it('reduced motion: the ✓ shows immediately with no travel or pulse', () => {
    reducedMotionState.on = true;
    renderReceipt();
    expect(screen.getByTestId('pair-stage')).toHaveTextContent('✓');
    expect(screen.queryByTestId('receipt-travel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('receipt-seal')).not.toBeInTheDocument();
    reducedMotionState.on = false;
  });

  it('Done dismisses; Move more hands back to the ticket', () => {
    const props = renderReceipt();
    fireEvent.click(screen.getByTestId('receipt-done'));
    expect(props.onDismissReceipt).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('receipt-move-more'));
    expect(props.onMoveMore).toHaveBeenCalledTimes(1);
  });

  it('the receipt stays under its 45-word budget', () => {
    renderReceipt({}, { claim: { label: '5 G$ ready', onClaim: vi.fn() } });
    const words = (screen.getByTestId('pair-receipt').textContent ?? '')
      .split(/\s+/)
      .filter(Boolean);
    expect(words.length).toBeLessThanOrEqual(45);
  });

  it('a shield-origin receipt offers the return line and leads back to the plan slice', () => {
    renderReceipt({
      origin: { source: 'shield', asset: 'NGNm', label: 'africapitalism' },
    });
    const back = screen.getByTestId('receipt-return');
    expect(back).toHaveTextContent('Back to your africapitalism plan');
    fireEvent.click(back);
    expect(mockNavigateWithIntent).toHaveBeenCalledWith('protect', {
      source: 'exchange',
      asset: 'NGNm',
    });
  });

  it('the return line falls back to the plain label when none was carried', () => {
    renderReceipt({ origin: { source: 'shield', asset: 'NGNm' } });
    expect(screen.getByTestId('receipt-return')).toHaveTextContent(
      'Back to your plan',
    );
  });

  it.each([undefined, { source: 'guardian' } as const])(
    'no return line for a %s origin',
    (origin) => {
      renderReceipt(origin ? { origin } : {});
      expect(screen.queryByTestId('receipt-return')).not.toBeInTheDocument();
    },
  );
});
