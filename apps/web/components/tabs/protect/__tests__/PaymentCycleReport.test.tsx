import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { PaymentCycleReport } from '../PaymentCycleReport';

const mocks = vi.hoisted(() => ({
  address: null as string | null,
  cycles: [] as Array<Record<string, unknown>>,
  needsUnlock: false,
  cyclesError: null as string | null,
  autoExecution: false,
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
    cycleAutoExecutionEnabled: mocks.autoExecution,
    error: mocks.cyclesError,
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

vi.mock('@/components/wallet/WalletButton', () => ({
  default: () => <button type="button">Connect wallet</button>,
}));

vi.mock('@/lib/haptics', () => ({ haptics: { tap: vi.fn(), confirm: vi.fn() } }));

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
  summary: {
    cycles: [],
    totalUsdPaid: 10000,
    totalActualLocal: 165000,
    totalDragLocal: 14000,
    totalDragPct: 8.48,
    totalTimingLocal: 11500,
    totalSpreadLocal: 2500,
    totalFeesLocal: 0,
  },
  narrative: {
    headline: "Your GHS payment could cost more at today's rate",
    dragLine: 'The cedi weakened 3% through a recent stress window.',
    protectionCostLine: 'Protecting now costs about GHS 400.',
    netBenefitDisclaimer: 'Illustrative only.',
    exposureDays: 30,
  },
  provenance: {
    sourceType: 'illustrative',
    asOf: '2026-09-01',
    rateSourceNote: 'indicative rate, test source',
    isHistorical: true,
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
  fireEvent.change(screen.getByLabelText('Your currency'), { target: { value: 'GHS' } });
  fireEvent.change(screen.getByLabelText('Payment date'), { target: { value: '2026-10-30' } });
  fireEvent.change(screen.getByLabelText('Amount (USD)'), { target: { value: '10000' } });
};

const runReport = async () => {
  fillForwardForm();
  fireEvent.click(screen.getByRole('button', { name: 'Compare payment options' }));
  await screen.findByTestId('payment-comparison');
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-03T12:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('PaymentCycleReport — mode control', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.saveCycle.mockClear();
    mocks.updateCycle.mockClear();
    mockTrack.mockClear();
    mocks.address = null;
    mocks.cycles = [];
    mocks.needsUnlock = false;
    mocks.cyclesError = null;
    mocks.autoExecution = false;
    mocks.focusedCycleId = null;
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => REPORT });
    vi.stubGlobal('fetch', mocks.fetch);
  });

  it('defaults to Next payment and renders the forward form', () => {
    render(<PaymentCycleReport />);
    expect(screen.getByRole('radiogroup', { name: 'Cycle direction' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Next payment' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('Payment date')).toBeInTheDocument();
    expect(screen.getByLabelText('Amount (USD)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Compare payment options' })).toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(2);
    expect(screen.queryByLabelText('Supplier currency')).not.toBeInTheDocument();
    // Modeling comes first, not a wallet gate.
    expect(screen.queryByRole('button', { name: 'Connect wallet' })).not.toBeInTheDocument();
    expect(screen.getByText(/USD payments only/)).toBeInTheDocument();
    // The old doorway link is gone.
    expect(screen.queryByText(/What did your last cycle cost/)).not.toBeInTheDocument();
  });

  it('initialMode="last" renders the historical engine', () => {
    render(<PaymentCycleReport initialMode="last" />);
    expect(screen.getByRole('radio', { name: '73-day scenario' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText(/Earnings this cycle/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Payment date')).not.toBeInTheDocument();
  });

  it('switching modes swaps the body on the same draft currency', () => {
    render(<PaymentCycleReport />);
    fireEvent.change(screen.getByLabelText('Your currency'), { target: { value: 'NGN' } });
    fireEvent.click(screen.getByRole('radio', { name: '73-day scenario' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Estimate FX drag' }));
    await screen.findByTestId('last-cycle-result');
    fireEvent.click(screen.getByRole('button', { name: /Track your next payment/ }));
    expect(screen.getByLabelText('Payment date')).toBeInTheDocument();
    expect(screen.getByLabelText('Amount (USD)')).toHaveValue('5000');
    expect(screen.getByRole('radio', { name: 'Next payment' })).toHaveAttribute('aria-checked', 'true');
  });
});

describe('PaymentCycleReport — report views', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.saveCycle.mockClear();
    mocks.updateCycle.mockClear();
    mocks.address = '0xabc0000000000000000000000000000000000001';
    mocks.cycles = [];
    mocks.needsUnlock = false;
    mocks.cyclesError = null;
    mocks.autoExecution = false;
    mocks.focusedCycleId = null;
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => REPORT });
    vi.stubGlobal('fetch', mocks.fetch);
  });

  it('computing a report never saves or monitors until explicitly requested', async () => {
    render(<PaymentCycleReport />);
    await runReport();
    expect(screen.queryByLabelText('Amount (USD)')).not.toBeInTheDocument();
    expect(screen.getByText(/GHS → USD \$10,000 · 2026-10-30/)).toBeInTheDocument();
    expect(screen.getByText('Waiting costs more in this scenario')).toBeInTheDocument();
    expect(screen.getByText('GHS 151,000')).toBeInTheDocument();
    expect(screen.getByText('GHS 165,000')).toBeInTheDocument();
    expect(mocks.saveCycle).not.toHaveBeenCalled();
    expect(mocks.updateCycle).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Let Guardian watch this payment' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save this payment' }));
    await screen.findByRole('button', { name: 'Let Guardian watch this payment' });
    expect(mocks.saveCycle).toHaveBeenCalledWith(expect.objectContaining({ monitoringEnabled: false }));
    fireEvent.click(screen.getByRole('button', { name: 'Let Guardian watch this payment' }));
    await screen.findByText(/Monitoring on/);
    expect(mocks.updateCycle).toHaveBeenCalledWith('saved-1', { monitoringEnabled: true });
    // Edit restores the form and hides the report until re-run.
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Amount (USD)')).toBeInTheDocument();
    expect(screen.queryByTestId('payment-comparison')).not.toBeInTheDocument();
  });

  it('sample reports cannot save, monitor, or overwrite the real draft', async () => {
    localStorage.setItem('diversifi-payment-cycle-draft', JSON.stringify({ localCurrency: 'NGN', paymentDate: '2027-01-01', targetAmountUsd: '3000' }));
    const before = localStorage.getItem('diversifi-payment-cycle-draft');
    render(<PaymentCycleReport sample />);
    await runReport();
    expect(screen.queryByRole('button', { name: 'Save this payment' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Connect wallet' })).not.toBeInTheDocument();
    expect(mocks.saveCycle).not.toHaveBeenCalled();
    expect(localStorage.getItem('diversifi-payment-cycle-draft')).toBe(before);
    fireEvent.click(screen.getByRole('button', { name: /Details & export/ }));
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('recalculation requires saving the new report before watching it', async () => {
    render(<PaymentCycleReport />);
    await runReport();
    fireEvent.click(screen.getByRole('button', { name: 'Save this payment' }));
    await screen.findByRole('button', { name: 'Let Guardian watch this payment' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Amount (USD)'), { target: { value: '20000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Compare payment options' }));
    await screen.findByRole('button', { name: 'Save this payment' });
    expect(screen.queryByRole('button', { name: 'Let Guardian watch this payment' })).not.toBeInTheDocument();
  });

  it('wallet changes invalidate a saved report relationship', async () => {
    const { rerender } = render(<PaymentCycleReport />);
    await runReport();
    fireEvent.click(screen.getByRole('button', { name: 'Save this payment' }));
    await screen.findByRole('button', { name: 'Let Guardian watch this payment' });
    mocks.address = '0xdef0000000000000000000000000000000000001';
    rerender(<PaymentCycleReport />);
    expect(screen.getByRole('button', { name: 'Save this payment' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Let Guardian watch this payment' })).not.toBeInTheDocument();
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
    expect(screen.getByText('0.5% assumed')).toBeInTheDocument();
    expect(screen.getByText('1.5% assumed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '← Report' }));
    expect(screen.getByTestId('payment-comparison')).toBeInTheDocument();
  });

  it('preserves the cheaper-waiting scenario without calling it realized savings', async () => {
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ ...REPORT, summary: { ...REPORT.summary, totalDragLocal: -5000 } }) });
    render(<PaymentCycleReport />);
    await runReport();
    expect(screen.getByText('Waiting costs less in this scenario')).toBeInTheDocument();
    expect(screen.getByText('GHS 170,000')).toBeInTheDocument();
    expect(screen.queryByText(/you saved/i)).not.toBeInTheDocument();
  });

  it('monitoring failures never display a successful monitoring state', async () => {
    mocks.updateCycle.mockRejectedValueOnce(new Error('Could not enable monitoring'));
    render(<PaymentCycleReport />);
    await runReport();
    fireEvent.click(screen.getByRole('button', { name: 'Save this payment' }));
    await screen.findByRole('button', { name: 'Let Guardian watch this payment' });
    fireEvent.click(screen.getByRole('button', { name: 'Let Guardian watch this payment' }));
    await screen.findByText('Could not enable monitoring');
    expect(screen.getByText('Payment saved · monitoring off')).toBeInTheDocument();
    expect(screen.queryByText(/Monitoring on/)).not.toBeInTheDocument();
  });

  it('reviewing with Guardian carries the saved payment and never executes a trade', async () => {
    const onAskGuardian = vi.fn();
    render(<PaymentCycleReport onAskGuardian={onAskGuardian} />);
    await runReport();
    fireEvent.click(screen.getByRole('button', { name: 'Save this payment' }));
    await screen.findByRole('button', { name: 'Let Guardian watch this payment' });
    fireEvent.click(screen.getByRole('button', { name: 'Let Guardian watch this payment' }));
    await screen.findByRole('button', { name: 'Review with Guardian' });
    fireEvent.click(screen.getByRole('button', { name: 'Review with Guardian' }));
    expect(onAskGuardian).toHaveBeenCalledWith(expect.stringContaining('saved cycle saved-1'));
    expect(onAskGuardian).toHaveBeenCalledWith(expect.stringContaining('Do not treat modeled costs as a quote or permission to trade'));
    expect(mocks.setCycleAutoExecution).not.toHaveBeenCalled();
  });

  it('does not claim manual-only proposals when existing cycle execution consent is on', async () => {
    mocks.autoExecution = true;
    render(<PaymentCycleReport />);
    await runReport();
    fireEvent.click(screen.getByRole('button', { name: 'Save this payment' }));
    await screen.findByRole('button', { name: 'Let Guardian watch this payment' });
    expect(screen.getByText(/Existing cycle execution consent is on/)).toBeInTheDocument();
  });

  it('reopens saved scenarios without refreshing rates or enabling monitoring', async () => {
    mocks.cycles = [{
      id: 'cycle-9', userAddress: mocks.address, status: 'active', localCurrency: 'GHS', targetCurrency: 'USD',
      targetAmountUsd: 10000, paymentDate: '2026-10-30', monitoringEnabled: false,
      lastReport: {
        summary: REPORT.summary, computedAt: '2026-09-01T12:00:00Z',
        narrativeHeadline: REPORT.narrative.headline, dragLine: REPORT.narrative.dragLine,
        protectionCostLine: REPORT.narrative.protectionCostLine,
        disclaimer: 'Illustrative only.', exposureDays: 30,
      },
    }];
    mocks.fetch.mockClear();
    render(<PaymentCycleReport />);
    fireEvent.click(screen.getByRole('button', { name: /Your cycles/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Review saved GHS payment due 2026-10-30' }));
    await screen.findByTestId('payment-comparison');
    expect(screen.getByText(/Saved scenario · 2026-09-01/)).toBeInTheDocument();
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.updateCycle).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Refresh scenario' })).toBeInTheDocument();
  });

  it('a due cycle puts the amber entry directly under the mode control', () => {
    mocks.cycles = [
      {
        id: 'due-1',
        userAddress: mocks.address,
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
        userAddress: mocks.address,
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
