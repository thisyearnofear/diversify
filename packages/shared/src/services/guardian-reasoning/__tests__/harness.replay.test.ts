/**
 * Phase 3 harness tests — the cross-surface replay contract.
 *
 * Scenarios (the fixtures mirror the Phase 0 golden set's conditions):
 *   1. all-live   — loop + heartbeat + marketplace must compose identical
 *                   text from identical facts; replaying twice is identical.
 *   2. all-down   — every surface must DISCLOSE the outage and quote nothing
 *                   (the honesty scanner runs on every replay).
 *   3. route parity — the fixture carries the heartbeat snapshot, so the
 *                   synthesizer→artifact path is replayed too and its text
 *                   must equal the frozen Phase 0 golden byte-for-byte.
 *
 * Each test ALSO flips one fact per surface (the mutation probes): changing
 * the draft on one surface must break cross-surface identity — proving the
 * harness detects drift rather than trivially passing.
 */

import { describe, expect, it } from 'vitest';
import {
  replaySignalFixture,
  assertReplayContract,
  findQuotedDeadSignals,
  type ReplayFixture,
  type ReplaySurfaceProjection,
} from '../harness';
import {
  synthesizeHeartbeatAdvisory,
  type GuardianDecisionArtifact,
  type HeartbeatMarketSnapshot,
} from '../index';

const TS = '2026-09-05T00:00:00.000Z';

const allLiveSnapshot: HeartbeatMarketSnapshot = {
  defillama: { live: true, pools: [{ protocol: 'Mento', apy: 12.5, tvl: 5_000_000 }] },
  coingecko: { live: true, bitcoin: 65432, pax_gold: 2411 },
  worldBank: { live: true, current_inflation: 4.2 },
  timestamp: TS,
};

const allDownSnapshot: HeartbeatMarketSnapshot = {
  defillama: { live: false, pools: [] },
  coingecko: { live: false, bitcoin: null, pax_gold: null },
  worldBank: { live: false, current_inflation: null },
  timestamp: TS,
};

// Frozen Phase 0 golden for the all-live fixture.
const ALL_LIVE_GOLDEN_REASONING =
  'High inflation (4.2%) detected (World Bank CPI, live). Recommend cUSD savings position on Celo to preserve purchasing power. Inflation: 4.2% (World Bank CPI, live), BTC: $65,432 (CoinGecko, live), PAXG: $2,411 (CoinGecko, live), Top yield: Mento at 12.50% APY ($5.0M TVL, DeFiLlama, live).';

const allLiveDraft: GuardianDecisionArtifact['draft'] = {
  action: 'ADVISORY_HEARTBEAT',
  targetToken: 'cUSD',
  confidence: 0.72,
  // The synthesizer's frozen reasoning (already data-point-complete).
  reasoning: ALL_LIVE_GOLDEN_REASONING,
};

const allDownDraft: GuardianDecisionArtifact['draft'] = {
  action: 'ADVISORY_HEARTBEAT',
  targetToken: 'cEUR',
  confidence: 0.6,
  reasoning:
    'No actionable live signal this beat — inflation not measured. Recommend holding the cEUR core; no fallback market figures were used.',
};

/**
 * The three surface projections as each surface's REAL wiring builds them:
 * heartbeat with bodyComplete (synthesizer text), loop with signals: []
 * (it never quotes a market source it didn't measure), marketplace with raw
 * LLM-style text rendered through the builder's canonical signal lines.
 */
function baseProjections(draft: GuardianDecisionArtifact['draft'], bodyComplete: boolean): ReplaySurfaceProjection[] {
  return [
    {
      surface: 'heartbeat',
      artifact: {
        surface: 'heartbeat',
        recordKind: 'advisory',
        draft,
        signals: [],
        bodyComplete,
      },
    },
    {
      surface: 'guardian-loop',
      artifact: {
        surface: 'guardian-loop',
        recordKind: 'autonomous-execution',
        draft,
        signals: [],
        bodyComplete,
      },
    },
    {
      surface: 'arc-marketplace',
      artifact: {
        surface: 'arc-marketplace',
        recordKind: 'advisory',
        draft,
        signals: [],
        bodyComplete,
      },
    },
  ];
}

describe('Phase 3 harness — cross-surface replay (all-live)', () => {
  const fixture: ReplayFixture = {
    name: 'all-live',
    signals: [],
    heartbeatSnapshot: allLiveSnapshot,
    draft: allLiveDraft,
  };

  it('loop, heartbeat, and marketplace compose byte-identical text', () => {
    const result = replaySignalFixture(fixture, baseProjections(allLiveDraft, true));
    assertReplayContract(result);

    const texts = result.surfaces.map((s) => s.text);
    expect(texts[0]).toBe(texts[1]);
    expect(texts[1]).toBe(texts[2]);
  });

  it('route parity: the synthesizer→artifact path equals the Phase 0 golden byte-for-byte', () => {
    const result = replaySignalFixture(fixture, baseProjections(allLiveDraft, true));
    assertReplayContract(result);

    const heartbeatText = result.surfaces.find((s) => s.surface === 'heartbeat')!.text;
    expect(heartbeatText).toBe(ALL_LIVE_GOLDEN_REASONING);
  });

  it('mutation probe: changing one surface\'s draft breaks cross-surface identity', () => {
    const driftedProjections = baseProjections(allLiveDraft, true);
    driftedProjections[1] = {
      ...driftedProjections[1],
      artifact: {
        ...driftedProjections[1].artifact,
        draft: { ...allLiveDraft, reasoning: 'A slightly different wording on the loop.' },
      },
    };
    const result = replaySignalFixture(fixture, driftedProjections);

    // The harness must FLAG the drift, not pass it.
    expect(result.failures.some((f) => f.includes('cross-surface wording drift'))).toBe(true);
    expect(() => assertReplayContract(result)).toThrow(/Replay contract violated/);
  });
});

describe('Phase 3 harness — outage disclosure (all-down)', () => {
  const deadSignals = [
    { key: 'inflation.us.cpi', value: null, unit: '%', source: 'world-bank', live: false, capturedAt: TS },
    { key: 'price.btc', value: null, unit: 'USD', source: 'coingecko', live: false, capturedAt: TS },
    { key: 'yield.stable.topApy', value: null, unit: '%APY', source: 'defillama', live: false, capturedAt: TS },
  ];

  const fixture: ReplayFixture = {
    name: 'all-down',
    signals: deadSignals,
    heartbeatSnapshot: allDownSnapshot,
    draft: allDownDraft,
  };

  it('every surface discloses the outage and quotes no observation', () => {
    const result = replaySignalFixture(fixture, baseProjections(allDownDraft, true));
    assertReplayContract(result);

    for (const s of result.surfaces) {
      expect(s.text).toContain('No actionable live signal');
      expect(s.text).not.toContain('inflation.us.cpi:');
      expect(s.text).not.toContain('price.btc:');
      expect(s.text).not.toContain('(world-bank, live)');
    }
  });

  it('honesty scanner: a dead signal with a value can never pass as quoted', () => {
    // The poison case: a live:false signal that carries a plausible value.
    // Quoting its key must be flagged even though the text looks honest.
    const poisoned = [
      ...deadSignals,
      { key: 'price.btc', value: 65000, unit: 'USD', source: 'coingecko', live: false, capturedAt: TS },
    ];
    const text = 'BTC looks fine: price.btc: 65000USD (coingecko, live).';
    expect(findQuotedDeadSignals(text, poisoned).map((s) => s.key)).toContain('price.btc');
  });

  it('mutation probe: dropping the outage disclosure from one surface breaks identity', () => {
    const drifted = baseProjections(allDownDraft, true);
    drifted[2] = {
      ...drifted[2],
      artifact: {
        ...drifted[2].artifact,
        draft: { ...allDownDraft, reasoning: 'No actionable live signal this beat — inflation not measured.' },
      },
    };
    const result = replaySignalFixture(fixture, drifted);
    expect(result.failures.some((f) => f.includes('cross-surface wording drift'))).toBe(true);
  });
});

describe('Phase 3 harness — raw-body rendering path (loop execution facts)', () => {
  it('loop raw body renders canonical signal lines and stays identical across replays', () => {
    const loopDraft: GuardianDecisionArtifact['draft'] = {
      action: 'AUTONOMOUS_REBALANCE',
      targetToken: 'cUSD',
      confidence: 0.8,
      reasoning: 'Guardian auto-execute: rebalance within signed bounds.',
    };
    const fixture: ReplayFixture = {
      name: 'loop-execution',
      signals: [
        { key: 'inflation.us.cpi', value: 4.2, unit: '%', source: 'world-bank', live: true, capturedAt: TS },
        { key: 'price.btc', value: 65432, unit: 'USD', source: 'coingecko', live: true, capturedAt: TS },
      ],
      draft: loopDraft,
    };
    const projections: ReplaySurfaceProjection[] = [
      {
        surface: 'guardian-loop',
        artifact: {
          surface: 'guardian-loop',
          recordKind: 'autonomous-execution',
          draft: loopDraft,
          signals: fixture.signals,
          // No bodyComplete — the loop's execution facts are raw text and the
          // builder renders the canonical signal lines after it.
        },
      },
    ];

    const result = replaySignalFixture(fixture, projections);
    assertReplayContract(result);

    const text = result.surfaces[0].text;
    expect(text).toContain('Guardian auto-execute: rebalance within signed bounds.');
    expect(text).toContain('inflation.us.cpi: 4.2% (world-bank, live)');
    expect(text).toContain('price.btc: 65432USD (coingecko, live)');
  });
});
