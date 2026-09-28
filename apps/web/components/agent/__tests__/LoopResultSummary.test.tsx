import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { GuardianLoopResult } from '@/hooks/use-session-key';

const mocks = vi.hoisted(() => ({ navigateToSwap: vi.fn() }));

vi.mock('@/context/app/NavigationContext', () => ({
  useNavigation: () => ({ navigateToSwap: mocks.navigateToSwap }),
}));

import { LoopResultSummary } from '../LoopResultSummary';

function offRail(handoff: GuardianLoopResult['handoff'], message: string): GuardianLoopResult {
  return {
    dryRun: true,
    status: 'noop',
    reasonCode: 'target_not_on_rail',
    message,
    summary: { total: 0, executed: 0, skipped: 0, failed: 0 },
    recommendations: [],
    transactions: [],
    handoff,
  };
}

describe('LoopResultSummary — off-rail Exchange handoff', () => {
  beforeEach(() => mocks.navigateToSwap.mockReset());

  it('offers "Review in Exchange" and applies the handoff ticket', () => {
    const handoff = { fromToken: 'USDC', toToken: 'PAXG', toChainId: 42161, origin: { source: 'guardian' as const } };
    render(
      <LoopResultSummary
        loopResult={offRail(handoff, 'Guardian executes on Celo only. Review PAXG on Arbitrum One in Exchange and sign it yourself.')}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Review in Exchange' }));
    expect(mocks.navigateToSwap).toHaveBeenCalledWith(
      expect.objectContaining({ toToken: 'PAXG', toChainId: 42161 }),
    );
  });

  it('with handoff: null shows only the not-buyable message', () => {
    render(
      <LoopResultSummary
        loopResult={offRail(null, "GOLD isn't buyable in-app, so Guardian is only watching it.")}
      />,
    );

    expect(screen.getByText(/isn't buyable in-app/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Review in Exchange' })).toBeNull();
    expect(screen.queryByText(/No rebalance needed/)).toBeNull();
  });
});
