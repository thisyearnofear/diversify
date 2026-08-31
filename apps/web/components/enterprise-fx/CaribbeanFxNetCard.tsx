/**
 * CaribbeanFxNetCard — CARICOM FX matching surface for the Protect tab.
 *
 * Shows the user's FX intent (e.g. "I need to convert BBD → JMD"), runs the
 * matching engine via useFxNetting, and surfaces the result: matched flows
 * at mid-market (no USD bridge), savings vs the traditional 7% corridor,
 * and the settlement plan (anchored to Celo).
 *
 * Follows the BestYieldCard pattern: self-contained, uses a dedicated hook,
 * surfaces a single high-signal number (savings). Gated to Pan-Caribbean
 * profiles — other philosophies don't see this card.
 */

import React, { useState } from 'react';
import { Card } from '../shared/TabComponents';
import { useWalletContext } from '../wallet/WalletProvider';
import { useFxNetting } from '../../hooks/use-fx-netting';
import { trackFunnelEvent } from '@/lib/analytics';

const CARIBBEAN_CURRENCIES = ['BBD', 'JMD', 'TTD', 'XCD', 'HTG', 'GYD', 'DOP'];

export function CaribbeanFxNetCard({ userAddress }: { userAddress: string | null }) {
  const { signMessage } = useWalletContext();
  const { data, isLoading, error, match } = useFxNetting(userAddress, signMessage);
  const [sellCurrency, setSellCurrency] = useState('BBD');
  const [sellAmount, setSellAmount] = useState('10000');
  const [buyCurrency, setBuyCurrency] = useState('JMD');

  const onMatch = () => {
    const amt = parseFloat(sellAmount);
    if (!Number.isFinite(amt) || amt <= 0) return;
    trackFunnelEvent('fx_netting_match_requested');
    void match(
      { sellCurrency, sellAmount: amt, buyCurrency },
      [{ sellCurrency: buyCurrency, sellAmount: amt * 79, buyCurrency: sellCurrency }],
    );
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🏝️</span>
        <div>
          <p className="text-sm font-black text-gray-900 dark:text-white">CARICOM FX Matching</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">Direct currency matching — no USD bridge</p>
        </div>
      </div>

      {/* Intent input */}
      <div className="flex items-end gap-2 mb-3">
        <div className="flex-1">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1 block">Sell</label>
          <div className="flex gap-1">
            <input
              type="number" inputMode="decimal" value={sellAmount}
              onChange={(e) => setSellAmount(e.target.value)} placeholder="Amount"
              aria-label="Sell amount"
              className="flex-1 min-w-0 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-2"
            />
            <select value={sellCurrency} onChange={(e) => setSellCurrency(e.target.value)} aria-label="Sell currency"
              className="text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-2"
            >
              {CARIBBEAN_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <span className="text-gray-400 pb-2">→</span>
        <div className="flex-1">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1 block">Buy</label>
          <select value={buyCurrency} onChange={(e) => setBuyCurrency(e.target.value)} aria-label="Buy currency"
            className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-2"
          >
            {CARIBBEAN_CURRENCIES.filter((c) => c !== sellCurrency).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <button type="button" onClick={onMatch} disabled={isLoading || !userAddress}
        className="w-full min-h-[44px] py-2.5 rounded-xl text-xs font-black text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 transition-colors"
      >
        {isLoading ? 'Matching…' : userAddress ? 'Find a match →' : 'Connect wallet to match'}
      </button>

      {error && <p className="text-[11px] text-red-500 mt-2">{error}</p>}
      {data && data.matches.length > 0 && <MatchResults data={data} />}
      {data && data.matches.length === 0 && !isLoading && (
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-3 text-center">No match found — try a different pair or amount.</p>
      )}
      <p className="text-[10px] text-gray-400 mt-3 text-center">
        {data?.rateSourceNote ?? 'Live mid-market rates from the fawazahmed0 open dataset.'}
      </p>
    </Card>
  );
}

function MatchResults({ data }: { data: NonNullable<ReturnType<typeof useFxNetting>['data']> }) {
  return (
    <div className="mt-4 space-y-2">
      {data.matches.map((m) => (
        <div key={m.matchId} className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3 border border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-bold text-gray-900 dark:text-white">
              {m.intentA.sellCurrency} ↔ {m.intentA.buyCurrency}
            </p>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
              Mid-market
            </span>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            {m.matchedAmount.toLocaleString()} {m.intentA.sellCurrency} @ {m.rate.toFixed(2)} {m.intentA.buyCurrency}/{m.intentA.sellCurrency}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <div>
              <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">${m.notionalUsd.toFixed(0)}</p>
              <p className="text-[9px] text-gray-400 uppercase tracking-wide">Matched</p>
            </div>
            <div>
              <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                ${(m.notionalUsd * m.savingsBps / 10_000).toFixed(0)}
              </p>
              <p className="text-[9px] text-gray-400 uppercase tracking-wide">Saved</p>
            </div>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-800/50 px-3 py-2">
        <p className="text-[11px] text-gray-500 dark:text-gray-400">Total savings vs 7% corridor</p>
        <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">${data.totalSavingsUsd.toFixed(0)}</p>
      </div>
      <p className="text-[10px] text-gray-400 text-center">
        Anchored to the RecommendationLedger on Celo — verifiable on-chain.
      </p>
    </div>
  );
}
