import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import CaribbeanFxNetCard from '../CaribbeanFxNetCard';

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

afterEach(cleanup);

describe('CaribbeanFxNetCard — smoke + phase flips', () => {
  beforeEach(() => {
    mockMatch.mockReset();
    mockRefreshSettlements.mockClear();
    mockAddress = '0xabc';
    mockData = null;
  });

  it('renders the intent phase by default with JMD/BBD defaults', () => {
    render(<CaribbeanFxNetCard />);
    expect(screen.getByTestId('caribbean-fx-net-card')).toBeInTheDocument();
    expect(screen.getByTestId('fx-phase-intent')).toBeInTheDocument();
    expect(screen.getByText('Caribbean FX Netting')).toBeInTheDocument();
    expect(screen.getByLabelText('Currency you have')).toHaveValue('JMD');
    expect(screen.getByLabelText('Currency you want')).toHaveValue('BBD');
  });

  it('flips to the review phase and calls match when the CTA is enabled', () => {
    render(<CaribbeanFxNetCard />);
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

describe('CaribbeanFxNetCard — walletless observer path (judges)', () => {
  beforeEach(() => {
    mockMatch.mockReset();
    mockRefreshSettlements.mockClear();
    mockAddress = null;
    mockData = null;
  });

  it('renders the intent form and an enabled CTA with NO wallet — matching is not gated on connection', () => {
    render(<CaribbeanFxNetCard />);
    const amount = screen.getByLabelText('Amount to convert');
    fireEvent.change(amount, { target: { value: '250000' } });
    const cta = screen.getByRole('button', { name: 'Match my intent' });
    expect(cta).toBeEnabled();
    fireEvent.click(cta);
    expect(mockMatch).toHaveBeenCalled();
  });

  it('shows the observer preview banner in review phase when walletless', () => {
    mockData = { matches: [], totalMatchedUsd: 0, totalSavingsUsd: 0, unmatchedCount: 1, observer: true, poolSize: 3 };
    render(<CaribbeanFxNetCard />);
    fireEvent.change(screen.getByLabelText('Amount to convert'), { target: { value: '250000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Match my intent' }));
    expect(screen.getByTestId('fx-observer-banner')).toBeInTheDocument();
    expect(screen.getByText(/previewing the live matching engine/i)).toBeInTheDocument();
  });

  it('guides a walletless visitor with an unmatched intent to connect to post it', () => {
    mockData = { matches: [], totalMatchedUsd: 0, totalSavingsUsd: 0, unmatchedCount: 1, observer: true, poolSize: 0 };
    render(<CaribbeanFxNetCard />);
    fireEvent.change(screen.getByLabelText('Amount to convert'), { target: { value: '250000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Match my intent' }));
    expect(screen.getByText(/connect a wallet to post your intent/i)).toBeInTheDocument();
  });
});

describe('CaribbeanFxNetCard — currency validation', () => {
  beforeEach(() => {
    mockMatch.mockReset();
    mockRefreshSettlements.mockClear();
    mockAddress = '0xabc';
    mockData = null;
  });

  it('flags an unknown currency code and keeps the CTA disabled', () => {
    render(<CaribbeanFxNetCard />);
    fireEvent.change(screen.getByLabelText('Currency you have'), { target: { value: 'JAM' } });
    fireEvent.change(screen.getByLabelText('Amount to convert'), { target: { value: '500' } });
    expect(screen.getByText(/unsupported currency code/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Match my intent' })).toBeDisabled();
  });

  it('keeps the CTA enabled for known codes from the corridor presets', () => {
    render(<CaribbeanFxNetCard />);
    fireEvent.click(screen.getByRole('button', { name: 'TTD → JMD' }));
    expect(screen.getByLabelText('Currency you have')).toHaveValue('TTD');
    expect(screen.getByLabelText('Currency you want')).toHaveValue('JMD');
    fireEvent.change(screen.getByLabelText('Amount to convert'), { target: { value: '1000' } });
    expect(screen.getByRole('button', { name: 'Match my intent' })).toBeEnabled();
  });

  it('disables the CTA when both currencies are the same', () => {
    render(<CaribbeanFxNetCard />);
    fireEvent.change(screen.getByLabelText('Currency you want'), { target: { value: 'JMD' } });
    fireEvent.change(screen.getByLabelText('Amount to convert'), { target: { value: '500' } });
    expect(screen.getByRole('button', { name: 'Match my intent' })).toBeDisabled();
  });
});

describe('CaribbeanFxNetCard — settlement-native credit file readout', () => {
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
    render(<CaribbeanFxNetCard />);
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
    render(<CaribbeanFxNetCard />);
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
    render(<CaribbeanFxNetCard />);
    expect(screen.queryByTestId('fx-credit-file')).not.toBeInTheDocument();
  });
});
