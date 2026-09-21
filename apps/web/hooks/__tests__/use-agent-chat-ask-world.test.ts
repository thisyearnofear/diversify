/**
 * "Ask the World" fast-answer plumbing inside use-agent-chat: matched
 * factual questions resolve from the data routes and never touch the
 * advisor; unresolved entities fall through; dead data routes get an
 * honest text answer instead of a silent LLM fallback.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../context/app/GuardianVisibilityContext', () => ({
  useGuardianVisibilityOptional: () => null,
}));
vi.mock('../../components/wallet/WalletProvider', () => ({
  useWalletContext: () => ({ address: '0xabc', chainId: 42220 }),
}));
vi.mock('../../context/AIConversationContext', () => ({
  useAIConversationOptional: () => undefined,
}));
vi.mock('../../context/app/AgentChatContext', () => ({
  useAgentChatContext: () => undefined,
}));
vi.mock('../../context/app/PortfolioContext', () => ({
  useSharedMultichainBalances: () => ({ chains: [], totalValue: 0, chainCount: 0, isLoading: false }),
}));
vi.mock('../use-agent-config', () => ({
  useAgentConfig: () => ({
    config: { goal: 'inflation_protection', voiceResponsesEnabled: false },
  }),
}));
vi.mock('../use-x402-payment', () => ({
  useX402Payment: () => ({ fetchPaidSource: vi.fn() }),
}));
vi.mock('../use-agent-activities', () => ({
  useAgentActivities: () => ({ addActivity: vi.fn() }),
}));
const mocks = vi.hoisted(() => ({ deductCredits: vi.fn() }));
vi.mock('../use-credits', () => ({
  useCredits: () => ({ deductCredits: mocks.deductCredits, status: { credits: { bonus: 0 } } }),
}));
vi.mock('../useFinancialStrategies', () => ({
  getPersistedStrategy: () => null,
}));
vi.mock('../../lib/analytics', () => ({
  trackFunnelEvent: vi.fn(),
}));

import { useAgentChat } from '../use-agent-chat';

const DEPS = {
  apiBase: '',
  capabilities: { chat: true, voiceInput: false, voiceOutput: false },
  useGlobalConversation: true,
} as never;

const INFLATION_FEED = {
  countries: [
    { country: 'Nigeria', countryCode: 'NGA', value: 24.1, year: 2026, source: 'imf' },
    { country: 'Argentina', countryCode: 'ARG', value: 12.0, year: 2026, source: 'imf' },
    { country: 'United States', countryCode: 'USA', value: 2.7, year: 2026, source: 'imf' },
    { country: 'World', countryCode: 'WEOWORLD', value: 5.5, year: 2026, source: 'imf', isGlobal: true },
  ],
  source: 'imf',
  lastUpdated: '2026-09-20T00:00:00.000Z',
};

const WORLD_FACTS = {
  kind: 'depreciation',
  horizon: 5,
  mode: 'reference',
  sources: 'Curated reference dataset',
  dataAsOf: '2025-07-01',
  entries: [
    { code: 'ARS', countryName: 'Argentina', iso2: 'AR', value: -78, isLive: false },
    { code: 'NGN', countryName: 'Nigeria', iso2: 'NG', value: -70, isLive: false },
    { code: 'MXN', countryName: 'Mexico', iso2: 'MX', value: 5, isLive: false },
  ],
  omittedCount: 0,
};

describe('useAgentChat — Ask the World fast path', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function routeResponses(map: Record<string, { ok?: boolean; body: unknown }>) {
    fetchMock.mockImplementation(async (url: string) => {
      for (const [frag, resp] of Object.entries(map)) {
        if (String(url).includes(frag)) {
          return { ok: resp.ok ?? true, status: 200, json: async () => resp.body };
        }
      }
      return { ok: false, status: 503, json: async () => ({}) };
    });
  }

  it('answers an inflation ranking from /api/inflation without touching the advisor', async () => {
    routeResponses({ '/api/inflation': { body: INFLATION_FEED } });
    const { result } = renderHook(() => useAgentChat(DEPS));

    await act(async () => {
      await result.current.sendChatMessage('which countries had inflation higher than 5%');
    });

    const assistant = [...result.current.messages].reverse().find((m) => m.role === 'assistant');
    expect(assistant?.type).toBe('answer');
    expect(assistant?.answer?.entries.map((e) => e.country)).toEqual(['Nigeria', 'Argentina']);
    expect(assistant?.content).toContain('🇳🇬');
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/api/agent/advisor'))).toBe(false);
    expect(mocks.deductCredits).not.toHaveBeenCalled();
    expect(result.current.isChatting).toBe(false);
  });

  it('answers a depreciation ranking from world-facts, reference mode disclosed', async () => {
    routeResponses({ '/api/agent/world-facts': { body: WORLD_FACTS } });
    const { result } = renderHook(() => useAgentChat(DEPS));

    await act(async () => {
      await result.current.sendChatMessage('which currency lost the most value vs usd over 5 years');
    });

    const assistant = [...result.current.messages].reverse().find((m) => m.role === 'assistant');
    expect(assistant?.type).toBe('answer');
    // Mexico gained — must not appear in a loss ranking.
    expect(assistant?.answer?.entries.map((e) => e.code)).toEqual(['ARS', 'NGN']);
    expect(assistant?.answer?.badge.mode).toBe('reference');
    expect(assistant?.content).toContain('not live');
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/api/agent/advisor'))).toBe(false);
  });

  it('falls through to the advisor when the entity is not in our datasets', async () => {
    const { result } = renderHook(() => useAgentChat(DEPS));

    await act(async () => {
      await result.current.sendChatMessage('what is the inflation in liechtenstein');
    });

    // Only the advisor POST happened — no /api/inflation fetch, because the
    // fall-through happens after the fetch for entity resolution…
    const advisorCall = fetchMock.mock.calls.find(([u]) => String(u).includes('/api/agent/advisor'));
    expect(advisorCall).toBeDefined();
    expect(result.current.isChatting).toBe(false);
  });

  it('answers in honest text — not via the advisor — when the data route is down', async () => {
    // default beforeEach mock: everything 503s
    const { result } = renderHook(() => useAgentChat(DEPS));

    await act(async () => {
      await result.current.sendChatMessage('which countries had inflation higher than 5%');
    });

    const assistant = [...result.current.messages].reverse().find((m) => m.role === 'assistant');
    expect(assistant?.type).toBe('text');
    expect(assistant?.content).toContain("couldn't reach");
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/api/agent/advisor'))).toBe(false);
    expect(result.current.isChatting).toBe(false);
  });

  it('leaves advice questions entirely to the advisor', async () => {
    const { result } = renderHook(() => useAgentChat(DEPS));

    await act(async () => {
      await result.current.sendChatMessage('should i move out of NGN?');
    });

    const infl = fetchMock.mock.calls.find(([u]) => String(u).includes('/api/inflation'));
    expect(infl).toBeUndefined();
    const advisorCall = fetchMock.mock.calls.find(([u]) => String(u).includes('/api/agent/advisor'));
    expect(advisorCall).toBeDefined();
  });

  it('routes an accepted TypeSafe miss through the facts path without the advisor', async () => {
    const prev = process.env.NEXT_PUBLIC_TYPESAFE_ASK_WORLD_SPIKE;
    process.env.NEXT_PUBLIC_TYPESAFE_ASK_WORLD_SPIKE = 'true';
    try {
      // Phrasing that the privacy whitelist can skeletonise but the strict
      // regex classifier intentionally misses (no "inflation"/"lost" pair).
      // "price higher than 8 percent in countries" → inflation_rank skeleton.
      routeResponses({
        '/api/agent/ask-world-spike': {
          body: {
            intent: 'inflation_rank',
            confidence: 0.92,
            margin: 0.4,
            accepted: true,
            bucket: 'jev_only',
          },
        },
        '/api/inflation': { body: INFLATION_FEED },
      });
      const { result } = renderHook(() => useAgentChat(DEPS));

      await act(async () => {
        await result.current.sendChatMessage('which countries have prices higher than 8 percent');
      });

      const assistant = [...result.current.messages].reverse().find((m) => m.role === 'assistant');
      expect(assistant?.type).toBe('answer');
      expect(assistant?.answer?.kind).toBe('inflation_rank');
      expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/api/agent/ask-world-spike'))).toBe(true);
      expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/api/agent/advisor'))).toBe(false);
    } finally {
      process.env.NEXT_PUBLIC_TYPESAFE_ASK_WORLD_SPIKE = prev;
    }
  });
});
