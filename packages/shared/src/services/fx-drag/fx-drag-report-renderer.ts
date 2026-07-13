/**
 * FX drag report rendering — shared between CLI, in-app export, and API surfaces.
 */

import type { CycleResult, DragInput, DragSummary } from './calc';

export interface CurrencyRiskContext {
  code: string;
  flag?: string;
  depreciationVsUsd?: { '1yr': number; '3yr': number; '5yr': number };
  riskEvents?: Array<{ year: number; event: string; impact: string }>;
}

export interface RenderReportOptions {
  rampBps?: number;
  sourceNote?: string;
  risk?: CurrencyRiskContext | null;
}

const fmt = (n: number, digits = 0): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

function money(currency: string, n: number): string {
  const sign = n < 0 ? '−' : '';
  return `${sign}${currency} ${fmt(Math.abs(n))}`;
}

function renderCycle(currency: string, c: CycleResult): string {
  const lines = [
    `### ${c.label}`,
    '',
    `| | |`,
    `|---|---|`,
    `| Exposure window | ${c.windowStart} → ${c.windowEnd} (${c.exposureDays} days; ${fmt(c.weightedExposureDays)} value-weighted) |`,
    `| ${currency} move over window | ${c.windowDepreciationPct >= 0 ? '−' : '+'}${fmt(Math.abs(c.windowDepreciationPct), 2)}% vs USD |`,
    `| Paid | $${fmt(c.coveredUsd + c.uncoveredUsd)} at ${fmt(c.actualLocalCost / (c.coveredUsd + c.uncoveredUsd), 2)} all-in (mid-market that day: ${fmt(c.midAtPayment, 2)}) |`,
    `| Protected counterfactual | effective rate ${fmt(c.counterfactualRate, 2)} (converting proceeds on arrival, incl. ramp cost) |`,
    `| **FX drag this cycle** | **${money(currency, c.dragLocal)}** (${fmt(c.dragPct, 2)}% of the payment) |`,
    `| — timing (depreciation while exposed) | ${money(currency, c.decomposition.timingLocal)} |`,
    `| — bank spread vs mid-market | ${money(currency, c.decomposition.spreadLocal)} |`,
    `| — explicit fees | ${money(currency, c.decomposition.feesLocal)} |`,
  ];
  for (const w of c.warnings) lines.push('', `> ⚠️ ${w}`);
  return lines.join('\n');
}

export function renderFxDragReportMarkdown(
  input: DragInput,
  summary: DragSummary,
  options: RenderReportOptions = {},
): string {
  const rampBps = options.rampBps ?? 50;
  const sourceNote = options.sourceNote ?? 'Rates: indicative mid-market snapshots.';
  const currency = input.currency.toUpperCase();
  const risk = options.risk;
  const first = summary.cycles[0];
  const last = summary.cycles[summary.cycles.length - 1];

  const header = [
    `# FX Drag Report${input.business ? ` — ${input.business}` : ''}`,
    '',
    `**Currency:** ${currency} · **Cycles analyzed:** ${summary.cycles.length} · **Period:** ${first.windowStart} → ${last.windowEnd}`,
    '',
    `## What this cost`,
    '',
    `Across ${summary.cycles.length} supplier payments totaling **$${fmt(summary.totalUsdPaid)}**` +
      ` (${money(currency, summary.totalActualLocal)} all-in), the gap between what was paid and what the` +
      ` same dollars would have cost with proceeds converted to USD-pegged value on arrival:`,
    '',
    `| | |`,
    `|---|---|`,
    `| **Total FX drag** | **${money(currency, summary.totalDragLocal)}** (${fmt(summary.totalDragPct, 2)}% of payment volume) |`,
    `| Timing — ${currency} movement while proceeds sat exposed | ${money(currency, summary.totalTimingLocal)} |`,
    `| Bank spread vs mid-market on payment days | ${money(currency, summary.totalSpreadLocal)} |`,
    `| Explicit fees | ${money(currency, summary.totalFeesLocal)} |`,
  ].join('\n');

  const context = risk?.depreciationVsUsd
    ? [
        '',
        `## Context: ${risk.flag ?? ''} ${currency} track record`,
        '',
        `Over the last 1/3/5 years ${currency} moved ${risk.depreciationVsUsd['1yr']}% / ${risk.depreciationVsUsd['3yr']}% / ${risk.depreciationVsUsd['5yr']}% vs USD.`,
        '',
        ...(risk.riskEvents ?? []).map((e) => `- **${e.year} — ${e.event}:** ${e.impact}`),
      ].join('\n')
    : '';

  const cycles = ['', '## Cycle by cycle', '', summary.cycles.map((c) => renderCycle(currency, c)).join('\n\n')].join('\n');

  const notes = [
    '',
    '## How to read this (honesty notes)',
    '',
    `- This is a **historical scenario, not advice**. Some cycles can show negative drag — protection is not free money.`,
    `- The counterfactual assumes converting each revenue receipt to USD-pegged value on arrival, with a ${rampBps} bps round-trip ramp cost.`,
    `- Bank spread is measured against indicative mid-market rates on the payment day.`,
    `- ${sourceNote}`,
    `- **Net benefit is not guaranteed.** Fees and spreads can erase the advantage.`,
  ].join('\n');

  return [header, context, cycles, notes, ''].join('\n');
}

export function renderFxDragReportCsv(
  input: DragInput,
  summary: DragSummary,
): string {
  const currency = input.currency.toUpperCase();
  const header = [
    'cycle',
    'window_start',
    'window_end',
    'exposure_days',
    'depreciation_pct',
    'usd_paid',
    'actual_local_cost',
    'drag_local',
    'drag_pct',
    'timing_local',
    'spread_local',
    'fees_local',
  ].join(',');

  const rows = summary.cycles.map((c) =>
    [
      csvEscape(c.label),
      c.windowStart,
      c.windowEnd,
      c.exposureDays,
      c.windowDepreciationPct.toFixed(2),
      (c.coveredUsd + c.uncoveredUsd).toFixed(2),
      c.actualLocalCost.toFixed(2),
      c.dragLocal.toFixed(2),
      c.dragPct.toFixed(2),
      c.decomposition.timingLocal.toFixed(2),
      c.decomposition.spreadLocal.toFixed(2),
      c.decomposition.feesLocal.toFixed(2),
    ].join(','),
  );

  const totals = [
    'TOTAL',
    '',
    '',
    '',
    '',
    summary.totalUsdPaid.toFixed(2),
    summary.totalActualLocal.toFixed(2),
    summary.totalDragLocal.toFixed(2),
    summary.totalDragPct.toFixed(2),
    summary.totalTimingLocal.toFixed(2),
    summary.totalSpreadLocal.toFixed(2),
    summary.totalFeesLocal.toFixed(2),
  ].join(',');

  return [`# currency: ${currency}`, header, ...rows, totals].join('\n');
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function downloadTextFile(filename: string, content: string, mime: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
