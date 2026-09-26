/**
 * Tests for RwaVaultSleeve — the tokenized-asset lens inspector.
 *
 * Pins the contract:
 *   - Holdable assets (USDY, syrupUSDC, PAXG) lead; IXS is an off-app section.
 *   - Live figures render only when present — never a default number.
 *   - The Islamic lens flags interest-bearing assets and never targets them.
 *   - One CTA: review a move (connected) or the wallet CTA (walletless).
 *   - SERV stays a quiet rail on the IXS section; degraded keeps the heuristic.
 */

// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { RwaVaultSleeve } from '../RwaVaultSleeve';
import { EMPTY_RWA_MARKET } from '@diversifi/shared/src/services/rwa-market-service';

const ALLOCATIONS = [
  { vaultId: 'ixs-usd-mmf', weightPct: 40, why: 'Cash anchor.' },
  { vaultId: 'ixs-open-ended', weightPct: 30, why: 'Daily liquidity.' },
  { vaultId: 'ixs-corp-bond', weightPct: 15, why: 'Credit.' },
  { vaultId: 'ixs-private-credit', weightPct: 15, why: 'Yield.' },
];

function baseProps(overrides = {}) {
  return {
    allocations: ALLOCATIONS,
    summary: 'SERV summary line.',
    source: 'heuristic' as const,
    loading: false,
    servOn: false,
    onToggleServ: vi.fn(),
    focusedVaultId: null,
    onSelectVault: vi.fn(),
    market: EMPTY_RWA_MARKET,
    ...overrides,
  };
}

afterEach(() => cleanup());

describe('RwaVaultSleeve — holdable assets', () => {
  it('lists the three holdable assets before the off-app IXS section', () => {
    render(<RwaVaultSleeve {...baseProps()} />);
    const usdy = screen.getByTestId('rwa-row-USDY');
    const offapp = screen.getByTestId('rwa-offapp');
    expect(screen.getByTestId('rwa-row-PAXG')).toBeInTheDocument();
    expect(screen.getByTestId('rwa-row-SYRUPUSDC')).toBeInTheDocument();
    expect(usdy.compareDocumentPosition(offapp) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(offapp).getByTestId('vault-row-ixs-usd-mmf')).toBeInTheDocument();
  });

  it('orders in-plan assets first and names their plan share', () => {
    render(<RwaVaultSleeve {...baseProps({ planPctBySymbol: { PAXG: 30 } })} />);
    const rows = screen.getAllByTestId(/^rwa-row-/);
    expect(rows[0]).toHaveAttribute('data-testid', 'rwa-row-PAXG');
    expect(within(rows[0]).getByText('30% of your plan')).toBeInTheDocument();
    expect(screen.getByText(/30% of your plan · Arbitrum/)).toBeInTheDocument();
  });

  it('renders a live figure only when the market supplied one', () => {
    render(
      <RwaVaultSleeve
        {...baseProps({
          market: {
            ...EMPTY_RWA_MARKET,
            USDY: { kind: 'apy', value: 3.59, source: 'DeFiLlama · Ondo on Arbitrum', capturedAt: new Date().toISOString() },
          },
        })}
      />,
    );
    expect(screen.getByTestId('rwa-figure-USDY')).toHaveTextContent('3.59% APY');
    expect(screen.queryByTestId('rwa-figure-PAXG')).not.toBeInTheDocument();
    expect(screen.queryByTestId('rwa-figure-SYRUPUSDC')).not.toBeInTheDocument();
  });

  it('unfolds curated provenance on tap', () => {
    render(<RwaVaultSleeve {...baseProps()} />);
    fireEvent.click(screen.getByTestId('rwa-row-PAXG'));
    expect(screen.getByTestId('rwa-row-PAXG')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/London Good Delivery gold/)).toBeInTheDocument();
    expect(screen.getByText(/issuer facts checked/)).toBeInTheDocument();
  });

  it('Islamic lens flags interest-bearing assets and targets gold', () => {
    const onReviewMove = vi.fn();
    render(
      <RwaVaultSleeve
        {...baseProps({ philosophy: 'islamic', onReviewMove, planPctBySymbol: { PAXG: 50 } })}
      />,
    );
    expect(within(screen.getByTestId('rwa-row-USDY')).getByText(/outside this lens/)).toBeInTheDocument();
    expect(screen.getByText(/None is Sharia-certified/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('rwa-review-move'));
    expect(onReviewMove).toHaveBeenCalledWith('PAXG');
  });

  it('never targets an asset without a swap route (USDY on Arbitrum)', () => {
    const onReviewMove = vi.fn();
    render(
      <RwaVaultSleeve {...baseProps({ onReviewMove, planPctBySymbol: { USDC: 70, USDY: 30 } })} />,
    );
    expect(within(screen.getByTestId('rwa-row-USDY')).getByText(/no swap route right now/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('rwa-review-move'));
    expect(onReviewMove).not.toHaveBeenCalledWith('USDY');
  });

  it('walletless: the wallet CTA replaces the move button', () => {
    render(<RwaVaultSleeve {...baseProps({ walletCta: <button>Connect wallet</button> })} />);
    expect(screen.getByText('Connect wallet')).toBeInTheDocument();
    expect(screen.queryByTestId('rwa-review-move')).not.toBeInTheDocument();
  });

  it('IXS is a quiet text link, not the primary CTA', () => {
    render(<RwaVaultSleeve {...baseProps()} />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', 'https://ixs.finance');
    expect(links[0]).toHaveTextContent('Review on IXS');
  });
});

describe('RwaVaultSleeve — IXS off-app section', () => {
  it('offers the deeper allocation as a quiet rail, not a gate', () => {
    const onToggleServ = vi.fn();
    render(<RwaVaultSleeve {...baseProps({ onToggleServ })} />);
    expect(screen.getByText(/Instant estimate/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('serv-enhance'));
    expect(onToggleServ).toHaveBeenCalledWith(true);
  });

  it('shows the honest degraded state when SERV cannot enhance', () => {
    render(<RwaVaultSleeve {...baseProps({ servOn: true, degradedReason: 'serv_not_configured' })} />);
    expect(screen.getByText(/Deeper allocation unavailable/)).toBeInTheDocument();
    expect(screen.getByTestId('vault-row-ixs-usd-mmf')).toBeInTheDocument();
  });

  it('shows the SERV receipt and summary when enhanced', () => {
    render(
      <RwaVaultSleeve
        {...baseProps({
          servOn: true,
          source: 'serv',
          receipt: {
            provider: 'serv',
            model: 'gpt-5.4-mini',
            effort: 'medium',
            latencyMs: 7700,
            at: '2026-09-20T00:00:00Z',
          },
        })}
      />,
    );
    expect(screen.getByText(/reasoned by SERV · gpt-5\.4-mini · 7\.7s/)).toBeInTheDocument();
    expect(screen.getByText('SERV summary line.')).toBeInTheDocument();
    expect(screen.getByText('← instant estimate')).toBeInTheDocument();
  });

  it('expands the focused vault row with rationale + indicative range', () => {
    render(<RwaVaultSleeve {...baseProps({ focusedVaultId: 'ixs-usd-mmf' })} />);
    expect(screen.getByTestId('vault-row-ixs-usd-mmf')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Cash anchor.')).toBeInTheDocument();
    expect(screen.getByText(/4–5% indicative/)).toBeInTheDocument();
  });
});
