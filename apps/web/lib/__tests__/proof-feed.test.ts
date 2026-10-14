/**
 * The proof-feed read set.
 *
 * This gate is the honesty boundary for testnet anchoring: the FX-move
 * pipeline can be demonstrated on free testnet gas, but a play-money record
 * must never be merged into the feed a real visitor reads — `getLedgerProofTitle`
 * would hand it a "verified" headline.
 */
import { describe, expect, it } from 'vitest';
import {
  PROOF_FEED_CHAIN_IDS,
  PROOF_FEED_TESTNET_CHAIN_IDS,
  proofFeedChainIds,
  getLedgerProofTitle,
  getLedgerProofLabel,
} from '@/constants/proof-feed';

const ARBITRUM_MAINNET = 42161;
const CELO_MAINNET = 42220;
const ARBITRUM_SEPOLIA = 421614;

describe('proofFeedChainIds', () => {
  it('reads mainnet rails only in production', () => {
    const ids = proofFeedChainIds('production');
    expect(ids).toEqual([...PROOF_FEED_CHAIN_IDS]);
    for (const testnet of PROOF_FEED_TESTNET_CHAIN_IDS) {
      expect(ids).not.toContain(testnet);
    }
  });

  it('adds testnet rails outside production', () => {
    for (const env of ['development', 'test', undefined]) {
      const ids = proofFeedChainIds(env);
      expect(ids).toContain(ARBITRUM_SEPOLIA);
      // …without dropping any mainnet rail.
      for (const mainnet of PROOF_FEED_CHAIN_IDS) expect(ids).toContain(mainnet);
    }
  });

  it('never duplicates a chain id', () => {
    const ids = proofFeedChainIds('development');
    expect(ids).toHaveLength(new Set(ids).size);
  });

  it('only ever lists a testnet that actually has a deployed ledger', () => {
    // Celo Sepolia has no entry in the ledger service's chain registry, so it
    // must not appear here — a rail that can never be read is dead weight.
    expect([...PROOF_FEED_TESTNET_CHAIN_IDS]).toEqual([ARBITRUM_SEPOLIA]);
  });
});

describe('testnet provenance stays distinguishable', () => {
  it('does not give a testnet record the confident "Verified on X" headline', () => {
    expect(getLedgerProofTitle(ARBITRUM_MAINNET)).toBe('Verified on Arbitrum');
    expect(getLedgerProofTitle(CELO_MAINNET)).toBe('Verified on Celo');
    expect(getLedgerProofTitle(ARBITRUM_SEPOLIA)).toBe('Verified ledger · Arbitrum Sepolia');
    expect(getLedgerProofTitle(ARBITRUM_SEPOLIA)).not.toContain('Verified on');
  });

  it('labels the testnet rail by name, not as a generic ledger', () => {
    expect(getLedgerProofLabel(ARBITRUM_SEPOLIA)).toBe('Arbitrum Sepolia');
  });
});
