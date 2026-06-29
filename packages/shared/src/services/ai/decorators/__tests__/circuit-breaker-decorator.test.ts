/**
 * Tests for the CircuitBreakerDecorator.
 *
 * The decorator delegates to circuitBreakerManager.getCircuit() for each
 * call. We test that successive failures trip the breaker, that open
 * circuits reject calls, and that half-open circuits recover on enough
 * successes.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { circuitBreakerManager } from '../../../../utils/circuit-breaker-service';
import { CircuitBreakerDecorator } from '../circuit-breaker-decorator';

/**
 * Return a fresh breaker so tests don't share state with the singleton.
 * We access the private `circuits` map via unsafe cast. This is fine
 * in tests — we just need to isolate between test files.
 */
function resetCircuitFor(name: string): void {
  (circuitBreakerManager as any).circuits.delete(name);
}

describe('CircuitBreakerDecorator — decorateChatCompletion', () => {
  const decorator = new CircuitBreakerDecorator('test-provider');
  const circuitName = 'ai-test-provider-chat';

  beforeEach(() => {
    resetCircuitFor(circuitName);
  });

  it('passes through successful calls and records success', async () => {
    const result = await decorator.decorateChatCompletion(
      { messages: [{ role: 'user', content: 'hello' }] },
      () => Promise.resolve({ content: 'hi', provider: 'test' }),
    );
    expect(result.content).toBe('hi');
    const state = circuitBreakerManager.getCircuit(circuitName).getState();
    expect(state.state).toBe('CLOSED');
    expect(state.totalCalls).toBe(1);
    expect(state.totalSuccesses).toBe(1);
  });

  it('trips to OPEN after failureThreshold (3) consecutive failures', async () => {
    const failingCall = () => Promise.reject(new Error('provider down'));

    // 3 failures should open the circuit
    for (let i = 0; i < 3; i++) {
      await expect(
        decorator.decorateChatCompletion(
          { messages: [{ role: 'user', content: 'test' }] },
          failingCall,
        ),
      ).rejects.toThrow('provider down');
    }

    const state = circuitBreakerManager.getCircuit(circuitName).getState();
    expect(state.state).toBe('OPEN');
    expect(state.totalFailures).toBe(3);
  });

  it('rejects calls immediately when circuit is OPEN', async () => {
    const failingCall = () => Promise.reject(new Error('provider down'));

    // Trip the breaker
    for (let i = 0; i < 3; i++) {
      await expect(decorator.decorateChatCompletion(
        { messages: [{ role: 'user', content: 'test' }] },
        failingCall,
      )).rejects.toThrow('provider down');
    }

    // Now the circuit is OPEN — even a healthy call should be rejected
    await expect(
      decorator.decorateChatCompletion(
        { messages: [{ role: 'user', content: 'healthcheck' }] },
        () => Promise.resolve({ content: 'ok', provider: 'test' }),
      ),
    ).rejects.toThrow('Circuit breaker is OPEN');
  });

  it('transitions to HALF_OPEN on a healthy call after the timeout', async () => {
    const failingCall = () => Promise.reject(new Error('provider down'));

    // Trip the breaker with a short timeout
    const shortTimeoutCircuit = circuitBreakerManager.getCircuit(circuitName, {
      failureThreshold: 3,
      timeout: 10,
      successThreshold: 2,
    });

    for (let i = 0; i < 3; i++) {
      await expect(decorator.decorateChatCompletion(
        { messages: [{ role: 'user', content: 'test' }] },
        failingCall,
      )).rejects.toThrow('provider down');
    }

    expect(shortTimeoutCircuit.getState().state).toBe('OPEN');

    // Wait for timeout to elapse, then make a call that succeeds.
    // The transition to HALF_OPEN happens inside shouldReject() when
    // it finds the timeout has elapsed.
    await new Promise(r => setTimeout(r, 20));

    await decorator.decorateChatCompletion(
      { messages: [{ role: 'user', content: 'recovery' }] },
      () => Promise.resolve({ content: 'back online', provider: 'test' }),
    );

    // After 1 success in HALF_OPEN, successCount(1) < successThreshold(2)
    expect(shortTimeoutCircuit.getState().state).toBe('HALF_OPEN');
  });

  it('closes the circuit after successThreshold successes in HALF_OPEN', async () => {
    // Reset so we get a fresh circuit with a short timeout
    resetCircuitFor(circuitName);
    const shortCircuit = circuitBreakerManager.getCircuit(circuitName, {
      failureThreshold: 3,
      timeout: 10,
      successThreshold: 2,
    });

    // Trip (decorator uses the same circuitName internally)
    for (let i = 0; i < 3; i++) {
      await expect(decorator.decorateChatCompletion(
        { messages: [{ role: 'user', content: 'test' }] },
        () => Promise.reject(new Error('down')),
      )).rejects.toThrow('down');
    }

    expect(shortCircuit.getState().state).toBe('OPEN');
    await new Promise(r => setTimeout(r, 20));

    // First success in HALF_OPEN → stays HALF_OPEN (1 < 2)
    await decorator.decorateChatCompletion(
      { messages: [{ role: 'user', content: 'r1' }] },
      () => Promise.resolve({ content: 'ok', provider: 'test' }),
    );
    expect(shortCircuit.getState().state).toBe('HALF_OPEN');

    // Second success → successCount(2) >= successThreshold(2) → CLOSED
    await decorator.decorateChatCompletion(
      { messages: [{ role: 'user', content: 'r2' }] },
      () => Promise.resolve({ content: 'ok', provider: 'test' }),
    );
    expect(shortCircuit.getState().state).toBe('CLOSED');
  });
});

describe('CircuitBreakerDecorator — decorateSpeech', () => {
  const decorator = new CircuitBreakerDecorator('test-speech');
  const circuitName = 'ai-test-speech-speech';

  beforeEach(() => {
    resetCircuitFor(circuitName);
  });

  it('passes through successful TTS calls', async () => {
    const result = await decorator.decorateSpeech(
      { text: 'hello', voice: 'default' },
      () => Promise.resolve({ audioData: new ArrayBuffer(0), format: 'wav' }),
    );
    expect(result.audioData).toBeInstanceOf(ArrayBuffer);
  });

  it('trips and rejects after 3 failures', async () => {
    const fail = () => Promise.reject(new Error('TTS error'));

    for (let i = 0; i < 3; i++) {
      await expect(decorator.decorateSpeech(
        { text: 'test', voice: 'default' },
        fail,
      )).rejects.toThrow('TTS error');
    }

    const state = circuitBreakerManager.getCircuit(circuitName).getState();
    expect(state.state).toBe('OPEN');

    await expect(decorator.decorateSpeech(
      { text: 'still down', voice: 'default' },
      () => Promise.resolve({ audioData: new ArrayBuffer(0), format: 'wav' }),
    )).rejects.toThrow('Circuit breaker is OPEN');
  });
});

describe('CircuitBreakerDecorator — decorateTranscription', () => {
  const decorator = new CircuitBreakerDecorator('test-transcribe');
  const circuitName = 'ai-test-transcribe-transcribe';

  beforeEach(() => {
    resetCircuitFor(circuitName);
  });

  it('passes through successful transcription calls', async () => {
    const result = await decorator.decorateTranscription(
      '/tmp/audio.wav',
      () => Promise.resolve({ text: 'hello world' }),
    );
    expect(result.text).toBe('hello world');
  });

  it('trips and rejects after 3 failures', async () => {
    const fail = () => Promise.reject(new Error('transcribe error'));

    for (let i = 0; i < 3; i++) {
      await expect(decorator.decorateTranscription(
        '/tmp/audio.wav',
        fail,
      )).rejects.toThrow('transcribe error');
    }

    const state = circuitBreakerManager.getCircuit(circuitName).getState();
    expect(state.state).toBe('OPEN');

    await expect(decorator.decorateTranscription(
      '/tmp/audio.wav',
      () => Promise.resolve({ text: 'should not reach' }),
    )).rejects.toThrow('Circuit breaker is OPEN');
  });
});
