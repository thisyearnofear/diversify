/**
 * SwapStatus — the in-flight pair object.
 *
 * While a swap is out, the two coins converge (RiveNetPair); completion is
 * owned by the success celebration, not the wait card, so `completed`
 * renders nothing here. Error state shows the message without the pair —
 * a failed tx isn't a relationship moment.
 */

// @vitest-environment jsdom

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
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

describe('SwapStatus error classes', () => {
  it('onchain-failed reassures that funds never left the wallet', () => {
    render(
      <SwapStatus
        {...BASE}
        status="error"
        errorClass="onchain-failed"
        error="Transaction was reverted"
      />,
    );
    expect(screen.getByText('Route failed on-chain')).toBeInTheDocument();
    expect(screen.getByText(/never left your wallet/)).toBeInTheDocument();
  });

  it('no-route suggests a larger amount and offers the hub leg when provided', () => {
    const onViaHub = vi.fn();
    render(
      <SwapStatus
        {...BASE}
        status="error"
        errorClass="no-route"
        error="No Uniswap V3 pool found"
        viaHubSymbol="USDm"
        onViaHub={onViaHub}
      />,
    );
    expect(screen.getByText('No route for this amount')).toBeInTheDocument();
    const btn = screen.getByTestId('via-hub-action');
    fireEvent.click(btn);
    expect(onViaHub).toHaveBeenCalled();
  });

  it('session class tells the user to reconnect', () => {
    render(
      <SwapStatus
        {...BASE}
        status="error"
        errorClass="session"
        error="Privy iframe failed to load"
      />,
    );
    expect(screen.getByText('Wallet session expired')).toBeInTheDocument();
  });

  it('no-gas names the missing fee token', () => {
    render(
      <SwapStatus
        {...BASE}
        status="error"
        errorClass="no-gas"
        error="You need a little CELO for network fees before swapping."
      />,
    );
    expect(screen.getByText('Not enough for network fees')).toBeInTheDocument();
    expect(screen.getByText(/CELO/)).toBeInTheDocument();
  });

  it('submitted tx hash still links to the explorer on failure', () => {
    render(
      <SwapStatus
        {...BASE}
        status="error"
        errorClass="onchain-failed"
        error="reverted"
        txHash="0xabc123"
      />,
    );
    const link = screen.getByText('View on Explorer').closest('a');
    expect(link).toHaveAttribute(
      'href',
      'https://celo.blockscout.com/tx/0xabc123',
    );
  });
});
