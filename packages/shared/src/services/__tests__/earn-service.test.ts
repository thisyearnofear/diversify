import { describe, expect, it } from 'vitest';
import { EarnService, type EarnVault } from '../earn-service';

const buildVault = (overrides: Partial<EarnVault>): EarnVault => ({
  id: overrides.id || 'vault-1',
  chainId: overrides.chainId || 8453,
  protocol: overrides.protocol || 'aave',
  vaultAddress: overrides.vaultAddress || '0xvault',
  name: overrides.name || 'Test Vault',
  asset: overrides.asset || { address: '0xasset', symbol: 'USDC', decimals: 6 },
  apy: overrides.apy ?? 8,
  tvl: overrides.tvl ?? 100_000,
  status: overrides.status || 'active',
  categories: overrides.categories || ['stablecoins'],
  risk: overrides.risk || 'low',
  description: overrides.description || 'desc',
});

describe('EarnService.rankVaultsForRecommendation', () => {
  it('filters out deprecated, low-liquidity and non-positive APY vaults', () => {
    const ranked = EarnService.rankVaultsForRecommendation([
      buildVault({ id: 'good', apy: 9, tvl: 120_000, status: 'active' }),
      buildVault({ id: 'deprecated', apy: 15, tvl: 500_000, status: 'deprecated' }),
      buildVault({ id: 'tiny-tvl', apy: 20, tvl: 1_000, status: 'active' }),
      buildVault({ id: 'zero-apy', apy: 0, tvl: 300_000, status: 'active' }),
    ]);

    expect(ranked.map(v => v.id)).toEqual(['good']);
  });

  it('prefers lower risk when APY and TVL are similar', () => {
    const ranked = EarnService.rankVaultsForRecommendation([
      buildVault({ id: 'high-risk', risk: 'high', apy: 12, tvl: 1_200_000 }),
      buildVault({ id: 'medium-risk', risk: 'medium', apy: 11.8, tvl: 1_100_000 }),
      buildVault({ id: 'low-risk', risk: 'low', apy: 11.5, tvl: 1_000_000 }),
    ], {
      allowedRisk: ['low', 'medium', 'high'],
    });

    expect(ranked.map(v => v.id)).toEqual(['low-risk', 'medium-risk', 'high-risk']);
  });

  it('respects maxResults and keeps deterministic ordering on ties', () => {
    const ranked = EarnService.rankVaultsForRecommendation([
      buildVault({ id: 'c', apy: 10, tvl: 1_000_000 }),
      buildVault({ id: 'a', apy: 10, tvl: 2_000_000 }),
      buildVault({ id: 'b', apy: 10, tvl: 1_500_000 }),
    ], {
      maxResults: 2,
    });

    expect(ranked.map(v => v.id)).toEqual(['a', 'b']);
  });
});