import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import FxNettingRail from '../FxNettingRail';
import { buildWalletAuthMessage } from '@/lib/wallet-auth';
import { buildLiveRateProvider } from '@diversifi/shared/src/services/fx-netting/rate-adapter';

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
let mockLoading = false;

vi.mock('../../../hooks/use-fx-netting', () => ({
  useFxNetting: () =>
    mockHookOverride
      ? { ...mockHookOverride }
      : {
          data: mockData,
          isLoading: mockLoading,
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

const mockNavigateWithIntent = vi.fn();
vi.mock('@/context/app/NavigationContext', () => ({
  useNavigation: () => ({ navigateWithIntent: mockNavigateWithIntent }),
}));

// The mid-market line reads the live USD table — mock the provider so
// tests never touch the network.
const mockRateProvider = {
  midRate: () => 0.0421,
  date: '2026-09-15',
  sourceNote: 'test table',
  hasRate: () => true,
};
vi.mock('@diversifi/shared/src/services/fx-netting/rate-adapter', () => ({
  buildLiveRateProvider: vi.fn(async () => mockRateProvider),
}));

afterEach(cleanup);

describe('FxNettingRail — smoke + phase flips', () => {
  beforeEach(() => {
    mockMatch.mockReset();
    mockLoading = false;
    mockHookOverride = null;
    mockRefreshSettlements.mockClear();
    mockAddress = '0xabc';
    mockData = null;
  });

  it('renders the intent phase by default with JMD/BBD defaults and no metric tiles or credit file', () => {
    render(<FxNettingRail />);
    expect(screen.getByTestId('fx-netting-rail')).toBeInTheDocument();
    expect(screen.getByTestId('fx-phase-intent')).toBeInTheDocument();
    expect(screen.getByText('Match a currency need')).toBeInTheDocument();
    expect(screen.getByLabelText('Currency you have')).toHaveValue('JMD');
    expect(screen.getByLabelText('Currency you want')).toHaveValue('BBD');
    expect(screen.queryByTestId('fx-metrics')).not.toBeInTheDocument();
    expect(screen.queryByTestId('fx-credit-file')).not.toBeInTheDocument();
    expect(screen.queryByText('Matched')).not.toBeInTheDocument();
  });

  it('shows the live mid-market line for a covered corridor', async () => {
    render(<FxNettingRail />);
    const line = await screen.findByTestId('fx-mid-rate');
    expect(line).toHaveTextContent('1 JMD = 0.0421 BBD');
    expect(line).toHaveTextContent('2026-09-15');
  });

  it('the cycle footnote lives in Details and hands off to the payment-cycle inspector, not the old page', () => {
    render(<FxNettingRail />);
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    fireEvent.click(
      screen.getByRole('button', { name: /See what FX timing costs across a whole cycle/ }),
    );
    expect(mockNavigateWithIntent).toHaveBeenCalledWith('protect', {
      source: 'exchange',
      lens: 'cycle',
    });
  });

  it('flips to the review phase and calls match when the CTA is enabled', () => {
    render(<FxNettingRail />);
    const amount = screen.getByLabelText('Amount to convert');
    fireEvent.change(amount, { target: { value: '500000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find a match' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Find a match' }));
    expect(mockRefreshSettlements).toHaveBeenCalled();
    expect(mockRefreshCreditProfile).toHaveBeenCalled();
  });
});

describe('FxNettingRail — walletless observer path (judges)', () => {
  beforeEach(() => {
    mockMatch.mockReset();
    mockLoading = false;
    mockHookOverride = null;
    mockRefreshSettlements.mockClear();
    mockAddress = null;
    mockData = null;
  });

  it('renders the intent form and an enabled CTA with NO wallet — matching is not gated on connection', () => {
    render(<FxNettingRail />);
    const amount = screen.getByLabelText('Amount to convert');
    fireEvent.change(amount, { target: { value: '250000' } });
    const cta = screen.getByRole('button', { name: 'Find a match' });
    expect(cta).toBeEnabled();
    fireEvent.click(cta);
    expect(mockMatch).toHaveBeenCalled();
  });

  it('shows the observer preview line in review phase when walletless', () => {
    mockData = { matches: [], totalMatchedUsd: 0, totalSavingsUsd: 0, unmatchedCount: 1, observer: true, poolSize: 3 };
    render(<FxNettingRail />);
    fireEvent.change(screen.getByLabelText('Amount to convert'), { target: { value: '250000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find a match' }));
    const banner = screen.getByTestId('fx-observer-banner');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(/live preview · nothing posted/i);
    expect(banner).toHaveTextContent(/connect a wallet to post your intent/i);
  });

  it('shows an honest no-match headline with no invented matches', () => {
    mockData = { matches: [], totalMatchedUsd: 0, totalSavingsUsd: 0, unmatchedCount: 1, observer: true, poolSize: 0 };
    render(<FxNettingRail />);
    fireEvent.change(screen.getByLabelText('Amount to convert'), { target: { value: '250000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find a match' }));
    expect(screen.getByText('No match yet')).toBeInTheDocument();
    expect(screen.getByText(/JMD → BBD has no opposing match in this check/i)).toBeInTheDocument();
    expect(screen.queryByText(/guardian standing liquidity/i)).not.toBeInTheDocument();
  });
});

describe('FxNettingRail — currency validation', () => {
  beforeEach(() => {
    mockMatch.mockReset();
    mockLoading = false;
    mockHookOverride = null;
    mockRefreshSettlements.mockClear();
    mockAddress = '0xabc';
    mockData = null;
  });

  it('flags an unknown currency code and keeps the CTA disabled', () => {
    render(<FxNettingRail />);
    fireEvent.change(screen.getByLabelText('Currency you have'), { target: { value: 'JAM' } });
    fireEvent.change(screen.getByLabelText('Amount to convert'), { target: { value: '500' } });
    expect(screen.getByText(/unsupported currency code/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Find a match' })).toBeDisabled();
  });

  it('keeps the CTA enabled for known codes from the corridor presets', () => {
    render(<FxNettingRail />);
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    fireEvent.click(screen.getByRole('button', { name: 'TTD → JMD' }));
    expect(screen.getByTestId('fx-phase-intent')).toBeInTheDocument();
    expect(screen.getByLabelText('Currency you have')).toHaveValue('TTD');
    expect(screen.getByLabelText('Currency you want')).toHaveValue('JMD');
    fireEvent.change(screen.getByLabelText('Amount to convert'), { target: { value: '1000' } });
    expect(screen.getByRole('button', { name: 'Find a match' })).toBeEnabled();
  });

  it('disables the CTA when both currencies are the same', () => {
    render(<FxNettingRail />);
    fireEvent.change(screen.getByLabelText('Currency you want'), { target: { value: 'JMD' } });
    fireEvent.change(screen.getByLabelText('Amount to convert'), { target: { value: '500' } });
    expect(screen.getByRole('button', { name: 'Find a match' })).toBeDisabled();
  });

  it('omits the mid-market line when the corridor has no live quote', async () => {
    vi.spyOn(mockRateProvider, 'hasRate').mockReturnValue(false);
    render(<FxNettingRail />);
    await screen.findByTestId('fx-phase-intent');
    await waitFor(() => expect(buildLiveRateProvider).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.queryByTestId('fx-mid-rate')).not.toBeInTheDocument();
    vi.restoreAllMocks();
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
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(screen.queryByTestId('fx-credit-file')).not.toBeInTheDocument();
  });
});

describe('FxNettingRail — need/details morph', () => {
  beforeEach(() => {
    mockMatch.mockReset();
    mockLoading = false;
    mockHookOverride = null;
    mockRefreshSettlements.mockClear();
    mockAddress = '0xabc';
    mockData = null;
  });

  it('Details replaces the intent form and preserves the amount on return', () => {
    render(<FxNettingRail />);
    fireEvent.change(screen.getByLabelText('Amount to convert'), { target: { value: '750' } });
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(screen.queryByLabelText('Amount to convert')).not.toBeInTheDocument();
    expect(screen.getByText('Try another pair')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Your need' }));
    expect(screen.getByLabelText('Amount to convert')).toHaveValue(750);
  });

  it('loading shows a status line, never fabricated zero stats', () => {
    render(<FxNettingRail />);
    fireEvent.change(screen.getByLabelText('Amount to convert'), { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find a match' }));
    mockLoading = true;
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    fireEvent.click(screen.getByRole('button', { name: 'Your need' }));
    expect(screen.getByText(/looking for an opposing currency need/i)).toBeInTheDocument();
    expect(screen.queryByText('Matched value')).not.toBeInTheDocument();
    expect(screen.queryByText('$0')).not.toBeInTheDocument();
    mockLoading = false;
  });
});

const MATCH_FIXTURE = {
  matches: [
    {
      matchId: 'm1', matchedAmount: 500, rate: 0.01264, savingsBps: 0, notionalUsd: 3.16,
      intentA: { participantId: 'observer-a', sellCurrency: 'JMD', buyCurrency: 'BBD' },
      intentB: { participantId: 'guardian-liquidity-test', sellCurrency: 'BBD', buyCurrency: 'JMD' },
    },
  ],
  totalMatchedUsd: 3.16, totalSavingsUsd: 0.1, unmatchedCount: 0,
  observer: true, rateDate: '2026-09-30', rateSourceNote: 'test rate table',
  bootstrapNote: 'Test liquidity note', poolSize: 1,
};

describe('FxNettingRail — match result + details data', () => {
  beforeEach(() => {
    mockMatch.mockReset();
    mockLoading = false;
    mockHookOverride = null;
    mockRefreshSettlements.mockClear();
    mockAddress = '0xabc';
    mockData = MATCH_FIXTURE as unknown as Record<string, unknown>;
  });
  afterEach(() => {
    mockData = null;
    mockHookOverride = null;
  });

  it('shows the matched hero and moves the field metrics to Details', () => {
    render(<FxNettingRail />);
    fireEvent.change(screen.getByLabelText('Amount to convert'), { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find a match' }));
    expect(screen.getByText('$3 matched')).toBeInTheDocument();
    expect(screen.getByText('1 match at mid-market')).toBeInTheDocument();
    expect(screen.getByTestId('fx-net-pair')).toBeInTheDocument();
    expect(screen.queryByText('Matched value')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(screen.getByText('Matched value')).toBeInTheDocument();
    expect(screen.getByText('Estimated avoided costs')).toBeInTheDocument();
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
    expect(screen.getByText('Matches')).toBeInTheDocument();
    expect(screen.getByText('Unmatched needs')).toBeInTheDocument();
  });

  it('keeps Guardian liquidity labels, bootstrap note and rate source accessible in Details', () => {
    render(<FxNettingRail />);
    fireEvent.change(screen.getByLabelText('Amount to convert'), { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find a match' }));
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(screen.getByTestId('fx-guardian-match-m1')).toBeInTheDocument();
    expect(screen.getByTestId('fx-bootstrap-note')).toHaveTextContent('Test liquidity note');
    expect(screen.getByText(/test rate table/)).toBeInTheDocument();
    expect(screen.getByText(/1 open intent/)).toBeInTheDocument();
  });

  it('Edit your need returns to the filled form without discarding fields', () => {
    render(<FxNettingRail />);
    fireEvent.change(screen.getByLabelText('Amount to convert'), { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find a match' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit your need' }));
    expect(screen.getByTestId('fx-phase-intent')).toBeInTheDocument();
    expect(screen.getByLabelText('Amount to convert')).toHaveValue(500);
    expect(screen.getByLabelText('Currency you have')).toHaveValue('JMD');
  });

  it('a retained result is never shown for a different pair while the new match loads', () => {
    render(<FxNettingRail />);
    fireEvent.change(screen.getByLabelText('Amount to convert'), { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find a match' }));
    expect(screen.getByText('$3 matched')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit your need' }));
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(screen.queryByTestId('fx-metrics')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Your need' }));

    fireEvent.change(screen.getByLabelText('Currency you have'), { target: { value: 'NGN' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find a match' }));
    mockLoading = true;
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(screen.queryByTestId('fx-metrics')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Your need' }));
    expect(screen.getByText(/looking for an opposing currency need/i)).toBeInTheDocument();
    expect(screen.queryByText('$3 matched')).not.toBeInTheDocument();
    expect(screen.queryByTestId('fx-net-pair')).not.toBeInTheDocument();

    mockLoading = false;
    mockData = {
      ...MATCH_FIXTURE,
      matches: [], unmatchedCount: 1, rateDate: '2026-10-01',
    } as unknown as Record<string, unknown>;
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    fireEvent.click(screen.getByRole('button', { name: 'Your need' }));
    expect(screen.getByText('No match yet')).toBeInTheDocument();
    expect(screen.getByText('Rates as of 2026-10-01')).toBeInTheDocument();
    mockLoading = false;
    mockData = null;
  });

  it('a matching error hides retained stats in Details and shows safe copy', () => {
    mockHookOverride = {
      data: MATCH_FIXTURE, isLoading: false, error: 'fx-netting 500', match: mockMatch,
      settlements: null, refreshSettlements: mockRefreshSettlements, settle: vi.fn(),
      isSettling: false, settleError: null,
      creditProfile: null, refreshCreditProfile: mockRefreshCreditProfile,
    };
    render(<FxNettingRail />);
    fireEvent.change(screen.getByLabelText('Amount to convert'), { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find a match' }));
    expect(screen.getByText('Matching is unavailable')).toBeInTheDocument();
    expect(screen.queryByText('fx-netting 500')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(screen.queryByTestId('fx-metrics')).not.toBeInTheDocument();
    mockHookOverride = null;
  });
});

describe('FxNettingRail — settlement worklist', () => {
  const settleSpy = vi.fn();
  const debt = {
    settlementId: 's1', status: 'pending',
    fromParticipant: '0xabc', toParticipant: '0xdef4567890',
    netAmount: 12.5, settlementCurrency: 'JMD', txHash: null,
  };

  beforeEach(() => {
    mockMatch.mockReset();
    mockLoading = false;
    mockHookOverride = null;
    settleSpy.mockClear();
    mockAddress = '0xabc';
    mockData = null;
    mockHookOverride = {
      data: null, isLoading: false, error: null, match: mockMatch,
      settlements: [debt], refreshSettlements: mockRefreshSettlements,
      settle: settleSpy, isSettling: false, settleError: null,
      creditProfile: null, refreshCreditProfile: mockRefreshCreditProfile,
    };
  });
  afterEach(() => {
    mockHookOverride = null;
  });

  it('renders the owed settlement in the result and passes it to onSettle once', () => {
    render(<FxNettingRail />);
    fireEvent.change(screen.getByLabelText('Amount to convert'), { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find a match' }));
    expect(settleSpy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Send 12.5 JMD/ }));
    expect(settleSpy).toHaveBeenCalledTimes(1);
    expect(settleSpy).toHaveBeenCalledWith(debt);
  });
});
