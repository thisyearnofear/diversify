/**
 * SwapStatus — the in-flight pair object.
 *
 * While a swap is out, the two coins converge (RiveNetPair); completion is
 * owned by the success celebration, not the wait card, so `completed`
 * renders nothing here. Error state shows the message without the pair —
 * a failed tx isn't a relationship moment.
 */

// @vitest-environment jsdom

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import SwapStatus from '../SwapStatus';

afterEach(() => cleanup());

const BASE = { error: null, txHash: null, fromChainId: 42220 };

describe('SwapStatus pair object', () => {
  it('shows the converging pair while approving', () => {
    render(
      <SwapStatus {...BASE} status="approving" fromToken="KESm" toToken="USDC" />,
    );
    expect(screen.getByTestId('swap-pair-wait')).toBeInTheDocument();
    expect(screen.getByText('Preparing your route')).toBeInTheDocument();
  });

  it('shows the pair while the tx confirms', () => {
    render(
      <SwapStatus {...BASE} status="swapping" fromToken="KESm" toToken="USDC" />,
    );
    expect(screen.getByTestId('swap-pair-wait')).toBeInTheDocument();
    expect(screen.getByText('Transaction in progress')).toBeInTheDocument();
  });

  it('still shows status text when token props are absent', () => {
    render(<SwapStatus {...BASE} status="swapping" />);
    expect(screen.queryByTestId('swap-pair-wait')).not.toBeInTheDocument();
    expect(screen.getByText('Transaction in progress')).toBeInTheDocument();
  });

  it('renders nothing on idle or completed — the success modal owns the moment', () => {
    const { container: idle } = render(
      <SwapStatus {...BASE} status="idle" fromToken="KESm" toToken="USDC" />,
    );
    expect(idle).toBeEmptyDOMElement();
    const { container: done } = render(
      <SwapStatus {...BASE} status="completed" fromToken="KESm" toToken="USDC" />,
    );
    expect(done).toBeEmptyDOMElement();
  });

  it('shows the error without the pair', () => {
    render(
      <SwapStatus
        {...BASE}
        status="error"
        error="User rejected the transaction"
        fromToken="KESm"
        toToken="USDC"
      />,
    );
    expect(screen.queryByTestId('swap-pair-wait')).not.toBeInTheDocument();
    expect(screen.getByText('User rejected the transaction')).toBeInTheDocument();
  });
});
