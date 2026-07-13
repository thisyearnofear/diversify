import type { IPurchaseCycle } from '@/models/PurchaseCycle';
import type { PurchaseCycleRecord, CycleReportSnapshot } from '@diversifi/shared/src/types/purchase-cycle';
import type { FxCycleReportResponse } from '@/pages/api/agent/fx-cycle-report';

export function snapshotFromFxReport(report: FxCycleReportResponse): CycleReportSnapshot {
  const cycle = report.summary.cycles[0];
  return {
    computedAt: new Date().toISOString(),
    totalDragLocal: report.summary.totalDragLocal,
    totalDragPct: report.summary.totalDragPct,
    exposureDays: report.narrative.exposureDays,
    narrativeHeadline: report.narrative.headline,
    dragLine: report.narrative.dragLine,
    protectionCostLine: report.narrative.protectionCostLine,
    disclaimer: report.narrative.netBenefitDisclaimer,
    provenance: {
      sourceType: report.provenance.sourceType,
      timestamp: report.provenance.asOf,
      benchmark: report.input.targetCurrency,
      period: `Recent historical stress applied through ${report.input.paymentDate}`,
      isHistorical: report.provenance.isHistorical,
      disclaimer: report.provenance.disclaimer,
    },
    summary: report.summary,
  };
}

export function serializePurchaseCycle(doc: IPurchaseCycle): PurchaseCycleRecord {
  const toSnapshot = (s?: IPurchaseCycle['lastReport']): CycleReportSnapshot | undefined => {
    if (!s) return undefined;
    return {
      computedAt: s.computedAt.toISOString(),
      totalDragLocal: s.totalDragLocal,
      totalDragPct: s.totalDragPct,
      exposureDays: s.exposureDays,
      narrativeHeadline: s.narrativeHeadline,
      dragLine: s.dragLine,
      protectionCostLine: s.protectionCostLine,
      disclaimer: s.disclaimer,
      provenance: s.provenance as CycleReportSnapshot['provenance'],
      summary: s.summary as CycleReportSnapshot['summary'],
    };
  };

  return {
    id: String(doc._id),
    userAddress: doc.userAddress,
    label: doc.label,
    localCurrency: doc.localCurrency,
    targetCurrency: doc.targetCurrency,
    paymentDate: doc.paymentDate.toISOString().slice(0, 10),
    targetAmountUsd: doc.targetAmountUsd,
    monitoringEnabled: doc.monitoringEnabled,
    status: doc.status,
    lastReport: toSnapshot(doc.lastReport),
    postEventReport: toSnapshot(doc.postEventReport),
    paymentOutcome: doc.paymentOutcome
      ? {
          confirmedAt: doc.paymentOutcome.confirmedAt.toISOString(),
          achievedLocalAmount: doc.paymentOutcome.achievedLocalAmount,
          achievedRate: doc.paymentOutcome.achievedRate,
          achievedFeesLocal: doc.paymentOutcome.achievedFeesLocal,
          notes: doc.paymentOutcome.notes,
        }
      : undefined,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
