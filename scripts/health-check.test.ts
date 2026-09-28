/**
 * Pure-evaluator tests for scripts/health-check.mjs — the GitHub health-check
 * workflow stays thin; all flag logic lives in evaluateHealth.
 */

import { describe, it, expect } from 'vitest';
import { evaluateHealth } from './health-check.mjs';

const okStatus = {
  ledgerGas: [
    { chainId: 42220, balance: '0.1', estCostPerWrite: '0.09', runwayWrites: 100, runwayDays: 200, status: 'ok' },
    { chainId: 177, balance: '0.05', estCostPerWrite: '0.1', runwayWrites: 50, runwayDays: 350, status: 'ok' },
  ],
};
const okAgent = {
  guardian: {
    loop: { status: 'ok', lastRunAt: '2026-09-25T06:00Z', freshness: 'fresh' },
    heartbeat: { status: 'ok', lastRunAt: '2026-09-24T07:00Z', freshness: 'fresh' },
  },
};

describe('health-check evaluateHealth', () => {
  it('reports healthy when everything is ok', () => {
    const { problems } = evaluateHealth({ status: okStatus, agentStatus: okAgent, routesOk: true, routesOutput: '' });
    expect(problems).toEqual([]);
  });

  it('flags low and blocked ledgerGas, warns on unknown', () => {
    const status = {
      ledgerGas: [
        { chainId: 42220, balance: '0.001', runwayDays: 0, status: 'blocked' },
        { chainId: 42161, balance: '0.01', runwayDays: 5, status: 'low' },
        { chainId: 177, balance: '0.05', runwayDays: 350, status: 'unknown' },
      ],
    };
    const { problems, warnings } = evaluateHealth({ status, agentStatus: okAgent, routesOk: true, routesOutput: '' });
    expect(problems.join('\n')).toContain('chain 42220');
    expect(problems.join('\n')).toContain('chain 42161');
    expect(problems.some((p: string) => p.includes('chain 177'))).toBe(false);
    expect(warnings.join('\n')).toContain('chain 177');
  });

  it('flags degraded/failed/stale/never guardian runs', () => {
    const agentStatus = {
      guardian: {
        loop: { status: 'degraded', lastRunAt: 'x', freshness: 'fresh' },
        heartbeat: { status: 'ok', lastRunAt: null, freshness: 'never' },
      },
    };
    const { problems } = evaluateHealth({ status: okStatus, agentStatus, routesOk: true, routesOutput: '' });
    expect(problems.join('\n')).toContain('loop last run degraded');
    expect(problems.join('\n')).toContain('heartbeat is never');
  });

  it('includes the route-check tail when check-swap-routes failed', () => {
    const routesOutput = Array.from({ length: 40 }, (_, i) => `line ${i}`).join('\n');
    const { problems } = evaluateHealth({ status: okStatus, agentStatus: okAgent, routesOk: false, routesOutput });
    expect(problems.join('\n')).toContain('check-swap-routes failed');
    expect(problems.join('\n')).toContain('line 39');
    expect(problems.join('\n')).not.toContain('line 10'); // truncated to tail
  });

  it('MARKET-CLOSED route lines are warnings, never problems', () => {
    const routesOutput = [
      'OK               CELO -> USDm (10)      via Uniswap V3 -> 9.9 USDm',
      'MARKET-CLOSED    USDm -> KESm (10)     Mento FX market is closed — quotes resume when FX markets reopen.',
      'MARKET-CLOSED    CHFm -> USDm (10)     via LiFi -> 9.8 USDm',
    ].join('\n');
    const { problems, warnings } = evaluateHealth({
      status: okStatus, agentStatus: okAgent, routesOk: true, routesOutput,
    });
    expect(problems).toEqual([]);
    expect(warnings.filter((w: string) => w.includes('MARKET-CLOSED')).length).toBe(2);
  });

  it('warns (not fails) when a guardian run block is absent', () => {
    const { problems, warnings } = evaluateHealth({ status: okStatus, agentStatus: { guardian: {} }, routesOk: true, routesOutput: '' });
    expect(problems).toEqual([]);
    expect(warnings.filter((w: string) => w.includes('guardian.')).length).toBe(2);
  });

  const okMacro = {
    configured: true, receivedCount: 3, lastReceivedAgeDays: 2,
    lastOutcome: 'signal_propagated', lastAnchorStatus: 'pending',
  };
  const okFeed = { recent: [{ action: 'MACRO_SIGNAL:RATE_CUT', reasoning: 'x', timestamp: 1 }] };

  it('flags an unconfigured macro webhook, failed outcome and failed anchor as problems', () => {
    const agentStatus = { ...okAgent, macroSignal: { ...okMacro, configured: false, lastOutcome: 'error', lastAnchorStatus: 'failed' } };
    const { problems } = evaluateHealth({ status: okStatus, agentStatus, routesOk: true, routesOutput: '', macroFeed: okFeed });
    expect(problems.join('\n')).toContain('FIRECRAWL_WEBHOOK_SECRET');
    expect(problems.join('\n')).toContain('webhook call errored');
    expect(problems.join('\n')).toContain('anchor failed');
  });

  it('warns but never fails on ambiguous silence — zero receipts, old receipt, empty feed', () => {
    const agentStatus = { ...okAgent, macroSignal: { ...okMacro, receivedCount: 0 } };
    const { problems, warnings } = evaluateHealth({ status: okStatus, agentStatus, routesOk: true, routesOutput: '', macroFeed: { recent: [] } });
    expect(problems).toEqual([]);
    expect(warnings.join('\n')).toContain('zero monitor events');
    expect(warnings.join('\n')).toContain('no MACRO_SIGNAL rows');

    const old = { ...okAgent, macroSignal: { ...okMacro, lastReceivedAgeDays: 45 } };
    const res2 = evaluateHealth({ status: okStatus, agentStatus: old, routesOk: true, routesOutput: '', macroFeed: okFeed });
    expect(res2.problems).toEqual([]);
    expect(res2.warnings.join('\n')).toContain('45d ago');
  });

  it('fails when the proof feed is unreachable; passes on a healthy macro block', () => {
    const bad = evaluateHealth({ status: okStatus, agentStatus: okAgent, routesOk: true, routesOutput: '', macroFeed: null });
    expect(bad.problems.join('\n')).toContain('zero-g-ledger feed unreachable');

    const good = evaluateHealth({ status: okStatus, agentStatus: { ...okAgent, macroSignal: okMacro }, routesOk: true, routesOutput: '', macroFeed: okFeed });
    expect(good.problems).toEqual([]);
  });
});
