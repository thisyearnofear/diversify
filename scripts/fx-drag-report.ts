/**
 * FX Drag Report — concierge analysis for import working-capital cycles.
 *
 * Takes a trader's real purchase-cycle records (local-currency revenue
 * receipts + USD supplier payments) and quantifies what currency movement,
 * bank spread, and fees cost them versus converting proceeds to USD-pegged
 * value as they arrived. This is the Phase 0 validation instrument from
 * docs/sme-fx-strategy.md — a measurement, not advice.
 *
 * Usage:
 *   npx tsx scripts/fx-drag-report.ts <cycles.json> [--ramp-bps 50] [--out report.md]
 *
 * Input format: see scripts/fx-drag/sample-cycles.kenya-textbooks.json
 *   { "business": "...", "currency": "KES", "cycles": [
 *       { "label": "...", "revenues": [{ "date": "2025-10-10", "amountLocal": 2400000 }],
 *         "payment": { "date": "2026-01-07", "amountUsd": 65000,
 *                      "achievedRate": 132.5, "feesLocal": 50000 } } ] }
 *
 * Historical mid-market rates are fetched once and cached (offline re-runs).
 * Dataset coverage starts 2024-03-02; earlier dates can be added to the
 * cache file manually from central bank records.
 */

import * as fs from 'fs';
import {
  analyzeCycles,
  requiredDates,
  DEFAULT_OPTIONS,
  type CycleResult,
  type DragInput,
  type DragSummary,
} from './fx-drag/calc';
import { buildRateProvider } from './fx-drag/rates';
import { CURRENCY_BY_CODE } from '../constants/currency-risk';

function parseArgs(argv: string[]): { inputPath: string; rampBps: number; outPath: string | null } {
  const positional = argv.filter((a) => !a.startsWith('--'));
  const inputPath = positional[0];
  if (!inputPath) {
    console.error('Usage: npx tsx scripts/fx-drag-report.ts <cycles.json> [--ramp-bps 50] [--out report.md]');
    process.exit(1);
  }
  const flagValue = (name: string): string | null => {
    const i = argv.indexOf(name);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
  };
  return {
    inputPath,
    rampBps: Number(flagValue('--ramp-bps') ?? DEFAULT_OPTIONS.rampCostBps),
    outPath: flagValue('--out'),
  };
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

function renderReport(input: DragInput, summary: DragSummary, rampBps: number, sourceNote: string): string {
  const currency = input.currency.toUpperCase();
  const risk = CURRENCY_BY_CODE[currency];
  const first = summary.cycles[0];
  const last = summary.cycles[summary.cycles.length - 1];

  const header = [
    `# FX Drag Report${input.business ? ` — ${input.business}` : ''}`,
    '',
    `**Currency:** ${currency} · **Cycles analyzed:** ${summary.cycles.length} · **Period:** ${first.windowStart} → ${last.windowEnd}`,
    '',
    `## What this cost the business`,
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

  const context = risk
    ? [
        '',
        `## Context: ${risk.flag} ${currency} track record`,
        '',
        `Over the last 1/3/5 years the ${currency} moved ${risk.depreciation.vsUSD['1yr']}% / ${risk.depreciation.vsUSD['3yr']}% / ${risk.depreciation.vsUSD['5yr']}% vs USD.`,
        '',
        ...risk.riskEvents.map((e) => `- **${e.year} — ${e.event}:** ${e.impact}`),
      ].join('\n')
    : '';

  const cycles = ['', '## Cycle by cycle', '', summary.cycles.map((c) => renderCycle(currency, c)).join('\n\n')].join('\n');

  const notes = [
    '',
    '## How to read this (honesty notes)',
    '',
    `- This is a **measurement, not advice**. Some cycles can show negative drag — protection is not free money.`,
    `- The counterfactual assumes converting each revenue receipt to USD-pegged value on arrival, with a ${rampBps} bps round-trip ramp cost so protection is never modeled as free. Re-run with \`--ramp-bps\` to stress the assumption.`,
    `- Bank spread is measured against indicative mid-market rates on the payment day; the achieved rates come from the business's own records.`,
    `- ${sourceNote}`,
  ].join('\n');

  return [header, context, cycles, notes, ''].join('\n');
}

async function main(): Promise<void> {
  const { inputPath, rampBps, outPath } = parseArgs(process.argv.slice(2));
  const input = JSON.parse(fs.readFileSync(inputPath, 'utf8')) as DragInput;
  if (!input.currency || !Array.isArray(input.cycles) || input.cycles.length === 0) {
    throw new Error('Input must include "currency" and a non-empty "cycles" array');
  }

  const dates = requiredDates(input);
  console.error(`Fetching ${input.currency.toUpperCase()}/USD mid rates for ${dates.length} dates (cached after first run)…`);
  const { getRate, sourceNote } = await buildRateProvider(input.currency, dates);

  const summary = analyzeCycles(input, getRate, { rampCostBps: rampBps });
  const report = renderReport(input, summary, rampBps, sourceNote);

  if (outPath) {
    fs.writeFileSync(outPath, report);
    console.error(`Report written to ${outPath}`);
  } else {
    console.log(report);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
