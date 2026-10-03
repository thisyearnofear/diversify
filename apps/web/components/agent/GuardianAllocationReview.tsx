import React, { useEffect, useRef, useState } from 'react';
import { useWalletContext } from '@/components/wallet/WalletProvider';
import { getWalletAuthHeaders } from '@/lib/wallet-auth';
import { useNavigation } from '@/context/app/NavigationContext';
import { useBalanceVisibility } from '@/context/app/BalanceVisibilityContext';
import { allocationReviewPrefill } from '@/lib/allocation-review';
import { invalidateExpectedOutputCache } from '@/hooks/use-expected-amount-out';
import { fetchWithTimeout } from '@diversifi/shared/src/utils/promise-utils';

/** A user-initiated measured read. It never submits a transaction. */
export function GuardianAllocationReview() {
  const { address, signMessage } = useWalletContext();
  const { navigateToSwap } = useNavigation();
  const { formatMoney } = useBalanceVisibility();
  const [advice, setAdvice] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  useEffect(() => {
    request.current++;
    setAdvice(null);
    setError(null);
    setLoading(false);
    const requestSequence = request;
    return () => { requestSequence.current++; };
  }, [address]);
  const read = async () => {
    if (!address || loading) return;
    const current = ++request.current;
    setLoading(true);
    setError(null);
    setAdvice(null);
    try {
      const headers = await getWalletAuthHeaders(address, signMessage);
      if (!headers) throw new Error('Sign the wallet read request to continue.');
      const response = await fetchWithTimeout('/api/agent/deep-analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: '{}',
      }, 35000);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Wallet evidence unavailable.');
      if (request.current === current) setAdvice(body.advice);
    } catch (e) {
      if (request.current === current) setError(e instanceof Error ? e.message : 'Allocation read failed.');
    } finally {
      if (request.current === current) setLoading(false);
    }
  };
  const prefill = allocationReviewPrefill(advice);
  const proposal = prefill ? advice.allocationProposal : null;
  return (
    <div className="space-y-3" data-testid="guardian-allocation-review">
      <p className="text-sm text-ink-muted">Compare measured savings with your saved allocation. No forecast, no automatic move.</p>
      {loading && <p role="status" className="text-sm text-ink-muted">Reading wallet balances and dated prices…</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {advice && <p className="text-sm text-ink">{advice.reasoning}</p>}
      {advice?.planStrategy && <p className="text-2xs text-ink-muted">Guardian’s saved plan: {advice.planStrategy}. Review-only; your signature is required.</p>}
      {proposal && (
        <p className="text-xs text-ink-muted">
          Estimated allocation drift: {formatMoney(proposal.driftBeforeUsd)} → {formatMoney(proposal.driftAfterUsd)}.
          At observed prices, before fees and slippage. This is not savings.
        </p>
      )}
      {advice?.scope && <p className="text-2xs text-ink-muted">{advice.scope}</p>}
      {prefill ? (
        <button type="button" onClick={() => {
          const fresh = allocationReviewPrefill(advice);
          if (!fresh) { setAdvice(null); setError('The allocation reading expired. Check again.'); return; }
          invalidateExpectedOutputCache();
          navigateToSwap(fresh);
        }} className="min-h-tap w-full rounded-xl bg-action px-4 text-sm font-bold text-white">
          Review in Exchange
        </button>
      ) : (
        <button type="button" onClick={() => void read()} disabled={loading || !address} className="min-h-tap w-full rounded-xl bg-action px-4 text-sm font-bold text-white disabled:opacity-50">
          {loading ? 'Reading allocation…' : advice || error ? 'Check again' : 'Check saved allocation'}
        </button>
      )}
    </div>
  );
}
