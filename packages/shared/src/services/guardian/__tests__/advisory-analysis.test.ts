import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  chat: vi.fn(),
  research: vi.fn(),
  pulse: vi.fn(),
  ledger: vi.fn(),
  automations: vi.fn(),
  receipt: vi.fn(),
}));
vi.mock('../../ai/ai-service', () => ({
  AIService: { chat: mocks.chat, getStatus: vi.fn() },
}));
vi.mock('../guardian-data-access.service', () => ({
  GuardianDataAccessService: class {
    fetchWithNanopayment = mocks.research;
  },
}));
vi.mock('../../../utils/market-pulse-service', () => ({
  marketPulseService: { getMarketPulse: mocks.pulse },
}));
vi.mock('../../recommendation-ledger.service', () => ({
  recordRecommendation: mocks.ledger,
}));
vi.mock('../guardian-post-analysis.service', () => ({
  GuardianPostAnalysisService: {
    triggerAutomations: mocks.automations,
    recordAnalysisOnChain: mocks.receipt,
  },
}));

import { AgentService } from '../../agent-service';
import { GuardianExecutionService } from '../guardian-execution.service';

function agent(arcBalance = '100', totalUSDC = '100') {
  // Bypass wallet construction, but exercise the production analysis method,
  // real context gathering, model parser, and result builder.
  const instance = Object.create(AgentService.prototype);
  const forbidden = vi.fn(() => { throw new Error('Analysis attempted capital movement'); });
  Object.assign(instance, {
    initialize: vi.fn().mockResolvedValue(undefined),
    spendingLimit: 5,
    spentToday: 0,
    agentAddress: '0xanalysis',
    dataSourceFailures: new Map(),
    walletService: { sendTransaction: forbidden, getExecutionSigner: forbidden, getUserId: () => 'test' },
    getUnifiedUSDCBalance: vi.fn().mockResolvedValue({
      arcBalance, totalUSDC,
      chainBalances: [{ chainId: 42161, chainName: 'Arbitrum', amount: '100' }],
    }),
    executeAutonomousBridge: forbidden,
    transferUSDCViaGateway: forbidden,
    bridgeToArbitrum: forbidden,
    monitorRiskExposure: forbidden,
    persistAgentState: vi.fn().mockResolvedValue(undefined),
  });
  return { instance: instance as AgentService, forbidden };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.research.mockResolvedValue(new Response(JSON.stringify({
    bundle: { sources: [{ sourceId: 'macro', label: 'Macro', dataType: 'economic', data: {} }] },
  }), { headers: { 'x-payment-proof': 'research-payment' } }));
  mocks.pulse.mockResolvedValue({
    sentiment: 0.5, aiMomentum: 0.5, warRisk: 1, liquidationRisk: 100,
    forecastVol: 1, realizedVol: 1, source: 'api',
  });
  mocks.ledger.mockResolvedValue({ status: 'pending' });
  mocks.automations.mockResolvedValue(undefined);
});

describe('portfolio analysis cannot execute recommendations', () => {
  it.each(['SWAP', 'BRIDGE', 'REBALANCE', 'HOLD'])('%s remains advisory even with funds and high model confidence', async (action) => {
    mocks.chat.mockResolvedValue({ data: JSON.stringify({
      action, targetToken: 'KESm', targetNetwork: 'Arbitrum',
      confidence: 1, expectedSavings: 999999, riskLevel: 'LOW',
      reasoning: 'Model recommends a move.',
      executionMode: 'MAINNET_READY', arcTxHash: '0xfabricated',
    }) });
    const swap = vi.spyOn(GuardianExecutionService, 'executeSwap');
    const bridge = vi.spyOn(GuardianExecutionService, 'executeBridgeToArbitrum');
    const { instance, forbidden } = agent();
    try {
      const result = await instance.analyzePortfolioAutonomously(
        { balance: 100, holdings: ['USDC'] }, {}, { chainId: 42161, name: 'Arbitrum' },
      );
      expect(result.action).toBe('HOLD');
      expect(result.confidence).toBe(0);
      expect(result.riskLevel).toBe('UNKNOWN');
      expect(result).not.toHaveProperty('expectedSavings');
      expect(result.targetToken).toBeUndefined();
      expect(result.executionMode).toBe('ADVISORY');
      expect(result.arcTxHash).toBeUndefined();
      expect(result.paymentHashes).toEqual({ 'Arc Research Bundle': 'research-payment' });
      expect(result.actionSteps).toContain('Advisory only. Review any proposed move in Exchange before signing.');
      expect(forbidden).not.toHaveBeenCalled();
      expect(swap).not.toHaveBeenCalled();
      expect(bridge).not.toHaveBeenCalled();
      expect(mocks.receipt).not.toHaveBeenCalled();
      expect(mocks.research).toHaveBeenCalledTimes(1);
      expect(mocks.automations).toHaveBeenCalled();
    } finally {
      swap.mockRestore();
      bridge.mockRestore();
    }
  });

  it('a disabled research budget makes no paid research or model call', async () => {
    const { instance, forbidden } = agent();
    Object.assign(instance, { spendingLimit: 0 });
    const result = await instance.analyzePortfolioAutonomously(
      { balance: 100, holdings: ['USDC'] }, {}, { chainId: 42161, name: 'Arbitrum' },
    );
    expect(result).toMatchObject({ action: 'HOLD', executionMode: 'ADVISORY' });
    expect(mocks.research).not.toHaveBeenCalled();
    expect(mocks.chat).not.toHaveBeenCalled();
    expect(forbidden).not.toHaveBeenCalled();
  });

  it('malformed model output cannot execute or manufacture a receipt', async () => {
    mocks.chat.mockResolvedValue({ data: 'not a recommendation' });
    const { instance, forbidden } = agent();
    const result = await instance.analyzePortfolioAutonomously(
      { balance: 100, holdings: ['USDC'] }, {}, { chainId: 42161, name: 'Arbitrum' },
    );
    expect(result).toMatchObject({ action: 'HOLD', executionMode: 'ADVISORY' });
    expect(result.arcTxHash).toBeUndefined();
    expect(forbidden).not.toHaveBeenCalled();
    expect(mocks.receipt).not.toHaveBeenCalled();
  });

  it.each(['0', 'invalid'])('unavailable Arc funding (%s) never bridges other-chain capital', async (arcBalance) => {
    const { instance, forbidden } = agent(arcBalance);
    const result = await instance.analyzePortfolioAutonomously(
      { balance: 100, holdings: ['USDC'] }, {}, { chainId: 42161, name: 'Arbitrum' },
    );
    expect(result).toMatchObject({ action: 'HOLD', executionMode: 'ADVISORY' });
    expect(result.arcTxHash).toBeUndefined();
    expect(result.actionSteps.join(' ')).toContain('does not move funds between chains');
    expect(forbidden).not.toHaveBeenCalled();
    expect(mocks.research).not.toHaveBeenCalled();
    expect(mocks.chat).not.toHaveBeenCalled();
  });
});
