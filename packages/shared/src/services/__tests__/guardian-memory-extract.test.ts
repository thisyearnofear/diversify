/**
 * Tests for extractGuardianFacts — the post-reply, opt-in fact extractor.
 *
 * The model call is mocked; the real contract here is the server-side
 * post-filter: secret-shaped output is rejected regardless of what the
 * model returned, facts dedupe case-insensitively against what is already
 * stored, and the cap is 2 per reply.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockChat = vi.fn(async () => ({
  data: '{"facts": []}',
  provider: 'mock',
  modelUsed: 'mock',
}));

vi.mock('../ai/ai-service', () => ({
  generateChatCompletion: (...a: any[]) => (mockChat as any)(...a),
}));

import {
  extractGuardianFacts,
  looksLikeSecret,
  sanitizeExtractedFacts,
} from '../guardian-memory-extract';

beforeEach(() => {
  vi.clearAllMocks();
  mockChat.mockResolvedValue({ data: '{"facts": []}', provider: 'mock', modelUsed: 'mock' });
});

describe('extractGuardianFacts', () => {
  it('returns model-suggested facts for a normal exchange', async () => {
    mockChat.mockResolvedValue({
      data: '{"facts": ["You pay a supplier in USD monthly", "You save in KES"]}',
      provider: 'mock',
      modelUsed: 'mock',
    });
    const facts = await extractGuardianFacts('remember that I pay my supplier in USD', 'Noted.');
    expect(facts).toEqual(['You pay a supplier in USD monthly', 'You save in KES']);
    expect(mockChat).toHaveBeenCalledWith(
      expect.objectContaining({ temperature: 0.2, maxTokens: 150 }),
    );
  });

  it('passes [] through unchanged', async () => {
    expect(await extractGuardianFacts('hi', 'hello')).toEqual([]);
  });

  it('fails soft to [] when the model errors or returns junk', async () => {
    mockChat.mockRejectedValueOnce(new Error('llm down'));
    expect(await extractGuardianFacts('m', 'r')).toEqual([]);
    mockChat.mockResolvedValueOnce({ data: 'not json', provider: 'mock', modelUsed: 'mock' });
    expect(await extractGuardianFacts('m', 'r')).toEqual([]);
  });
});

describe('sanitizeExtractedFacts', () => {
  it('rejects seed phrases, private keys and account numbers', () => {
    expect(
      sanitizeExtractedFacts([
        'witch collapse practice feed shame open despair creek road again ice legal',
        `key is 0x${'a'.repeat(64)}`,
        'account 4111 1111 1111 1111',
      ]),
    ).toEqual([]);
  });

  it('dedupes case-insensitively against existing facts and within the batch', () => {
    const out = sanitizeExtractedFacts(
      ['You SAVE in usd', 'You pay in USD monthly', 'you pay in usd monthly'],
      ['you save in USD'],
    );
    expect(out).toEqual(['You pay in USD monthly']);
  });

  it('caps at two facts and 140 chars each', () => {
    const long = 'x'.repeat(200);
    const out = sanitizeExtractedFacts(['one', 'two', 'three', long]);
    expect(out).toHaveLength(2);
    expect(sanitizeExtractedFacts([long])[0]).toHaveLength(140);
  });

  it('strips control characters and normalises whitespace', () => {
    expect(sanitizeExtractedFacts(['  pay\tsupplier \n in USD '])).toEqual(['pay supplier in USD']);
  });
});

describe('looksLikeSecret', () => {
  it('flags seed/key/account shapes only', () => {
    expect(looksLikeSecret('witch collapse practice feed shame open despair creek road again ice legal')).toBe(true);
    expect(looksLikeSecret(`0x${'f'.repeat(64)}`)).toBe(true);
    expect(looksLikeSecret('card 4111-1111-1111-1111')).toBe(true);
    expect(looksLikeSecret('You pay a supplier in USD monthly')).toBe(false);
    expect(looksLikeSecret('0xabc123')).toBe(false);
  });
});
