import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { PaymentCycleReport } from '../PaymentCycleReport';

const mocks = vi.hoisted(() => ({
  address: null as string | null,
  cycles: [] as Array<Record<string, unknown>>,
  needsUnlock: false,
  focusedCycleId: null as string | null,
  saveCycle: vi.fn(async (input: Record<string, unknown>) => ({ id: 'saved-1', ...input })),
  updateCycle: vi.fn(async () => ({ id: 'saved-1' })),
  unlockCycles: vi.fn(),
  setCycleAutoExecution: vi.fn(),
  setFocusedCycleId: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('@/components/wallet/WalletProvider', () => ({
  useWalletContext: () => ({ address: mocks.address, signMessage: vi.fn() }),
}));

vi.mock('@/hooks/use-purchase-cycles', () => ({
  usePurchaseCycles: () => ({
    cycles: mocks.cycles,
    saveCycle: mocks.saveCycle,
    updateCycle: mocks.updateCycle,
    loading: false,
    needsUnlock: mocks.needsUnlock,
    cycleAutoExecutionEnabled: false,
    unlockCycles: mocks.unlockCycles,
    setCycleAutoExecution: mocks.setCycleAutoExecution,
  }),
}));

vi.mock('@/context/app/NavigationContext', () => ({
  useNavigation: () => ({
    focusedCycleId: mocks.focusedCycleId,
    setFocusedCycleId: mocks.setFocusedCycleId,
  }),
  FOCUS_HIGHLIGHT_MS: 4000,
}));

vi.mock('@/components/agent/GuardianRecommendationCard', () => ({
  GuardianRecommendationCard: () => <div data-testid="guardian-rec-card" />,
}));

vi.mock('@/lib/purchase-cycle-serialize', () => ({
  snapshotFromFxReport: () => ({}),
}));

vi.mock('@diversifi/shared/src/services/guardian/recommendation-contract', () => ({
  buildCycleProtectionContract: () => ({}),
  daysUntilPaymentDate: () => 30,
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

const REPORT = {
  ok: true,
  summary: {},
  narrative: {
    headline: "Your GHS payment could cost more at today's rate",
    dragLine: 'The cedi weakened 3% through a recent stress window.',
    protectionCostLine: 'Protecting now costs about GHS 400.',
    netBenefitDisclaimer: 'Illustrative only.',
    exposureDays: 30,
  },
  provenance: {
    sourceType: 'live',
    asOf: '2026-09-01',
    rateSourceNote: 'indicative rate, test source',
    isHistorical: false,
    disclaimer: 'not advice',
  },
  input: {
    localCurrency: 'GHS',
    targetCurrency: 'USD',
    paymentDate: '2026-10-30',
    targetAmount: 10000,
  },
};

const fillForwardForm = () => {
  fireEvent.change(screen.getByLabelText('Local currency'), { target: { value: 'GHS' } });
  fireEvent.change(screen.getByLabelText('Payment date'), { target: { value: '2026-10-30' } });
  fireEvent.change(screen.getByLabelText('Target amount'), { target: { value: '10000' } });
};

const runReport = async () => {
  fillForwardForm();
  fireEvent.click(screen.getByRole('button', { name: 'Run cycle report' }));
  await screen.findByText(REPORT.narrative.headline);
};

describe('PaymentCycleReport — mode control', () => {
  beforeEach(() => {
    localStorage.clear();
    mockTrack.mockClear();
    mocks.address = null;
    mocks.cycles = [];
    mocks.needsUnlock = false;
    mocks.focusedCycleId = null;
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => REPORT });
    vi.stubGlobal('fetch', mocks.fetch);
  });

  it('defaults to Next payment and renders the forward form', () => {
    render(<PaymentCycleReport />);
    expect(screen.getByRole('radiogroup', { name: 'Cycle direction' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Next payment' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('Payment date')).toBeInTheDocument();
    expect(screen.getByLabelText('Target amount')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run cycle report' })).toBeInTheDocument();
    // Walletless: one quiet line under the CTA, no amber box.
    expect(
      screen.getByText('Connect your wallet to save cycles and let Guardian watch them.'),
    ).toBeInTheDocument();
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

describe('PaymentCycleReport — report views', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.address = '0xabc0000000000000000000000000000000000001';
    mocks.cycles = [];
    mocks.needsUnlock = false;
    mocks.focusedCycleId = null;
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => REPORT });
    vi.stubGlobal('fetch', mocks.fetch);
  });

  it('post-report collapses the form to a summary and shows the watch CTA', async () => {
    render(<PaymentCycleReport />);
    await runReport();
    expect(screen.queryByLabelText('Target amount')).not.toBeInTheDocument();
    expect(screen.getByText(/GHS → USD 10,000 · 2026-10-30/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Let Guardian watch this payment' }),
    ).toBeInTheDocument();
    // Edit restores the form and hides the report until re-run.
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Target amount')).toBeInTheDocument();
    expect(screen.queryByText(REPORT.narrative.headline)).not.toBeInTheDocument();
  });

  it('"Details & export" opens the options view with downloads and a back link', async () => {
    render(<PaymentCycleReport />);
    await runReport();
    fireEvent.click(screen.getByRole('button', { name: /Details & export/ }));
    expect(screen.getByRole('button', { name: '← Report' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download Markdown' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download CSV' })).toBeInTheDocument();
    expect(screen.getByTestId('guardian-rec-card')).toBeInTheDocument();
    expect(screen.getByText('indicative rate, test source')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '← Report' }));
    expect(screen.getByText(REPORT.narrative.headline)).toBeInTheDocument();
  });

  it('a due cycle puts the amber entry directly under the mode control', () => {
    mocks.cycles = [
      {
        id: 'due-1',
        status: 'payment_due',
        localCurrency: 'GHS',
        targetCurrency: 'USD',
        targetAmountUsd: 5000,
        paymentDate: '2026-01-01',
        monitoringEnabled: false,
      },
    ];
    render(<PaymentCycleReport />);
    const entry = screen.getByRole('button', { name: /need an outcome →/ });
    const form = screen.getByLabelText('Payment date');
    expect(
      entry.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(entry.className).toContain('amber');
    // It is a doorway into the cycles view, which holds the due form.
    fireEvent.click(entry);
    expect(screen.getByText('Payment date passed — confirm outcome')).toBeInTheDocument();
  });

  it('focusedCycleId opens the cycles view and highlights the matching row', async () => {
    mocks.cycles = [
      {
        id: 'cycle-9',
        status: 'active',
        localCurrency: 'GHS',
        targetCurrency: 'USD',
        targetAmountUsd: 5000,
        paymentDate: '2026-12-01',
        monitoringEnabled: false,
      },
    ];
    mocks.focusedCycleId = 'cycle-9';
    render(<PaymentCycleReport />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '← Back' })).toBeInTheDocument(),
    );
    expect(screen.getByText('Active cycles')).toBeInTheDocument();
    const row = screen.getByText(/GHS → USD \$5,000 · 2026-12-01/);
    expect(row.className).toContain('ring-amber');
  });
});
