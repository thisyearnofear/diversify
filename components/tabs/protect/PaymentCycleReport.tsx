/**
 * PaymentCycleReport — free FX drag scenario + cycle monitoring opt-in.
 */

import React, { useState } from 'react';
import type { FxCycleReportResponse } from '@/pages/api/agent/fx-cycle-report';
import { usePaymentCycleDraft } from '@/hooks/use-payment-cycle';
import { usePurchaseCycles } from '@/hooks/use-purchase-cycles';
import { useWalletContext } from '@/components/wallet/WalletProvider';
import { GuardianRecommendationCard } from '@/components/agent/GuardianRecommendationCard';
import {
  buildCycleProtectionContract,
  daysUntilPaymentDate,
} from '@diversifi/shared/src/services/guardian/recommendation-contract';
import { snapshotFromFxReport } from '@/lib/purchase-cycle-serialize';
import { trackFunnelEvent } from '@/lib/analytics';
import { InlineSpinner } from '@/components/ui/Skeleton';
import type { PurchaseCycleRecord } from '@diversifi/shared/src/types/purchase-cycle';
import {
  downloadTextFile,
  renderFxDragReportCsv,
  renderFxDragReportMarkdown,
} from '@diversifi/shared/src/services/fx-drag/fx-drag-report-renderer';
import { CURRENCY_BY_CODE } from '@/constants/currency-risk';

interface PaymentCycleReportProps {
  defaultLocalCurrency?: string;
  onAskGuardian?: (prompt: string) => void;
}

function CyclePostEventCard({ cycle }: { cycle: PurchaseCycleRecord }) {
  const hasOutcome = Boolean(cycle.paymentOutcome);
  const hasPostEvent = Boolean(cycle.postEventReport);
  const report = cycle.postEventReport ?? (!hasOutcome ? cycle.lastReport : undefined);
  if (!report && !hasOutcome) return null;

  const title = hasPostEvent
    ? 'Payment outcome recorded'
    : hasOutcome
      ? 'Payment recorded — outcome comparison pending'
      : 'Post-date illustrative snapshot';

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/60 p-3 space-y-2">
      <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">
        {title}
      </p>
      {cycle.paymentOutcome && (
        <div className="text-xs text-gray-700 dark:text-gray-300 space-y-0.5">
          <p>
            Paid {cycle.paymentOutcome.achievedLocalAmount.toLocaleString()} {cycle.localCurrency}
            {cycle.paymentOutcome.achievedFeesLocal != null
              ? ` (fees ${cycle.paymentOutcome.achievedFeesLocal.toLocaleString()})`
              : ''}
          </p>
          {cycle.paymentOutcome.achievedRate != null && (
            <p className="text-[11px] text-gray-500">
              Achieved rate: {cycle.paymentOutcome.achievedRate.toLocaleString()} {cycle.localCurrency}/USD
            </p>
          )}
          {cycle.paymentOutcome.notes && (
            <p className="text-[11px] text-gray-500 italic">{cycle.paymentOutcome.notes}</p>
          )}
        </div>
      )}
      {report && (
        <>
          <p className="text-xs font-bold text-gray-900 dark:text-white">{report.narrativeHeadline}</p>
          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{report.dragLine}</p>
          <p className="text-[10px] text-gray-400 italic">{report.disclaimer}</p>
        </>
      )}
      {hasOutcome && !hasPostEvent && cycle.lastReport && (
        <p className="text-[11px] text-gray-500">
          Pre-payment scenario remains illustrative and is not shown as realized P&amp;L.
        </p>
      )}
    </div>
  );
}

function PaymentDueConfirm({
  cycle,
  onConfirm,
  onCancel,
}: {
  cycle: PurchaseCycleRecord;
  onConfirm: (outcome: {
    achievedLocalAmount: number;
    achievedRate?: number;
    achievedFeesLocal?: number;
    notes?: string;
  }) => Promise<void>;
  onCancel: () => Promise<void>;
}) {
  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState('');
  const [fees, setFees] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = async () => {
    const achievedLocalAmount = Number.parseFloat(amount);
    if (!Number.isFinite(achievedLocalAmount) || achievedLocalAmount <= 0) {
      setLocalError('Enter the local amount you actually paid.');
      return;
    }
    setSaving(true);
    setLocalError(null);
    try {
      const achievedRate = Number.parseFloat(rate);
      const achievedFeesLocal = Number.parseFloat(fees);
      await onConfirm({
        achievedLocalAmount,
        achievedRate: Number.isFinite(achievedRate) && achievedRate > 0 ? achievedRate : undefined,
        achievedFeesLocal:
          Number.isFinite(achievedFeesLocal) && achievedFeesLocal >= 0 ? achievedFeesLocal : undefined,
        notes: notes.trim() || undefined,
      });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Could not confirm payment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl bg-white/70 dark:bg-gray-900/50 p-3 space-y-2">
      <p className="text-xs text-gray-700 dark:text-gray-300">
        {cycle.localCurrency} → {cycle.targetCurrency} ${cycle.targetAmountUsd.toLocaleString()} · {cycle.paymentDate}
      </p>
      <p className="text-[11px] text-gray-500">
        Payment date passed — confirm outcome. Any earlier scenario stays an illustrative snapshot until you enter what you paid.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <label className="col-span-2 space-y-1">
          <span className="text-[10px] font-bold uppercase text-gray-500">
            Amount paid ({cycle.localCurrency})
          </span>
          <input
            type="number"
            min="0"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm min-h-11"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-bold uppercase text-gray-500">Rate (optional)</span>
          <input
            type="number"
            min="0"
            step="any"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder={`${cycle.localCurrency}/USD`}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm min-h-11"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-bold uppercase text-gray-500">Fees (optional)</span>
          <input
            type="number"
            min="0"
            step="any"
            value={fees}
            onChange={(e) => setFees(e.target.value)}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm min-h-11"
          />
        </label>
        <label className="col-span-2 space-y-1">
          <span className="text-[10px] font-bold uppercase text-gray-500">Notes (optional)</span>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm min-h-11"
          />
        </label>
      </div>
      {localError && (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert">
          {localError}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={submit}
          className="min-h-11 px-3 rounded-lg bg-teal-600 text-white text-xs font-bold disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Confirm paid'}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => onCancel()}
          className="min-h-11 px-3 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-bold disabled:opacity-50"
        >
          Payment cancelled
        </button>
      </div>
    </div>
  );
}

export function PaymentCycleReport({
  defaultLocalCurrency,
  onAskGuardian,
}: PaymentCycleReportProps) {
  const { address, signMessage } = useWalletContext();
  const { draft, updateDraft } = usePaymentCycleDraft(defaultLocalCurrency);
  const { cycles, saveCycle, updateCycle, loading: cyclesLoading, needsUnlock, unlockCycles } = usePurchaseCycles(address, signMessage);
  const [report, setReport] = useState<FxCycleReportResponse | null>(null);
  const [savedCycleId, setSavedCycleId] = useState<string | null>(null);
  const [monitoringEnabled, setMonitoringEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const targetCurrency = 'USD';

  if (dismissed) return null;

  const canSubmit =
    draft.localCurrency.length === 3 &&
    draft.paymentDate &&
    Number.parseFloat(draft.targetAmountUsd) > 0;

  const runReport = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/agent/fx-cycle-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          localCurrency: draft.localCurrency.toUpperCase(),
          targetCurrency,
          paymentDate: draft.paymentDate,
          targetAmount: Number.parseFloat(draft.targetAmountUsd),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not compute report');
        setReport(null);
        return;
      }
      const fxReport = data as FxCycleReportResponse;
      setReport(fxReport);
      trackFunnelEvent('cycle_report_run', {
        currency: draft.localCurrency,
      });

      if (address) {
        const snapshot = snapshotFromFxReport(fxReport);
        const cycleInput = {
          localCurrency: draft.localCurrency.toUpperCase(),
          targetCurrency,
          paymentDate: draft.paymentDate,
          targetAmountUsd: Number.parseFloat(draft.targetAmountUsd),
          lastReport: snapshot,
          monitoringEnabled: false,
        };
        const saved = savedCycleId
          ? await updateCycle(savedCycleId, cycleInput)
          : await saveCycle(cycleInput);
        setSavedCycleId(saved?.id ?? null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error — try again');
    } finally {
      setLoading(false);
    }
  };

  const toggleMonitoring = async (enabled: boolean) => {
    if (!savedCycleId) return;
    setMonitoringEnabled(enabled);
    try {
      await updateCycle(savedCycleId, { monitoringEnabled: enabled });
      if (enabled) {
        trackFunnelEvent('cycle_monitoring_enabled', {
          currency: draft.localCurrency,
        });
      }
    } catch (e) {
      setMonitoringEnabled(!enabled);
      setError(e instanceof Error ? e.message : 'Could not update monitoring');
    }
  };

  const exportReport = (format: 'md' | 'csv') => {
    if (!report) return;
    const code = draft.localCurrency.toUpperCase();
    const risk = CURRENCY_BY_CODE[code];
    const dragInput = {
      business: 'Payment readiness scenario',
      currency: code,
      cycles: [],
    };
    const stamp = draft.paymentDate || 'report';
    if (format === 'md') {
      const md = renderFxDragReportMarkdown(dragInput, report.summary, {
        sourceNote: report.provenance.rateSourceNote,
        risk: risk
          ? {
              code: risk.code,
              flag: risk.flag,
              depreciationVsUsd: risk.depreciation.vsUSD,
              riskEvents: risk.riskEvents,
            }
          : null,
      });
      downloadTextFile(`fx-drag-${code}-${stamp}.md`, md, 'text/markdown;charset=utf-8');
    } else {
      const csv = renderFxDragReportCsv(dragInput, report.summary);
      downloadTextFile(`fx-drag-${code}-${stamp}.csv`, csv, 'text/csv;charset=utf-8');
    }
  };

  const daysUntil = draft.paymentDate ? daysUntilPaymentDate(draft.paymentDate) : null;

  const reportContract = report
    ? buildCycleProtectionContract({
        localCurrency: draft.localCurrency,
        targetCurrency,
        paymentDate: draft.paymentDate,
        daysUntilPayment: daysUntil ?? 0,
        targetAmountUsd: Number.parseFloat(draft.targetAmountUsd) || 0,
        dragLine: report.narrative.dragLine,
        protectionCostLine: report.narrative.protectionCostLine,
        provenance: {
          sourceType: report.provenance.sourceType,
          timestamp: report.provenance.asOf,
          benchmark: report.input.targetCurrency,
          period: `Recent historical stress applied through ${report.input.paymentDate}`,
          isHistorical: report.provenance.isHistorical,
          disclaimer: report.provenance.disclaimer,
        },
        monitoringEnabled,
        guardianBounds: monitoringEnabled
          ? 'Guardian will propose moves as the payment date approaches — execution stays within Auto-Saver limits.'
          : 'Enable monitoring below after you understand this scenario.',
      })
    : null;

  const upcomingCycles = cycles.filter((c) => c.status === 'active');
  const dueCycles = cycles.filter((c) => c.status === 'payment_due');
  const completedCycles = cycles.filter((c) => c.status === 'completed');

  return (
    <div className="rounded-2xl border border-teal-200 dark:border-teal-800/50 bg-gradient-to-br from-teal-50/80 to-cyan-50/50 dark:from-teal-950/20 dark:to-cyan-950/10 p-4 space-y-4">
      <div>
        <p className="text-xs font-black uppercase tracking-wider text-teal-800 dark:text-teal-200">
          Payment readiness
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 leading-relaxed">
          Model currency drag before a supplier payment — then opt into cycle-aware Guardian monitoring.
        </p>
      </div>

      {!address && (
        <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
          Connect your wallet to save cycles and enable monitoring.
        </p>
      )}

      {address && needsUnlock && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/20 p-3 space-y-2">
          <p className="text-xs text-blue-900 dark:text-blue-100 leading-relaxed">
            Unlock saved cycles with a short wallet signature. DiversiFi derives your address from the signature — it never trusts a pasted wallet address.
          </p>
          <button
            type="button"
            onClick={() => unlockCycles()}
            disabled={cyclesLoading}
            className="min-h-11 px-3 rounded-lg bg-blue-600 text-white text-xs font-bold disabled:opacity-50"
          >
            {cyclesLoading ? 'Unlocking…' : 'Unlock saved cycles'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <label className="col-span-1 space-y-1">
          <span className="text-[10px] font-bold uppercase text-gray-500">Local currency</span>
          <input
            value={draft.localCurrency}
            onChange={(e) => updateDraft({ localCurrency: e.target.value.toUpperCase().slice(0, 3) })}
            placeholder="GHS"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          />
        </label>
        <label className="col-span-1 space-y-1">
          <span className="text-[10px] font-bold uppercase text-gray-500">Target</span>
          <input
            value={targetCurrency}
            readOnly
            aria-describedby="payment-target-note"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          />
        </label>
        <label className="col-span-1 space-y-1">
          <span className="text-[10px] font-bold uppercase text-gray-500">Payment date</span>
          <input
            type="date"
            value={draft.paymentDate}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => updateDraft({ paymentDate: e.target.value })}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          />
        </label>
        <label className="col-span-1 space-y-1">
          <span className="text-[10px] font-bold uppercase text-gray-500">Target amount</span>
          <input
            inputMode="decimal"
            value={draft.targetAmountUsd}
            onChange={(e) => updateDraft({ targetAmountUsd: e.target.value })}
            placeholder="10000"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          />
        </label>
      </div>
      <p id="payment-target-note" className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
        USD targets only for now. This applies one recent historical stress move to today’s indicative rate at the payment date—not compounded over the full horizon, and not a forecast or locked quote.
      </p>

      <button
        type="button"
        onClick={runReport}
        disabled={!canSubmit || loading}
        className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2"
      >
        {loading ? <InlineSpinner /> : null}
        {loading ? 'Computing…' : 'Run cycle report'}
      </button>

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      {report && reportContract && (
        <div className="space-y-3 pt-1">
          <p className="text-sm font-bold text-gray-900 dark:text-white">
            {report.narrative.headline}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
            {report.narrative.dragLine}
          </p>
          <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 leading-relaxed">
            {report.narrative.protectionCostLine}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            {report.narrative.netBenefitDisclaimer}
          </p>
          <GuardianRecommendationCard
            contract={reportContract}
            onAskWhy={() =>
              onAskGuardian?.(
                `Explain this payment-cycle FX drag report for ${draft.localCurrency} → ${targetCurrency} on ${draft.paymentDate}.`,
              )
            }
            onDismiss={() => setDismissed(true)}
          />

          {savedCycleId && address && (
            <label className="flex items-start gap-3 rounded-xl border border-teal-200 dark:border-teal-800 bg-white/70 dark:bg-gray-900/50 p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={monitoringEnabled}
                onChange={(e) => toggleMonitoring(e.target.checked)}
                className="mt-1"
              />
              <div>
                <p className="text-xs font-bold text-gray-900 dark:text-white">
                  Let Guardian monitor this payment cycle
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                  Guardian may propose protection as the date approaches. Auto-execution only within your signed limits. You can mute or cancel anytime.
                </p>
              </div>
            </label>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => exportReport('md')}
              className="text-xs font-bold px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Download Markdown
            </button>
            <button
              type="button"
              onClick={() => exportReport('csv')}
              className="text-xs font-bold px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Download CSV
            </button>
          </div>

          <p className="text-[10px] text-gray-400 italic">{report.provenance.rateSourceNote}</p>
        </div>
      )}

      {address && !cyclesLoading && upcomingCycles.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-teal-200/60 dark:border-teal-800/40">
          <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Active cycles</p>
          {upcomingCycles.map((c) => (
            <div key={c.id} className="text-xs text-gray-600 dark:text-gray-400">
              {c.localCurrency} → {c.targetCurrency} ${c.targetAmountUsd.toLocaleString()} · {c.paymentDate}
              {c.monitoringEnabled ? ' · Monitoring on' : ''}
            </div>
          ))}
        </div>
      )}

      {address && !cyclesLoading && dueCycles.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-amber-200/60 dark:border-amber-800/40">
          <p className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
            Payment date passed — confirm outcome
          </p>
          {dueCycles.map((cycle) => (
            <PaymentDueConfirm
              key={cycle.id}
              cycle={cycle}
              onConfirm={async (paymentOutcome) => {
                await updateCycle(cycle.id, { status: 'completed', paymentOutcome });
              }}
              onCancel={async () => {
                await updateCycle(cycle.id, { status: 'cancelled' });
              }}
            />
          ))}
        </div>
      )}

      {completedCycles.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Completed cycles</p>
          {completedCycles.map((c) => (
            <CyclePostEventCard key={c.id} cycle={c} />
          ))}
        </div>
      )}
    </div>
  );
}

export default PaymentCycleReport;
