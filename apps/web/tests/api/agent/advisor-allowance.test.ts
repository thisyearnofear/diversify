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
import { mintDemoToken } from '@/lib/demo-token';

const WALLET = '0xABC0000000000000000000000000000000000001';
const RESETS = '2026-01-02T00:00:00.000Z';
const DEMO_MOCK_ADDRESS = '0xDemo1234567890123456789012345678901234';

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

  it('consumes the demo bucket (not the real allowance) for a minted demo token', async () => {
    const mint = mintDemoToken('7.7.7.7');
    expect(mint).not.toBeNull();
    const res = makeRes();
    await handler(
      req({ message: 'hi', address: DEMO_MOCK_ADDRESS, demoToken: mint!.token }),
      res as never,
    );
    expect(mocks.consumeQuestion).toHaveBeenCalledTimes(1);
    expect(mocks.consumeQuestion).toHaveBeenCalledWith('demo:7.7.7', 'demo');
    expect(mocks.runConversation).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it('no longer skips counting for the mock 0xDemo address alone', async () => {
    const res = makeRes();
    await handler(req({ message: 'hi', address: DEMO_MOCK_ADDRESS }), res as never);
    expect(mocks.consumeQuestion).toHaveBeenCalledWith('ip:7.7.7.7', 'ip');
  });

  it('no longer honors the client-asserted demo header or body flag', async () => {
    const res = makeRes();
    await handler(req({ message: 'hi', demo: true }), res as never);
    expect(mocks.consumeQuestion).toHaveBeenCalledWith('ip:7.7.7.7', 'ip');
  });

  it('falls back to the real gate for a forged or expired demo token', async () => {
    const res = makeRes();
    await handler(req({ message: 'hi', demoToken: `${Date.now() + 86400000}.deadbeef` }), res as never);
    expect(mocks.consumeQuestion).toHaveBeenCalledWith('ip:7.7.7.7', 'ip');
  });

  it('returns the sample-mode 429 when the demo bucket is spent', async () => {
    mocks.consumeQuestion.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      limit: 20,
      resetsAt: RESETS,
    });
    const mint = mintDemoToken('7.7.7.7')!;
    const res = makeRes();
    await handler(req({ message: 'hi', demoToken: mint.token }), res as never);
    expect(res.statusCode).toBe(429);
    expect((res.body as any).message).toMatch(/Sample questions/);
    expect(mocks.runConversation).not.toHaveBeenCalled();
  });

  it('a demo request falls through to the IP gate when the demo bucket store errors', async () => {
    mocks.consumeQuestion.mockRejectedValueOnce(new Error('mongo down'));
    const mint = mintDemoToken('7.7.7.7')!;
    const res = makeRes();
    await handler(req({ message: 'hi', demoToken: mint.token }), res as never);
    expect(mocks.consumeQuestion).toHaveBeenCalledTimes(2);
    expect(mocks.consumeQuestion).toHaveBeenNthCalledWith(2, 'ip:7.7.7.7', 'ip');
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

describe('advisor allowance echo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    allow();
  });

  function writtenEvents(res: ResMock): any[] {
    return res.written
      .join('')
      .split('\n\n')
      .filter((line) => line.startsWith('data: '))
      .map((line) => JSON.parse(line.slice(6)));
  }

  it('includes the post-consumption allowance in the non-stream response', async () => {
    const res = makeRes();
    await handler(req({ message: 'hi', address: WALLET }), res as never);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      allowance: { remaining: 4, limit: 10, resetsAt: RESETS },
    });
  });

  it('includes the allowance in the analysis response too', async () => {
    const res = makeRes();
    await handler(req({ mode: 'analysis', address: WALLET }), res as never);
    expect(res.body).toMatchObject({
      allowance: { remaining: 4, limit: 10, resetsAt: RESETS },
    });
  });

  it('attaches allowance to the done SSE event only — never to chunks', async () => {
    mocks.runStream.mockReturnValueOnce(
      (async function* () {
        yield { type: 'chunk', text: 'working…' };
        yield {
          type: 'done',
          response: 'ok',
          provider: 'mock',
          action: null,
          researchSources: [],
          memoryEnabled: false,
        };
      })(),
    );
    const res = makeRes();
    await handler(req({ message: 'hi', address: WALLET, stream: true }), res as never);
    const events = writtenEvents(res);
    const chunk = events.find((e) => e.type === 'chunk');
    const done = events.find((e) => e.type === 'done');
    expect(chunk).toBeDefined();
    expect('allowance' in chunk).toBe(false);
    expect(done.allowance).toEqual({ remaining: 4, limit: 10, resetsAt: RESETS });
  });

  it('echoes the demo bucket allowance for token-verified demo requests', async () => {
    const mint = mintDemoToken('7.7.7.7')!;
    const res = makeRes();
    await handler(req({ message: 'hi', demoToken: mint.token }), res as never);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      allowance: { remaining: 4, limit: 10, resetsAt: RESETS },
    });
    expect(mocks.consumeQuestion).toHaveBeenCalledWith('demo:7.7.7', 'demo');
  });

  it('sends no allowance when the gate fails open', async () => {
    mocks.consumeQuestion.mockRejectedValueOnce(new Error('mongo down'));
    const res = makeRes();
    await handler(req({ message: 'hi', address: WALLET }), res as never);
    expect(res.statusCode).toBe(200);
    expect('allowance' in (res.body as any)).toBe(false);
  });
});
