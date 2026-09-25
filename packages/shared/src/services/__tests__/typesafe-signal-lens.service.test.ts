import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { assessMacroSignalWithTypeSafe } from '../typesafe-signal-lens.service';

const input = {
  sourceUrl: 'https://example.com/policy',
  sourceSummary: 'Central bank update',
  changeContent: 'The central bank raised its policy rate by 50 basis points.',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('assessMacroSignalWithTypeSafe', () => {
  // .env.local may carry a real AI_GATEWAY_API_KEY — these tests exercise the
  // direct path explicitly, so neutralize it unless a test opts in via options.
  const savedGatewayKey = process.env.AI_GATEWAY_API_KEY;
  beforeEach(() => { delete process.env.AI_GATEWAY_API_KEY; });
  afterEach(() => {
    if (savedGatewayKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = savedGatewayKey;
  });

  it('does not call the vendor when disabled', async () => {
    const fetchImpl = vi.fn();

    const result = await assessMacroSignalWithTypeSafe(input, {
      enabled: false,
      apiKey: 'test-key',
      fetchImpl,
    });

    expect(result).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('sends only minimized public-source context and normalizes a valid assessment', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({
      model: 'jev-1.13.0',
      answers: {
        materiality: { type: 'noul', noul: 0.91 },
        category: { type: 'choice', choice: 'rate_hike', confidence: 0.88, probabilities: { rate_hike: 0.88 } },
        urgency: { type: 'choice', choice: 'review', confidence: 0.77, probabilities: { review: 0.77 } },
        source_quality: { type: 'score', score: 1.8, confidence: 0.82, probabilities: { '2': 0.8 } },
      },
    }));

    const result = await assessMacroSignalWithTypeSafe(input, {
      enabled: true,
      apiKey: 'test-key',
      fetchImpl,
    });

    expect(result).toMatchObject({
      provider: 'typesafe-direct',
      model: 'jev-1.13.0',
      materiality: 0.91,
      category: 'rate_hike',
      urgency: 'review',
      sourceQuality: 1.8,
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ Authorization: 'Bearer test-key' });
    expect(JSON.parse(String(init.body)).state).toEqual(input);
  });

  it('prefers Vercel AI Gateway when configured', async () => {
    const evaluateGateway = vi.fn().mockResolvedValue({
      modelId: 'typesafe-ai/jev',
      answers: {
        materiality: { type: 'boolean', probability: 0.94 },
        category: { type: 'choice', choice: 'rate_hike' },
        urgency: { type: 'choice', choice: 'review' },
        source_quality: { type: 'score', score: 1.6 },
      },
      providerMetadata: {
        typesafe: { confidence: { category: 0.89, urgency: 0.78, source_quality: 0.83 } },
      },
    });
    const fetchImpl = vi.fn();

    const result = await assessMacroSignalWithTypeSafe(input, {
      enabled: true,
      aiGatewayApiKey: 'gateway-key',
      apiKey: 'direct-key',
      evaluateGateway,
      fetchImpl,
    });

    expect(result).toMatchObject({
      provider: 'vercel-ai-gateway',
      model: 'typesafe-ai/jev',
      materiality: 0.94,
      category: 'rate_hike',
      categoryConfidence: 0.89,
    });
    expect(evaluateGateway).toHaveBeenCalledWith(expect.objectContaining({
      model: 'typesafe-ai/jev',
      state: input,
    }));
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('falls back to direct TypeSafe when Gateway fails', async () => {
    const evaluateGateway = vi.fn().mockRejectedValue(new Error('Gateway unavailable'));
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({
      model: 'jev-1.13.0',
      answers: {
        materiality: { type: 'noul', noul: 0.91 },
        category: { type: 'choice', choice: 'rate_hike', confidence: 0.88, probabilities: { rate_hike: 0.88 } },
        urgency: { type: 'choice', choice: 'review', confidence: 0.77, probabilities: { review: 0.77 } },
        source_quality: { type: 'score', score: 1.8, confidence: 0.82, probabilities: { '2': 0.8 } },
      },
    }));

    const result = await assessMacroSignalWithTypeSafe(input, {
      enabled: true,
      aiGatewayApiKey: 'gateway-key',
      apiKey: 'direct-key',
      evaluateGateway,
      fetchImpl,
    });

    expect(result?.provider).toBe('typesafe-direct');
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('skips Gateway and uses direct when evaluateGateway is not injected', async () => {
    // The shared package can't import ESM-only `ai` itself — callers inject
    // the evaluator. A key with no injection must degrade to direct, not throw.
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({
      model: 'jev-1.13.0',
      answers: {
        materiality: { type: 'noul', noul: 0.9 },
        category: { type: 'choice', choice: 'rate_cut', confidence: 0.8 },
        urgency: { type: 'choice', choice: 'monitor', confidence: 0.7 },
        source_quality: { type: 'score', score: 1.5, confidence: 0.75 },
      },
    }));

    const result = await assessMacroSignalWithTypeSafe(input, {
      enabled: true,
      aiGatewayApiKey: 'gateway-key',
      apiKey: 'direct-key',
      fetchImpl,
    });

    expect(result?.provider).toBe('typesafe-direct');
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('returns null for an invalid vendor response without affecting callers', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ model: 'jev-1.13.0', answers: {} }));

    await expect(assessMacroSignalWithTypeSafe(input, {
      enabled: true,
      apiKey: 'test-key',
      fetchImpl,
    })).resolves.toBeNull();
  });

  it('returns null when the vendor is unavailable', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: 'overloaded' }, 529));

    await expect(assessMacroSignalWithTypeSafe(input, {
      enabled: true,
      apiKey: 'test-key',
      fetchImpl,
    })).resolves.toBeNull();
  });

  it('stamps a measured durationMs on the gateway path', async () => {
    const nowSpy = vi.spyOn(Date, 'now')
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(1_750);
    const evaluateGateway = vi.fn().mockResolvedValue({
      modelId: 'typesafe-ai/jev',
      answers: {
        materiality: { type: 'boolean', probability: 0.94 },
        category: { type: 'choice', choice: 'rate_hike' },
        urgency: { type: 'choice', choice: 'review' },
        source_quality: { type: 'score', score: 1.6 },
      },
    });

    const result = await assessMacroSignalWithTypeSafe(input, {
      enabled: true,
      aiGatewayApiKey: 'gateway-key',
      evaluateGateway,
      fetchImpl: vi.fn(),
    });

    expect(result?.durationMs).toBe(750);
    nowSpy.mockRestore();
  });

  it('stamps a measured durationMs on the direct path', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(500);
    try {
      const fetchImpl = vi.fn(async () => {
        vi.advanceTimersByTime(700);
        return jsonResponse({
          model: 'jev-1.13.0',
          answers: {
            materiality: { type: 'noul', noul: 0.91 },
            category: { type: 'choice', choice: 'rate_hike', confidence: 0.88, probabilities: { rate_hike: 0.88 } },
            urgency: { type: 'choice', choice: 'review', confidence: 0.77, probabilities: { review: 0.77 } },
            source_quality: { type: 'score', score: 1.8, confidence: 0.82, probabilities: { '2': 0.8 } },
          },
        });
      });

      const result = await assessMacroSignalWithTypeSafe(input, {
        enabled: true,
        apiKey: 'test-key',
        fetchImpl,
      });

      expect(result?.durationMs).toBe(700);
    } finally {
      vi.useRealTimers();
    }
  });
});
