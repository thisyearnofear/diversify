/**
 * Guardian-visibility plumbing inside use-agent-chat: agent-native
 * preference flips (deterministic, zero LLM cost, never leaves the client
 * when unmounted without a provider) and the drill-down transport that
 * attaches a journaled decision record to the advisor request.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  visibility: null as null | {
    visibility: string;
    origin: string;
    setVisibility: (v: 'quiet' | 'informed', by: 'user' | 'agent') => void;
  },
}));

vi.mock('../../context/app/GuardianVisibilityContext', () => ({
  useGuardianVisibilityOptional: () => mocks.visibility,
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
vi.mock('../use-credits', () => ({
  useCredits: () => ({ deductCredits: vi.fn(), status: { credits: { bonus: 0 } } }),
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

describe('useAgentChat — Guardian visibility plumbing', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: 'advisor down' }),
    });
    mocks.visibility = null;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('flips the preference locally with a reversible-by-name confirmation, no network call', async () => {
    const setVisibility = vi.fn();
    mocks.visibility = { visibility: 'informed', origin: 'persona', setVisibility };
    const { result } = renderHook(() => useAgentChat(DEPS));

    await act(async () => {
      await result.current.sendChatMessage('quiet mode');
    });

    expect(setVisibility).toHaveBeenCalledWith('quiet', 'agent');
    const assistant = result.current.messages.find((m) => m.role === 'assistant');
    expect(assistant?.content).toContain('Automation settings');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('stays inert when no visibility provider is mounted — the message goes to the advisor', async () => {
    const { result } = renderHook(() => useAgentChat(DEPS));

    await act(async () => {
      await result.current.sendChatMessage('quiet mode');
    });

    expect(fetchMock).toHaveBeenCalled();
  });

  it('attaches a journaled decisionRef to the advisor POST body as contextRecords', async () => {
    const { result } = renderHook(() => useAgentChat(DEPS));
    const decisionRef = {
      capturedAt: '2026-09-19T10:00:00.000Z',
      kind: 'decision' as const,
      status: 'daily_limit_reached',
      reason: 'Daily budget spent',
      targetToken: 'KESm',
      durationMs: 1180,
    };

    await act(async () => {
      await result.current.sendChatMessage(
        'Guardian, you stood down on my KESm position. What did you see?',
        { decisionRef },
      );
    });

    const call = fetchMock.mock.calls.find(([url]) => String(url).includes('/api/agent/advisor'));
    expect(call).toBeDefined();
    const body = JSON.parse(String((call![1] as RequestInit).body));
    expect(body.contextRecords).toEqual([decisionRef]);
  });

  it('sends no contextRecords for ordinary messages', async () => {
    const { result } = renderHook(() => useAgentChat(DEPS));

    await act(async () => {
      await result.current.sendChatMessage('How is my portfolio diversified today?');
    });

    const call = fetchMock.mock.calls.find(([url]) => String(url).includes('/api/agent/advisor'));
    const body = JSON.parse(String((call![1] as RequestInit).body));
    expect(body.contextRecords).toBeUndefined();
  });
});
