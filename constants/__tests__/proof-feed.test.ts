import { describe, expect, it } from 'vitest';
import {
  getLedgerFreshnessLabel,
  getLedgerProofLabel,
  getLedgerProofTitle,
} from '../proof-feed';

describe('proof-feed copy', () => {
  it('labels mainnet chains for user-facing proof copy', () => {
    expect(getLedgerProofLabel(42220)).toBe('Celo');
    expect(getLedgerProofLabel(42161)).toBe('Arbitrum');
    expect(getLedgerProofLabel(16661)).toBe('0G');
    expect(getLedgerProofLabel(177)).toBe('HashKey');
  });

  it('builds neutral mainnet titles', () => {
    expect(getLedgerProofTitle(42220)).toBe('Verified on Celo');
    expect(getLedgerProofTitle(42161)).toBe('Verified on Arbitrum');
    expect(getLedgerProofTitle(177)).toBe('Verified on HashKey');
  });

  it('labels testnet chains without implying mainnet', () => {
    expect(getLedgerProofTitle(16602)).toBe('Verified ledger · 0G testnet');
    expect(getLedgerFreshnessLabel(16602, false)).toBe('Live · 0G testnet');
  });
});
