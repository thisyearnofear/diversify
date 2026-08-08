// @vitest-environment jsdom

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { NETWORKS } from '@/config';
import {
  hasTestnetOptIn,
  isAppTestnetChain,
  optIntoTestnetUi,
  shouldShowTestnetBanner,
  TESTNET_OPT_IN_KEY,
} from '../testnet';

describe('testnet helpers', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SHOW_TESTNET', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('detects configured testnet chain ids', () => {
    expect(isAppTestnetChain(NETWORKS.ARC_TESTNET.chainId)).toBe(true);
    expect(isAppTestnetChain(NETWORKS.CELO_MAINNET.chainId)).toBe(false);
  });

  it('hides testnet banner without opt-in in production', () => {
    expect(hasTestnetOptIn()).toBe(false);
    expect(
      shouldShowTestnetBanner(NETWORKS.ARC_TESTNET.chainId),
    ).toBe(false);
  });

  it('shows testnet banner after explicit opt-in', () => {
    optIntoTestnetUi();
    expect(localStorage.getItem(TESTNET_OPT_IN_KEY)).toBe('true');
    expect(shouldShowTestnetBanner(NETWORKS.CELO_SEPOLIA.chainId)).toBe(true);
  });

  it('shows testnet UI when NEXT_PUBLIC_SHOW_TESTNET is set', () => {
    vi.stubEnv('NEXT_PUBLIC_SHOW_TESTNET', 'true');
    expect(hasTestnetOptIn()).toBe(true);
    expect(shouldShowTestnetBanner(NETWORKS.RH_TESTNET.chainId)).toBe(true);
  });
});
