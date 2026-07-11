import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { GmxGmDepositStrategy } from '../gmx-gm-deposit.strategy';
import { getGmxAddresses } from '../../gmx/gmx-config';
import { computeMinMarketTokens } from '../../gmx/gmx-deposit-quote';
import { ethers } from 'ethers';

const base = {
  fromToken: 'USDC',
  toToken: 'GM',
  amount: '100',
  fromChainId: 42161,
  toChainId: 42161,
  userAddress: '0xdd6204dd1b7e0311e184dbe458dcc268715ea061',
};

describe('GmxGmDepositStrategy.supports (gated)', () => {
  const orig = process.env.GMX_GM_DEPOSIT_ENABLED;
  afterEach(() => { process.env.GMX_GM_DEPOSIT_ENABLED = orig; });

  it('is OFF by default (feature-flag gated) — never routes unless enabled', () => {
    delete process.env.GMX_GM_DEPOSIT_ENABLED;
    expect(new GmxGmDepositStrategy().supports(base as any)).toBe(false);
  });

  it('supports USDC→GM on Arbitrum when enabled', () => {
    process.env.GMX_GM_DEPOSIT_ENABLED = 'true';
    expect(new GmxGmDepositStrategy().supports(base as any)).toBe(true);
  });

  it('rejects non-Arbitrum, non-USDC, or non-GM requests', () => {
    process.env.GMX_GM_DEPOSIT_ENABLED = 'true';
    const s = new GmxGmDepositStrategy();
    expect(s.supports({ ...base, fromChainId: 42220, toChainId: 42220 } as any)).toBe(false);
    expect(s.supports({ ...base, toToken: 'USDY' } as any)).toBe(false);
    expect(s.supports({ ...base, fromToken: 'PAXG' } as any)).toBe(false);
  });
});

describe('gmx-config', () => {
  it('has verified Arbitrum One + Sepolia addresses', () => {
    expect(getGmxAddresses(42161)?.exchangeRouter).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(getGmxAddresses(42161)?.router).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(getGmxAddresses(421614)?.depositVault).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(getGmxAddresses(1)).toBeNull();
  });

  it('computes a minMarketTokens slippage floor from GM price', () => {
    // 100 USDC (6dp) at GM price $2.00 (1e30) with 1% slippage → ~49.5 GM (18dp)
    const usdc = ethers.utils.parseUnits('100', 6);
    const gmPrice = ethers.BigNumber.from(2).mul(ethers.BigNumber.from(10).pow(30));
    const min = computeMinMarketTokens(usdc, 6, gmPrice, 100)!;
    expect(Number(ethers.utils.formatUnits(min, 18))).toBeCloseTo(49.5, 1);
  });

  it('returns null (no floor) when GM price is unknown — caller must refuse', () => {
    const usdc = ethers.utils.parseUnits('100', 6);
    expect(computeMinMarketTokens(usdc, 6, null, 100)).toBeNull();
  });
});
