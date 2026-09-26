/**
 * Tests for the daily-question gate in POST /api/agent/advisor.
 *
 * advisor-core is mocked (no LLM); AgentUsage's consumeQuestion is mocked
 * while resolveSubject stays real so wallet-vs-IP subject selection is
 * exercised.
 */

// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  consumeQuestion: vi.fn(),
  runConversation: vi.fn(async () => ({ response: 'ok', action: null })),
  runAnalysis: vi.fn(async () => ({ ok: true })),
  runStream: vi.fn(),
}));

vi.mock('@/lib/agent/advisor-core', () => ({
  runAdvisorConversation: mocks.runConversation,
  runAdvisorAnalysis: mocks.runAnalysis,
  runAdvisorConversationStream: mocks.runStream,
}));

vi.mock('@/models/AgentUsage', async (importActual) => {
  const actual = await importActual<typeof import('@/models/AgentUsage')>();
  return { ...actual, consumeQuestion: mocks.consumeQuestion };
});

import handler from '@/pages/api/agent/advisor';

const WALLET = '0xABC0000000000000000000000000000000000001';
const RESETS = '2026-01-02T00:00:00.000Z';

type ResMock = {
  statusCode?: number;
  body?: unknown;
  headers: Record<string, string>;
  written: string[];
  ended: boolean;
  setHeader: (k: string, v: string) => void;
  flushHeaders: () => void;
  write: (s: string) => void;
  end: () => void;
  status: (code: number) => ResMock;
  json: (b: unknown) => ResMock;
};

function makeRes(): ResMock {
  return {
    headers: {},
    written: [],
    ended: false,
    setHeader(k, v) { this.headers[k] = v; },
    flushHeaders() {},
    write(s) { this.written.push(s); },
    end() { this.ended = true; },
    status(code) { this.statusCode = code; return this; },
    json(b) { this.body = b; return this; },
  };
}

function req(body: Record<string, unknown> = {}, ip = '7.7.7.7') {
  return {
    method: 'POST',
    headers: { 'x-forwarded-for': ip },
    body,
    socket: { remoteAddress: ip },
  } as never;
}

function allow(remaining = 4, limit = 10) {
  mocks.consumeQuestion.mockResolvedValue({ allowed: true, remaining, limit, resetsAt: RESETS });
}

describe('advisor daily-question gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    allow();
  });

  it('consumes one question against the wallet subject and proceeds', async () => {
    const res = makeRes();
    await handler(req({ message: 'hi', address: WALLET }), res as never);
    expect(mocks.consumeQuestion).toHaveBeenCalledWith(`wallet:${WALLET.toLowerCase()}`, 'wallet');
    expect(mocks.runConversation).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it('falls back to the client IP subject when no wallet is present', async () => {
    const res = makeRes();
    await handler(req({ message: 'hi' }), res as never);
    expect(mocks.consumeQuestion).toHaveBeenCalledWith('ip:7.7.7.7', 'ip');
  });

  it('returns 429 daily_questions_exhausted when the allowance is spent', async () => {
    mocks.consumeQuestion.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      limit: 13,
      resetsAt: RESETS,
    });
    const res = makeRes();
    await handler(req({ message: 'hi', address: WALLET }), res as never);
    expect(res.statusCode).toBe(429);
    expect(res.body).toMatchObject({
      error: 'daily_questions_exhausted',
      remaining: 0,
      limit: 13,
      resetsAt: RESETS,
    });
    expect(mocks.runConversation).not.toHaveBeenCalled();
  });

  it('returns the same 429 before opening an SSE stream', async () => {
    mocks.consumeQuestion.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      limit: 3,
      resetsAt: RESETS,
    });
    const res = makeRes();
    await handler(req({ message: 'hi', stream: true }), res as never);
    expect(res.statusCode).toBe(429);
    expect((res.body as any).error).toBe('daily_questions_exhausted');
    // never entered the streaming path
    expect(res.headers['Content-Type']).toBeUndefined();
    expect(mocks.runStream).not.toHaveBeenCalled();
  });

  it('skips counting for demo-mode requests', async () => {
    const res = makeRes();
    await handler(
      req({ message: 'hi', address: '0xDemo1234567890123456789012345678901234' }),
      res as never,
    );
    expect(mocks.consumeQuestion).not.toHaveBeenCalled();
    expect(mocks.runConversation).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it('fails open when the allowance store is down', async () => {
    mocks.consumeQuestion.mockRejectedValueOnce(new Error('mongo down'));
    const res = makeRes();
    await handler(req({ message: 'hi', address: WALLET }), res as never);
    expect(mocks.runConversation).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it('does not burn a question on malformed conversation requests', async () => {
    const res = makeRes();
    await handler(req({ address: WALLET }), res as never);
    expect(res.statusCode).toBe(400);
    expect(mocks.consumeQuestion).not.toHaveBeenCalled();
  });

  it('gates analysis mode too', async () => {
    const res = makeRes();
    await handler(req({ mode: 'analysis', address: WALLET }), res as never);
    expect(mocks.consumeQuestion).toHaveBeenCalled();
    expect(mocks.runAnalysis).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });
});
