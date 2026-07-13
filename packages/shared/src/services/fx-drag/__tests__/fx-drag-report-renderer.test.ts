import { describe, expect, it } from 'vitest';
import {
  renderFxDragReportCsv,
  renderFxDragReportMarkdown,
} from '../fx-drag-report-renderer';
import type { DragInput, DragSummary } from '../calc';

const sampleInput: DragInput = {
  business: 'Test importer',
  currency: 'GHS',
  cycles: [
    {
      label: 'Cycle A',
      revenues: [{ date: '2025-10-01', amountLocal: 100_000 }],
      payment: { date: '2026-01-01', amountUsd: 5000, achievedRate: 15.2 },
    },
  ],
};

const sampleSummary: DragSummary = {
  cycles: [
    {
      label: 'Cycle A',
      windowStart: '2025-10-01',
      windowEnd: '2026-01-01',
      exposureDays: 92,
      weightedExposureDays: 92,
      windowDepreciationPct: 4.2,
      midAtPayment: 15,
      counterfactualRate: 14.8,
      actualLocalCost: 76_000,
      counterfactualLocalCost: 74_000,
      coveredUsd: 5000,
      uncoveredUsd: 0,
      dragLocal: 2000,
      dragPct: 2.63,
      decomposition: { timingLocal: 1500, spreadLocal: 400, feesLocal: 100 },
      warnings: [],
    },
  ],
  totalUsdPaid: 5000,
  totalActualLocal: 76_000,
  totalDragLocal: 2000,
  totalDragPct: 2.63,
  totalTimingLocal: 1500,
  totalSpreadLocal: 400,
  totalFeesLocal: 100,
};

describe('fx-drag-report-renderer', () => {
  it('renders markdown with honesty notes', () => {
    const md = renderFxDragReportMarkdown(sampleInput, sampleSummary, {
      sourceNote: 'Test rates',
    });
    expect(md).toContain('# FX Drag Report');
    expect(md).toContain('Net benefit is not guaranteed');
    expect(md).toContain('GHS 2,000');
  });

  it('renders CSV with header and totals row', () => {
    const csv = renderFxDragReportCsv(sampleInput, sampleSummary);
    expect(csv).toContain('cycle,window_start');
    expect(csv).toContain('TOTAL');
    expect(csv).toContain('2000.00');
  });
});
