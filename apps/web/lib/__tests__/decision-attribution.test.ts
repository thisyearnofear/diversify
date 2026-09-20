import { describe, it, expect } from 'vitest';
import {
  findTokenAttribution,
  newestExecutionAnchor,
} from '@/lib/agent/decision-attribution';

type AttributionArg = Parameters<typeof findTokenAttribution>[0];

const anchor = (capturedAt: string) =>
  ({ capturedAt, status: 'confirmed', txHash: `0x${capturedAt.slice(-4)}` });

describe('findTokenAttribution', () => {
  it('returns the newest token-matched decline, case-insensitively', () => {
    const info = {
      decisionLog: [
        {
          capturedAt: '2026-09-18T10:00:00.000Z',
          status: 'daily_limit_reached',
          reason: 'Daily budget spent',
          targetToken: 'usdt',
        },
        {
          capturedAt: '2026-09-19T10:00:00.000Z',
          status: 'awaiting_confirmation',
          reason: 'Waiting for first confirmation',
          targetToken: 'USDT',
          source: 'guardian-loop',
          durationMs: 1180,
        },
      ],
      latestRecommendation: undefined,
    } as unknown as AttributionArg;

    const result = findTokenAttribution(info, 'USDT');
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('decline');
    expect(result!.capturedAt).toBe('2026-09-19T10:00:00.000Z');
    expect(result!.durationMs).toBe(1180);
  });

  it('falls back to a pending proposal when no decline matches', () => {
    const info = {
      decisionLog: [
        {
          capturedAt: '2026-09-19T10:00:00.000Z',
          status: 'stale_proposal',
          reason: 'Proposal expired',
          targetToken: 'WETH',
        },
      ],
      latestRecommendation: {
        capturedAt: '2026-09-19T12:00:00.000Z',
        targetToken: 'USDC',
        oneLiner: 'Rotate idle USDC into yield',
        source: 'cycle-monitor',
      },
    } as unknown as AttributionArg;

    const result = findTokenAttribution(info, 'usdc');
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('proposal');
    expect(result!.status).toBe('awaiting_review');
    expect(result!.reason).toBe('Rotate idle USDC into yield');
  });

  it('omits entirely when nothing explains the token — no unrelated substitution', () => {
    const info = {
      decisionLog: [
        {
          capturedAt: '2026-09-19T10:00:00.000Z',
          status: 'stale_proposal',
          reason: 'Proposal expired',
          targetToken: 'WETH',
        },
      ],
      latestAnchors: [anchor('2026-09-19T11:00:00.000Z')],
    } as unknown as AttributionArg;

    expect(findTokenAttribution(info, 'USDT')).toBeNull();
    expect(findTokenAttribution(null, 'USDT')).toBeNull();
    expect(findTokenAttribution(info, '')).toBeNull();
  });
});

describe('newestExecutionAnchor', () => {
  it('prefers the rolling anchor history head', () => {
    const info = {
      latestAnchors: [anchor('2026-09-19T11:00:00.000Z'), anchor('2026-09-18T11:00:00.000Z')],
      latestAnchor: anchor('2026-09-01T11:00:00.000Z'),
    } as unknown as AttributionArg;
    expect(newestExecutionAnchor(info)!.capturedAt).toBe('2026-09-19T11:00:00.000Z');
  });

  it('falls back to the single legacy pointer, then null', () => {
    const legacy = { latestAnchor: anchor('2026-09-01T11:00:00.000Z') } as unknown as AttributionArg;
    expect(newestExecutionAnchor(legacy)!.capturedAt).toBe('2026-09-01T11:00:00.000Z');
    expect(newestExecutionAnchor({} as AttributionArg)).toBeNull();
    expect(newestExecutionAnchor(null)).toBeNull();
  });
});
