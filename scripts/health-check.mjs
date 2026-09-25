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

/** Pure evaluator — exported for tests. */
export function evaluateHealth({ status, agentStatus, routesOk, routesOutput }) {
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

  const [status, agentStatus] = await Promise.all([fetchJson(STATUS_URL), fetchJson(AGENT_STATUS_URL)]);
  const routesOutput = routesOutputPath ? readFileSync(routesOutputPath, 'utf8') : '';

  const { problems, warnings } = evaluateHealth({ status, agentStatus, routesOk, routesOutput });

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
