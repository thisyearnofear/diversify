import { describe, expect, it, vi } from 'vitest';
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
      provider: 'typesafe',
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
});
