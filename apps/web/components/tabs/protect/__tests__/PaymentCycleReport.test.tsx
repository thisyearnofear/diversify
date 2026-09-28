import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { PaymentCycleReport } from '../PaymentCycleReport';

vi.mock('@/components/wallet/WalletProvider', () => ({
  useWalletContext: () => ({ address: null, signMessage: vi.fn() }),
}));

vi.mock('@/hooks/use-purchase-cycles', () => ({
  usePurchaseCycles: () => ({
    cycles: [],
    saveCycle: vi.fn(),
    updateCycle: vi.fn(),
    loading: false,
    needsUnlock: false,
    cycleAutoExecutionEnabled: false,
    unlockCycles: vi.fn(),
    setCycleAutoExecution: vi.fn(),
  }),
}));

vi.mock('@/context/app/NavigationContext', () => ({
  useNavigation: () => ({ focusedCycleId: null, setFocusedCycleId: vi.fn() }),
  FOCUS_HIGHLIGHT_MS: 4000,
}));

vi.mock('@/components/agent/GuardianRecommendationCard', () => ({
  GuardianRecommendationCard: () => null,
}));

vi.mock('@diversifi/shared/src/services/fx-drag/rates-serverless', () => ({
  buildServerlessRateProvider: vi.fn(async () => ({
    getRate: () => 15,
    sourceNote: 'test',
  })),
}));

const mockTrack = vi.fn();
vi.mock('@/lib/analytics', () => ({
  trackFunnelEvent: (...args: unknown[]) => mockTrack(...args),
}));

describe('PaymentCycleReport — mode control', () => {
  beforeEach(() => {
    localStorage.clear();
    mockTrack.mockClear();
  });

  it('defaults to Next payment and renders the forward form', () => {
    render(<PaymentCycleReport />);
    expect(screen.getByRole('radiogroup', { name: 'Cycle direction' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Next payment' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('Payment date')).toBeInTheDocument();
    expect(screen.getByLabelText('Target amount')).toBeInTheDocument();
    // The old doorway link is gone.
    expect(screen.queryByText(/What did your last cycle cost/)).not.toBeInTheDocument();
  });

  it('initialMode="last" renders the historical engine', () => {
    render(<PaymentCycleReport initialMode="last" />);
    expect(screen.getByRole('radio', { name: 'Last cycle' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText(/Earnings this cycle/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Payment date')).not.toBeInTheDocument();
  });

  it('switching modes swaps the body on the same draft currency', () => {
    render(<PaymentCycleReport />);
    fireEvent.change(screen.getByLabelText('Local currency'), { target: { value: 'NGN' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Last cycle' }));
    expect(screen.getByLabelText(/Earnings this cycle/)).toBeInTheDocument();
    expect(screen.getByLabelText('Local currency')).toHaveValue('NGN');
    fireEvent.click(screen.getByRole('radio', { name: 'Next payment' }));
    expect(screen.getByLabelText('Payment date')).toBeInTheDocument();
  });

  it('Track your next payment flips to next mode with the amount seeded', async () => {
    render(<PaymentCycleReport initialMode="last" />);
    fireEvent.change(screen.getByLabelText('Local currency'), { target: { value: 'GHS' } });
    fireEvent.change(screen.getByLabelText(/Earnings this cycle/), { target: { value: '100000' } });
    fireEvent.change(screen.getByLabelText(/USD paid to suppliers/), { target: { value: '5000' } });
    fireEvent.change(screen.getByLabelText(/Bank rate/), { target: { value: '16' } });
    fireEvent.click(screen.getByRole('button', { name: 'See what it cost' }));
    await screen.findByTestId('last-cycle-result');
    fireEvent.click(screen.getByRole('button', { name: /Track your next payment/ }));
    expect(screen.getByLabelText('Payment date')).toBeInTheDocument();
    expect(screen.getByLabelText('Target amount')).toHaveValue('5000');
    expect(screen.getByRole('radio', { name: 'Next payment' })).toHaveAttribute('aria-checked', 'true');
  });
});
