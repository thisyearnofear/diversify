import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { getTokenAddresses } from '@diversifi/shared/src/config';
const m = vi.hoisted(() => ({ auth: vi.fn(), fetch: vi.fn(), navigate: vi.fn(), invalidate: vi.fn() }));
vi.mock('@/components/wallet/WalletProvider', () => ({ useWalletContext: () => ({ address: `0x${'1'.repeat(40)}`, signMessage: vi.fn() }) }));
vi.mock('@/lib/wallet-auth', () => ({ getWalletAuthHeaders: m.auth }));
vi.mock('@/context/app/NavigationContext', () => ({ useNavigation: () => ({ navigateToSwap: m.navigate }) }));
vi.mock('@/hooks/use-expected-amount-out', () => ({ invalidateExpectedOutputCache: m.invalidate }));
vi.mock('@diversifi/shared/src/utils/promise-utils', () => ({ fetchWithTimeout: m.fetch }));
import { GuardianAllocationReview } from '../GuardianAllocationReview';
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ 'X-Wallet-Auth-Signature': 'proof' });
});
describe('measured allocation review', () => {
  it('requests authenticated evidence, preserves exact amount, and refreshes quotes before navigation', async () => {
    m.fetch.mockResolvedValue({ ok: true, json: async () => ({ advice: {
      action: 'SWAP', executionMode: 'ADVISORY', executionEligibility: 'manual_review', reasoning: 'Measured gap',
      allocationProposal: {
        chainId: 42220, fromToken: 'USDm', targetToken: 'KESm',
        fromAddress: getTokenAddresses(42220).USDm, targetAddress: getTokenAddresses(42220).KESm,
        amountIn: '12.123456', amountInRaw: '12123456', fromDecimals: 6,
        metricBasis: 'observed_prices_before_fees_and_slippage',
        reason: 'Measured gap', inputsAsOf: Date.now(), driftBeforeUsd: 100, driftAfterUsd: 80,
        executionEligibility: 'manual_review',
      },
    } }) });
    render(<GuardianAllocationReview />);
    fireEvent.click(screen.getByRole('button', { name: 'Check saved allocation' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Review in Exchange' }));
    expect(m.fetch.mock.calls[0][1]).toMatchObject({ body: '{}', headers: { 'X-Wallet-Auth-Signature': 'proof' } });
    expect(m.invalidate).toHaveBeenCalledTimes(1);
    expect(m.navigate).toHaveBeenCalledWith(expect.objectContaining({ amount: '12.123456', fromChainId: 42220, toChainId: 42220 }));
    expect(screen.getByText(/before fees and slippage/)).toBeInTheDocument();
  });
  it('a HOLD never offers an Exchange move', async () => {
    m.fetch.mockResolvedValue({ ok: true, json: async () => ({ advice: { action: 'HOLD', reasoning: 'Aligned' } }) });
    render(<GuardianAllocationReview />);
    fireEvent.click(screen.getByRole('button', { name: 'Check saved allocation' }));
    expect(await screen.findByText('Aligned')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Review in Exchange' })).not.toBeInTheDocument();
    expect(m.navigate).not.toHaveBeenCalled();
  });
});
