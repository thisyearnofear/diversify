import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import CaribbeanFxNetCard from '../CaribbeanFxNetCard';

// Mock the wallet + netting hook so the card renders/isolation-testable
// without a connection or network.
const mockMatch = vi.fn();
vi.mock('../../../hooks/use-fx-netting', () => ({
  useFxNetting: () => ({
    data: null,
    isLoading: false,
    error: null,
    match: mockMatch,
  }),
}));
vi.mock('../../../components/wallet/WalletProvider', () => ({
  useWalletContext: () => ({ address: '0xabc' }),
}));

afterEach(cleanup);

describe('CaribbeanFxNetCard — smoke + phase flips', () => {
  beforeEach(() => mockMatch.mockReset());

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