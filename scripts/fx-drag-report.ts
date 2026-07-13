/**
 * FX Drag Report — concierge analysis for import working-capital cycles.
 *
 * Rendering delegates to @diversifi/shared; this script handles CLI I/O only.
 */

import * as fs from 'fs';
import {
  analyzeCycles,
  requiredDates,
  DEFAULT_OPTIONS,
  type DragInput,
} from './fx-drag/calc';
import { buildRateProvider } from './fx-drag/rates';
import { CURRENCY_BY_CODE } from '../constants/currency-risk';
import {
  renderFxDragReportMarkdown,
  type CurrencyRiskContext,
} from '@diversifi/shared/src/services/fx-drag/fx-drag-report-renderer';

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

function riskContext(code: string): CurrencyRiskContext | null {
  const risk = CURRENCY_BY_CODE[code];
  if (!risk) return null;
  return {
    code: risk.code,
    flag: risk.flag,
    depreciationVsUsd: risk.depreciation.vsUSD,
    riskEvents: risk.riskEvents,
  };
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
  const report = renderFxDragReportMarkdown(input, summary, {
    rampBps,
    sourceNote,
    risk: riskContext(input.currency.toUpperCase()),
  });

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
