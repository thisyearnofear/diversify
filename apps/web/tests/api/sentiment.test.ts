/**
 * /api/sentiment — the confidence poll's reads.
 *
 *  - GET without a code returns the public board: per-currency tallies,
 *    totals, dated — no session id required.
 *  - GET with a code keeps the per-currency shape (tally + yourVote).
 *  - An unknown code is rejected, not counted.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextApiRequest, NextApiResponse } from 'next';

vi.mock('../../lib/mongodb', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ allowed: true })),
  getClientIp: vi.fn(() => 'test'),
}));

const aggregateMock = vi.hoisted(() => vi.fn());
const findOneMock = vi.hoisted(() => vi.fn());

vi.mock('../../models/SentimentVote', () => ({
  SentimentVote: {
    aggregate: aggregateMock,
    findOne: () => ({ select: () => ({ lean: findOneMock }) }),
    findOneAndUpdate: vi.fn(),
  },
}));

import handler from '../../pages/api/sentiment';

function reqRes(method: string, query: Record<string, unknown> = {}, body?: unknown) {
  const req = { method, query, body } as unknown as NextApiRequest;
  const res: any = {
    statusCode: 0,
    body: undefined,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
    setHeader: vi.fn(),
    end: vi.fn(),
  };
  return {
    req,
    res: res as NextApiResponse & { statusCode: number; body: any },
  };
}

describe('/api/sentiment', () => {
  beforeEach(() => {
    aggregateMock.mockReset();
    findOneMock.mockReset();
    findOneMock.mockResolvedValue(null);
  });

  it('GET without a code returns the dated public board', async () => {
    aggregateMock.mockResolvedValue([
      { _id: 'NGN', sentiments: ['worried', 'worried', 'confident'] },
      { _id: 'KES', sentiments: ['neutral'] },
    ]);
    const { req, res } = reqRes('GET');
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.asOf).toBeTruthy();
    expect(res.body.rows).toHaveLength(2);
    // Sorted by total desc — NGN's three votes lead.
    expect(res.body.rows[0].code).toBe('NGN');
    expect(res.body.rows[0].total).toBe(3);
    expect(res.body.rows[0].tally).toEqual({
      confident: 1,
      neutral: 0,
      worried: 2,
    });
    expect(res.body.rows[1].code).toBe('KES');
    expect(res.body.rows[1].total).toBe(1);
  });

  it('GET with a code keeps the per-currency tally shape', async () => {
    // resultFor groups by sentiment, not by code.
    aggregateMock.mockResolvedValue([
      { _id: 'worried', count: 2 },
      { _id: 'confident', count: 1 },
    ]);
    const { req, res } = reqRes('GET', { code: 'ngn' });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.code).toBe('NGN');
    expect(res.body.total).toBe(3);
    expect(res.body.tally.worried).toBe(2);
    expect(res.body.yourVote).toBeNull();
  });

  it('GET with an unknown code is rejected', async () => {
    const { req, res } = reqRes('GET', { code: 'XXX' });
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });
});
