import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
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
});
