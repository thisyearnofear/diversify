import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import FxNettingRail from '../FxNettingRail';
import { buildWalletAuthMessage } from '@/lib/wallet-auth';

// Mock the wallet + netting hook so the card renders/isolation-testable
// without a connection or network. Overridable per-test via the exported
// handles so walletless (observer) behaviour is testable too.
const mockMatch = vi.fn();
const mockRefreshSettlements = vi.fn(async () => {});
const mockRefreshCreditProfile = vi.fn(async () => {});
/** Tests that need a full hook shape set this; factory spreads it. */
let mockHookOverride: Record<string, unknown> | null = null;
let mockAddress: string | null = '0xabc';
let mockData: Record<string, unknown> | null = null;

vi.mock('../../../hooks/use-fx-netting', () => ({
  useFxNetting: () =>
    mockHookOverride
      ? { ...mockHookOverride }
      : {
          data: mockData,
          isLoading: false,
          error: null,
          match: mockMatch,
          settlements: null,
          refreshSettlements: mockRefreshSettlements,
          creditProfile: null,
          refreshCreditProfile: mockRefreshCreditProfile,
        },
}));

vi.mock('../../wallet/WalletProvider', () => ({
  useWalletContext: () => ({ address: mockAddress }),
}));

// The mid-market line reads the live USD table — mock the provider so
// tests never touch the network.
vi.mock('@diversifi/shared/src/services/fx-netting/rate-adapter', () => ({
  buildLiveRateProvider: vi.fn(async () => ({
    midRate: () => 0.0421,
    date: '2026-09-15',
    sourceNote: 'test table',
    hasRate: () => true,
  })),
}));

afterEach(cleanup);

describe('FxNettingRail — smoke + phase flips', () => {
  beforeEach(() => {
    mockMatch.mockReset();
    mockRefreshSettlements.mockClear();
    mockAddress = '0xabc';
    mockData = null;
  });

  it('renders the intent phase by default with JMD/BBD defaults', () => {
    render(<FxNettingRail />);
    expect(screen.getByTestId('fx-netting-rail')).toBeInTheDocument();
    expect(screen.getByTestId('fx-phase-intent')).toBeInTheDocument();
    expect(screen.getByText('Counterparty match')).toBeInTheDocument();
    expect(screen.getByLabelText('Currency you have')).toHaveValue('JMD');
    expect(screen.getByLabelText('Currency you want')).toHaveValue('BBD');
  });

  it('shows the live mid-market line for a covered corridor', async () => {
    render(<FxNettingRail />);
    const line = await screen.findByTestId('fx-mid-rate');
    expect(line).toHaveTextContent('1 JMD = 0.0421 BBD');
    expect(line).toHaveTextContent('2026-09-15');
  });

  it('flips to the review phase and calls match when the CTA is enabled', () => {
    render(<FxNettingRail />);
    const amount = screen.getByLabelText('Amount to convert');
    fireEvent.change(amount, { target: { value: '500000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Match my intent' }));
    expect(screen.getByTestId('fx-phase-review')).toBeInTheDocument();
    expect(mockMatch).toHaveBeenCalledWith(
      { sellCurrency: 'JMD', sellAmount: 500000, buyCurrency: 'BBD' },
      [],
    );
  });
});

describe('FxNettingRail — auth timing (view ≠ sign)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockMatch.mockReset();
    mockRefreshSettlements.mockClear();
    mockRefreshCreditProfile.mockClear();
    mockAddress = '0xabc';
    mockData = null;
  });

  it('requests no authed reads on mount — opening the card must not pop a signature', () => {
    render(<FxNettingRail />);
    expect(mockRefreshSettlements).not.toHaveBeenCalled();
    expect(mockRefreshCreditProfile).not.toHaveBeenCalled();
  });

  it('refreshes silently on mount when a session proof is already cached', () => {
    const addr = `0x${'a'.repeat(40)}`;
    mockAddress = addr;
    sessionStorage.setItem(
      `diversifi-wallet-auth:${addr}`,
      JSON.stringify({ message: buildWalletAuthMessage(addr), signature: '0xsig' }),
    );
    render(<FxNettingRail />);
    expect(mockRefreshSettlements).toHaveBeenCalled();
    expect(mockRefreshCreditProfile).toHaveBeenCalled();
  });

  it('refreshes on entering the review phase — the match act earns the read', () => {
    render(<FxNettingRail />);
    fireEvent.change(screen.getByLabelText('Amount to convert'), { target: { value: '500000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Match my intent' }));
    expect(mockRefreshSettlements).toHaveBeenCalled();
    expect(mockRefreshCreditProfile).toHaveBeenCalled();
  });
});

describe('FxNettingRail — walletless observer path (judges)', () => {
  beforeEach(() => {
    mockMatch.mockReset();
    mockRefreshSettlements.mockClear();
    mockAddress = null;
    mockData = null;
  });

  it('renders the intent form and an enabled CTA with NO wallet — matching is not gated on connection', () => {
    render(<FxNettingRail />);
    const amount = screen.getByLabelText('Amount to convert');
    fireEvent.change(amount, { target: { value: '250000' } });
    const cta = screen.getByRole('button', { name: 'Match my intent' });
    expect(cta).toBeEnabled();
    fireEvent.click(cta);
    expect(mockMatch).toHaveBeenCalled();
  });

  it('shows the observer preview banner in review phase when walletless', () => {
    mockData = { matches: [], totalMatchedUsd: 0, totalSavingsUsd: 0, unmatchedCount: 1, observer: true, poolSize: 3 };
    render(<FxNettingRail />);
    fireEvent.change(screen.getByLabelText('Amount to convert'), { target: { value: '250000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Match my intent' }));
    expect(screen.getByTestId('fx-observer-banner')).toBeInTheDocument();
    expect(screen.getByText(/previewing the live matching engine/i)).toBeInTheDocument();
  });

  it('guides a walletless visitor with an unmatched intent to connect to post it', () => {
    mockData = { matches: [], totalMatchedUsd: 0, totalSavingsUsd: 0, unmatchedCount: 1, observer: true, poolSize: 0 };
    render(<FxNettingRail />);
    fireEvent.change(screen.getByLabelText('Amount to convert'), { target: { value: '250000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Match my intent' }));
    expect(screen.getByText(/connect a wallet to post your intent/i)).toBeInTheDocument();
  });
});

describe('FxNettingRail — currency validation', () => {
  beforeEach(() => {
    mockMatch.mockReset();
    mockRefreshSettlements.mockClear();
    mockAddress = '0xabc';
    mockData = null;
  });

  it('flags an unknown currency code and keeps the CTA disabled', () => {
    render(<FxNettingRail />);
    fireEvent.change(screen.getByLabelText('Currency you have'), { target: { value: 'JAM' } });
    fireEvent.change(screen.getByLabelText('Amount to convert'), { target: { value: '500' } });
    expect(screen.getByText(/unsupported currency code/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Match my intent' })).toBeDisabled();
  });

  it('keeps the CTA enabled for known codes from the corridor presets', () => {
    render(<FxNettingRail />);
    fireEvent.click(screen.getByRole('button', { name: 'TTD → JMD' }));
    expect(screen.getByLabelText('Currency you have')).toHaveValue('TTD');
    expect(screen.getByLabelText('Currency you want')).toHaveValue('JMD');
    fireEvent.change(screen.getByLabelText('Amount to convert'), { target: { value: '1000' } });
    expect(screen.getByRole('button', { name: 'Match my intent' })).toBeEnabled();
  });

  it('disables the CTA when both currencies are the same', () => {
    render(<FxNettingRail />);
    fireEvent.change(screen.getByLabelText('Currency you want'), { target: { value: 'JMD' } });
    fireEvent.change(screen.getByLabelText('Amount to convert'), { target: { value: '500' } });
    expect(screen.getByRole('button', { name: 'Match my intent' })).toBeDisabled();
  });
});

describe('FxNettingRail — settlement-native credit file readout', () => {
  afterEach(() => {
    mockHookOverride = null;
  });

  it('renders a scored file with volume and counterparty counts', () => {
    mockHookOverride = {
      data: null, isLoading: false, error: null, match: vi.fn(),
      settlements: null, refreshSettlements: vi.fn(), settle: vi.fn(),
      isSettling: false, settleError: null,
      creditProfile: {
        score: 712, fileStrength: 'established', settledVolumeUsd: 32500,
        settlementsCompleted: 9, counterparties: 4,
        summary: '9 verified settlements.', lendingReadiness: 'Decision-support ready.',
        synthetic: false,
      },
      refreshCreditProfile: vi.fn(),
    };
    render(<FxNettingRail />);
    expect(screen.getByTestId('fx-credit-score')).toHaveTextContent('712');
    expect(screen.getByTestId('fx-credit-summary')).toHaveTextContent(/9 verified settlements/);
    expect(screen.getByTestId('fx-credit-summary')).toHaveTextContent(/4 counterparties/);
  });

  it('renders the thin-file state honestly — no score, path forward named', () => {
    mockHookOverride = {
      data: null, isLoading: false, error: null, match: vi.fn(),
      settlements: null, refreshSettlements: vi.fn(), settle: vi.fn(),
      isSettling: false, settleError: null,
      creditProfile: {
        score: null, fileStrength: 'thin', settledVolumeUsd: 0,
        settlementsCompleted: 1, counterparties: 1,
        summary: 'Thin file.', lendingReadiness: 'Early file.',
        synthetic: false,
      },
      refreshCreditProfile: vi.fn(),
    };
    render(<FxNettingRail />);
    expect(screen.getByTestId('fx-credit-score')).toHaveTextContent('Thin file');
    expect(screen.getByTestId('fx-credit-summary')).toHaveTextContent(/next settled trade strengthens this file/);
  });

  it('hides the credit section for synthetic participants', () => {
    mockHookOverride = {
      data: null, isLoading: false, error: null, match: vi.fn(),
      settlements: null, refreshSettlements: vi.fn(), settle: vi.fn(),
      isSettling: false, settleError: null,
      creditProfile: {
        score: null, fileStrength: 'none', settledVolumeUsd: 0,
        settlementsCompleted: 0, counterparties: 0,
        summary: '', lendingReadiness: '', synthetic: true,
      },
      refreshCreditProfile: vi.fn(),
    };
    render(<FxNettingRail />);
    expect(screen.queryByTestId('fx-credit-file')).not.toBeInTheDocument();
  });
});
