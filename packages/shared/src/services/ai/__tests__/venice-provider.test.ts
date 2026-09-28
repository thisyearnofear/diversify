/**
 * Venice provider — reasoning-model handling: hidden thinking deltas must
 * emit heartbeats (not chunks), disableReasoning must reach the request
 * body, and empty replies must throw so the orchestrator fails over.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}));

import { VeniceProvider } from '../providers/venice-provider';

const MESSAGES = [{ role: 'user' as const, content: 'hi' }];

function makeProvider() {
  return new VeniceProvider({ veniceApiKey: 'test-key' });
}

async function drain(stream: AsyncGenerator<any>) {
  const events: any[] = [];
  for await (const e of stream) events.push(e);
  return events;
}

beforeEach(() => {
  mockCreate.mockReset();
});

describe('generateChatCompletionStream', () => {
  it('yields heartbeats for reasoning deltas, then chunks, then done', async () => {
    mockCreate.mockResolvedValueOnce(
      (async function* () {
        yield { choices: [{ delta: { reasoning_content: 'let me think' } }] };
        yield { choices: [{ delta: { reasoning: 'still thinking' } }] };
        yield { choices: [{ delta: { content: 'Hello' } }] };
        yield { choices: [{ delta: { content: ' world' } }] };
      })(),
    );
    const events = await drain(
      makeProvider().generateChatCompletionStream({ messages: MESSAGES }),
    );
    expect(events).toEqual([
      { type: 'heartbeat' },
      { type: 'heartbeat' },
      { type: 'chunk', text: 'Hello' },
      { type: 'chunk', text: ' world' },
      { type: 'done', modelUsed: 'deepseek-v4-flash' },
    ]);
  });

  it('sends reasoning:{enabled:false} when disableReasoning is set', async () => {
    mockCreate.mockResolvedValueOnce(
      (async function* () {
        yield { choices: [{ delta: { content: 'ok' } }] };
      })(),
    );
    await drain(
      makeProvider().generateChatCompletionStream({ messages: MESSAGES, disableReasoning: true }),
    );
    expect(mockCreate.mock.calls.at(-1)?.[0]).toMatchObject({
      reasoning: { enabled: false },
    });
  });

  it('omits the reasoning field by default', async () => {
    mockCreate.mockResolvedValueOnce(
      (async function* () {
        yield { choices: [{ delta: { content: 'ok' } }] };
      })(),
    );
    await drain(makeProvider().generateChatCompletionStream({ messages: MESSAGES }));
    expect(mockCreate.mock.calls.at(-1)?.[0]).not.toHaveProperty('reasoning');
  });

  it('throws on a whitespace-only stream', async () => {
    mockCreate.mockResolvedValueOnce(
      (async function* () {
        yield { choices: [{ delta: { content: '   ' } }] };
        yield { choices: [{ delta: { content: '\n' } }] };
      })(),
    );
    await expect(
      drain(makeProvider().generateChatCompletionStream({ messages: MESSAGES })),
    ).rejects.toThrow('Venice returned an empty stream');
  });

  it('throws on a stream that produced only reasoning', async () => {
    mockCreate.mockResolvedValueOnce(
      (async function* () {
        yield { choices: [{ delta: { reasoning_content: 'hmm' } }] };
      })(),
    );
    await expect(
      drain(makeProvider().generateChatCompletionStream({ messages: MESSAGES })),
    ).rejects.toThrow('Venice returned an empty stream');
  });
});

describe('generateChatCompletion', () => {
  it('throws on an empty response so the orchestrator fails over', async () => {
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: '  ' } }] });
    await expect(
      makeProvider().generateChatCompletion({ messages: MESSAGES }),
    ).rejects.toThrow('Venice returned an empty response');
  });

  it('returns full trimmed prose in content even when it contains braces', async () => {
    const prose = 'Numbers like {x} belong in code, not prose — your naira bought less.';
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: ` ${prose} ` } }] });
    const result = await makeProvider().generateChatCompletion({ messages: MESSAGES });
    expect(result.content).toBe(prose);
    // data stays the cleaned JSON span for JSON consumers
    expect(result.data).toBe('{x}');
  });

  it('sends reasoning:{enabled:false} in the non-stream body too', async () => {
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: 'ok' } }] });
    await makeProvider().generateChatCompletion({ messages: MESSAGES, disableReasoning: true });
    expect(mockCreate.mock.calls.at(-1)?.[0]).toMatchObject({
      reasoning: { enabled: false },
      stream: false,
    });
  });
});
