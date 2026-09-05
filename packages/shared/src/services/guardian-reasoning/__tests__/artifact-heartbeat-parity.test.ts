/**
 * Probe (Phase 3 prep): does the Phase 1 heartbeat wiring reproduce the
 * pre-Phase-1 on-chain text byte-for-byte?
 *
 * The pre-Phase-1 heartbeat text for the all-live fixture is frozen in
 * deterministic-synthesizer.test.ts: the synthesizer's `reasoning` string
 * ALREADY ends in the data-point sentence (with no caveat, because all
 * sources are live). If `decisionToLedgerParams` re-renders the bundle's
 * data points after that body, the on-chain text grows a duplicate
 * data-point sentence — a wording change to already-anchored text that
 * Phase 1's own tests would not have caught, because they only compared
 * surfaces to EACH OTHER, never to the pre-Phase-1 freeze.
 */

import { describe, expect, it } from 'vitest';
import { decisionToLedgerParams, type GuardianDecisionArtifact } from '../artifact';
import { synthesizeHeartbeatAdvisory, toGuardianSignals, type HeartbeatMarketSnapshot } from '../index';

const TS = '2026-09-05T00:00:00.000Z';

const allLiveSnapshot: HeartbeatMarketSnapshot = {
  defillama: { live: true, pools: [{ protocol: 'Mento', apy: 12.5, tvl: 5_000_000 }] },
  coingecko: { live: true, bitcoin: 65432, pax_gold: 2411 },
  worldBank: { live: true, current_inflation: 4.2 },
  timestamp: TS,
};

// Frozen in deterministic-synthesizer.test.ts (golden `allLive`).
const PRE_PHASE1_REASONING =
  'High inflation (4.2%) detected (World Bank CPI, live). Recommend cUSD savings position on Celo to preserve purchasing power. Inflation: 4.2% (World Bank CPI, live), BTC: $65,432 (CoinGecko, live), PAXG: $2,411 (CoinGecko, live), Top yield: Mento at 12.50% APY ($5.0M TVL, DeFiLlama, live).';

describe('Phase 3 prep probe: heartbeat wiring vs pre-Phase-1 on-chain text', () => {
  it('builder path reproduces the pre-Phase-1 text byte-for-byte (bodyComplete, as the heartbeat wires it)', () => {
    const rec = synthesizeHeartbeatAdvisory(allLiveSnapshot);
    expect(rec.reasoning).toBe(PRE_PHASE1_REASONING); // Phase 0 freeze holds

    // Mirrors the heartbeat route's `decisionBase` EXACTLY — including
    // `bodyComplete: true`. If the route and this probe ever diverge, this
    // test and the route's own honesty suite will disagree, which is the
    // early-warning this harness exists to provide.
    const decision: GuardianDecisionArtifact = {
      surface: 'heartbeat',
      recordKind: 'advisory',
      draft: {
        action: rec.action,
        targetToken: rec.targetToken,
        confidence: rec.confidence,
        reasoning: rec.reasoning,
      },
      signals: toGuardianSignals(allLiveSnapshot),
      bodyComplete: true,
    };
    const params = decisionToLedgerParams(decision);

    // The wiring must be a no-op on already-complete text.
    expect(params.reasoning).toBe(PRE_PHASE1_REASONING);
  });

  it('bodyComplete=false still renders canonical signal lines (raw-body path preserved)', () => {
    const decision: GuardianDecisionArtifact = {
      surface: 'guardian-loop',
      recordKind: 'autonomous-execution',
      draft: {
        action: 'AUTONOMOUS_REBALANCE',
        targetToken: 'cUSD',
        confidence: 0.8,
        reasoning: 'Raw body without rendered data points.',
      },
      signals: toGuardianSignals(allLiveSnapshot),
    };
    const params = decisionToLedgerParams(decision);

    expect(params.reasoning).toContain('Raw body without rendered data points.');
    expect(params.reasoning).toContain('inflation.us.cpi: 4.2% (world-bank, live)');
  });
});
