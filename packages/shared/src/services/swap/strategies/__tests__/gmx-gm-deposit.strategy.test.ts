import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { GmxGmDepositStrategy } from '../gmx-gm-deposit.strategy';
import { getGmxAddresses, getExecutionFeeWei } from '../../gmx/gmx-config';

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

  it('parses the execution fee to wei', () => {
    const orig = process.env.GMX_EXECUTION_FEE_ETH;
    process.env.GMX_EXECUTION_FEE_ETH = '0.002';
    expect(getExecutionFeeWei()).toBe('2000000000000000');
    process.env.GMX_EXECUTION_FEE_ETH = orig;
  });
});
