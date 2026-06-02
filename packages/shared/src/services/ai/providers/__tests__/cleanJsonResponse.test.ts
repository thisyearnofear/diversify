import { describe, expect, it } from 'vitest';
import { BaseAIProvider } from '../base-ai-provider';

/**
 * Tests for cleanJsonResponse. The method is `protected` on BaseAIProvider;
 * we expose it via a tiny test-only subclass so we don't have to change the
 * production surface.
 */
class TestProvider extends BaseAIProvider {
  constructor() {
    super({ veniceApiKey: 'test' });
  }
  async initialize() {}
  isAvailable() { return true; }
  async generateChatCompletion() { return {} as any; }
  async generateSpeech() { return {} as any; }
  async transcribeAudio() { return {} as any; }
  getName() { return 'test'; }
  // Expose the protected method for testing.
  clean(input: string) { return (this as any).cleanJsonResponse(input); }
}

const t = new TestProvider();
const clean = (s: string) => t.clean(s);

describe('cleanJsonResponse', () => {
  describe('objects', () => {
    it('returns a bare object unchanged', () => {
      const obj = '{"action":"HOLD","confidence":0.8}';
      expect(clean(obj)).toBe(obj);
    });

    it('strips leading prose before the JSON', () => {
      const result = clean('Here is the analysis: {"action":"SWAP","confidence":0.7}');
      expect(JSON.parse(result)).toEqual({ action: 'SWAP', confidence: 0.7 });
    });

    it('strips trailing prose after the JSON', () => {
      const result = clean('{"action":"HOLD","confidence":0.6}\n\nLet me know if you need more.');
      expect(JSON.parse(result)).toEqual({ action: 'HOLD', confidence: 0.6 });
    });

    it('handles a markdown code fence', () => {
      const fenced = '```json\n{"action":"REBALANCE","confidence":0.9}\n```';
      expect(JSON.parse(clean(fenced))).toEqual({ action: 'REBALANCE', confidence: 0.9 });
    });

    it('handles a markdown code fence without the language tag', () => {
      const fenced = '```\n{"action":"HOLD"}\n```';
      expect(JSON.parse(clean(fenced))).toEqual({ action: 'HOLD' });
    });
  });

  describe('arrays (post-36d1dc7 support)', () => {
    it('returns a top-level array unchanged', () => {
      const arr = '[{"action":"HOLD","confidence":0.7},{"action":"SWAP","confidence":0.6}]';
      expect(clean(arr)).toBe(arr);
    });

    it('strips leading prose before an array', () => {
      const result = clean('Here are options: [{"action":"HOLD"}]');
      expect(JSON.parse(result)).toEqual([{ action: 'HOLD' }]);
    });

    it('strips trailing prose after an array', () => {
      const result = clean('[{"action":"HOLD"}] - hope this helps');
      expect(JSON.parse(result)).toEqual([{ action: 'HOLD' }]);
    });

    it('prefers array when present, even if an object also appears in the response', () => {
      // The '[' of the array must be detected first, regardless of '{' position.
      const result = clean('note: see [{"action":"HOLD"}] and {"action":"SWAP"} for context');
      expect(JSON.parse(result)).toEqual([{ action: 'HOLD' }]);
    });

    it('handles a markdown-fenced array', () => {
      const result = clean('```json\n[{"action":"HOLD","confidence":0.7}]\n```');
      expect(JSON.parse(result)).toEqual([{ action: 'HOLD', confidence: 0.7 }]);
    });
  });

  describe('edge cases', () => {
    it('returns empty string for empty input', () => {
      expect(clean('')).toBe('');
    });

    it('returns the trimmed input as a last resort when no JSON is present', () => {
      // The bare-string fallback exists so downstream code never crashes on
      // completely malformed input. We pin that behavior here.
      const result = clean('Sorry, I cannot help with that.');
      expect(result).toBe('Sorry, I cannot help with that.');
    });

    it('handles nested objects without losing the outer braces', () => {
      const obj = '{"a":{"b":{"c":1}},"d":2}';
      expect(clean(obj)).toBe(obj);
    });

    it('handles deeply nested arrays', () => {
      // The current array-preference heuristic chooses the outer '[...]' over
      // the object. This is a known limitation (36d1dc7 only added array
      // support to handle the top-level array case from the intelligence
      // prompt). For nested arrays inside an object, the JSON parser will
      // reject the extracted substring and the caller falls back to the
      // original text. We pin the current behavior here.
      const arr = '[[1,2],[3,4]]';
      expect(clean(arr)).toBe(arr);
    });
  });
});
