/**
 * wallet-auth — session-proof cache + signing-prompt dedupe.
 *
 * Concurrent authed fetches must share ONE signature request: without
 * dedupe, two mount-time callers each pop a wallet prompt before either
 * writes the sessionStorage cache (the FX-netting card bug).
 */

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildWalletAuthMessage,
  getCachedWalletAuth,
  getWalletAuthHeaders,
} from '../wallet-auth';

const ADDR = `0x${'b'.repeat(40)}`;

beforeEach(() => sessionStorage.clear());

describe('getWalletAuthHeaders', () => {
  it('signs once and caches the proof for the session', async () => {
    const signMessage = vi.fn(async () => '0xsig');
    const headers = await getWalletAuthHeaders(ADDR, signMessage);
    expect(signMessage).toHaveBeenCalledTimes(1);
    expect(headers?.['X-Wallet-Auth-Signature']).toBe('0xsig');
    expect(getCachedWalletAuth(ADDR)).not.toBeNull();

    // Second call reads the cache — no new prompt.
    await getWalletAuthHeaders(ADDR, signMessage);
    expect(signMessage).toHaveBeenCalledTimes(1);
  });

  it('concurrent callers share one in-flight signature request', async () => {
    const deferred = { resolve: null as null | ((sig: string) => void) };
    const signMessage = vi.fn(
      () => new Promise<string>((res) => { deferred.resolve = res; }),
    );

    const p1 = getWalletAuthHeaders(ADDR, signMessage);
    const p2 = getWalletAuthHeaders(ADDR, signMessage);

    // Let both callers park on the shared sign promise, then resolve it.
    await Promise.resolve();
    deferred.resolve?.('0xsharedsig');

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(signMessage).toHaveBeenCalledTimes(1);
    expect(r1?.['X-Wallet-Auth-Signature']).toBe('0xsharedsig');
    expect(r2?.['X-Wallet-Auth-Signature']).toBe('0xsharedsig');
  });

  it('returns null without a signer and without a cached proof', async () => {
    expect(await getWalletAuthHeaders(ADDR)).toBeNull();
  });

  it('drops expired proofs from the cache', async () => {
    // Craft an already-expired message.
    const expired = {
      address: ADDR,
      issuedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      purpose: 'session',
    };
    sessionStorage.setItem(
      `diversifi-wallet-auth:${ADDR}`,
      JSON.stringify({
        message: `DiversiFi wallet session\n${JSON.stringify(expired)}`,
        signature: '0xold',
      }),
    );
    expect(getCachedWalletAuth(ADDR)).toBeNull();
    expect(await getWalletAuthHeaders(ADDR)).toBeNull();
  });
});

describe('buildWalletAuthMessage', () => {
  it('embeds the lowercased address and a 15-minute window', () => {
    const msg = buildWalletAuthMessage(`0x${'B'.repeat(40)}`, 1000);
    expect(msg).toContain(ADDR);
    expect(msg).toContain(new Date(1000 + 15 * 60 * 1000).toISOString());
  });
});
