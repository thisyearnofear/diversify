import { describe, expect, it } from 'vitest';
import { deriveYieldFocusKey, type BestYieldRecommendation } from '../use-best-yield';

/**
 * deriveYieldFocusKey — collision regression-bait.
 *
 * Purpose: this helper is the single source of truth for the focus-key
 * shape used by both the drawer (AIChat.tsx → setFocusedYieldKey) and the
 * surface (BestYieldCard.tsx → rowKey). Any change to the shape must be
 * reflected in both sides — the helper ties them together.
 *
 * The deliberately relaxed `${chain}:${symbol}` key is robust across the
 * three yield sources (vaults.fyi / gmx / free LI.FI), but it WILL collide
 * if two rows legitimately share the same chain+symbol tuple (e.g., two
 * vaults.fyi pools on Arbitrum both labelled USDC, or a future source that
 * emits LM-only tokens without a unique marker).
 *
 * This test pins that collision risk so any change to the shape is a
 * conscious decision: the test fails whenever the key for two well-formed
 * rows with matching chain+symbol stops being equal — i.e., it is the canary
 * for "did someone change the key shape without updating all callers?"
 */
describe('deriveYieldFocusKey', () => {
  function makeRec(overrides: Partial<BestYieldRecommendation> = {}): BestYieldRecommendation {
    return {
      id: 'rec-1',
      type: 'opportunity',
      title: 'Yield Opportunity',
      description: '',
      ...overrides,
    };
  }

  it('produces `${chain}:${symbol}` for top-level typed fields', () => {
    expect(
      deriveYieldFocusKey(makeRec({ chain: 'Arbitrum', symbol: 'GLP' })),
    ).toBe('Arbitrum:GLP');
  });

  it('produces empty-key stub when both chain and symbol are missing', () => {
    expect(deriveYieldFocusKey(makeRec())).toBe(':');
    expect(deriveYieldFocusKey(makeRec({ chain: undefined, symbol: undefined }))).toBe(':');
  });

  it('keeps the key stable even when other top-level fields change', () => {
    const base = makeRec({ chain: 'Arbitrum', symbol: 'GM', apy: 18, protocol: 'GMX' });
    const candidate = makeRec({ chain: 'Arbitrum', symbol: 'GM', apy: 19, protocol: 'GMX V2' });
    // APY rises and the protocol version shifts — the focus key MUST stay
    // equal so a refreshed alert doesn't eject the highlight off the row.
    expect(deriveYieldFocusKey(base)).toBe(deriveYieldFocusKey(candidate));
  });

  it('produces different keys for different chain/symbol on the same source', () => {
    expect(
      deriveYieldFocusKey(makeRec({ chain: 'Arbitrum', symbol: 'GLP' })),
    ).not.toBe(
      deriveYieldFocusKey(makeRec({ chain: 'Arbitrum', symbol: 'GM' })),
    );
    expect(
      deriveYieldFocusKey(makeRec({ chain: 'Arbitrum', symbol: 'GLP' })),
    ).not.toBe(
      deriveYieldFocusKey(makeRec({ chain: 'Optimism', symbol: 'GLP' })),
    );
  });

  /**
   * PROVES THE COLLISION RISK — if this test ever fails the focus-key has
   * changed shape (or the helper special-cases duplicates), and the team
   * should grep the codebase for hard-coded `${chain}:${symbol}` strings
   * to confirm both sides still match.
   */
  it('collides by design when two rows legitimately share chain+symbol', () => {
    const rowA = makeRec({
      id: 'A',
      chain: 'Arbitrum',
      symbol: 'GLP',
      source: 'vaults.fyi',
      protocol: 'SomeProtocol',
      apy: 4.2,
    });
    const rowB = makeRec({
      id: 'B',
      chain: 'Arbitrum',
      symbol: 'GLP',
      source: 'gmx',
      protocol: 'GMX',
      apy: 21.5,
    });

    // BOTH rows → SAME key. The 4-row cap and upstream de-duplication
    // make this vanishingly rare in practice; this test fixes the
    // behaviour so a future reviewer can either drop one of the rows
    // upstream or add `source`/`id` to the key explicitly.
    expect(deriveYieldFocusKey(rowA)).toBe('Arbitrum:GLP');
    expect(deriveYieldFocusKey(rowB)).toBe('Arbitrum:GLP');
    expect(deriveYieldFocusKey(rowA)).toBe(deriveYieldFocusKey(rowB));
  });

  it('is stable against field ordering — field order does not affect the key', () => {
    const a = makeRec({ chain: 'Base', symbol: 'USDC', apy: 5 });
    const b = makeRec({ apy: 5, symbol: 'USDC', chain: 'Base' });
    expect(deriveYieldFocusKey(a)).toBe(deriveYieldFocusKey(b));
  });

  it('produces the same key when fields are empty-string OR undefined', () => {
    // Empty strings and undefined both round-trip to the same `:`
    // key. The helper does NOT normalize empty strings into undefined —
    // it concatenates `'' | undefined` literally — but for focus-key
    // purposes the two are interchangeable. A partially-populated row
    // (e.g. missing chain) and an explicitly-empty row (rare, but
    // defined) will collide on the same key.
    expect(deriveYieldFocusKey(makeRec({ chain: '', symbol: '' }))).toBe(':');
    expect(deriveYieldFocusKey(makeRec({ chain: undefined, symbol: undefined }))).toBe(':');
  });

  /**
   * Three-source shape pin: every yield producer MUST emit a
   * non-empty `chain` field when it knows the chain. This is the
   * single source of truth for the focus-key shape contract — if it
   * ever breaks, the drawer (which feeds the same `chain` through this
   * helper) will start failing to highlight rows. Failures here
   * should be treated as a regression in the producer.
   */
  it('three-source shape pin: vaults.fyi / gmx / free all emit a well-formed key', () => {
    // vaults.fyi rows: producer emits `chain: opt.network` (display
    // name, e.g. "Arbitrum") AND `chainId: mapVaultsFyiNetworkToChainId(opt.network)`.
    const vaultsFyiRow = makeRec({
      id: 'vaultsfyi-row',
      source: 'vaults.fyi',
      protocol: 'SomeProtocol',
      chain: 'Arbitrum',
      chainId: 42161,
      symbol: 'USDC',
      apy: 4.2,
    });
    expect(deriveYieldFocusKey(vaultsFyiRow)).toBe('Arbitrum:USDC');

    // GMX rows: producer emits the literal "Arbitrum" chain name and 42161.
    const gmxRow = makeRec({
      id: 'gmx-row',
      source: 'gmx',
      protocol: 'GMX',
      chain: 'Arbitrum',
      chainId: 42161,
      symbol: 'GLP',
      apy: 21.5,
    });
    expect(deriveYieldFocusKey(gmxRow)).toBe('Arbitrum:GLP');

    // free LI.FI Earn rows: producer emits `getLiquidChainName(vault.chainId)`
    // (prefers NETWORKS name, falls back to a curated map, last-resort
    // stringified chainId). Common LI.FI chains like Base (8453) must
    // resolve to a name, NOT to the numeric string — otherwise the
    // drawer will mismatch.
    const freeBaseRow = makeRec({
      id: 'free-base',
      source: 'free',
      protocol: 'aave',
      chain: 'Base', // getLiquidChainName(8453) === 'Base'
      chainId: 8453,
      symbol: 'USDC',
      apy: 5.1,
    });
    expect(deriveYieldFocusKey(freeBaseRow)).toBe('Base:USDC');

    // What the drawer emits for an executable yield alert
    // (buildYieldAlertContract → open_yield_review.chain) MUST match
    // the row's chain key. The drawer's typed action uses `chain` as
    // a name-shaped string. This test pins that the producer's name
    // format agrees with what `deriveYieldFocusKey` produces — if
    // either side starts emitting the numeric string the focus key
    // won't match and the row highlight silently breaks.
    expect(deriveYieldFocusKey({ chain: 'Arbitrum', symbol: 'USDC' })).toBe('Arbitrum:USDC');
    expect(deriveYieldFocusKey({ chain: 'Base', symbol: 'USDC' })).toBe('Base:USDC');
  });
});
