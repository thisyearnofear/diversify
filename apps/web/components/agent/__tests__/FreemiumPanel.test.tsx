import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mocks = vi.hoisted(() => ({
  creditsStatus: {
    credits: { bonus: 0.5, total: 0.5, used: 0 },
    referral: {
      totalEarned: 0,
      availableActions: [
        { key: 'a', label: 'A', emoji: '✨', credits: 0.1 },
        { key: 'b', label: 'B', emoji: '✨', credits: 0.1 },
        { key: 'c', label: 'C', emoji: '✨', credits: 0.1 },
        { key: 'd', label: 'D', emoji: '✨', credits: 0.1 },
        { key: 'e', label: 'E', emoji: '✨', credits: 0.1 },
      ],
      completedActions: [],
    },
  } as any,
}));

vi.mock('../../../hooks/use-credits', () => ({
  useCredits: () => ({
    status: mocks.creditsStatus,
    claimReward: vi.fn(),
    shareApp: vi.fn(),
  }),
}));

vi.mock('../../../hooks/use-research-account', () => ({
  useResearchPaymentSettings: () => ({
    settings: { autoPayEnabled: false, autoPayMaxUSDC: 0.05 },
    updateSettings: vi.fn(),
  }),
}));

import FreemiumPanel from '../FreemiumPanel';

describe('FreemiumPanel — quiet collapsed line', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders one quiet text line with the real balance and earn count', () => {
    render(<FreemiumPanel onGoodDollarClaim={vi.fn()} />);
    const toggle = screen.getByRole('button', { name: /protection balance/i });
    expect(toggle).toHaveTextContent('$0.50 protection balance · 5 ways to earn');
    // Quiet footnote styling — no filled pill or badge markup.
    expect(toggle.className).not.toMatch(/rounded-xl|bg-gradient/);
    expect(toggle.querySelector('.rounded-full')).toBeNull();
  });

  it('still expands to the full panel on click', () => {
    render(<FreemiumPanel onGoodDollarClaim={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /protection balance/i }));
    expect(screen.getByText('Auto-fund reviews')).toBeInTheDocument();
  });
});
