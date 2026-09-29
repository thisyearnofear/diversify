import { describe, it, expect, vi, afterEach } from 'vitest';
import { useState } from 'react';
import { act, render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ProtectionPlanRing } from '../ProtectionPlanRing';
import { BalanceVisibilityProvider } from '@/context/app/BalanceVisibilityContext';
import { DEMO_PORTFOLIO } from '@/lib/demo-data';
import type { MultichainPortfolio } from '@/hooks/use-multichain-balances';
import {
  getArchetypeAllocations,
  legsForRisk,
} from '@/components/protection-cards/plan-preview';

vi.mock('@/lib/haptics', () => ({
  haptics: { tap: vi.fn(), confirm: vi.fn(), selection: vi.fn() },
}));

const reducedMotion = vi.hoisted(() => ({ on: false }));
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => reducedMotion.on };
});

afterEach(() => {
  reducedMotion.on = false;
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

  it('renders no stress-test affordance — the ring carries no defense verdict', () => {
    render(
      <ProtectionPlanRing
        strategyKey="africapitalism"
        portfolio={portfolio}
        selectedToken={null}
        onSelectToken={() => {}}
      />,
    );
    expect(screen.queryByTestId('stress-test-btn')).not.toBeInTheDocument();
    expect(screen.queryByText('Test defense')).not.toBeInTheDocument();
    expect(screen.queryByText('Reserve ready')).not.toBeInTheDocument();
    expect(screen.queryByText(/shock/i)).not.toBeInTheDocument();
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

  it('does not draw a ghost when idle — the hole states the total, not the score', async () => {
    render(
      <ProtectionPlanRing
        strategyKey="africapitalism"
        portfolio={portfolio}
        selectedToken={null}
        onSelectToken={() => {}}
        alignmentScore={72}
      />,
    );
    expect(await screen.findByText('$1,000')).toBeInTheDocument();
    expect(screen.getByText('your savings')).toBeInTheDocument();
    expect(screen.queryByText('72%')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ring-ghost')).not.toBeInTheDocument();
  });

  it('merges a USDm holding into the plan leg row — rendered under the Dollar exposure', () => {
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
    // One row under the canonical ticker — never a stray "not in plan" row,
    // never the legacy cUSD spelling on the surface.
    expect(screen.getAllByText('Dollar').length).toBeGreaterThan(0);
    expect(screen.queryByText('cUSD')).not.toBeInTheDocument();
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

  const fundedKesmWallet = {
    ...DEMO_PORTFOLIO,
    totalValue: 500,
    chains: [
      {
        chainId: 42220,
        chainName: 'Celo',
        totalValue: 500,
        tokenCount: 1,
        balances: [
          {
            symbol: 'KESm',
            value: 500,
            balance: '500',
            formattedBalance: '500',
            name: 'KESm',
            chainId: 42220,
            chainName: 'Celo',
          },
        ],
      },
    ],
  } as unknown as MultichainPortfolio;

  it('forcePlanLegs draws the plan legs even when the wallet has holdings', () => {
    const { unmount } = render(
      <ProtectionPlanRing
        strategyKey="africapitalism"
        portfolio={fundedKesmWallet}
        legs={legsForRisk(getArchetypeAllocations('buen_vivir'), 'Balanced')}
        selectedToken={null}
        onSelectToken={() => {}}
      />,
    );
    // Without the flag, funded holdings shadow the previewed plan.
    expect(
      screen.queryByRole('group', { name: 'Allocation ring' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Real — plan/ }),
    ).not.toBeInTheDocument();
    unmount();

    render(
      <ProtectionPlanRing
        strategyKey="africapitalism"
        portfolio={fundedKesmWallet}
        legs={legsForRisk(getArchetypeAllocations('buen_vivir'), 'Balanced')}
        forcePlanLegs
        selectedToken={null}
        onSelectToken={() => {}}
      />,
    );
    expect(
      screen.getByRole('button', { name: /Real — plan/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /wallet holding/ }),
    ).not.toBeInTheDocument();
  });

  it('ghostLegs renders the current plan as a faint outer track', () => {
    const ghost = legsForRisk(getArchetypeAllocations('africapitalism'), 'Balanced');
    render(
      <ProtectionPlanRing
        strategyKey="buen_vivir"
        portfolio={fundedKesmWallet}
        legs={legsForRisk(getArchetypeAllocations('buen_vivir'), 'Balanced')}
        forcePlanLegs
        ghostLegs={ghost}
        selectedToken={null}
        onSelectToken={() => {}}
      />,
    );
    const outline = screen.getByTestId('ghost-plan-outline');
    expect(outline).toBeInTheDocument();
    // The ghost draws the current plan's legs, not the preview — its
    // track is decorative, so the wedges carry labels without a role.
    expect(
      within(outline).getByLabelText(/Shilling — current plan/),
    ).toBeInTheDocument();
  });

  it('compact hides the header, legend rows and controls but keeps the hole', () => {
    render(
      <ProtectionPlanRing
        strategyKey="africapitalism"
        portfolio={fundedKesmWallet}
        compact
        holeOverride={{ label: 'Buen Vivir', hint: '+15% PAXG' }}
        onHoleTap={() => {}}
        selectedToken={null}
        onSelectToken={() => {}}
      />,
    );
    expect(screen.queryByText('Your shield plan')).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+% held/)).not.toBeInTheDocument();
    const hole = screen.getByTestId('ring-hole');
    expect(hole).toHaveTextContent('Buen Vivir');
    expect(hole).toHaveTextContent('+15% PAXG');
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

  it('walletless hole states the plan reserve — no connect copy, no repeated plan name', () => {
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
        walletless
        onHoleTap={() => {}}
      />,
    );
    const hole = screen.getByTestId('ring-hole');
    expect(within(hole).getByText('dollar reserve')).toBeInTheDocument();
    expect(within(hole).getByText(/^\d+%$/)).toBeInTheDocument();
    expect(within(hole).queryByText(/connect/i)).not.toBeInTheDocument();
    // The plan name lives once, in the badge.
    expect(screen.getAllByText(/Africapitalism/)).toHaveLength(1);
    expect(screen.queryByText('Add funds')).not.toBeInTheDocument();
  });
});

describe('ProtectionPlanRing — tokenized-asset lens', () => {
  const emptyPortfolio = {
    ...DEMO_PORTFOLIO,
    totalValue: 0,
    tokens: [],
    chains: [],
  } as unknown as MultichainPortfolio;

  it('keeps the RWA wedge and states its share in the hole — no IXS fan in the ring', () => {
    render(
      <ProtectionPlanRing
        strategyKey="islamic"
        portfolio={emptyPortfolio}
        selectedToken="sleeve"
        onSelectToken={() => {}}
        sleeveOpen
      />,
    );
    // The PAXG leg stays itself — gold never decomposes into credit vaults.
    expect(screen.getByRole('button', { name: /^Gold — plan/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /RWA vault/ })).not.toBeInTheDocument();
    // Other plan legs are still drawn (quiet), still tappable.
    expect(screen.getByRole('button', { name: /^Dollar — plan/ })).toBeInTheDocument();
    expect(screen.getByText('tokenized assets')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('PAXG · of this plan')).toBeInTheDocument();
  });

  it('reads the same on the walletless ghost ring (lens checked before empty)', () => {
    render(
      <ProtectionPlanRing
        strategyKey="islamic"
        portfolio={emptyPortfolio}
        selectedToken="sleeve"
        onSelectToken={() => {}}
        sleeveOpen
        empty
        walletless
      />,
    );
    expect(screen.getByText('tokenized assets')).toBeInTheDocument();
    expect(screen.queryByText('dollar reserve')).not.toBeInTheDocument();
  });

  it('appends one labelled preview wedge when the plan has no tokenized asset', () => {
    render(
      <ProtectionPlanRing
        strategyKey="africapitalism"
        portfolio={emptyPortfolio}
        selectedToken="sleeve"
        onSelectToken={() => {}}
        sleeveOpen
      />,
    );
    expect(screen.getByRole('button', { name: /^Shilling — plan/ })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Tokenized assets — preview, not in your plan/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('none in this plan yet')).toBeInTheDocument();
  });

  it('no preview wedge while the lens is closed', () => {
    render(
      <ProtectionPlanRing
        strategyKey="africapitalism"
        portfolio={emptyPortfolio}
        selectedToken={null}
        onSelectToken={() => {}}
      />,
    );
    expect(screen.queryByRole('button', { name: /Tokenized assets/ })).not.toBeInTheDocument();
  });

  it('tapping a wedge inside the lens emits that leg', () => {
    const onSelect = vi.fn();
    render(
      <ProtectionPlanRing
        strategyKey="islamic"
        portfolio={emptyPortfolio}
        selectedToken="sleeve"
        onSelectToken={onSelect}
        sleeveOpen
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^Gold — plan/ }));
    expect(onSelect).toHaveBeenCalledWith('PAXG');
  });
});

describe('ProtectionPlanRing — hole tap (the flip verb)', () => {
  it('flips the face — total to alignment — and never opens compare', async () => {
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
    expect(hole).toHaveAccessibleName('Show plan alignment');
    fireEvent.click(hole);
    expect(onHoleTap).not.toHaveBeenCalled();
    expect(await screen.findByText('aligned')).toBeInTheDocument();
    expect(await screen.findByText('72%')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('ring-hole'));
    expect(await screen.findByText('your savings')).toBeInTheDocument();
  });

  it('the hole button opts back into pointer events despite the inert centre wrapper', () => {
    // AllocationRing wraps hole children in `pointer-events-none` (slice arcs
    // under the padding must stay tappable). The button must re-enable events
    // itself or real clicks never land — jsdom ignores pointer-events CSS, so
    // this asserts the class contract rather than the click outcome.
    render(
      <ProtectionPlanRing
        strategyKey="africapitalism"
        portfolio={portfolio}
        selectedToken={null}
        onSelectToken={() => {}}
        alignmentScore={72}
        onHoleTap={() => {}}
      />,
    );
    const hole = screen.getByTestId('ring-hole');
    expect(hole.className).toContain('pointer-events-auto');
    let node = hole.parentElement;
    while (node) {
      if (node.className?.includes?.('pointer-events-none')) {
        expect(hole.className).toContain('pointer-events-auto');
      }
      node = node.parentElement;
    }
  });

  it('header pill is a compare button only when onHoleTap is provided', () => {
    const onHoleTap = vi.fn();
    const { rerender } = render(
      <ProtectionPlanRing
        strategyKey="africapitalism"
        portfolio={portfolio}
        selectedToken={null}
        onSelectToken={() => {}}
        alignmentScore={72}
        onHoleTap={onHoleTap}
      />,
    );
    const badge = screen.getByTestId('plan-badge');
    fireEvent.click(badge);
    expect(onHoleTap).toHaveBeenCalledTimes(1);
    expect(badge.textContent).toContain('▾');

    rerender(
      <ProtectionPlanRing
        strategyKey="africapitalism"
        portfolio={portfolio}
        selectedToken={null}
        onSelectToken={() => {}}
        alignmentScore={72}
      />,
    );
    expect(screen.queryByTestId('plan-badge')).not.toBeInTheDocument();
    screen.getAllByText('Africapitalism').forEach((el) => {
      expect(el.tagName).not.toBe('BUTTON');
    });
  });

  it('the pill keeps calling onHoleTap while comparing — as the exit ("Keep")', () => {
    const onHoleTap = vi.fn();
    render(
      <ProtectionPlanRing
        strategyKey="africapitalism"
        portfolio={portfolio}
        selectedToken={null}
        onSelectToken={() => {}}
        alignmentScore={72}
        onHoleTap={onHoleTap}
        holeHintOverride="under this plan"
      />,
    );
    const badge = screen.getByTestId('plan-badge');
    expect(badge).toHaveAttribute('aria-label', 'Exit compare');
    expect(badge.textContent).not.toContain('▾');
    fireEvent.click(badge);
    expect(onHoleTap).toHaveBeenCalledTimes(1);
  });

  it('keeps the hole non-interactive for an unfunded ring with no compare entry', () => {
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

  it('withholds the 3xs compare kicker while the hole flips — the badge is compare', () => {
    const empty = {
      ...DEMO_PORTFOLIO,
      totalValue: 0,
      tokens: [],
      chains: [],
    } as unknown as MultichainPortfolio;
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
    expect(screen.queryByText('Compare plans ▾')).not.toBeInTheDocument();
    expect(screen.getByTestId('plan-badge')).toHaveAttribute('aria-label', 'Compare philosophies');

    // Unfunded: the hole can't flip, so the kicker earns its 3xs again.
    rerender(
      <ProtectionPlanRing
        strategyKey="africapitalism"
        portfolio={empty}
        selectedToken={null}
        onSelectToken={() => {}}
        empty
        onHoleTap={() => {}}
      />,
    );
    expect(screen.getByText('Compare plans ▾')).toBeInTheDocument();

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

describe('ProtectionPlanRing — balance preview', () => {
  const SAVED_LEGS = legsForRisk(getArchetypeAllocations('africapitalism'), 'Balanced');
  const DRAFT_LEGS = legsForRisk(getArchetypeAllocations('africapitalism'), 'Conservative');

  it('draws proposed target wedges — never the held mix — while previewing', () => {
    const { rerender } = render(
      <ProtectionPlanRing
        strategyKey="africapitalism"
        portfolio={portfolio}
        legs={DRAFT_LEGS}
        savedLegs={SAVED_LEGS}
        balancePreview
        selectedToken={null}
        onSelectToken={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: /Shilling — preview target: 48%/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dollar — preview target: 40%/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Euro — preview target: 12%/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /wallet holding/ })).not.toBeInTheDocument();
    expect(screen.getByText('Your shield plan')).toBeInTheDocument();
    expect(screen.queryByText(/3-year path/)).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Protection armed' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('ring-ghost')).not.toBeInTheDocument();
    expect(screen.getByText('Dollar reserve')).toBeInTheDocument();
    expect(screen.getByText('Preview · not saved')).toBeInTheDocument();

    rerender(
      <ProtectionPlanRing
        strategyKey="africapitalism"
        portfolio={portfolio}
        legs={SAVED_LEGS}
        savedLegs={SAVED_LEGS}
        balancePreview={false}
        selectedToken={null}
        onSelectToken={() => {}}
      />,
    );
    expect(screen.queryByRole('button', { name: /preview target/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /wallet holding/ }).length).toBeGreaterThan(0);
    expect(screen.getByText(/3-year path/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Protection armed' })).toBeInTheDocument();
  });

  it('selected slice answers preview vs saved — not a gap, not a holding', () => {
    render(
      <ProtectionPlanRing
        strategyKey="africapitalism"
        portfolio={portfolio}
        legs={DRAFT_LEGS}
        savedLegs={SAVED_LEGS}
        balancePreview
        selectedToken="KESm"
        onSelectToken={() => {}}
      />,
    );
    expect(screen.getAllByText('Shilling').length).toBeGreaterThan(0);
    expect(screen.getByText('48%')).toBeInTheDocument();
    expect(screen.getByText('60% in saved plan')).toBeInTheDocument();
    expect(screen.queryByTestId('ring-ghost')).not.toBeInTheDocument();
    expect(screen.getAllByText('48% preview').length).toBeGreaterThan(0);
    expect(screen.getAllByText('60% saved').length).toBeGreaterThan(0);
    expect(screen.queryByText(/held/)).not.toBeInTheDocument();
  });

  it('renders the controls slot between the geometry and the asset rows', () => {
    render(
      <ProtectionPlanRing
        strategyKey="africapitalism"
        portfolio={portfolio}
        selectedToken={null}
        onSelectToken={() => {}}
        controls={<div data-testid="ring-controls">dial</div>}
      />,
    );
    const controls = screen.getByTestId('ring-controls');
    const firstRow = screen.getByText('Shilling').closest('button')!;
    expect(controls.compareDocumentPosition(firstRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      screen.getByRole('group', { name: 'Allocation ring' })
        .compareDocumentPosition(controls) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('empty ring + selected slice says Target only — never funded', () => {
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
        selectedToken="KESm"
        onSelectToken={() => {}}
        empty
      />,
    );
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('Target only · not funded')).toBeInTheDocument();
    expect(screen.queryByText(/\d+% held/)).not.toBeInTheDocument();
    // Funding status is stated once — the hole, not per legend row.
    expect(screen.queryByText('Not funded')).not.toBeInTheDocument();
  });

  it('Other aggregates preview percentages, not max-held, for many-leg plans', () => {
    const manyLegs = [
      { token: 'KESm', region: 'Kenya', percent: 30, why: 'a' },
      { token: 'cUSD', region: 'US', percent: 20, why: 'b' },
      { token: 'cEUR', region: 'EU', percent: 10, why: 'c' },
      { token: 'PAXG', region: 'Global', percent: 10, why: 'd' },
      { token: 'cREAL', region: 'Brazil', percent: 10, why: 'e' },
      { token: 'COPm', region: 'Colombia', percent: 10, why: 'f' },
      { token: 'PHPm', region: 'Philippines', percent: 5, why: 'g' },
      { token: 'USDY', region: 'Yield', percent: 5, why: 'h' },
    ];
    const funded = {
      ...DEMO_PORTFOLIO,
      totalValue: 1000,
      chains: [
        {
          chainId: 42161,
          chainName: 'Arbitrum',
          totalValue: 1000,
          tokenCount: 1,
          balances: [{ symbol: 'WETH', value: 1000, balance: '1', formattedBalance: '1', name: 'WETH', chainId: 42161, chainName: 'Arbitrum' }],
        },
      ],
    } as unknown as MultichainPortfolio;
    render(
      <ProtectionPlanRing
        strategyKey="africapitalism"
        portfolio={funded}
        legs={manyLegs}
        savedLegs={manyLegs}
        balancePreview
        selectedToken={null}
        onSelectToken={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: /Other — 3 small positions: 20%/ })).toBeInTheDocument();
    expect(within(screen.getByTestId('shield-other')).getByText('20% preview')).toBeInTheDocument();
    expect(screen.queryByText(/held/)).not.toBeInTheDocument();
  });

  it('reduced motion: preview still answers target vs saved in the hole', () => {
    reducedMotion.on = true;
    function Wrapper() {
      const [sel, setSel] = useState<string | null>(null);
      return (
        <ProtectionPlanRing
          strategyKey="africapitalism"
          portfolio={portfolio}
          legs={DRAFT_LEGS}
          savedLegs={SAVED_LEGS}
          balancePreview
          selectedToken={sel}
          onSelectToken={setSel}
        />
      );
    }
    render(<Wrapper />);
    const kesm = screen.getByRole('button', { name: /Shilling — preview target: 48%/ });
    expect(kesm).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(kesm);
    expect(screen.getByRole('button', { name: /Shilling — preview target: 48%/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText('48%')).toBeInTheDocument();
    expect(screen.getByText('60% in saved plan')).toBeInTheDocument();
    expect(screen.queryByTestId('ring-ghost')).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Protection armed' })).not.toBeInTheDocument();
    expect(screen.queryByText(/3-year path/)).not.toBeInTheDocument();
    expect(screen.queryByText(/held/)).not.toBeInTheDocument();
  });
});

describe('ProtectionPlanRing — idle face: one fact, dwell swap, privacy', () => {
  it('states one fact — the total — never the plan name, a hint sentence, or idle memory', async () => {
    render(
      <ProtectionPlanRing
        strategyKey="africapitalism"
        portfolio={portfolio}
        selectedToken={null}
        onSelectToken={() => {}}
        alignmentScore={72}
      />,
    );
    const hole = screen.getByTestId('ring-hole');
    expect(await within(hole).findByText('your savings')).toBeInTheDocument();
    expect(within(hole).queryByText('of your money follows the plan')).not.toBeInTheDocument();
    expect(within(hole).queryByText('Africapitalism')).not.toBeInTheDocument();
    // The since-last-visit drift moved to the status tier, not the hole.
    expect(screen.queryByTestId('shield-since-last-visit')).not.toBeInTheDocument();
  });

  it('dwell previews the alignment face once — swap, hold, return, never repeats', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    try {
      render(
        <ProtectionPlanRing
          strategyKey="africapitalism"
          portfolio={portfolio}
          selectedToken={null}
          onSelectToken={() => {}}
          alignmentScore={72}
        />,
      );
      expect(screen.getByText('your savings')).toBeInTheDocument();
      await act(async () => {
        vi.advanceTimersByTime(8000);
      });
      expect(screen.getByText('aligned')).toBeInTheDocument();
      // The preview holds ~3s, then hands the face back on its own.
      await act(async () => {
        vi.advanceTimersByTime(3000);
      });
      expect(screen.getByText('your savings')).toBeInTheDocument();
      // One-shot: idling again never re-runs the swap.
      await act(async () => {
        vi.advanceTimersByTime(30000);
      });
      expect(screen.getByText('your savings')).toBeInTheDocument();
      expect(screen.queryByText('aligned')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('a hole tap mid-preview takes the face back and latches stillness', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    try {
      render(
        <ProtectionPlanRing
          strategyKey="africapitalism"
          portfolio={portfolio}
          selectedToken={null}
          onSelectToken={() => {}}
          alignmentScore={72}
        />,
      );
      await act(async () => {
        vi.advanceTimersByTime(8000);
      });
      expect(screen.getByText('aligned')).toBeInTheDocument();
      // The user takes it back — the dwell never repeats afterwards.
      fireEvent.click(screen.getByTestId('ring-hole'));
      expect(screen.getByText('your savings')).toBeInTheDocument();
      await act(async () => {
        vi.advanceTimersByTime(30000);
      });
      expect(screen.getByText('your savings')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('the plan badge tap also latches stillness — the pending preview never fires', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    try {
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
      fireEvent.click(screen.getByTestId('plan-badge'));
      expect(onHoleTap).toHaveBeenCalledTimes(1);
      await act(async () => {
        vi.advanceTimersByTime(30000);
      });
      expect(screen.getByText('your savings')).toBeInTheDocument();
      expect(screen.queryByText('aligned')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('steps the total down to text-2xl for six-figure savings', async () => {
    const big = {
      ...DEMO_PORTFOLIO,
      totalValue: 123456,
      chains: [
        {
          chainId: 42220,
          chainName: 'Celo',
          totalValue: 123456,
          tokenCount: 1,
          balances: [
            {
              symbol: 'KESm',
              value: 123456,
              balance: '123456',
              formattedBalance: '123456',
              name: 'KESm',
              chainId: 42220,
              chainName: 'Celo',
            },
          ],
        },
      ],
    } as unknown as MultichainPortfolio;
    const { unmount } = render(
      <ProtectionPlanRing
        strategyKey="africapitalism"
        portfolio={big}
        selectedToken={null}
        onSelectToken={() => {}}
        alignmentScore={72}
      />,
    );
    const hole = screen.getByTestId('ring-hole');
    // Assert the size class on the number's span — the count-up's final
    // text is covered by use-count-up.test.tsx (fake-timer tests in this
    // file can leave jsdom's animation frame loop stalled for later
    // mounts, so the assertion keys on the class, not the landed value).
    const number = within(hole).getByText(/^\$/);
    expect(number.parentElement).toHaveClass('text-2xl');
    unmount();

    render(
      <ProtectionPlanRing
        strategyKey="africapitalism"
        portfolio={portfolio}
        selectedToken={null}
        onSelectToken={() => {}}
        alignmentScore={72}
      />,
    );
    const smallHole = screen.getByTestId('ring-hole');
    expect(within(smallHole).getByText(/^\$/).parentElement).toHaveClass('text-3xl');
  });

  it('renders face dots only while the hole can flip', () => {
    const { rerender } = render(
      <ProtectionPlanRing
        strategyKey="africapitalism"
        portfolio={portfolio}
        selectedToken={null}
        onSelectToken={() => {}}
        alignmentScore={72}
      />,
    );
    const hole = screen.getByTestId('ring-hole');
    expect(within(hole).getByTestId('hole-face-dots')).toBeInTheDocument();

    rerender(
      <ProtectionPlanRing
        strategyKey="africapitalism"
        portfolio={portfolio}
        selectedToken="cUSD"
        onSelectToken={() => {}}
        alignmentScore={72}
      />,
    );
    expect(screen.queryByTestId('hole-face-dots')).not.toBeInTheDocument();

    rerender(
      <ProtectionPlanRing
        strategyKey="africapitalism"
        portfolio={portfolio}
        selectedToken={null}
        onSelectToken={() => {}}
        alignmentScore={72}
        holeHintOverride="under this plan"
      />,
    );
    expect(screen.queryByTestId('hole-face-dots')).not.toBeInTheDocument();
  });

  it('Other replaces the legend with the remainder rows and returns', () => {
    const manyWallet = {
      ...DEMO_PORTFOLIO,
      totalValue: 1000,
      chains: [
        {
          chainId: 42220,
          chainName: 'Celo',
          totalValue: 1000,
          tokenCount: 7,
          balances: [
            { symbol: 'KESm', value: 300, balance: '300', formattedBalance: '300', name: 'KESm', chainId: 42220, chainName: 'Celo' },
            { symbol: 'cUSD', value: 200, balance: '200', formattedBalance: '200', name: 'cUSD', chainId: 42220, chainName: 'Celo' },
            { symbol: 'cEUR', value: 100, balance: '100', formattedBalance: '100', name: 'cEUR', chainId: 42220, chainName: 'Celo' },
            { symbol: 'PAXG', value: 100, balance: '100', formattedBalance: '100', name: 'PAXG', chainId: 42220, chainName: 'Celo' },
            { symbol: 'cREAL', value: 100, balance: '100', formattedBalance: '100', name: 'cREAL', chainId: 42220, chainName: 'Celo' },
            { symbol: 'COPm', value: 100, balance: '100', formattedBalance: '100', name: 'COPm', chainId: 42220, chainName: 'Celo' },
            { symbol: 'PHPm', value: 100, balance: '100', formattedBalance: '100', name: 'PHPm', chainId: 42220, chainName: 'Celo' },
          ],
        },
      ],
    } as unknown as MultichainPortfolio;
    const onSelect = vi.fn();
    render(
      <ProtectionPlanRing
        strategyKey="africapitalism"
        portfolio={manyWallet}
        selectedToken={null}
        onSelectToken={onSelect}
      />,
    );
    const other = screen.getByTestId('shield-other');
    expect(within(other).getByText('Other')).toBeInTheDocument();
    expect(within(other).getByText('2 small positions')).toBeInTheDocument();
    expect(screen.queryByTestId('shield-other-back')).not.toBeInTheDocument();

    const ring = screen.getByRole('group', { name: 'Allocation ring' });
    const sliceSum = (group: HTMLElement) =>
      within(group)
        .getAllByRole('button')
        .map((b) => Number((b.getAttribute('aria-label') ?? '').match(/: ([\d.]+)%/)?.[1] ?? NaN))
        .reduce((a, b) => a + b, 0);
    const collapsedSum = sliceSum(ring);

    fireEvent.click(other);
    expect(screen.getByTestId('shield-other-back')).toBeInTheDocument();
    expect(screen.queryByTestId('shield-other')).not.toBeInTheDocument();
    expect(screen.getByText(/percentages stay of the whole wallet/)).toBeInTheDocument();

    expect(Math.abs(sliceSum(ring) - collapsedSum)).toBeLessThan(0.001);
    expect(within(ring).getByRole('button', { name: /COPm — wallet holding/ })).toBeInTheDocument();
    expect(within(ring).getByRole('button', { name: /PHPm — wallet holding/ })).toBeInTheDocument();

    const legend = screen.getByTestId('shield-legend');
    expect(within(legend).getByText('COPm')).toBeInTheDocument();
    expect(within(legend).getByText('PHPm')).toBeInTheDocument();
    expect(within(legend).queryByText('Shilling')).not.toBeInTheDocument();

    fireEvent.click(
      within(ring).getByRole('button', { name: /KESm — wallet holding/ }),
    );
    expect(onSelect).toHaveBeenCalledWith('KESm');
    expect(screen.getByTestId('shield-other')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('shield-other'));
    fireEvent.click(
      within(ring).getByRole('button', { name: /COPm — wallet holding/ }),
    );
    expect(onSelect).toHaveBeenCalledWith('COPm');

    fireEvent.click(screen.getByTestId('shield-other-back'));
    expect(screen.getByTestId('shield-other')).toBeInTheDocument();
    expect(screen.queryByTestId('shield-other-back')).not.toBeInTheDocument();
  });

  it('reduced motion never auto-swaps the face', async () => {
    reducedMotion.on = true;
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    try {
      render(
        <ProtectionPlanRing
          strategyKey="africapitalism"
          portfolio={portfolio}
          selectedToken={null}
          onSelectToken={() => {}}
          alignmentScore={72}
        />,
      );
      await act(async () => {
        vi.advanceTimersByTime(30000);
      });
      expect(screen.getByText('your savings')).toBeInTheDocument();
      expect(screen.queryByText('aligned')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('masks every dollar figure when balances are hidden — dots, never a zero', async () => {
    localStorage.setItem('diversifi.balances.hidden', '1');
    try {
      render(
        <BalanceVisibilityProvider>
          <ProtectionPlanRing
            strategyKey="africapitalism"
            portfolio={portfolio}
            selectedToken={null}
            onSelectToken={() => {}}
            alignmentScore={72}
          />
        </BalanceVisibilityProvider>,
      );
      const hole = screen.getByTestId('ring-hole');
      expect(within(hole).getByText('••••')).toBeInTheDocument();
      // The projections footer masks too — every dollar figure in the object.
      expect(screen.getAllByText('••••').length).toBeGreaterThanOrEqual(3);
      expect(screen.queryByText('$1,000')).not.toBeInTheDocument();
      expect(screen.queryByText('$200')).not.toBeInTheDocument();
      // Percentages stay readable — privacy covers how much, not what the plan thinks.
      expect(screen.getAllByText(/^\d+% (plan|held)$/).length).toBeGreaterThan(0);
    } finally {
      localStorage.removeItem('diversifi.balances.hidden');
    }
  });
});
