// @vitest-environment jsdom
/**
 * guardian-memory — opt-in memory helpers: per-scope preference keys,
 * device-fact storage (12-fact cap, 30-day pruning), sanitisation, and the
 * `memory` request payload for advisor calls.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  addDeviceFacts,
  buildNewFacts,
  clearDeviceFacts,
  GUARDIAN_FACT_MAX,
  GUARDIAN_FACT_MAX_CHARS,
  GUARDIAN_FACT_TTL_MS,
  loadDeviceFacts,
  loadMemoryPreference,
  memoryFactsKeyFor,
  memoryPreferenceKeyFor,
  memoryRequestFor,
  pruneExpiredFacts,
  removeDeviceFact,
  sanitizeFactText,
  saveDeviceFacts,
  saveMemoryPreference,
  type GuardianFact,
} from '../guardian-memory';

const ADDR = '0xAbC0000000000000000000000000000000000001';

function fact(text: string, createdAt = new Date().toISOString()): GuardianFact {
  return { id: `id-${text.slice(0, 8)}`, text, createdAt };
}

beforeEach(() => {
  localStorage.clear();
});

describe('storage keys are scoped per wallet or anon', () => {
  it('lowercases the address and falls back to anon', () => {
    expect(memoryPreferenceKeyFor(ADDR)).toBe('diversifi.guardian.memory.0xabc0000000000000000000000000000000000001');
    expect(memoryFactsKeyFor(undefined)).toBe('diversifi.guardian.memory.facts.anon');
    expect(memoryFactsKeyFor(null)).toBe('diversifi.guardian.memory.facts.anon');
  });
});

describe('preference storage', () => {
  it('defaults to off', () => {
    expect(loadMemoryPreference(ADDR)).toEqual({ mode: 'off' });
  });

  it('round-trips a cloud preference with provider', () => {
    saveMemoryPreference(ADDR, { mode: 'cloud', provider: 'tablestore' });
    expect(loadMemoryPreference(ADDR)).toEqual({ mode: 'cloud', provider: 'tablestore' });
  });

  it('keeps scopes separate per wallet', () => {
    saveMemoryPreference(ADDR, { mode: 'device' });
    saveMemoryPreference('0xdef0000000000000000000000000000000000002', { mode: 'cloud', provider: 'cognee' });
    expect(loadMemoryPreference(ADDR)).toEqual({ mode: 'device' });
    expect(loadMemoryPreference('0xdef0000000000000000000000000000000000002')).toEqual({
      mode: 'cloud',
      provider: 'cognee',
    });
    expect(loadMemoryPreference(undefined)).toEqual({ mode: 'off' });
  });

  it('survives corrupt JSON and unknown modes/providers', () => {
    localStorage.setItem(memoryPreferenceKeyFor(ADDR), '{nope');
    expect(loadMemoryPreference(ADDR)).toEqual({ mode: 'off' });
    localStorage.setItem(memoryPreferenceKeyFor(ADDR), JSON.stringify({ mode: 'everything', provider: 's3' }));
    expect(loadMemoryPreference(ADDR)).toEqual({ mode: 'off' });
  });
});

describe('sanitizeFactText', () => {
  it('strips control characters, normalises whitespace, caps length', () => {
    expect(sanitizeFactText('  pay\t supplier\nin  USD ')).toBe('pay supplier in USD');
    expect(sanitizeFactText('a'.repeat(200))).toHaveLength(GUARDIAN_FACT_MAX_CHARS);
    expect(sanitizeFactText('')).toBe('');
    expect(sanitizeFactText(42)).toBe('');
  });
});

describe('buildNewFacts', () => {
  it('sanitises, dedupes case-insensitively, caps at the fact max', () => {
    const existing = [fact('You save in USD')];
    const added = buildNewFacts(
      ['  you SAVE in usd ', 'You pay a supplier in USD', ''],
      existing,
    );
    expect(added.map((f) => f.text)).toEqual(['You pay a supplier in USD']);
  });

  it('never exceeds the 12-fact cap including existing', () => {
    const existing = Array.from({ length: GUARDIAN_FACT_MAX }, (_, i) => fact(`e${i}`));
    expect(buildNewFacts(['new fact'], existing)).toEqual([]);
  });

  it('assigns unique ids and ISO timestamps', () => {
    const added = buildNewFacts(['one', 'two']);
    expect(added).toHaveLength(2);
    expect(new Set(added.map((f) => f.id)).size).toBe(2);
    expect(Date.parse(added[0].createdAt)).not.toBeNaN();
  });
});

describe('30-day expiry', () => {
  it('prunes facts older than the TTL and invalid dates', () => {
    const now = Date.now();
    const fresh = fact('fresh', new Date(now - 1000).toISOString());
    const stale = fact('stale', new Date(now - GUARDIAN_FACT_TTL_MS - 1).toISOString());
    const broken = fact('broken', 'not-a-date');
    expect(pruneExpiredFacts([fresh, stale, broken], now)).toEqual([fresh]);
  });

  it('prunes on read and rewrites storage', () => {
    const now = Date.now();
    saveDeviceFacts(ADDR, [
      fact('fresh', new Date(now).toISOString()),
      fact('stale', new Date(now - GUARDIAN_FACT_TTL_MS - 1).toISOString()),
    ]);
    const loaded = loadDeviceFacts(ADDR);
    expect(loaded.map((f) => f.text)).toEqual(['fresh']);
    // The stale entry is gone from storage, not just from this read.
    expect(JSON.parse(localStorage.getItem(memoryFactsKeyFor(ADDR))!)).toHaveLength(1);
  });
});

describe('device fact storage', () => {
  it('adds, loads, removes and clears per scope', () => {
    const added = addDeviceFacts(['You pay a supplier in USD'], ADDR);
    expect(added).toHaveLength(1);
    expect(loadDeviceFacts(ADDR)).toEqual(added);
    expect(loadDeviceFacts('0xdef0000000000000000000000000000000000002')).toEqual([]);

    const remaining = removeDeviceFact(added[0].id, ADDR);
    expect(remaining).toEqual([]);
    expect(loadDeviceFacts(ADDR)).toEqual([]);

    addDeviceFacts(['a'], ADDR);
    clearDeviceFacts(ADDR);
    expect(loadDeviceFacts(ADDR)).toEqual([]);
  });

  it('caps stored facts at 12', () => {
    addDeviceFacts(Array.from({ length: 15 }, (_, i) => `fact ${i}`), ADDR);
    expect(loadDeviceFacts(ADDR)).toHaveLength(GUARDIAN_FACT_MAX);
  });
});

describe('memoryRequestFor', () => {
  it('device mode sends the stored fact texts', () => {
    addDeviceFacts(['You save in USD'], ADDR);
    expect(memoryRequestFor({ mode: 'device' }, ADDR)).toEqual({
      mode: 'device',
      facts: ['You save in USD'],
    });
  });

  it('cloud mode sends the provider, never facts or an address', () => {
    expect(memoryRequestFor({ mode: 'cloud', provider: 'cognee' }, ADDR)).toEqual({
      mode: 'cloud',
      provider: 'cognee',
    });
  });

  it('off and cloud-without-provider degrade to off', () => {
    expect(memoryRequestFor({ mode: 'off' }, ADDR)).toEqual({ mode: 'off' });
    expect(memoryRequestFor({ mode: 'cloud' }, ADDR)).toEqual({ mode: 'off' });
  });
});
