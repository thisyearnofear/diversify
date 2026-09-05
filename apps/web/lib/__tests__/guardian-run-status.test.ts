import { describe, expect, it } from 'vitest';
import {
  deriveGuardianRunHealth,
  guardianRunFreshnessWindowMs,
  GUARDIAN_RUN_CADENCE_MS,
} from '../guardian-run-status';

const NOW = Date.parse('2026-09-05T12:00:00.000Z');

describe('deriveGuardianRunHealth', () => {
  it('reports never for a missing record', () => {
    const health = deriveGuardianRunHealth('loop', null, NOW);
    expect(health.freshness).toBe('never');
    expect(health.healthy).toBe(false);
    expect(health.lastRunAt).toBeNull();
  });

  it('reports fresh + healthy for a recent ok run', () => {
    const health = deriveGuardianRunHealth(
      'loop',
      {
        lastRunAt: new Date(NOW - 60_000).toISOString(),
        status: 'ok',
        summary: { executionsSucceeded: 1 },
      },
      NOW,
    );
    expect(health.freshness).toBe('fresh');
    expect(health.healthy).toBe(true);
    expect(health.ageSeconds).toBe(60);
  });

  it('treats an idle run as healthy (the Guardian is alive, nothing to do)', () => {
    const health = deriveGuardianRunHealth(
      'loop',
      { lastRunAt: new Date(NOW - 30_000).toISOString(), status: 'idle' },
      NOW,
    );
    expect(health.freshness).toBe('fresh');
    expect(health.healthy).toBe(true);
  });

  it('marks a recent failed run unhealthy even though it is fresh', () => {
    const health = deriveGuardianRunHealth(
      'loop',
      { lastRunAt: new Date(NOW - 10_000).toISOString(), status: 'failed', error: 'db down' },
      NOW,
    );
    expect(health.freshness).toBe('fresh');
    expect(health.healthy).toBe(false);
  });

  it('flags a run older than 3× cadence as stale', () => {
    // Loop cadence is 5 min → window 15 min.
    const health = deriveGuardianRunHealth(
      'loop',
      { lastRunAt: new Date(NOW - guardianRunFreshnessWindowMs('loop') - 1).toISOString(), status: 'ok' },
      NOW,
    );
    expect(health.freshness).toBe('stale');
    expect(health.healthy).toBe(false);
  });

  it('uses the heartbeat cadence (30 min → 90 min window) for heartbeat', () => {
    expect(GUARDIAN_RUN_CADENCE_MS.heartbeat).toBe(30 * 60 * 1000);
    const within = deriveGuardianRunHealth(
      'heartbeat',
      { lastRunAt: new Date(NOW - 60 * 60 * 1000).toISOString(), status: 'ok' }, // 1h ago
      NOW,
    );
    expect(within.freshness).toBe('fresh');
    const outside = deriveGuardianRunHealth(
      'heartbeat',
      { lastRunAt: new Date(NOW - 2 * 60 * 60 * 1000).toISOString(), status: 'ok' }, // 2h ago
      NOW,
    );
    expect(outside.freshness).toBe('stale');
  });
});
