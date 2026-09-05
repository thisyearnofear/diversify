/**
 * Tests for the heartbeat's market-snapshot honesty contract.
 *
 * The heartbeat records advisory reasoning ON-CHAIN (immutable). Historically
 * it hardcoded "default" prices on provider failure (`bitcoin || 65000`,
 * `wbData || 3.1`) so a recorded advisory read as if CoinGecko/World Bank had
 * actually quoted those figures. These tests pin the replacement contract:
 * unavailable sources yield `null`, decisions gate on live data only, and the
 * reasoning names + discloses every unavailable source ("no fallback figures").
 */

import { describe, it, expect, vi } from 'vitest';

// The route imports the @diversifi/shared barrel, which drags in live
// provider SDKs (ethers, openai, 0G…). We only test the pure snapshot
// logic, so mock the barrel like guardian-loop.test.ts does — the handler
// that actually touches these exports never runs here.
vi.mock('@diversifi/shared', () => ({
  recommendationLedgerService: {},
  constantTimeEqual: () => false,
}));

import {
  pickRecommendation,
  type MarketSnapshot,
} from '../guardian-heartbeat';

const TS = '2026-09-05T00:00:00.000Z';

function snapshot(opts: {
  defillamaLive?: boolean;
  pools?: MarketSnapshot['defillama']['pools'];
  coingeckoLive?: boolean;
  bitcoin?: number | null;
  paxGold?: number | null;
  worldBankLive?: boolean;
  inflation?: number | null;
}): MarketSnapshot {
  return {
    defillama: {
      live: opts.defillamaLive ?? true,
      pools: opts.pools ?? [],
    },
    coingecko: {
      live: opts.coingeckoLive ?? true,
      bitcoin: opts.bitcoin ?? (opts.coingeckoLive === false ? null : 65432),
      pax_gold: opts.paxGold ?? (opts.coingeckoLive === false ? null : 2411),
    },
    worldBank: {
      live: opts.worldBankLive ?? true,
      current_inflation: opts.inflation ?? (opts.worldBankLive === false ? null : 4.2),
    },
    timestamp: TS,
  };
}

describe('guardian-heartbeat pickRecommendation', () => {
  it('quotes live figures with their sources when every provider is up', () => {
    const rec = pickRecommendation(snapshot({
      inflation: 4.2,
      pools: [{ protocol: 'Mento', apy: 12.5, tvl: 5_000_000 }],
    }));

    expect(rec.targetToken).toBe('cUSD');
    expect(rec.confidence).toBe(0.72);
    expect(rec.reasoning).toContain('World Bank CPI, live');
    expect(rec.reasoning).toContain('BTC: $65,432 (CoinGecko, live)');
    expect(rec.reasoning).toContain('PAXG: $2,411 (CoinGecko, live)');
    expect(rec.reasoning).toContain('DeFiLlama, live');
    expect(rec.reasoning).not.toContain('no fallback');
  });

  it('never fabricates a CoinGecko price when CoinGecko is down', () => {
    const rec = pickRecommendation(snapshot({
      inflation: 4.2,
      coingeckoLive: false,
      bitcoin: null,
      paxGold: null,
    }));

    expect(rec.targetToken).toBe('cUSD');
    // Decision still drives off the live World Bank read.
    expect(rec.reasoning).toContain('High inflation (4.2%)');
    // But no quote is asserted, and the outage is disclosed on-chain.
    expect(rec.reasoning).not.toContain('BTC');
    expect(rec.reasoning).not.toContain('PAXG');
    expect(rec.reasoning).not.toContain('$');
    expect(rec.reasoning).not.toContain('65,000');
    expect(rec.reasoning).not.toContain('2,400');
    expect(rec.reasoning).toContain('CoinGecko prices');
    expect(rec.reasoning).toContain('no fallback figures were used');
  });

  it('never claims high inflation from the hardcoded 3.1 default when World Bank is down', () => {
    const rec = pickRecommendation(snapshot({
      worldBankLive: false,
      inflation: null,
      pools: [{ protocol: 'Mento', apy: 12.5, tvl: 5_000_000 }],
    }));

    // Live DeFiLlama yield still triggers the yield branch…
    expect(rec.targetToken).toBe('USDC');
    expect(rec.reasoning).toContain('DeFiLlama, live');
    // …but no inflation datum is invented, and the gap is disclosed.
    expect(rec.reasoning).not.toContain('High inflation');
    expect(rec.reasoning).not.toContain('Inflation:');
    expect(rec.reasoning).not.toContain('3.1');
    expect(rec.reasoning).toContain('World Bank CPI');
    expect(rec.reasoning).toContain('no fallback figures were used');
  });

  it('falls to an honest no-signal default when World Bank is down and yield is weak', () => {
    const rec = pickRecommendation(snapshot({
      worldBankLive: false,
      inflation: null,
      pools: [{ protocol: 'Mento', apy: 3.2, tvl: 5_000_000 }],
    }));

    expect(rec.targetToken).toBe('cEUR');
    expect(rec.confidence).toBe(0.6);
    expect(rec.reasoning).toContain('No actionable live signal');
    expect(rec.reasoning).toContain('yields below the 5% threshold');
    // No regime claim, and the down source's figure is never quoted — the
    // live CoinGecko/DeFiLlama quotes may still carry their honest $ figures.
    expect(rec.reasoning).not.toContain('Stable regime');
    expect(rec.reasoning).not.toContain('Inflation:');
    expect(rec.reasoning).not.toContain('3.1');
  });

  it('discloses every unavailable source when all three providers fail', () => {
    const rec = pickRecommendation(snapshot({
      defillamaLive: false,
      coingeckoLive: false,
      bitcoin: null,
      paxGold: null,
      worldBankLive: false,
      inflation: null,
    }));

    expect(rec.targetToken).toBe('cEUR');
    expect(rec.confidence).toBe(0.6);
    expect(rec.reasoning).toContain('No actionable live signal');
    expect(rec.reasoning).toContain('World Bank CPI');
    expect(rec.reasoning).toContain('CoinGecko prices');
    expect(rec.reasoning).toContain('DeFiLlama yields');
    expect(rec.reasoning).toContain('no fallback market figures were used');
    expect(rec.reasoning).not.toContain('Stable regime');
    expect(rec.reasoning).not.toContain('$');
    expect(rec.reasoning).not.toContain('65,000');
    expect(rec.reasoning).not.toContain('3.1');
  });

  it('only claims a stable regime when inflation was actually measured', () => {
    const rec = pickRecommendation(snapshot({
      inflation: 2.0,
      pools: [],
    }));

    expect(rec.targetToken).toBe('cEUR');
    expect(rec.confidence).toBe(0.65);
    expect(rec.reasoning).toContain('Stable regime measured');
    expect(rec.reasoning).toContain('Inflation: 2% (World Bank CPI, live)');
    // A live-but-empty yield read (no qualifying pools) is NOT an outage.
    expect(rec.reasoning).not.toContain('DeFiLlama yields');
    expect(rec.reasoning).not.toContain('no fallback');
  });
});
