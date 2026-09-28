/**
 * The analysis POST carries this session's cached wallet proof so the
 * server can journal rejected tilts against the verified address — and it
 * never prompts for a signature to get one.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  getCachedWalletAuth: vi.fn(),
  getWalletAuthHeaders: vi.fn(),
  signMessage: vi.fn(),
  fetchWithTimeout: vi.fn(),
}));

vi.mock('@/context/PrivyProvider', () => ({ usePrivy: () => ({ user: null }) }));
vi.mock('../../components/wallet/WalletProvider', () => ({
  useWalletContext: () => ({ address: '0xabc', signMessage: mocks.signMessage }),
}));
vi.mock('../../components/ui/Toast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('@/lib/wallet-auth', () => ({
  getCachedWalletAuth: mocks.getCachedWalletAuth,
  getWalletAuthHeaders: mocks.getWalletAuthHeaders,
}));
vi.mock('@diversifi/shared/src/utils/promise-utils', () => ({
  fetchWithTimeout: mocks.fetchWithTimeout,
}));
vi.mock('../useFinancialStrategies', () => ({
  getPersistedStrategy: () => null,
  getStrategyPrompt: () => '',
}));

import { useAgentAnalysis } from '../use-agent-analysis';

const DEPS = {
  apiBase: '',
  capabilities: { analysis: true, voiceInput: false, voiceOutput: false, chat: true, webSearch: false },
  config: { goal: 'inflation_protection', riskTolerance: 'Balanced' },
  addMessage: vi.fn(),
  addActivity: vi.fn(),
} as never;

const PORTFOLIO = { chains: [], totalValue: 0 } as never;

async function runAnalysis() {
  const { result } = renderHook(() => useAgentAnalysis(DEPS));
  await act(async () => {
    await result.current.analyzePortfolio({}, PORTFOLIO);
  });
  const call = mocks.fetchWithTimeout.mock.calls.find(([url]) => String(url).endsWith('/api/agent/advisor'));
  expect(call).toBeDefined();
  return call![1].headers as Record<string, string>;
}

describe('useAgentAnalysis — analysis request auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchWithTimeout.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
  });

  it('attaches the cached wallet proof headers when one exists', async () => {
    mocks.getCachedWalletAuth.mockReturnValue({ message: 'auth message', signature: '0xsig' });
    const headers = await runAnalysis();
    expect(headers).toMatchObject({
      'Content-Type': 'application/json',
      'X-Wallet-Auth-Message': encodeURIComponent('auth message'),
      'X-Wallet-Auth-Signature': '0xsig',
    });
    expect(mocks.signMessage).not.toHaveBeenCalled();
    expect(mocks.getWalletAuthHeaders).not.toHaveBeenCalled();
  });

  it('sends no auth headers and never signs without a cached proof', async () => {
    mocks.getCachedWalletAuth.mockReturnValue(null);
    const headers = await runAnalysis();
    expect(headers).toEqual({ 'Content-Type': 'application/json' });
    expect(mocks.signMessage).not.toHaveBeenCalled();
    expect(mocks.getWalletAuthHeaders).not.toHaveBeenCalled();
  });
});
