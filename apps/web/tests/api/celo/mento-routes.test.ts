import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

// The handlers resolve everything through the Mento SDK service — mock the
// module boundary so no chain calls happen.
const ROUTER = '0x4861840C2EfB2b98312B0aE34d86fD73E8f9B6f6';
const mocks = vi.hoisted(() => ({
  findMentoRoute: vi.fn(async () => ({ id: 'route-1', tokens: [], path: [{}] })),
  quoteMento: vi.fn(async () => ({
    amountOut: 2_000_000_000_000_000_000n,
    hops: 1,
    costPercent: 0.3,
  })),
  getMentoRouterAddress: vi.fn(() => ROUTER),
  buildMentoSwap: vi.fn(async (): Promise<{
    approval: { to: string; data: string; value: string } | null;
    swap: { to: string; data: string; value: string };
    expectedAmountOut: bigint;
    amountOutMin: bigint;
    hops: number;
    spender: string;
    route: unknown;
  }> => ({
    approval: null,
    swap: { to: ROUTER, data: '0x12b34c', value: '0' },
    expectedAmountOut: 2_000_000_000_000_000_000n,
    amountOutMin: 1_980_000_000_000_000_000n,
    hops: 1,
    spender: ROUTER,
    route: {},
  })),
}));

vi.mock('@diversifi/shared/src/services/swap/mento-sdk.service', () => ({
  findMentoRoute: mocks.findMentoRoute,
  quoteMento: mocks.quoteMento,
  getMentoRouterAddress: mocks.getMentoRouterAddress,
  buildMentoSwap: mocks.buildMentoSwap,
}));

import quoteHandler from '@/pages/api/celo/mento-quote';
import swapHandler from '@/pages/api/celo/mento-swap';

function res() {
  const r = {
    statusCode: 200,
    body: undefined as unknown,
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/celo/mento-quote', () => {
  it('returns a quote with the Router as exchangeProvider and route id as exchangeId', async () => {
    const r = res();
    await quoteHandler(
      { method: 'GET', query: { tokenIn: 'cUSD', tokenOut: 'KESm', amount: '10' } } as unknown as NextApiRequest,
      r,
    );
    expect(r.statusCode).toBe(200);
    expect(r.body.success).toBe(true);
    expect(r.body.protocol).toBe('mento');
    expect(r.body.exchangeProvider).toBe(ROUTER);
    expect(r.body.exchangeId).toBe('route-1');
    expect(r.body.amountOut).toBe('2');
  });

  it('keeps the cUSD alias and 400s unknown tokens', async () => {
    const r = res();
    await quoteHandler(
      { method: 'GET', query: { tokenIn: 'NOPE', tokenOut: 'KESm' } } as unknown as NextApiRequest,
      r,
    );
    expect(r.statusCode).toBe(400);
  });

  it('404s when the SDK finds no route', async () => {
    mocks.findMentoRoute.mockRejectedValueOnce(new Error('No route found for pair'));
    const r = res();
    await quoteHandler(
      { method: 'GET', query: { tokenIn: 'CELO', tokenOut: 'KESm' } } as unknown as NextApiRequest,
      r,
    );
    expect(r.statusCode).toBe(404);
  });
});

describe('POST /api/celo/mento-swap', () => {
  const body = {
    tokenIn: 'cUSD',
    tokenOut: 'KESm',
    amount: '10',
    userAddress: '0x0000000000000000000000000000000000000001',
  };

  it('returns the swap transaction targeting the Mento Router', async () => {
    const r = res();
    await swapHandler({ method: 'POST', body } as unknown as NextApiRequest, r);
    expect(r.statusCode).toBe(200);
    expect(r.body.needsApproval).toBe(false);
    expect(r.body.transactions).toHaveLength(1);
    expect(r.body.transactions[0].to).toBe(ROUTER);
    expect(r.body.minAmountOut).toBe('1.98');
  });

  it('prepends the SDK approval transaction when one is needed', async () => {
    mocks.buildMentoSwap.mockResolvedValueOnce({
      approval: { to: '0x765DE816845861e75A25fCA122bb6898B8B1282a', data: '0x095ea7b3', value: '0' },
      swap: { to: ROUTER, data: '0x12b34c', value: '0' },
      expectedAmountOut: 2_000_000_000_000_000_000n,
      amountOutMin: 1_980_000_000_000_000_000n,
      hops: 1,
      spender: ROUTER,
      route: {},
    });
    const r = res();
    await swapHandler({ method: 'POST', body } as unknown as NextApiRequest, r);
    expect(r.body.needsApproval).toBe(true);
    expect(r.body.transactions).toHaveLength(2);
    expect(r.body.transactions[1].to).toBe(ROUTER);
  });

  it('400s without userAddress', async () => {
    const r = res();
    await swapHandler(
      { method: 'POST', body: { ...body, userAddress: undefined } } as unknown as NextApiRequest,
      r,
    );
    expect(r.statusCode).toBe(400);
  });
});
