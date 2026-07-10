import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWithTimeout, withTimeout } from '../promise-utils';

/**
 * Tests for the shared promise/fetch helpers. We mock global `fetch` and assert:
 *   - fetchWithTimeout passes the response through on success
 *   - fetchWithTimeout aborts a hung request once the timeout elapses
 *   - the abort signal is actually wired into the underlying fetch call
 *   - withTimeout rejects with the custom message after the deadline
 */

describe('promise-utils', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.useRealTimers();
  });

  it('fetchWithTimeout resolves with the response when fetch succeeds in time', async () => {
    const response = { ok: true, status: 200 } as Response;
    global.fetch = vi.fn(async () => response) as any;

    await expect(fetchWithTimeout('https://example.com', {}, 1000)).resolves.toBe(response);
  });

  it('fetchWithTimeout aborts a hung request after the timeout', async () => {
    vi.useFakeTimers();
    // Simulate a fetch that only settles when its signal aborts
    global.fetch = vi.fn((_url: string, init?: RequestInit) =>
      new Promise((_, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        );
      })
    ) as any;

    const pending = fetchWithTimeout('https://example.com', {}, 5000);
    const assertion = expect(pending).rejects.toThrow(/abort/i);
    await vi.advanceTimersByTimeAsync(5001);
    await assertion;
  });

  it('fetchWithTimeout wires an abort signal into the underlying fetch', async () => {
    const spy = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: true }) as Response);
    global.fetch = spy as any;

    await fetchWithTimeout('https://example.com', { headers: { accept: 'application/json' } }, 1000);

    const init = spy.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect((init.headers as Record<string, string>).accept).toBe('application/json');
  });

  it('withTimeout rejects with the custom message once the deadline passes', async () => {
    vi.useFakeTimers();
    const never = new Promise<never>(() => {});

    const pending = withTimeout(never, 2000, 'price feed timed out');
    const assertion = expect(pending).rejects.toThrow('price feed timed out');
    await vi.advanceTimersByTimeAsync(2001);
    await assertion;
  });
});
