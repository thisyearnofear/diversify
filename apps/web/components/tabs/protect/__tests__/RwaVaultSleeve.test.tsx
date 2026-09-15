/**
 * Tests for RwaVaultSleeve — the inspector body behind the ring fan.
 *
 * Pins the freemium rail contract:
 *   - Free heuristic is the default; SERV is a quiet opt-in rail.
 *   - Degraded SERV still shows the heuristic + an honest reason.
 *   - Exactly one CTA, and it points at IXS — nothing executes here.
 */

// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { RwaVaultSleeve } from '../RwaVaultSleeve';

const ALLOCATIONS = [
  { vaultId: 'ixs-usd-mmf', weightPct: 40, why: 'Cash anchor.' },
  { vaultId: 'ixs-open-ended', weightPct: 30, why: 'Daily liquidity.' },
  { vaultId: 'ixs-corp-bond', weightPct: 15, why: 'Credit.' },
  { vaultId: 'ixs-private-credit', weightPct: 15, why: 'Yield.' },
];

function baseProps(overrides = {}) {
  return {
    allocations: ALLOCATIONS,
    summary: 'Heuristic allocation across the IXS catalog.',
    source: 'heuristic' as const,
    loading: false,
    servOn: false,
    onToggleServ: vi.fn(),
    focusedVaultId: null,
    onSelectVault: vi.fn(),
    sleeveContext: 'PAXG leg',
    ...overrides,
  };
}

afterEach(() => cleanup());

describe('RwaVaultSleeve', () => {
  it('lists every vault row and exactly one IXS CTA', () => {
    render(<RwaVaultSleeve {...baseProps()} />);
    expect(screen.getByTestId('vault-row-ixs-usd-mmf')).toBeInTheDocument();
    expect(screen.getByTestId('vault-row-ixs-private-credit')).toBeInTheDocument();
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', 'https://ixs.finance');
  });

  it('offers the SERV upgrade as a quiet rail, not a gate', () => {
    const onToggleServ = vi.fn();
    render(<RwaVaultSleeve {...baseProps({ onToggleServ })} />);
    expect(screen.getByText(/Free heuristic/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('serv-enhance'));
    expect(onToggleServ).toHaveBeenCalledWith(true);
  });

  it('shows the honest degraded state when SERV cannot enhance', () => {
    render(
      <RwaVaultSleeve
        {...baseProps({ servOn: true, degradedReason: 'serv_not_configured' })}
      />,
    );
    expect(screen.getByText(/SERV unavailable \(serv_not_configured\)/)).toBeInTheDocument();
    // The heuristic rows are still there — the free path never regresses.
    expect(screen.getByTestId('vault-row-ixs-usd-mmf')).toBeInTheDocument();
  });

  it('shows the SERV receipt in the rail when enhanced', () => {
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
    expect(screen.getByText(/SERV-enhanced · gpt-5\.4-mini · 7\.7s/)).toBeInTheDocument();
    expect(screen.getByText('← free heuristic')).toBeInTheDocument();
  });

  it('expands the focused vault row with rationale + provenance', () => {
    render(
      <RwaVaultSleeve {...baseProps({ focusedVaultId: 'ixs-usd-mmf' })} />,
    );
    const row = screen.getByTestId('vault-row-ixs-usd-mmf');
    expect(row).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Cash anchor.')).toBeInTheDocument();
    expect(screen.getByText(/4–5% indicative/)).toBeInTheDocument();
    expect(screen.getByText('← Whole sleeve')).toBeInTheDocument();
  });

  it('labels the preview sleeve as not in the plan', () => {
    render(<RwaVaultSleeve {...baseProps({ sleeveContext: 'preview' })} />);
    expect(screen.getByText(/Preview — not in your plan/)).toBeInTheDocument();
  });
});
