/**
 * Streaks route — no gamified trading:
 *  - POST with a non-claim source is rejected (no streak extension).
 *  - POST claim still extends the streak.
 *  - PATCH swap on mainnet updates stats but awards no badge; the same
 *    action on testnet earns first-swap.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

vi.mock('../../lib/mongodb', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

// In-memory Streak store — enough of the mongoose shape for the route.
const store = vi.hoisted(() => ({
  docs: new Map<string, any>(),
  findOne: vi.fn(async ({ walletAddress }: any) => store.docs.get(walletAddress) ?? null),
}));

vi.mock('../../models/Streak', () => ({
  default: class Streak {
    [k: string]: any;
    static findOne = store.findOne;
    constructor(init: any) {
      Object.assign(this, init);
      this.achievements = this.achievements ?? [];
      this.crossChainActivity = this.crossChainActivity ?? {
        testnet: { totalSwaps: 0, totalClaims: 0, totalVolume: 0, chainsUsed: [], totalSimulations: 0, simulatedAlpha: 0 },
        mainnet: { totalSwaps: 0, totalClaims: 0, totalVolume: 0 },
        graduation: { isGraduated: false, testnetActionsBeforeGraduation: 0 },
      };
      store.docs.set(this.walletAddress, this);
    }
    toObject() {
      const { save, toObject, ...rest } = this;
      return rest;
    }
    async save() {
      return this;
    }
  },
}));

vi.mock('../../config', () => ({
  isTestnetChain: (id: number) => id === 11142220 || id === 5042,
  NETWORKS: {
    ARC_TESTNET: { chainId: 5042 },
    CELO_SEPOLIA: { chainId: 11142220 },
    CELO_MAINNET: { chainId: 42220 },
  },
}));

import handler from '@/pages/api/streaks/[address]';

const ADDR = '0x1111111111111111111111111111111111111111';

function res() {
  const r = {
    statusCode: 200,
    body: undefined as any,
    headers: {} as Record<string, string[]>,
    setHeader(k: string, v: any) {
      r.headers[k] = v;
      return r;
    },
    status(code: number) {
      r.statusCode = code;
      return r;
    },
    json(payload: unknown) {
      r.body = payload;
      return r;
    },
  };
  return r as unknown as NextApiResponse & { statusCode: number; body: any };
}

function req(method: string, body: any = {}) {
  return {
    method,
    query: { address: ADDR },
    body,
  } as unknown as NextApiRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  store.docs.clear();
});

describe('POST /api/streaks/[address]', () => {
  it('rejects a swap-source POST — real-money swaps earn no streak', async () => {
    const r = res();
    await handler(req('POST', { amountUSD: 50, source: 'swap' }), r);
    expect(r.statusCode).toBe(400);
    expect(r.body.error).toMatch(/swaps do not earn streak credit/i);
    expect(store.docs.size).toBe(0);
  });

  it('rejects a missing source the same way', async () => {
    const r = res();
    await handler(req('POST', { amountUSD: 50 }), r);
    expect(r.statusCode).toBe(400);
  });

  it('a claim still extends the streak', async () => {
    const r = res();
    await handler(req('POST', { amountUSD: 0.5, source: 'claim' }), r);
    expect(r.statusCode).toBe(200);
    expect(r.body.daysActive).toBe(1);
    expect(store.docs.get(ADDR).daysActive).toBe(1);
  });
});

describe('PATCH /api/streaks/[address] swap achievements', () => {
  it('mainnet swap updates stats but awards no badge', async () => {
    const r = res();
    await handler(
      req('PATCH', {
        action: 'swap',
        chainId: 42220, // Celo mainnet
        networkType: 'mainnet',
        usdValue: 100,
      }),
      r,
    );
    expect(r.statusCode).toBe(200);
    const doc = store.docs.get(ADDR);
    expect(doc.crossChainActivity.mainnet.totalSwaps).toBe(1);
    expect(doc.crossChainActivity.mainnet.totalVolume).toBe(100);
    expect(doc.achievements).not.toContain('first-swap');
    expect(r.body.newAchievements).toEqual([]);
  });

  it('testnet swap earns first-swap — practice is learning', async () => {
    const r = res();
    await handler(
      req('PATCH', {
        action: 'swap',
        chainId: 11142220, // Celo Sepolia
        networkType: 'testnet',
        usdValue: 5,
      }),
      r,
    );
    expect(r.statusCode).toBe(200);
    expect(store.docs.get(ADDR).achievements).toContain('first-swap');
    expect(r.body.newAchievements).toContain('first-swap');
  });
});
