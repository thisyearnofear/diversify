#!/usr/bin/env node
/**
 * Curated-data freshness check — invoked by .github/workflows/health-check.yml.
 *
 * Three staleness alarms over the hand-curated datasets:
 *   (a) apps/web/constants/currency-risk.ts vsUSD '1yr' vs the live feed
 *       (the same /api/currency-risk/live endpoint the app merges) —
 *       flag when the sign flips or |live − curated| > 3pp;
 *   (b) currency risk-event trails whose effective checked date (newest
 *       event asOf, else CURRENCY_RISK_DATA_AS_OF — the same fallback
 *       riskTrailCheckedAt uses) is older than 90 days;
 *   (c) packages/shared/src/constants/token-provenance.ts entries whose
 *       asOf is older than 90 days (each entry's own re-verify rule).
 *
 * Emits a `dataFreshness` section on stdout — flags prefixed `flag:`,
 * warnings `warn:` — for the `data-review` issue body. Exit 0 = fresh,
 * 1 = flags exist. Feed outages are warnings, not flags: a fetch that
 * can't answer says nothing about the curated data.
 *
 *   node scripts/check-data-freshness.mjs
 *   PROD_URL overrides the live endpoint base (tests/local).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROD_URL = (process.env.PROD_URL || 'https://diversifi.persidian.com').replace(/\/+$/, '');

export const STALE_AFTER_DAYS = 90;
export const DRIFT_FLAG_PP = 3;
const FETCH_TIMEOUT_MS = 30_000;

/** Pull each curated currency's code, 1yr vs-USD figure, and effective
 *  trail checked date out of the dataset source. Entries are separated
 *  by `  {\n    code: 'XXX'` boundaries; `asOf: 'YYYY-MM-DD'` literals
 *  inside an entry belong to its riskEvents. */
export function parseCurrencyRisk(src) {
  const datasetAsOf =
    src.match(/CURRENCY_RISK_DATA_AS_OF\s*=\s*'([0-9]{4}-[0-9]{2}-[0-9]{2})'/)?.[1] ?? null;
  const chunks = src.split(/\n\s*\{\s*\n\s*code:\s*'/);
  const entries = [];
  for (const chunk of chunks.slice(1)) {
    const code = chunk.match(/^([A-Z]+)/)?.[1];
    const usd1yr = Number(chunk.match(/vsUSD:\s*\{\s*'1yr':\s*(-?[\d.]+)/)?.[1]);
    const asOfs = [...chunk.matchAll(/asOf:\s*'([0-9]{4}-[0-9]{2}-[0-9]{2})'/g)].map((m) => m[1]);
    const checkedAt = asOfs.reduce((latest, d) => (d > latest ? d : latest), datasetAsOf ?? '');
    if (code) entries.push({ code, usd1yr, checkedAt });
  }
  return { datasetAsOf, entries };
}

/** Pull (symbol, asOf) pairs out of the curated provenance source. */
export function parseProvenance(src) {
  const out = [];
  const re = /symbol:\s*'([^']+)'[\s\S]*?asOf:\s*'([0-9]{4}-[0-9]{2}-[0-9]{2})'/g;
  let m;
  while ((m = re.exec(src))) out.push({ symbol: m[1], asOf: m[2] });
  return out;
}

/** Pure evaluator — exported for tests. */
export function evaluateFreshness({ currencies, trails, provenance, nowMs }) {
  const flags = [];
  const warnings = [];

  for (const c of currencies ?? []) {
    if (!Number.isFinite(c.curated1yr)) {
      warnings.push(`warn: ${c.code} — curated 1yr figure unreadable`);
      continue;
    }
    if (c.live1yr == null) {
      warnings.push(`warn: ${c.code} — live 1yr unavailable (feed miss)`);
      continue;
    }
    const diff = c.live1yr - c.curated1yr;
    // A sub-1pp wobble across zero is rounding noise, not a direction
    // flip — a real flip means the curated story points the wrong way.
    const flipped = Math.sign(c.live1yr) !== Math.sign(c.curated1yr) && Math.abs(diff) > 1;
    if (flipped || Math.abs(diff) > DRIFT_FLAG_PP) {
      flags.push(
        `${c.code} vsUSD 1yr: curated ${c.curated1yr}% vs live ${c.live1yr}%` +
          (flipped ? ' — sign flipped' : ` — ${Math.abs(Math.round(diff))}pp drift`),
      );
    }
  }

  const cutoff = nowMs - STALE_AFTER_DAYS * 86_400_000;
  for (const t of trails ?? []) {
    if (Date.parse(`${t.checkedAt}T00:00:00Z`) < cutoff) {
      flags.push(`${t.code} risk trail last checked ${t.checkedAt} — stale (> ${STALE_AFTER_DAYS}d)`);
    }
  }
  for (const p of provenance ?? []) {
    if (Date.parse(`${p.asOf}T00:00:00Z`) < cutoff) {
      flags.push(`${p.symbol} provenance last checked ${p.asOf} — stale (> ${STALE_AFTER_DAYS}d)`);
    }
  }

  return { flags, warnings };
}

async function fetchLive1yr(code) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(`${PROD_URL}/api/currency-risk/live?currency=${code}`, {
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const v = data?.depreciation?.['1yr'];
    return typeof v === 'number' ? v : null;
  } catch {
    return null;
  }
}

async function main() {
  const riskSrc = readFileSync(path.join(ROOT, 'apps/web/constants/currency-risk.ts'), 'utf8');
  const provSrc = readFileSync(
    path.join(ROOT, 'packages/shared/src/constants/token-provenance.ts'),
    'utf8',
  );

  const { entries } = parseCurrencyRisk(riskSrc);
  const provenance = parseProvenance(provSrc);
  const live = await Promise.all(entries.map((e) => fetchLive1yr(e.code)));

  const { flags, warnings } = evaluateFreshness({
    currencies: entries.map((e, i) => ({
      code: e.code,
      curated1yr: e.usd1yr,
      live1yr: live[i],
    })),
    trails: entries.map((e) => ({ code: e.code, checkedAt: e.checkedAt })),
    provenance,
    nowMs: Date.now(),
  });

  console.log('dataFreshness');
  for (const w of warnings) console.log(`  ${w}`);
  for (const f of flags) console.log(`  flag: ${f}`);
  console.log(`dataFreshness: ${flags.length} flag(s), ${warnings.length} warning(s)`);
  if (flags.length) process.exit(1);
}

if (process.argv[1] && process.argv[1].endsWith('check-data-freshness.mjs')) {
  main();
}
