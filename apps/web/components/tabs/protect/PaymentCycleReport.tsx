/**
 * PaymentCycleReport — the payment-cycle FX tool, two modes on one draft:
 * "Next payment" (forward FX drag scenario + cycle monitoring opt-in) and
 * "Last cycle" (the historical engine over a trailing 73-day window).
 * /fx-drag-calculator is now a doorway into "Last cycle".
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
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
import WalletButton from '@/components/wallet/WalletButton';
import { DEFAULT_PAYMENT_BANK_SPREAD_BPS, paymentScenarioComparison, type PaymentScenarioComparison } from '@diversifi/shared/src/services/fx-drag/payment-intent';
import { DEFAULT_OPTIONS } from '@diversifi/shared/src/services/fx-drag/calc';
import { useBalanceVisibility } from '@/context/app/BalanceVisibilityContext';
import { MONEY_MASK } from '@/lib/money-format';
import { useCountUp } from '@/hooks/use-count-up';
import { haptics } from '@/lib/haptics';
import { reveal, springPop } from '@/lib/motion-tokens';

function PaymentScenarioReading({ comparison, currency }: { comparison: PaymentScenarioComparison; currency: string }) {
  const { hidden } = useBalanceVisibility();
  const format = (value: number) => hidden ? MONEY_MASK : `${currency} ${Math.round(value).toLocaleString('en-US')}`;
  const difference = useCountUp(Math.abs(comparison.differenceLocal), { initialValue: Math.abs(comparison.differenceLocal), format });
  const early = useCountUp(comparison.convertEarlyLocal, { initialValue: comparison.convertEarlyLocal, format });
  const waiting = useCountUp(comparison.waitScenarioLocal, { initialValue: comparison.waitScenarioLocal, format });
  return (
    <div className="space-y-4" data-testid="payment-comparison">
      <div className="text-center">
        <p className="text-sm font-semibold text-ink">
          {comparison.direction === 'similar' ? 'The modeled costs are similar' : `Waiting costs ${comparison.direction} in this scenario`}
        </p>
        {comparison.direction !== 'similar' && <motion.p className="my-2 text-3xl font-black tabular-nums text-ink">{difference}</motion.p>}
      </div>
      <dl className="space-y-2 text-sm">
        <div className="flex flex-wrap justify-between gap-2 border-b border-line pb-2">
          <dt className="text-ink-muted">Convert early reference</dt>
          <motion.dd className="font-semibold tabular-nums text-ink">{early}</motion.dd>
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          <dt className="text-ink-muted">Wait in this scenario</dt>
          <motion.dd className="font-semibold tabular-nums text-ink">{waiting}</motion.dd>
        </div>
      </dl>
    </div>
  );
}

interface PaymentCycleReportProps {
  defaultLocalCurrency?: string;
  onAskGuardian?: (prompt: string) => void;
  /** Which engine the inspector opens on — the URL/intent caller decides;
   *  the segmented control owns it afterwards. */
  initialMode?: 'next' | 'last';
  sample?: boolean;
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
          className="min-h-11 px-3 rounded-lg bg-action text-white text-xs font-bold disabled:opacity-50"
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
  last: '73-day scenario',
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
  sample = false,
}: PaymentCycleReportProps) {
  const [mode, setMode] = useState<CycleMode>(initialMode);
  const { address: walletAddress, signMessage } = useWalletContext();
  const reducedMotion = useReducedMotion();
  const { formatMoney } = useBalanceVisibility();
  const address = sample ? null : walletAddress;
  const { draft, updateDraft } = usePaymentCycleDraft(defaultLocalCurrency, !sample);
  const {
    cycles,
    saveCycle,
    updateCycle,
    loading: cyclesLoading,
    needsUnlock,
    cycleAutoExecutionEnabled,
    unlockCycles,
    setCycleAutoExecution,
    error: cyclesError,
  } = usePurchaseCycles(address, signMessage);
  const { focusedCycleId, setFocusedCycleId } = useNavigation();
  const [report, setReport] = useState<FxCycleReportResponse | null>(null);
  const [savedCycleId, setSavedCycleId] = useState<string | null>(null);
  const [reportSaved, setReportSaved] = useState(false);
  const [monitoringEnabled, setMonitoringEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cycleConsentSaving, setCycleConsentSaving] = useState(false);
  const reportRef = useRef(report);
  reportRef.current = report;
  const addressRef = useRef(address);
  addressRef.current = address;
  const draftRef = useRef(draft);
  draftRef.current = draft;
  // In-sheet view swaps (the lens pattern): quiet link in, "←" out.
  const [view, setView] = useState<'main' | 'options' | 'cycles'>('main');
  const [editing, setEditing] = useState(false);
  const [savedReading, setSavedReading] = useState(false);
  const reportHeadingRef = useRef<HTMLDivElement>(null);
  const [highlightedCycleId, setHighlightedCycleId] = useState<string | null>(null);
  const cycleRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const targetCurrency = 'USD';
  const previousAddress = useRef(address);

  useEffect(() => {
    if (previousAddress.current === address) return;
    previousAddress.current = address;
    if (savedReading) setReport(null);
    setSavedCycleId(null);
    setReportSaved(false);
    setMonitoringEnabled(false);
    setSavedReading(false);
    setView('main');
  }, [address, savedReading]);

  const editDraft = (patch: Parameters<typeof updateDraft>[0]) => {
    updateDraft(patch);
    setReport(null);
    setReportSaved(false);
    setMonitoringEnabled(false);
    setSavedReading(false);
    setError(null);
  };
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
      node.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
    }
    setHighlightedCycleId(targetId ?? focusedCycleId);
    const handle = setTimeout(() => {
      setHighlightedCycleId(null);
      setFocusedCycleId(null);
    }, FOCUS_HIGHLIGHT_MS);
    return () => clearTimeout(handle);
  }, [focusedCycleId, savedCycleId, mode, view, setFocusedCycleId, reducedMotion]);

  const canSubmit =
    /^[A-Z]{3}$/.test(draft.localCurrency) &&
    /^\d{4}-\d{2}-\d{2}$/.test(draft.paymentDate) &&
    Number.isFinite(Date.parse(draft.paymentDate)) &&
    draft.paymentDate >= new Date().toISOString().slice(0, 10) &&
    Number.isFinite(Number(draft.targetAmountUsd)) &&
    Number(draft.targetAmountUsd) > 0;

  useEffect(() => {
    if (report && !editing && view === 'main') reportHeadingRef.current?.focus();
  }, [report, editing, view]);

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
          targetAmount: Number(draft.targetAmountUsd),
        }),
      });
      const data = await res.json();
      if (draftRef.current !== draft) return;
      if (!res.ok) {
        setError(data.error ?? 'Could not compute report');
        setReport(null);
        return;
      }
      const fxReport = data as FxCycleReportResponse;
      setReport(fxReport);
      setEditing(false);
      setReportSaved(false);
      setMonitoringEnabled(false);
      setSavedReading(false);
      trackFunnelEvent('cycle_report_run', {
        currency: draft.localCurrency,
      });

    } catch (e) {
      if (draftRef.current === draft) setError(e instanceof Error ? e.message : 'Network error — try again');
    } finally {
      setLoading(false);
    }
  };

  const saveReport = async () => {
    if (!address || !report || saving) return;
    setSaving(true);
    setError(null);
    try {
      const cycleInput = {
        localCurrency: report.input.localCurrency,
        targetCurrency,
        paymentDate: report.input.paymentDate,
        targetAmountUsd: report.input.targetAmount,
        lastReport: snapshotFromFxReport(report),
        monitoringEnabled: false,
      };
      const saved = savedCycleId
        ? await updateCycle(savedCycleId, cycleInput)
        : await saveCycle(cycleInput);
      if (addressRef.current !== address || reportRef.current !== report) return;
      if (!saved?.id) throw new Error('Could not save payment');
      setSavedCycleId(saved?.id ?? null);
      setReportSaved(true);
      setMonitoringEnabled(false);
      haptics.confirm();
    } catch (e) {
      if (addressRef.current === address && reportRef.current === report) setError(e instanceof Error ? e.message : 'Could not save payment');
    } finally {
      setSaving(false);
    }
  };

  const toggleMonitoring = async (enabled: boolean) => {
    if (!address || !savedCycleId || !reportSaved || cycleConsentSaving) return;
    setCycleConsentSaving(true);
    setError(null);
    try {
      const saved = await updateCycle(savedCycleId, { monitoringEnabled: enabled });
      if (addressRef.current !== address || reportRef.current !== report) return;
      if (!saved?.id) throw new Error('Could not update monitoring');
      setMonitoringEnabled(enabled);
      haptics.tap();
      if (enabled) {
        trackFunnelEvent('cycle_monitoring_enabled', {
          currency: draft.localCurrency,
        });
      }
    } catch (e) {
      if (addressRef.current === address && reportRef.current === report) setError(e instanceof Error ? e.message : 'Could not update monitoring');
    } finally {
      setCycleConsentSaving(false);
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
    const code = report.input.localCurrency.toUpperCase();
    const risk = CURRENCY_BY_CODE[code];
    const dragInput = {
      business: 'Payment readiness scenario',
      currency: code,
      cycles: [],
    };
    const stamp = report.input.paymentDate || 'report';
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
        localCurrency: report.input.localCurrency,
        targetCurrency,
        paymentDate: report.input.paymentDate,
        daysUntilPayment: daysUntil ?? 0,
        targetAmountUsd: report.input.targetAmount,
        cycleId: reportSaved ? savedCycleId ?? undefined : undefined,
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

  const visibleCycles = address ? cycles.filter((cycle) => cycle.userAddress?.toLowerCase() === address.toLowerCase()) : [];
  const upcomingCycles = visibleCycles.filter((c) => c.status === 'active');
  const dueCycles = visibleCycles.filter((c) => c.status === 'payment_due');
  const completedCycles = visibleCycles.filter((c) => c.status === 'completed');
  const comparison = report ? paymentScenarioComparison(report.summary) : null;
  const approvalBoundary = cycleAutoExecutionEnabled
    ? 'Existing cycle execution consent is on. Signed wallet permissions still apply.'
    : 'Review proposals in Exchange. Execution depends on separate, signed wallet permissions.';
  const explainReport = () => {
    if (!report) return;
    onAskGuardian?.(
      `${sample ? 'This is sample mode. ' : ''}Review the ${savedReading ? 'saved' : 'modeled'} ${report.input.localCurrency} → USD supplier payment of ${report.input.targetAmount} due ${report.input.paymentDate}${reportSaved && savedCycleId ? ` (saved cycle ${savedCycleId})` : ''}. Explain the scenario assumptions and any current proposals separately. Do not treat modeled costs as a quote or permission to trade.`,
    );
  };
  const openSavedPayment = (cycle: PurchaseCycleRecord) => {
    const snapshot = cycle.lastReport;
    updateDraft({ localCurrency: cycle.localCurrency, paymentDate: cycle.paymentDate, targetAmountUsd: String(cycle.targetAmountUsd) });
    setSavedCycleId(cycle.id);
    setError(null);
    setView('main');
    setEditing(false);
    setMonitoringEnabled(cycle.monitoringEnabled);
    setSavedReading(true);
    if (!snapshot?.summary) {
      setReport(null);
      setReportSaved(false);
      return;
    }
    setReport({
      ok: true,
      summary: snapshot.summary,
      input: { localCurrency: cycle.localCurrency, targetCurrency: cycle.targetCurrency, paymentDate: cycle.paymentDate, targetAmount: cycle.targetAmountUsd },
      narrative: {
        headline: snapshot.narrativeHeadline, dragLine: snapshot.dragLine,
        protectionCostLine: snapshot.protectionCostLine, netBenefitDisclaimer: snapshot.disclaimer,
        exposureDays: snapshot.exposureDays,
      },
      provenance: {
        sourceType: 'cached', asOf: snapshot.provenance?.timestamp ?? snapshot.computedAt,
        rateSourceNote: `Saved scenario · calculated ${snapshot.computedAt.slice(0, 10)}. Not a fresh rate check.`,
        isHistorical: snapshot.provenance?.isHistorical ?? true,
        disclaimer: snapshot.provenance?.disclaimer ?? 'Historical scenario, not a forecast or quote.',
      },
    });
    setReportSaved(true);
  };

  const showCyclesEntry =
    mode === 'next' &&
    view === 'main' &&
    Boolean(address) &&
    (needsUnlock || visibleCycles.length > 0 || cyclesError);
  const cyclesEntryLabel = cyclesError
    ? 'Saved payments unavailable →'
    : needsUnlock
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
      <CycleModeControl mode={mode} onChange={setMode} />

      {mode === 'next' && view === 'main' && cyclesEntry}

      {mode === 'last' ? (
        <LastCycleDrag
          currency={draft.localCurrency}
          onCurrencyChange={(c) => editDraft({ localCurrency: c })}
          onTrackNext={({ currency, paymentUsd }) => {
            editDraft({
              localCurrency: currency,
              targetAmountUsd: String(Math.round(paymentUsd)),
            });
            setSavedCycleId(null);
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
              onAskWhy={explainReport}
            />
          )}
          <div className="space-y-2 text-sm text-ink-muted">
            <p className="font-semibold text-ink">What this comparison assumes</p>
            <p>{report.narrative.dragLine}</p>
            {savedReading ? <p>{report.narrative.protectionCostLine}</p> : (
              <dl className="space-y-1">
                <div className="flex justify-between gap-3"><dt>Early-conversion ramp cost</dt><dd>{DEFAULT_OPTIONS.rampCostBps / 100}% assumed</dd></div>
                <div className="flex justify-between gap-3"><dt>Bank spread if waiting</dt><dd>{(report.input.bankSpreadBps ?? DEFAULT_PAYMENT_BANK_SPREAD_BPS) / 100}% assumed</dd></div>
                <div className="flex justify-between gap-3"><dt>Wire fees</dt><dd>None entered</dd></div>
              </dl>
            )}
            <p>{report.provenance.disclaimer}</p>
          </div>
          {savedCycleId && reportSaved && address && monitoringEnabled && (
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
          {cyclesError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{cyclesError}</p>}
          {!needsUnlock && !cyclesLoading && !cyclesError && visibleCycles.length === 0 && (
            <p className="text-sm text-ink-muted">No saved payments yet. Model one first, then choose whether to save it.</p>
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
                    {c.localCurrency} → {c.targetCurrency} {formatMoney(c.targetAmountUsd)} · {c.paymentDate}
                    {c.monitoringEnabled ? ' · Monitoring on' : ''}
                    <button
                      type="button"
                      onClick={() => openSavedPayment(c)}
                      className="min-h-tap ml-2 font-semibold text-action"
                      aria-label={`Review saved ${c.localCurrency} payment due ${c.paymentDate}`}
                    >
                      Review →
                    </button>
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
      <div className="space-y-1">
        <h3 className="text-lg font-bold text-ink">Plan a supplier payment</h3>
        <p className="text-sm text-ink-muted">Your currency, invoice amount, and due date.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="col-span-1 space-y-1">
          <span className="text-xs font-semibold text-ink-muted">Your currency</span>
          <input
            value={draft.localCurrency}
            onChange={(e) => editDraft({ localCurrency: e.target.value.toUpperCase().slice(0, 3) })}
            placeholder="GHS"
            className="w-full min-h-tap rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          />
        </label>
        <label className="col-span-1 space-y-1">
          <span className="text-xs font-semibold text-ink-muted">Amount (USD)</span>
          <input
            inputMode="decimal"
            value={draft.targetAmountUsd}
            onChange={(e) => editDraft({ targetAmountUsd: e.target.value })}
            placeholder="10000"
            aria-describedby="payment-target-note"
            className="w-full min-h-tap rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          />
        </label>
        <label className="col-span-2 space-y-1">
          <span className="text-xs font-semibold text-ink-muted">Payment date</span>
          <input
            type="date"
            value={draft.paymentDate}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => editDraft({ paymentDate: e.target.value })}
            className="w-full min-h-tap rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
          />
        </label>
      </div>
      <p id="payment-target-note" className="text-xs text-ink-muted leading-relaxed">
        USD payments only. Compare modeled costs, not a forecast or a live quote.
      </p>

      <button
        type="button"
        onClick={runReport}
        disabled={!canSubmit || loading}
        className="w-full min-h-tap py-2.5 rounded-xl bg-action hover:bg-action-hover disabled:opacity-50 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2"
      >
        {loading ? <InlineSpinner /> : null}
        {loading ? 'Comparing…' : 'Compare payment options'}
      </button>
      </>
      ) : report ? (
      <>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {report.input.localCurrency.toUpperCase()} → {targetCurrency}{' '}
          {formatMoney(report.input.targetAmount)} · {report.input.paymentDate} ·{' '}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            Edit
          </button>
        </p>

        {/* The result is the object — no card chrome. */}
        <div ref={reportHeadingRef} role="group" tabIndex={-1} className="space-y-3 focus:outline-none" aria-label="Payment cost comparison">
          {comparison ? <PaymentScenarioReading comparison={comparison} currency={report.input.localCurrency} /> : (
            <p className="text-sm font-semibold text-ink">{report.narrative.headline}</p>
          )}
          <p className="text-xs text-ink-muted text-center">
            {savedReading ? 'Saved scenario' : 'Historical scenario'} · {report.provenance.asOf.slice(0, 10)} · includes assumed costs, not a quote.
          </p>
          {savedReading && (
            <button type="button" disabled={!canSubmit || loading} onClick={runReport} className="min-h-tap text-sm font-semibold text-action disabled:opacity-50">
              {loading ? 'Refreshing…' : 'Refresh scenario'}
            </button>
          )}
        </div>

        {/* One CTA, chosen by state. */}
        {!sample && !address && (
          <WalletButton variant="primary" className="w-full" connectLabel="Connect to save this payment" />
        )}
        {address && !reportSaved && (
          <div className="space-y-1">
          <button
            type="button"
            onClick={saveReport}
            disabled={saving}
            className="min-h-tap w-full rounded-xl bg-action hover:bg-action-hover text-white text-sm font-bold disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save this payment'}
          </button>
          {savedCycleId && <p className="text-xs text-ink-muted">Saving updates this payment and turns monitoring off.</p>}
          </div>
        )}
        {address && reportSaved && savedCycleId && !monitoringEnabled && (
          <div className="space-y-1">
            <motion.p
              initial={reducedMotion || savedReading ? false : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={reducedMotion ? { duration: 0 } : springPop}
              role="status"
              className="text-sm font-semibold text-ink"
            >
              Payment saved · monitoring off
            </motion.p>
            <button
              type="button"
              onClick={() => toggleMonitoring(true)}
              disabled={cycleConsentSaving}
              className="min-h-tap w-full py-2.5 rounded-xl bg-action hover:bg-action-hover disabled:opacity-50 text-white text-sm font-bold transition-colors"
            >
              {cycleConsentSaving ? 'Enabling monitoring…' : 'Let Guardian watch this payment'}
            </button>
            <p className="text-2xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Monitoring never grants trade permission. {approvalBoundary}
            </p>
          </div>
        )}
        {address && reportSaved && savedCycleId && monitoringEnabled && (
          <div className="space-y-2">
          <motion.p initial={false} animate={{ opacity: 1 }} transition={reducedMotion ? { duration: 0 } : reveal} className="text-sm font-semibold text-ink" role="status">
            Monitoring on ·{' '}
            <button
              type="button"
              onClick={() => toggleMonitoring(false)}
              disabled={cycleConsentSaving}
              className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Stop
            </button>
          </motion.p>
          <p className="text-xs text-ink-muted">{approvalBoundary}</p>
          {onAskGuardian && (
            <button type="button" onClick={explainReport} className="min-h-tap w-full rounded-xl bg-action text-white text-sm font-bold">
              Review with Guardian
            </button>
          )}
          </div>
        )}

        <div className="flex items-center gap-4 pt-1">
          <button
            type="button"
            onClick={() => setView('options')}
            className="text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            Details &amp; export →
          </button>
          {onAskGuardian && !monitoringEnabled && <button
            type="button"
            onClick={explainReport}
            className="text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            Ask Guardian why
          </button>}
        </div>
      </>
      ) : null}

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      {!sample && !address && report && !showForm && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Connect to save this payment. Monitoring requires a separate choice.
        </p>
      )}

      </>
      )}
    </div>
  );
}

export default PaymentCycleReport;
