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
    expect(warnings.length).toBe(2);
  });
});
