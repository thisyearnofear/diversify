/**
 * guardian_review in use-agent-chat: an off-rail target comes back from
 * /api/vault/rebalance as `target_not_on_rail` with an Exchange handoff —
 * the assistant reply must carry that ticket as a one-tap action.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  conversation: {
    messages: [] as Array<Record<string, unknown>>,
    addMessage: vi.fn(),
    clearMessages: vi.fn(),
    patchMessage: vi.fn(),
  },
}));

vi.mock('../../context/app/GuardianVisibilityContext', () => ({
  useGuardianVisibilityOptional: () => null,
}));
vi.mock('../../components/wallet/WalletProvider', () => ({
  useWalletContext: () => ({ address: '0xabc', chainId: 42220, signMessage: vi.fn() }),
}));
vi.mock('../../context/AIConversationContext', () => ({
  useAIConversationOptional: () => mocks.conversation,
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
vi.mock('../../lib/wallet-auth', () => ({
  getWalletAuthHeaders: vi.fn(async () => ({})),
  getCachedWalletAuth: vi.fn(() => null),
}));

import { useAgentChat } from '../use-agent-chat';

const DEPS = {
  apiBase: '',
  capabilities: { chat: true, voiceInput: false, voiceOutput: false },
  useGlobalConversation: true,
} as never;

const PAXG_HANDOFF = {
  fromToken: 'USDC',
  toToken: 'PAXG',
  toChainId: 42161,
  reason: 'Gold slice',
  origin: { source: 'guardian' },
};

function rebalanceReply(body: Record<string, unknown>) {
  return { ok: true, status: 200, json: async () => body };
}

describe('useAgentChat — guardian_review off-rail handoff', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    mocks.conversation.addMessage.mockReset();
    mocks.conversation.messages = [
      {
        role: 'assistant',
        content: 'Want Guardian to review this?',
        timestamp: new Date(),
        action: { type: 'guardian_review' },
      },
    ];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('offers "Review in Exchange" carrying the handoff ticket', async () => {
    fetchMock.mockResolvedValue(
      rebalanceReply({
        status: 'noop',
        reasonCode: 'target_not_on_rail',
        message: 'Guardian executes on Celo only. Review PAXG on Arbitrum One in Exchange and sign it yourself.',
        handoff: PAXG_HANDOFF,
      }),
    );
    const { result } = renderHook(() => useAgentChat(DEPS));

    await act(async () => {
      await result.current.sendChatMessage('yes');
    });

    const reply = mocks.conversation.addMessage.mock.calls
      .map(([m]) => m)
      .find((m) => m.role === 'assistant');
    expect(reply.action).toEqual({ type: 'review_in_exchange', prefill: PAXG_HANDOFF });
    expect(reply.action.prefill).toMatchObject({ toToken: 'PAXG', toChainId: 42161 });
  });

  it('with handoff: null only says the target is not buyable in-app', async () => {
    fetchMock.mockResolvedValue(
      rebalanceReply({
        status: 'noop',
        reasonCode: 'target_not_on_rail',
        message: "GOLD isn't buyable in-app, so Guardian is only watching it.",
        handoff: null,
      }),
    );
    const { result } = renderHook(() => useAgentChat(DEPS));

    await act(async () => {
      await result.current.sendChatMessage('yes');
    });

    const reply = mocks.conversation.addMessage.mock.calls
      .map(([m]) => m)
      .find((m) => m.role === 'assistant');
    expect(reply.content).toContain("isn't buyable in-app");
    expect(reply.action).toBeUndefined();
  });
});
