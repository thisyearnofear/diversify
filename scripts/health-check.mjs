#!/usr/bin/env node
/**
 * Daily health check — invoked by .github/workflows/health-check.yml.
 *
 * Reads two public endpoints:
 *   /api/status        → ledgerGas runway per chain
 *   /api/agent/status  → guardian { loop, heartbeat } run health
 * plus the captured output of `pnpm check-swap-routes`.
 *
 * Emits a problem list (one line each) for the `health-alert` issue body on
 * stdout, warnings prefixed with "warn:". Exit 0 = healthy, 1 = problems.
 *
 *   node scripts/health-check.mjs --routes-output /tmp/routes.txt [--routes-ok 0|1]
 *   STATUS_URL / AGENT_STATUS_URL override the endpoints (tests/local).
 */

const STATUS_URL = process.env.STATUS_URL || 'https://api.diversifi.famile.xyz/api/status';
const AGENT_STATUS_URL = process.env.AGENT_STATUS_URL || 'https://api.diversifi.famile.xyz/api/agent/status';
const MACRO_FEED_URL = process.env.MACRO_FEED_URL || 'https://api.diversifi.famile.xyz/api/agent/zero-g-ledger?limit=10';

/**
 * Pure evaluator — exported for tests. `macroFeed` is optional: undefined
 * skips the macro silence check, null means the feed was unreachable.
 * @param {{ status: any, agentStatus: any, routesOk: any, routesOutput: any, macroFeed?: any }} input
 */
export function evaluateHealth({ status, agentStatus, routesOk, routesOutput, macroFeed }) {
  const problems = [];
  const warnings = [];

  if (status == null) problems.push('/api/status unreachable or non-2xx');
  if (agentStatus == null) problems.push('/api/agent/status unreachable or non-2xx');

  for (const entry of status?.ledgerGas ?? []) {
    const label = `ledgerGas chain ${entry.chainId} (${entry.status}: balance ${entry.balance}, ~${entry.runwayDays ?? '?'}d runway)`;
    if (entry.status === 'low' || entry.status === 'blocked') problems.push(label);
    else if (entry.status === 'unknown') warnings.push(`warn: ${label}`);
  }

  for (const kind of ['loop', 'heartbeat']) {
    const run = agentStatus?.guardian?.[kind];
    if (!run) { warnings.push(`warn: guardian.${kind} absent from /api/agent/status`); continue; }
    if (run.status === 'failed' || run.status === 'degraded') {
      problems.push(`guardian ${kind} last run ${run.status}${run.error ? `: ${run.error}` : ''}`);
    }
    if (run.freshness === 'stale' || run.freshness === 'never') {
      problems.push(`guardian ${kind} is ${run.freshness} (lastRunAt: ${run.lastRunAt ?? 'none'})`);
    }
  }

  // Macro-signal silence alarm. Anchor count CANNOT distinguish "monitors
  // quiet" from "path dead" — most sources change a few times a year and the
  // NHC monitor needs an actual storm — so receipts, not feed rows, carry
  // the evidence. Failures are problems; ambiguous silence is warn-only.
  const macro = agentStatus?.macroSignal;
  if (agentStatus && macro === undefined) {
    warnings.push('warn: agentStatus.macroSignal absent — runtime predates the receipt block');
  }
  if (macro) {
    if (macro.configured === false) {
      problems.push('FIRECRAWL_WEBHOOK_SECRET missing on the API — webhook rejects or skips auth by design');
    }
    if (!macro.receivedCount) {
      warnings.push('warn: macro webhook has received zero monitor events — path unproven organically');
    } else {
      if (typeof macro.lastReceivedAgeDays === 'number' && macro.lastReceivedAgeDays > 30) {
        warnings.push(`warn: last macro monitor event ${Math.floor(macro.lastReceivedAgeDays)}d ago (sources change rarely — warn-only, not proven dead)`);
      }
      if (macro.lastOutcome === 'error') {
        problems.push(`last macro webhook call errored (at ${macro.lastReceivedAt ?? 'unknown time'})`);
      }
      if (macro.lastAnchorStatus === 'failed') {
        problems.push('last macro signal on-chain anchor failed');
      }
    }
  }
  if (macroFeed === null) {
    problems.push('zero-g-ledger feed unreachable or non-2xx (verification + corridor beats read it)');
  } else if (macroFeed !== undefined) {
    // Rehearsal rows are test anchors, not monitor evidence — a feed full of
    // them still counts as silent.
    const macroRows = (macroFeed.recent ?? []).filter((r) => {
      const action = String(r.action || '');
      return action.startsWith('MACRO_SIGNAL') && action !== 'MACRO_SIGNAL:REHEARSAL';
    });
    if (macroRows.length === 0) {
      const observations = (macroFeed.recent ?? []).some((r) => r.action === 'MACRO_OBSERVATION');
      warnings.push(observations
        ? 'warn: observations recorded; no verified MACRO_SIGNAL rows (observation-only policy)'
        : 'warn: feed holds no MACRO_SIGNAL rows — no verified market signals; inspect webhook receipts for ingestion health');
    }
  }

  // MARKET-CLOSED lines are informational — Mento FX markets legitimately
  // close on weekends/holidays. They ride along in the issue body only when
  // the run failed for another reason; alone they never fail the check.
  for (const line of (routesOutput ?? '').split('\n')) {
    if (line.startsWith('MARKET-CLOSED')) warnings.push(`warn: ${line.trim()}`);
  }

  if (!routesOk) {
    problems.push(`check-swap-routes failed — tail:\n${(routesOutput ?? '').trim().split('\n').slice(-15).join('\n')}`);
  }

  return { problems, warnings };
}

async function main() {
  const args = process.argv.slice(2);
  const routesOutputPath = args.includes('--routes-output') ? args[args.indexOf('--routes-output') + 1] : null;
  const routesOk = args.includes('--routes-ok') ? args[args.indexOf('--routes-ok') + 1] === '1' : true;

  const { readFileSync } = await import('node:fs');
  const fetchJson = async (url) => {
    try {
      const res = await fetch(url);
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  };

  const [status, agentStatus, macroFeed] = await Promise.all([
    fetchJson(STATUS_URL),
    fetchJson(AGENT_STATUS_URL),
    fetchJson(MACRO_FEED_URL),
  ]);
  const routesOutput = routesOutputPath ? readFileSync(routesOutputPath, 'utf8') : '';

  const { problems, warnings } = evaluateHealth({ status, agentStatus, routesOk, routesOutput, macroFeed });

  for (const w of warnings) console.log(w);

  if (problems.length) {
    console.log(problems.join('\n'));
    process.exit(1);
  }
  console.log('healthy');
}

if (process.argv[1] && process.argv[1].endsWith('health-check.mjs')) {
  main();
}
