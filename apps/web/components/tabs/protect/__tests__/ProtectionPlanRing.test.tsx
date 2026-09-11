import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ProtectionPlanRing } from '../ProtectionPlanRing';
import { DEMO_PORTFOLIO } from '@/lib/demo-data';
import type { MultichainPortfolio } from '@/hooks/use-multichain-balances';

vi.mock('@/lib/haptics', () => ({
  haptics: { tap: vi.fn(), confirm: vi.fn(), selection: vi.fn() },
}));

afterEach(() => {
  cleanup();
});

const liveProjections = {
  currentPath: { value1Year: 900, value3Year: 800, purchasingPowerLost: 200 },
  optimizedPath: {
    value1Year: 950,
    value3Year: 880,
    purchasingPowerPreserved: 80,
  },
};

const portfolio = {
  ...DEMO_PORTFOLIO,
  projections: liveProjections,
} as unknown as MultichainPortfolio;

describe('ProtectionPlanRing — projections shape', () => {
  it('does not crash when projections is the legacy demo shape (no currentPath)', () => {
    const legacy = {
      ...DEMO_PORTFOLIO,
      projections: {
        oneMonth: { optimistic: 1050, pessimistic: 950, expected: 1000 },
      },
    } as unknown as MultichainPortfolio;

    expect(() =>
      render(
        <ProtectionPlanRing
          strategyKey="africapitalism"
          portfolio={legacy}
          selectedToken={null}
          onSelectToken={() => {}}
        />,
      ),
    ).not.toThrow();
    expect(screen.getByText('Your shield plan')).toBeInTheDocument();
    expect(screen.queryByText(/3-year path/)).not.toBeInTheDocument();
  });

  it('does not crash when projections is missing entirely', () => {
    const { projections: _drop, ...rest } = DEMO_PORTFOLIO;
    expect(() =>
      render(
        <ProtectionPlanRing
          strategyKey="africapitalism"
          portfolio={rest as unknown as MultichainPortfolio}
          selectedToken={null}
          onSelectToken={() => {}}
        />,
      ),
    ).not.toThrow();
  });

  it('renders the purchasing-power footer when currentPath is present', () => {
    render(
      <ProtectionPlanRing
        strategyKey="africapitalism"
        portfolio={portfolio}
        selectedToken={null}
        onSelectToken={() => {}}
      />,
    );
    expect(screen.getByText(/3-year path/)).toBeInTheDocument();
    expect(screen.getByText('$200')).toBeInTheDocument();
    expect(screen.getByText('$80')).toBeInTheDocument();
  });

  it('renders DEMO_PORTFOLIO without crashing (aligned projections shape)', () => {
    expect(() =>
      render(
        <ProtectionPlanRing
          strategyKey="africapitalism"
          portfolio={DEMO_PORTFOLIO as unknown as MultichainPortfolio}
          selectedToken={null}
          onSelectToken={() => {}}
        />,
      ),
    ).not.toThrow();
    expect(DEMO_PORTFOLIO.projections.currentPath.purchasingPowerLost).toBeGreaterThan(0);
  });

  it('draws a trim ghost when the selected slice is over the plan', () => {
    render(
      <ProtectionPlanRing
        strategyKey="africapitalism"
        portfolio={portfolio}
        selectedToken="cUSD"
        onSelectToken={() => {}}
        alignmentScore={72}
      />,
    );
    expect(screen.getByTestId('ring-ghost')).toHaveAttribute('data-ghost-kind', 'trim');
  });

  it('does not draw a ghost when idle', async () => {
    render(
      <ProtectionPlanRing
        strategyKey="africapitalism"
        portfolio={portfolio}
        selectedToken={null}
        onSelectToken={() => {}}
        alignmentScore={72}
      />,
    );
    expect(await screen.findByText('72%')).toBeInTheDocument();
    expect(screen.queryByTestId('ring-ghost')).not.toBeInTheDocument();
    expect(screen.queryByText('$1,000')).not.toBeInTheDocument();
  });

  it('merges a USDm holding into the cUSD legend row (one asset, one name)', () => {
    const usdmWallet = {
      ...DEMO_PORTFOLIO,
      totalValue: 100,
      chains: [
        {
          chainId: 42220,
          chainName: 'Celo',
          totalValue: 100,
          tokenCount: 1,
          balances: [
            {
              symbol: 'USDm',
              value: 100,
              balance: '100',
              formattedBalance: '100',
              name: 'USDm',
              chainId: 42220,
              chainName: 'Celo',
            },
          ],
        },
      ],
    } as unknown as MultichainPortfolio;
    render(
      <ProtectionPlanRing
        strategyKey="buen_vivir"
        portfolio={usdmWallet}
        selectedToken={null}
        onSelectToken={() => {}}
      />,
    );
    // One row under the plan-facing name — never a stray "not in plan" USDm row.
    expect(screen.getAllByText('cUSD').length).toBeGreaterThan(0);
    expect(screen.queryByText('USDm')).not.toBeInTheDocument();
    expect(screen.queryByText('not in plan')).not.toBeInTheDocument();
  });

  it('puts the gap in the hole when a slice is selected', async () => {
    render(
      <ProtectionPlanRing
        strategyKey="africapitalism"
        portfolio={portfolio}
        selectedToken="cUSD"
        onSelectToken={() => {}}
        alignmentScore={72}
      />,
    );
    expect(await screen.findByText('pts over')).toBeInTheDocument();
  });

  it('shows Add funds in the hole when the wallet is empty', () => {
    const empty = {
      ...DEMO_PORTFOLIO,
      totalValue: 0,
      tokens: [],
      chains: [],
    } as unknown as MultichainPortfolio;
    render(
      <ProtectionPlanRing
        strategyKey="africapitalism"
        portfolio={empty}
        selectedToken={null}
        onSelectToken={() => {}}
        empty
      />,
    );
    expect(screen.getByText('Add funds')).toBeInTheDocument();
  });

  it('emptyLabel replaces the Add funds label (walletless ghost ring)', () => {
    const empty = {
      ...DEMO_PORTFOLIO,
      totalValue: 0,
      tokens: [],
      chains: [],
    } as unknown as MultichainPortfolio;
    render(
      <ProtectionPlanRing
        strategyKey="africapitalism"
        portfolio={empty}
        selectedToken={null}
        onSelectToken={() => {}}
        empty
        emptyLabel="Connect to fund"
      />,
    );
    expect(screen.getByText('Connect to fund')).toBeInTheDocument();
    expect(screen.queryByText('Add funds')).not.toBeInTheDocument();
  });
});

describe('ProtectionPlanRing — hole tap (compare mode entry)', () => {
  it('renders the hole as a button only when onHoleTap is provided and nothing is selected', () => {
    const onHoleTap = vi.fn();
    render(
      <ProtectionPlanRing
        strategyKey="africapitalism"
        portfolio={portfolio}
        selectedToken={null}
        onSelectToken={() => {}}
        alignmentScore={72}
        onHoleTap={onHoleTap}
      />,
    );
    const hole = screen.getByTestId('ring-hole');
    fireEvent.click(hole);
    expect(onHoleTap).toHaveBeenCalledTimes(1);
  });

  it('keeps the hole non-interactive without onHoleTap', () => {
    render(
      <ProtectionPlanRing
        strategyKey="africapitalism"
        portfolio={portfolio}
        selectedToken={null}
        onSelectToken={() => {}}
        alignmentScore={72}
      />,
    );
    expect(screen.queryByTestId('ring-hole')).not.toBeInTheDocument();
  });

  it('is not a button while a slice is selected', () => {
    render(
      <ProtectionPlanRing
        strategyKey="africapitalism"
        portfolio={portfolio}
        selectedToken="cUSD"
        onSelectToken={() => {}}
        alignmentScore={72}
        onHoleTap={() => {}}
      />,
    );
    expect(screen.queryByTestId('ring-hole')).not.toBeInTheDocument();
  });

  it('shows the "Compare plans" affordance only when the hole is tappable and not previewing', () => {
    const { rerender } = render(
      <ProtectionPlanRing
        strategyKey="africapitalism"
        portfolio={portfolio}
        selectedToken={null}
        onSelectToken={() => {}}
        alignmentScore={72}
        onHoleTap={() => {}}
      />,
    );
    expect(screen.getByText('Compare plans ▾')).toBeInTheDocument();

    // No tap affordance → no hint.
    rerender(
      <ProtectionPlanRing
        strategyKey="africapitalism"
        portfolio={portfolio}
        selectedToken={null}
        onSelectToken={() => {}}
        alignmentScore={72}
      />,
    );
    expect(screen.queryByText('Compare plans ▾')).not.toBeInTheDocument();

    // Compare preview ("under this plan") → the affordance steps aside.
    rerender(
      <ProtectionPlanRing
        strategyKey="africapitalism"
        portfolio={portfolio}
        selectedToken={null}
        onSelectToken={() => {}}
        alignmentScore={72}
        onHoleTap={() => {}}
        holeHintOverride="under this plan"
      />,
    );
    expect(screen.queryByText('Compare plans ▾')).not.toBeInTheDocument();
    expect(screen.getByText('under this plan')).toBeInTheDocument();
  });

  it('holeHintOverride replaces the idle hint', () => {
    render(
      <ProtectionPlanRing
        strategyKey="africapitalism"
        portfolio={portfolio}
        selectedToken={null}
        onSelectToken={() => {}}
        alignmentScore={72}
        holeHintOverride="under this plan"
      />,
    );
    expect(screen.getByText('under this plan')).toBeInTheDocument();
    expect(screen.queryByText('of your money follows the plan')).not.toBeInTheDocument();
  });

  it('re-keys the hole when the previewed plan changes at the same score', () => {
    const { rerender } = render(
      <ProtectionPlanRing
        strategyKey="africapitalism"
        portfolio={portfolio}
        selectedToken={null}
        onSelectToken={() => {}}
        alignmentScore={null}
      />,
    );
    expect(screen.getAllByText('Africapitalism').length).toBeGreaterThan(0);
    rerender(
      <ProtectionPlanRing
        strategyKey="buen_vivir"
        portfolio={portfolio}
        selectedToken={null}
        onSelectToken={() => {}}
        alignmentScore={null}
      />,
    );
    expect(screen.getAllByText('Buen Vivir').length).toBeGreaterThan(0);
    expect(screen.queryByText('Africapitalism')).not.toBeInTheDocument();
  });
});
