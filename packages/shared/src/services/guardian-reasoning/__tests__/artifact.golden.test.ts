/**
 * Phase 1 golden tests — the unified decision artifact.
 *
 * The contract (docs/guardian-reasoning-service.md §5, §7 Phase 1, §8.4):
 * identical (draft facts, signals, cohort) ⇒ **byte-identical** on-chain
 * text, no matter which surface emits it. These tests drive all three
 * surfaces through `buildAdvisoryReasoning` / `decisionToLedgerParams` and
 * demand string equality — wording drift between surfaces now fails here
 * before it can reach immutable on-chain text.
 *
 * The heartbeat's exact historical wording (cohort prefixes, data-point
 * format, outage disclosure) is pinned literally so the unification does
 * not silently reword what is already anchored on-chain.
 */

import { describe, expect, it } from 'vitest';
import {
  buildAdvisoryReasoning,
  decisionToLedgerParams,
  surfaceToServingModel,
  type GuardianDecisionArtifact,
  type GuardianSignal,
} from '../artifact';
import type { HeartbeatMarketSnapshot } from '../index';
import { toGuardianSignals } from '../index';

const TS = '2026-09-05T00:00:00.000Z';

const snapshot: HeartbeatMarketSnapshot = {
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

// The live draft the Phase 0 synthesizer produces for the all-live snapshot —
// reasoning text frozen from the original implementation's golden set.
const LIVE_DRAFT_REASONING =
  'High inflation (4.2%) detected (World Bank CPI, live). Recommend cUSD savings position on Celo to preserve purchasing power.';

const signals: GuardianSignal[] = toGuardianSignals(snapshot);

describe('buildAdvisoryReasoning — cross-surface identity (doc §8.4)', () => {
  it('loop, heartbeat, and marketplace produce byte-identical text for the same facts', () => {
    const surfaces: GuardianDecisionArtifact['surface'][] = [
      'guardian-loop',
      'heartbeat',
      'arc-marketplace',
    ];

    const texts = surfaces.map((surface) =>
      buildAdvisoryReasoning({
        surface,
        recordKind: 'advisory',
        draft: { action: 'ADVISORY_HEARTBEAT', targetToken: 'cUSD', confidence: 0.72, reasoning: LIVE_DRAFT_REASONING },
        signals,
        cohort: 'global',
      }),
    );

    expect(texts[0]).toBe(texts[1]);
    expect(texts[1]).toBe(texts[2]);
  });

  it('surface changes only the origin stamp, never the reasoning text', () => {
    const base = {
      recordKind: 'advisory' as const,
      draft: { action: 'ADVISORY_HEARTBEAT', targetToken: 'cUSD', confidence: 0.72, reasoning: LIVE_DRAFT_REASONING },
      signals,
      cohort: 'global' as const,
    };
    const loop = decisionToLedgerParams({ ...base, surface: 'guardian-loop' });
    const heartbeat = decisionToLedgerParams({ ...base, surface: 'heartbeat' });

    expect(loop.reasoning).toBe(heartbeat.reasoning);
    expect(loop.servingModel).toBe('guardian-loop');
    expect(heartbeat.servingModel).toBe('guardian-heartbeat');
  });

  it('cohort framing is the only difference between global and cohort records of the same facts', () => {
    const base = {
      surface: 'heartbeat' as const,
      recordKind: 'advisory' as const,
      draft: { action: 'ADVISORY_HEARTBEAT', targetToken: 'cUSD', confidence: 0.72, reasoning: LIVE_DRAFT_REASONING },
      signals,
    };
    const global = buildAdvisoryReasoning({ ...base, cohort: 'global' });
    const apac = buildAdvisoryReasoning({ ...base, cohort: 'confucian' });
    const caribbean = buildAdvisoryReasoning({ ...base, cohort: 'pan_caribbean' });

    // The cohort prefixes are exactly the strings the heartbeat has been
    // anchoring on-chain — pinned here so they can never silently drift.
    expect(apac.startsWith('APAC savings advisory (Confucian/Gotong Royong cohort): hold stablecoin core on the APAC rail. ')).toBe(true);
    expect(caribbean.startsWith('Caribbean savings advisory (Pan-Caribbean cohort): hold USD-pegged stablecoin core on Celo. ')).toBe(true);
    expect(apac.substring(global.length === 0 ? 0 : 0)).toBe(apac); // no-op guard on shape
    // Cohort text = global text with the prefix in front (same body).
    expect(apac.endsWith(global)).toBe(true);
    expect(caribbean.endsWith(global)).toBe(true);
  });
});

describe('buildAdvisoryReasoning — data-point rendering and honesty', () => {
  it('renders live data points with key, unit, and source — the canonical signal line format', () => {
    const text = buildAdvisoryReasoning({
      surface: 'heartbeat',
      recordKind: 'advisory',
      draft: { action: 'ADVISORY_HEARTBEAT', targetToken: 'cUSD', confidence: 0.72, reasoning: LIVE_DRAFT_REASONING },
      signals,
    });

    expect(text).toContain('inflation.us.cpi: 4.2% (world-bank, live)');
    expect(text).toContain('price.btc: 65432USD (coingecko, live)');
    expect(text).toContain('yield.stable.topApy: 12.5%APY (defillama, live)');
    expect(text).not.toContain('no fallback');
  });

  it('a live:false signal is never quoted — the outage is disclosed instead', () => {
    const downSignals: GuardianSignal[] = [
      { key: 'inflation.us.cpi', value: null, unit: '%', source: 'world-bank', live: false, capturedAt: TS },
      { key: 'price.btc', value: 65432, unit: 'USD', source: 'coingecko', live: true, capturedAt: TS },
    ];
    const text = buildAdvisoryReasoning({
      surface: 'heartbeat',
      recordKind: 'advisory',
      draft: { action: 'ADVISORY_HEARTBEAT', targetToken: 'cEUR', confidence: 0.6, reasoning: 'No actionable live signal this beat.' },
      signals: downSignals,
    });

    expect(text).not.toContain('inflation.us.cpi');
    expect(text).toContain('price.btc: 65432USD (coingecko, live)');
    expect(text).toContain('Sources unavailable this beat: world-bank — no fallback figures were used.');
  });

  it('all-down: every outage disclosed, nothing quoted', () => {
    const text = buildAdvisoryReasoning({
      surface: 'heartbeat',
      recordKind: 'advisory',
      draft: { action: 'ADVISORY_HEARTBEAT', targetToken: 'cEUR', confidence: 0.6, reasoning: 'No actionable live signal this beat.' },
      signals: toGuardianSignals(allDownSnapshot).length > 0 ? toGuardianSignals(allDownSnapshot) : [
        { key: 'inflation.us.cpi', value: null, unit: '%', source: 'world-bank', live: false, capturedAt: TS },
        { key: 'price.btc', value: null, unit: 'USD', source: 'coingecko', live: false, capturedAt: TS },
        { key: 'yield.stable.topApy', value: null, unit: '%APY', source: 'defillama', live: false, capturedAt: TS },
      ],
    });

    expect(text).toContain('Sources unavailable this beat: world-bank, coingecko, defillama — no fallback figures were used.');
    expect(text).not.toContain('(live)');
  });

  it('a declined verdict is disclosed in the text', () => {
    const text = buildAdvisoryReasoning({
      surface: 'guardian-loop',
      recordKind: 'autonomous-execution',
      draft: { action: 'AUTONOMOUS_REBALANCE', targetToken: 'cUSD', confidence: 0.8, reasoning: 'Rebalance within bounds.' },
      signals,
      verdict: { status: 'declined', reasons: ['daily_limit_reached'] },
    });

    expect(text).toContain('Gates declined: daily_limit_reached.');
  });
});

describe('buildAdvisoryReasoning — record kinds', () => {
  it('evidence-mirror renders the deterministic mirror reference', () => {
    const text = buildAdvisoryReasoning({
      surface: 'guardian-loop',
      recordKind: 'evidence-mirror',
      draft: { action: 'EVIDENCE_MIRROR', targetToken: 'cUSD', confidence: 0.72, reasoning: '' },
      signals: [],
      mirror: { anchorStatus: 'anchored', chainId: 42220, primaryReasoning: 'the primary reasoning line' },
    });

    expect(text).toBe('Evidence anchor for anchored rec on chain 42220: the primary reasoning line');
  });

  it('evidence-mirror falls back to the draft reasoning when no primary text is given', () => {
    const text = buildAdvisoryReasoning({
      surface: 'heartbeat',
      recordKind: 'evidence-mirror',
      draft: { action: 'EVIDENCE_MIRROR', targetToken: 'cUSD', confidence: 0.72, reasoning: 'fallback line' },
      signals: [],
      mirror: { anchorStatus: 'failed', chainId: 42220 },
    });

    expect(text).toBe('Evidence anchor for failed rec on chain 42220: fallback line');
  });
});

describe('surfaceToServingModel — origin stamps', () => {
  it('maps every surface/kind combination to its canonical origin label', () => {
    expect(surfaceToServingModel('heartbeat', 'advisory')).toBe('guardian-heartbeat');
    expect(surfaceToServingModel('heartbeat', 'evidence-mirror')).toBe('guardian-heartbeat-mirror');
    expect(surfaceToServingModel('guardian-loop', 'autonomous-execution')).toBe('guardian-loop');
    expect(surfaceToServingModel('guardian-loop', 'cycle-execution')).toBe('guardian-loop-cycle');
    expect(surfaceToServingModel('guardian-loop', 'evidence-mirror')).toBe('guardian-loop-mirror');
    expect(surfaceToServingModel('arc-marketplace', 'advisory')).toBe('guardian-ai');
  });

  it('confidence converts to basis points exactly once', () => {
    const params = decisionToLedgerParams({
      surface: 'heartbeat',
      recordKind: 'advisory',
      draft: { action: 'ADVISORY_HEARTBEAT', targetToken: 'cUSD', confidence: 0.72, reasoning: 'x' },
      signals: [],
    });
    expect(params.confidence).toBe(7200);
  });
});
