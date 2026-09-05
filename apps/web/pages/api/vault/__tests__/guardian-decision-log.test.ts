import { describe, expect, it } from 'vitest';
import {
  MAX_DECISION_LOG,
  pushDecisionLog,
  type GuardianDecisionEntry,
} from '../_guardian-state';

function entry(overrides: Partial<GuardianDecisionEntry> = {}): GuardianDecisionEntry {
  return {
    capturedAt: '2026-09-05T00:00:00.000Z',
    status: 'daily_limit_reached',
    reason: 'No daily budget remaining',
    identityKey: 'daily_limit_reached',
    ...overrides,
  };
}

describe('pushDecisionLog', () => {
  it('prepends newest-first', () => {
    const a = entry({ capturedAt: '2026-09-05T00:00:01.000Z', identityKey: 'no_vault' });
    const b = entry({ capturedAt: '2026-09-05T00:00:02.000Z', identityKey: 'advisory_pending_user_review', reason: 'newer' });
    const log = pushDecisionLog([a], b);
    expect(log[0].reason).toBe('newer');
    expect(log).toHaveLength(2);
  });

  it('replaces a prior entry with the same identityKey (one live entry per persistent state)', () => {
    const old = entry({ reason: 'stale reason' });
    const refreshed = entry({ capturedAt: '2026-09-05T00:10:00.000Z', reason: 'fresh reason' });
    const log = pushDecisionLog([old], refreshed);
    expect(log).toHaveLength(1);
    expect(log[0].reason).toBe('fresh reason');
  });

  it('keeps distinct one-shot declines with different identityKeys', () => {
    const stale = entry({ identityKey: 'stale_recommendation:abc', status: 'stale_recommendation' });
    const stale2 = entry({ identityKey: 'stale_recommendation:def', status: 'stale_recommendation' });
    const log = pushDecisionLog([stale], stale2);
    expect(log).toHaveLength(2);
  });

  it('caps the log at MAX_DECISION_LOG', () => {
    let log: GuardianDecisionEntry[] | undefined;
    for (let i = 0; i < MAX_DECISION_LOG + 5; i += 1) {
      log = pushDecisionLog(log, entry({ identityKey: `key-${i}`, status: `s-${i}` }));
    }
    expect(log).toHaveLength(MAX_DECISION_LOG);
    expect(log?.[0].status).toBe(`s-${MAX_DECISION_LOG + 4}`);
  });
});
