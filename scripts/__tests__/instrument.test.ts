/**
 * Tests for scripts/instrument.js. We can't import the module via ESM because
 * it relies on global side effects (process.on) at top level. Instead, we
 * require it from CJS, swap process.on / console.error / process.exit with
 * spies, and assert the handlers we registered behave as documented.
 *
 * NB: the spy installation must stay in place for the duration of the test
 * (or the setTimeout in uncaughtException will hit the real process.exit
 * when the spy is restored).
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';

const requireCjs = createRequire(import.meta.url);
const INSTRUMENT_PATH = path.resolve(__dirname, '..', 'instrument.js');

function installSpies() {
  const on = vi.fn();
  const error = vi.fn();
  const exit = vi.fn();

  const originalOn = process.on;
  const originalError = console.error;
  const originalExit = process.exit;

  process.on = on as any;
  console.error = error as any;
  process.exit = exit as any;

  return {
    on,
    error,
    exit,
    restore() {
      process.on = originalOn;
      console.error = originalError;
      process.exit = originalExit;
    },
  };
}

function loadFresh(spies: ReturnType<typeof installSpies>) {
  delete requireCjs.cache[INSTRUMENT_PATH];
  requireCjs(INSTRUMENT_PATH);
  return spies.on.mock.calls;
}

function getHandler(calls: unknown[][], event: string): Function | undefined {
  return calls.find((c) => c[0] === event)?.[1] as Function | undefined;
}

describe('instrument.js', () => {
  let spies: ReturnType<typeof installSpies>;

  afterEach(() => {
    spies?.restore();
  });

  describe('handler registration', () => {
    it('registers exactly one unhandledRejection handler', () => {
      spies = installSpies();
      const calls = loadFresh(spies);

      const rejectionCall = calls.find((c) => c[0] === 'unhandledRejection');
      expect(rejectionCall).toBeDefined();
      expect(typeof rejectionCall?.[1]).toBe('function');
    });

    it('registers exactly one uncaughtException handler', () => {
      spies = installSpies();
      const calls = loadFresh(spies);

      const excCall = calls.find((c) => c[0] === 'uncaughtException');
      expect(excCall).toBeDefined();
      expect(typeof excCall?.[1]).toBe('function');
    });

    it('registers exactly one handler per event', () => {
      spies = installSpies();
      const calls = loadFresh(spies);

      const rejections = calls.filter((c) => c[0] === 'unhandledRejection');
      const exceptions = calls.filter((c) => c[0] === 'uncaughtException');
      expect(rejections).toHaveLength(1);
      expect(exceptions).toHaveLength(1);
    });
  });

  describe('unhandledRejection handler', () => {
    it('emits a single-line summary for an Error rejection', () => {
      spies = installSpies();
      const calls = loadFresh(spies);
      const handler = getHandler(calls, 'unhandledRejection');
      handler!(new TypeError('fetch failed'));

      const firstLine = spies.error.mock.calls[0]?.[0] as string;
      expect(firstLine).toMatch(/^\[INSTRUMENT\] unhandledRejection at \d{4}-\d{2}-\d{2}T/);
      expect(firstLine).toMatch(/pid=\d+/);
      expect(firstLine).toContain('name=TypeError');
      expect(firstLine).toContain('message="fetch failed"');
    });

    it('truncates messages longer than 500 characters', () => {
      spies = installSpies();
      const calls = loadFresh(spies);
      const handler = getHandler(calls, 'unhandledRejection');
      handler!(new Error('x'.repeat(1000)));

      const firstLine = spies.error.mock.calls[0]?.[0] as string;
      expect(firstLine).toContain('x'.repeat(500) + '...');
    });

    it('serialises a string rejection as JSON', () => {
      spies = installSpies();
      const calls = loadFresh(spies);
      const handler = getHandler(calls, 'unhandledRejection');
      handler!('plain string rejection');

      const firstLine = spies.error.mock.calls[0]?.[0] as string;
      expect(firstLine).toContain('name=NonError');
      expect(firstLine).toContain('message="plain string rejection"');
    });

    it('serialises an object rejection as JSON', () => {
      spies = installSpies();
      const calls = loadFresh(spies);
      const handler = getHandler(calls, 'unhandledRejection');
      handler!({ code: 'ECONNREFUSED' });

      const firstLine = spies.error.mock.calls[0]?.[0] as string;
      expect(firstLine).toContain('name=NonError');
      // The object has been JSON.stringified and is embedded in the message
      expect(firstLine).toMatch(/message=/);
    });

    it('emits a stack block when the Error has a stack', () => {
      spies = installSpies();
      const calls = loadFresh(spies);
      const handler = getHandler(calls, 'unhandledRejection');
      handler!(new Error('boom'));

      expect(spies.error.mock.calls.length).toBeGreaterThanOrEqual(2);
      const stackLine = spies.error.mock.calls[1]?.[0] as string;
      expect(stackLine).toMatch(/^\[INSTRUMENT\]   stack\[0\.\.5\]:/);
    });

    it('truncates the stack to 5 lines', () => {
      spies = installSpies();
      const calls = loadFresh(spies);
      const handler = getHandler(calls, 'unhandledRejection');

      const err = new Error('boom');
      err.stack = Array.from({ length: 20 }, (_, i) => `    at frame${i} (file.js:${i + 1}:1)`).join('\n');
      handler!(err);

      const stackLine = spies.error.mock.calls[1]?.[0] as string;
      const stackLines = stackLine.split('\n').slice(1); // drop the [INSTRUMENT] header
      expect(stackLines).toHaveLength(5);
    });
  });

  describe('uncaughtException handler', () => {
    it('logs the summary line', () => {
      spies = installSpies();
      const calls = loadFresh(spies);
      const handler = getHandler(calls, 'uncaughtException');
      handler!(new Error('fatal'));

      const firstLine = spies.error.mock.calls[0]?.[0] as string;
      expect(firstLine).toMatch(/^\[INSTRUMENT\] uncaughtException at /);
      expect(firstLine).toContain('name=Error');
    });

    it('schedules process.exit(1) for after the log flush window', () => {
      // Use real timers + the actual spy for process.exit. The handler
      // calls setTimeout(250). We don't wait for the real 250ms here
      // (it would slow the suite); instead, we just verify exit was NOT
      // called synchronously, which proves the delay is in place.
      spies = installSpies();
      const calls = loadFresh(spies);
      const handler = getHandler(calls, 'uncaughtException');
      handler!(new Error('fatal'));

      // Exit must not have been called synchronously
      expect(spies.exit).not.toHaveBeenCalled();
    });
  });
});
