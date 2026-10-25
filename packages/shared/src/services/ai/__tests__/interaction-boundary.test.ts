import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  chat: vi.fn(), anchor: vi.fn(), ledger: vi.fn(), cacheSpeech: vi.fn(), speech: vi.fn(),
}));
vi.mock('../fallback/fallback-orchestrator', () => ({
  FallbackOrchestrator: class {
    executeChatCompletion = mocks.chat;
    executeSpeechGeneration = mocks.speech;
  },
}));
vi.mock('../providers/elevenlabs-provider', () => ({
  ElevenLabsProvider: class {
    isAvailable() { return true; }
    getName() { return 'elevenlabs'; }
    generateSpeech(_options: unknown) {}
    transcribeAudio(_path: unknown) {}
  },
}));
vi.mock('../decorators/zero-g-anchoring-decorator', () => ({
  ZeroGAnchoringDecorator: class { decorateChatCompletion = mocks.anchor; },
}));
vi.mock('../decorators/recommendation-ledger-decorator', () => ({
  RecommendationLedgerDecorator: class { decorateChatCompletion = mocks.ledger; },
}));
vi.mock('../decorators/caching-decorator', () => ({
  CachingDecorator: class { decorateSpeech = mocks.cacheSpeech; },
}));
import { AIService } from '../ai-service';

beforeEach(() => vi.clearAllMocks());
const context = { currencies: ['NGN', 'BRL', 'USD'] };

describe('read-only interpretation boundary', () => {
  it('routes through AIService failover without anchoring the transcript or interpretation', async () => {
    mocks.chat.mockResolvedValue({ data: '{"kind":"navigate","tab":"exchange"}' });
    expect(await AIService.interpretInteraction('Open the exchange screen', context)).toEqual({ kind: 'navigate', tab: 'exchange' });
    expect(mocks.chat).toHaveBeenCalledOnce();
    expect(mocks.anchor).not.toHaveBeenCalled();
    expect(mocks.ledger).not.toHaveBeenCalled();
  });

  it.each([
    '{"kind":"submit","xdr":"untrusted"}',
    '{"kind":"navigate","tab":"exchange","sign":true}',
    '{"kind":"currency","view":{"currencyCode":"FAKE","benchmark":"USD","horizon":"1yr","story":true}}',
    'not json',
  ])('drops malformed or unsupported model output: %s', async data => {
    mocks.chat.mockResolvedValue({ data });
    expect(await AIService.interpretInteraction('Bring up a currency story', context)).toBeNull();
    expect(mocks.anchor).not.toHaveBeenCalled();
    expect(mocks.ledger).not.toHaveBeenCalled();
  });

  it('does not cache private spoken readbacks', async () => {
    mocks.speech.mockResolvedValue({ data: 'audio', provider: 'elevenlabs' });
    await AIService.speech({ text: 'Your requested amount' });
    expect(mocks.speech).toHaveBeenCalledOnce();
    expect(mocks.cacheSpeech).not.toHaveBeenCalled();
  });
});
