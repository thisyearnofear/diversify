import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('@/lib/analytics', () => ({
  trackFunnelEvent: vi.fn(),
}));
vi.mock('@/lib/haptics', () => ({
  haptics: { tap: vi.fn(), confirm: vi.fn(), selection: vi.fn() },
}));
// The mascot is framer-motion heavy; the marquee tests only care which
// mood the lifecycle state maps to.
vi.mock('@/components/shared/GuardianMascot', () => ({
  GuardianMascot: ({ mood }: { mood: string }) => (
    <div data-testid="guardian-mascot" data-mood={mood} />
  ),
}));

import { trackFunnelEvent } from '@/lib/analytics';
import { GuardianMarquee } from '../GuardianMarquee';
import type { GuardianSessionInfo } from '../../../hooks/use-session-key';

const SESSION: GuardianSessionInfo = {
  active: true,
  dailyLimitUSD: 10,
  spentTodayUSD: 2.5,
  remainingTodayUSD: 7.5,
  executionCount: 2,
  recentExecutions: [
    {
      txHash: '0xabc',
      action: 'rebalance',
      tokenIn: 'USDC',
      tokenOut: 'cUSD',
      amountUSD: 5,
      timestamp: Date.now() - 3_600_000,
      status: 'success',
      explorerUrl: 'https://celoscan.io/tx/0xabc',
    },
  ],
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('GuardianMarquee — Agent tab marquee', () => {
  it('renders the monitoring state with the protective mood and journal CTA', () => {
    const onOpenJournal = vi.fn();
    render(
      <GuardianMarquee
        guardianState="monitoring"
        hasValidPermission
        sessionInfo={SESSION}
        dailyLimit={10}
        onOpenJournal={onOpenJournal}
        onSetup={vi.fn()}
      />,
    );

    expect(screen.getByTestId('guardian-mascot')).toHaveAttribute('data-mood', 'protective');
    expect(screen.getByText('Protection on')).toBeInTheDocument();
    expect(screen.getByText('$7.50')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Open the Guardian journal/ }));
    expect(onOpenJournal).toHaveBeenCalledTimes(1);
  });

  it('selects a budget slice, tracks the marquee event, and explains it', () => {
    render(
      <GuardianMarquee
        guardianState="monitoring"
        hasValidPermission
        sessionInfo={SESSION}
        dailyLimit={10}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Spent today: 25%/ }));
    expect(trackFunnelEvent).toHaveBeenCalledWith('marquee_select', {
      slice: 'spent',
      source: 'agent_budget',
    });
    expect(
      screen.getByText(/Auto-Saver moved \$2\.50 across 2 saves today/),
    ).toBeInTheDocument();
  });

  it('shows the recent saves spoke with a proof link', () => {
    render(
      <GuardianMarquee
        guardianState="monitoring"
        hasValidPermission
        sessionInfo={SESSION}
        dailyLimit={10}
      />,
    );
    expect(screen.getByText(/USDC → cUSD/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'proof' })).toHaveAttribute(
      'href',
      'https://celoscan.io/tx/0xabc',
    );
  });

  it('renders the setup CTA and no budget ring when idle', () => {
    const onSetup = vi.fn();
    render(
      <GuardianMarquee
        guardianState="idle"
        hasValidPermission={false}
        sessionInfo={null}
        dailyLimit={0}
        onSetup={onSetup}
      />,
    );

    expect(screen.queryByRole('button', { name: /Spent today/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Set up Auto-Saver/ }));
    expect(onSetup).toHaveBeenCalledTimes(1);
  });
});
