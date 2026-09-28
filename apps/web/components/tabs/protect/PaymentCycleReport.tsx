/**
 * PaymentCycleReport — the payment-cycle FX tool, two modes on one draft:
 * "Next payment" (forward FX drag scenario + cycle monitoring opt-in) and
 * "Last cycle" (the historical engine over a trailing 73-day window).
 * /fx-drag-calculator is now a doorway into "Last cycle".
 */

import React, { useEffect, useRef, useState } from 'react';
import type { FxCycleReportResponse } from '@/pages/api/agent/fx-cycle-report';
import { usePaymentCycleDraft } from '@/hooks/use-payment-cycle';
import { usePurchaseCycles } from '@/hooks/use-purchase-cycles';
import { useWalletContext } from '@/components/wallet/WalletProvider';
import { useNavigation, FOCUS_HIGHLIGHT_MS } from '@/context/app/NavigationContext';
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
import { LastCycleDrag } from './LastCycleDrag';

interface PaymentCycleReportProps {
  defaultLocalCurrency?: string;
  onAskGuardian?: (prompt: string) => void;
  /** Which engine the inspector opens on — the URL/intent caller decides;
   *  the segmented control owns it afterwards. */
  initialMode?: 'next' | 'last';
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
      <p className="text-3xs font-black uppercase tracking-wider text-gray-500">
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
            <p className="text-2xs text-gray-500">
              Achieved rate: {cycle.paymentOutcome.achievedRate.toLocaleString()} {cycle.localCurrency}/USD
            </p>
          )}
          {cycle.paymentOutcome.notes && (
            <p className="text-2xs text-gray-500 italic">{cycle.paymentOutcome.notes}</p>
          )}
        </div>
      )}
      {report && (
        <>
          <p className="text-xs font-bold text-gray-900 dark:text-white">{report.narrativeHeadline}</p>
          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{report.dragLine}</p>
          <p className="text-3xs text-gray-400 italic">{report.disclaimer}</p>
        </>
      )}
      {hasOutcome && !hasPostEvent && cycle.lastReport && (
        <p className="text-2xs text-gray-500">
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
      <p className="text-2xs text-gray-500">
        Payment date passed — confirm outcome. Any earlier scenario stays an illustrative snapshot until you enter what you paid.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <label className="col-span-2 space-y-1">
          <span className="text-3xs font-bold uppercase text-gray-500">
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
          <span className="text-3xs font-bold uppercase text-gray-500">Rate (optional)</span>
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
          <span className="text-3xs font-bold uppercase text-gray-500">Fees (optional)</span>
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
          <span className="text-3xs font-bold uppercase text-gray-500">Notes (optional)</span>
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

const CYCLE_MODES = ['next', 'last'] as const;
type CycleMode = (typeof CYCLE_MODES)[number];
const CYCLE_MODE_LABELS: Record<CycleMode, string> = {
  next: 'Next payment',
  last: 'Last cycle',
};

function CycleModeControl({ mode, onChange }: { mode: CycleMode; onChange: (m: CycleMode) => void }) {
  const groupRef = useRef<HTMLDivElement>(null);
  const choose = (index: number) => {
    onChange(CYCLE_MODES[index]);
    groupRef.current
      ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
      [index]?.focus();
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const index = CYCLE_MODES.indexOf(mode);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      choose((index + 1) % CYCLE_MODES.length);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      choose((index + CYCLE_MODES.length - 1) % CYCLE_MODES.length);
    }
  };

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label="Cycle direction"
      className="grid grid-cols-2 gap-1 rounded-full bg-gray-100 dark:bg-gray-800 p-1"
      onKeyDown={onKeyDown}
    >
      {CYCLE_MODES.map((opt) => {
        const isSelected = mode === opt;
        return (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange(opt)}
            className={`min-h-tap px-2 rounded-full text-xs font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 ${
              isSelected
                ? 'bg-white dark:bg-gray-900 shadow-sm text-gray-900 dark:text-white'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {CYCLE_MODE_LABELS[opt]}
          </button>
        );
      })}
    </div>
  );
}

export function PaymentCycleReport({
  defaultLocalCurrency,
  onAskGuardian,
  initialMode = 'next',
}: PaymentCycleReportProps) {
  const [mode, setMode] = useState<CycleMode>(initialMode);
  const { address, signMessage } = useWalletContext();
  const { draft, updateDraft } = usePaymentCycleDraft(defaultLocalCurrency);
  const {
    cycles,
    saveCycle,
    updateCycle,
    loading: cyclesLoading,
    needsUnlock,
    cycleAutoExecutionEnabled,
    unlockCycles,
    setCycleAutoExecution,
  } = usePurchaseCycles(address, signMessage);
  const { focusedCycleId, setFocusedCycleId } = useNavigation();
  const [report, setReport] = useState<FxCycleReportResponse | null>(null);
  const [savedCycleId, setSavedCycleId] = useState<string | null>(null);
  const [monitoringEnabled, setMonitoringEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cycleConsentSaving, setCycleConsentSaving] = useState(false);
  // In-sheet view swaps (the lens pattern): quiet link in, "←" out.
  const [view, setView] = useState<'main' | 'options' | 'cycles'>('main');
  const [editing, setEditing] = useState(false);
  const [highlightedCycleId, setHighlightedCycleId] = useState<string | null>(null);
  const cycleRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const targetCurrency = 'USD';

  // When the drawer's open_cycle_review handler sets focusedCycleId,
  // scroll the matching saved-cycle row into view and pulse-highlight it
  // so the user can confirm Guardian matched the right cycle. Falls back
  // to the local draft id (savedCycleId) for the in-tab draft when the
  // synthetic id was used.
  useEffect(() => {
    if (!focusedCycleId) return;
    // Focus lands in the cycles view — switch first so the row exists,
    // then scroll and highlight on the next pass.
    if (mode !== 'next' || view !== 'cycles') {
      setMode('next');
      setView('cycles');
      return;
    }
    const targetId = focusedCycleId === savedCycleId || focusedCycleId === 'draft'
      ? savedCycleId
      : focusedCycleId;
    const node = targetId ? cycleRefs.current[targetId] : null;
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setHighlightedCycleId(targetId ?? focusedCycleId);
    const handle = setTimeout(() => {
      setHighlightedCycleId(null);
      setFocusedCycleId(null);
    }, FOCUS_HIGHLIGHT_MS);
    return () => clearTimeout(handle);
  }, [focusedCycleId, savedCycleId, mode, view, setFocusedCycleId]);

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
      setEditing(false);
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

  const toggleCycleAutoExecution = async (enabled: boolean) => {
    setCycleConsentSaving(true);
    setError(null);
    try {
      await setCycleAutoExecution(enabled);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update cycle execution consent');
    } finally {
      setCycleConsentSaving(false);
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
          ? 'Guardian will propose moves as the payment date approaches — within your daily limit, and you approve each one.'
          : 'Enable monitoring below after you understand this scenario.',
      })
    : null;

  const upcomingCycles = cycles.filter((c) => c.status === 'active');
  const dueCycles = cycles.filter((c) => c.status === 'payment_due');
  const completedCycles = cycles.filter((c) => c.status === 'completed');

  const showCyclesEntry =
    mode === 'next' &&
    view === 'main' &&
    Boolean(address) &&
    (needsUnlock || cycles.length > 0);
  const cyclesEntryLabel = needsUnlock
    ? 'Saved cycles are locked →'
    : `Your cycles: ${upcomingCycles.length} active${
        dueCycles.length ? ` · ${dueCycles.length} need an outcome` : ''
      } →`;
  const cyclesEntry = showCyclesEntry ? (
    <button
      type="button"
      onClick={() => setView('cycles')}
      className={`text-xs font-semibold transition-colors ${
        dueCycles.length > 0
          ? 'text-amber-700 dark:text-amber-300'
          : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
      }`}
    >
      {cyclesEntryLabel}
    </button>
  ) : null;
  const showForm = !report || editing;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        What FX timing costs a supplier payment — your next one, or your last.
      </p>

      <CycleModeControl mode={mode} onChange={setMode} />

      {mode === 'next' && view === 'main' && dueCycles.length > 0 && cyclesEntry}

      {mode === 'last' ? (
        <LastCycleDrag
          currency={draft.localCurrency}
          onCurrencyChange={(c) => updateDraft({ localCurrency: c })}
          onTrackNext={({ currency, paymentUsd }) => {
            updateDraft({
              localCurrency: currency,
              targetAmountUsd: String(Math.round(paymentUsd)),
            });
            setMode('next');
            setView('main');
          }}
        />
      ) : view === 'options' && report ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setView('main')}
            className="text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            ← Report
          </button>
          {reportContract && (
            <GuardianRecommendationCard
              contract={reportContract}
              onAskWhy={() =>
                onAskGuardian?.(
                  `Explain this payment-cycle FX drag report for ${draft.localCurrency} → ${targetCurrency} on ${draft.paymentDate}.`,
                )
              }
            />
          )}
          {savedCycleId && address && monitoringEnabled && (
            <label className="flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/20 p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={cycleAutoExecutionEnabled}
                disabled={cycleConsentSaving}
                onChange={(e) => toggleCycleAutoExecution(e.target.checked)}
                className="mt-1"
              />
              <div>
                <p className="text-xs font-bold text-gray-900 dark:text-white">
                  Allow Guardian to execute supported cycle protection
                </p>
                <p className="text-2xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                  Separate consent: Guardian may make one verified Celo local-stable → cUSD trade for the full cycle amount, only within your active GUARDIAN limits. Unsupported currencies and insufficient balances stay advisory-only.
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
          <p className="text-3xs text-gray-400 italic">{report.provenance.rateSourceNote}</p>
        </div>
      ) : view === 'cycles' ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setView('main')}
            className="text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            ← Back
          </button>
          {needsUnlock && (
            <div className="space-y-2">
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
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
          {upcomingCycles.length > 0 && (
            <div className="space-y-2">
              <p className="text-3xs font-black uppercase tracking-wider text-gray-500">Active cycles</p>
              {upcomingCycles.map((c) => {
                const isHighlighted = highlightedCycleId === c.id;
                return (
                  <div
                    key={c.id}
                    ref={(node) => {
                      cycleRefs.current[c.id] = node;
                    }}
                    className={`text-xs text-gray-600 dark:text-gray-400 rounded-lg px-2 py-1.5 transition-colors${
                      isHighlighted
                        ? ' bg-amber-50 dark:bg-amber-900/20 ring-2 ring-amber-300 dark:ring-amber-600'
                        : ''
                    }`}
                  >
                    {c.localCurrency} → {c.targetCurrency} ${c.targetAmountUsd.toLocaleString()} · {c.paymentDate}
                    {c.monitoringEnabled ? ' · Monitoring on' : ''}
                  </div>
                );
              })}
            </div>
          )}
          {dueCycles.length > 0 && (
            <div className="space-y-2">
              <p className="text-3xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
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
              <p className="text-3xs font-black uppercase tracking-wider text-gray-500">Completed cycles</p>
              {completedCycles.map((c) => (
                <CyclePostEventCard key={c.id} cycle={c} />
              ))}
            </div>
          )}
        </div>
      ) : (
      <>
      {showForm ? (
      <>
      <div className="grid grid-cols-2 gap-2">
        <label className="col-span-1 space-y-1">
          <span className="text-3xs font-bold uppercase text-gray-500">Local currency</span>
          <input
            value={draft.localCurrency}
            onChange={(e) => updateDraft({ localCurrency: e.target.value.toUpperCase().slice(0, 3) })}
            placeholder="GHS"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          />
        </label>
        <label className="col-span-1 space-y-1">
          <span className="text-3xs font-bold uppercase text-gray-500">Target</span>
          <input
            value={targetCurrency}
            readOnly
            aria-describedby="payment-target-note"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          />
        </label>
        <label className="col-span-1 space-y-1">
          <span className="text-3xs font-bold uppercase text-gray-500">Payment date</span>
          <input
            type="date"
            value={draft.paymentDate}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => updateDraft({ paymentDate: e.target.value })}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          />
        </label>
        <label className="col-span-1 space-y-1">
          <span className="text-3xs font-bold uppercase text-gray-500">Target amount</span>
          <input
            inputMode="decimal"
            value={draft.targetAmountUsd}
            onChange={(e) => updateDraft({ targetAmountUsd: e.target.value })}
            placeholder="10000"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          />
        </label>
      </div>
      <p id="payment-target-note" className="text-2xs text-gray-500 dark:text-gray-400 leading-relaxed">
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
      </>
      ) : report ? (
      <>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {draft.localCurrency.toUpperCase()} → {targetCurrency}{' '}
          {Number.parseFloat(draft.targetAmountUsd).toLocaleString()} · {draft.paymentDate} ·{' '}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            Edit
          </button>
        </p>

        {/* The result is the object — no card chrome. */}
        <div className="space-y-1.5">
          <p className="text-sm font-bold text-gray-900 dark:text-white">
            {report.narrative.headline}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
            {report.narrative.dragLine}
          </p>
          <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 leading-relaxed">
            {report.narrative.protectionCostLine}
          </p>
          <p className="text-2xs text-gray-500 dark:text-gray-400">
            {report.narrative.netBenefitDisclaimer}
          </p>
        </div>

        {/* One CTA, chosen by state. */}
        {address && savedCycleId && !monitoringEnabled && (
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => toggleMonitoring(true)}
              className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold transition-colors"
            >
              Let Guardian watch this payment
            </button>
            <p className="text-2xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Guardian may propose protection as the date approaches — you approve each move. Watching never authorizes a trade.
            </p>
          </div>
        )}
        {address && savedCycleId && monitoringEnabled && (
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Guardian is watching this payment ·{' '}
            <button
              type="button"
              onClick={() => toggleMonitoring(false)}
              className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Stop
            </button>
          </p>
        )}

        <div className="flex items-center gap-4 pt-1">
          <button
            type="button"
            onClick={() => setView('options')}
            className="text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            Details &amp; export →
          </button>
          <button
            type="button"
            onClick={() =>
              onAskGuardian?.(
                `Explain this payment-cycle FX drag report for ${draft.localCurrency} → ${targetCurrency} on ${draft.paymentDate}.`,
              )
            }
            className="text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            Ask Guardian why
          </button>
        </div>
      </>
      ) : null}

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      {!address && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Connect your wallet to save cycles and let Guardian watch them.
        </p>
      )}

      {dueCycles.length === 0 && cyclesEntry}
      </>
      )}
    </div>
  );
}

export default PaymentCycleReport;
