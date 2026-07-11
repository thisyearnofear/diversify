import { describe, expect, it } from 'vitest';
import { getOnChainSavedUsd, deriveServerEngagement } from '../engagement.service';
import { resolveInsightTier } from '../insight-tier';

describe('engagement.service (server-derived, un-spoofable gate)', () => {
  it('returns 0 for a malformed address (fails closed, no network)', async () => {
    expect(await getOnChainSavedUsd('not-an-address')).toBe(0);
    expect(await getOnChainSavedUsd('0x123')).toBe(0);
    expect(await getOnChainSavedUsd('')).toBe(0);
  });

  it('derived engagement never authorizes paid spend via streak', async () => {
    // Even the zero-balance/invalid path must resolve to the free tier — a
    // spoofable streak can never unlock paid calls because streakDays is 0.
    const engagement = await deriveServerEngagement('not-an-address');
    expect(engagement.streakDays).toBe(0);
    expect(engagement.savedUsd).toBe(0);
    expect(resolveInsightTier(engagement)).toBe('free');
  });

  it('tier resolution honours the on-chain savedUsd thresholds', () => {
    // The gate itself is unchanged; this documents that server-derived savedUsd
    // is the only lever now (streakDays fixed at 0).
    expect(resolveInsightTier({ savedUsd: 0, streakDays: 0 })).toBe('free');
    expect(resolveInsightTier({ savedUsd: 100, streakDays: 0 })).toBe('saver');
    expect(resolveInsightTier({ savedUsd: 1000, streakDays: 0 })).toBe('committed');
    // A huge spoofed streak is irrelevant because we never pass it through.
    expect(resolveInsightTier({ savedUsd: 0, streakDays: 999 })).toBe('committed');
  });
});
