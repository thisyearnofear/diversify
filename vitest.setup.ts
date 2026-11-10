/**
 * Vitest setup — runs before each test file.
 *
 * Explicitly registers `@testing-library/react`'s `cleanup()` after each
 * test so component tests don't leak DOM between cases. Component test
 * files no longer need to remember this themselves — they get isolation
 * for free.
 *
 * The bare `import '@testing-library/react'` does NOT reliably register
 * cleanup inside vitest setupFiles (the package side-effect registers
 * `afterEach` only against the jest global, not the vitest runner).
 * Calling `afterEach` ourselves from the vitest namespace is the
 * reliable pattern.
 */
import { afterEach } from 'vitest';

/**
 * Scrub real signer credentials from the test environment.
 *
 * Vitest auto-loads `.env.local`, which contains production signer keys
 * (VAULT_PRIVATE_KEY, LEDGER_PRIVATE_KEY). When those leak into tests,
 * code paths guarded by "is a signer key configured" don't take their
 * mock-fallback branch and instead attempt REAL network I/O — e.g. the
 * guardian-loop DA snapshot ran a genuine 0G Storage upload against the
 * testnet indexer and hung the suite until the 5s timeout. This is the
 * same leak class that broke recommendation-ledger.service tests before
 * (AGENTS.md, chat-UX-overhaul section).
 *
 * setupFiles run inside every test worker, so this is guaranteed to apply
 * to each test file (a globalSetup change would not be, since it runs in
 * a separate process). Tests that need a signer set a SYNTHETIC key
 * explicitly (see recommendation-ledger.service.test.ts), which is
 * unaffected by this scrub.
 *
 * Key patterns live in shared `signer-env-keys.ts` (dependency-free leaf);
 * the tripwire test `signer-env-leak.test.ts` asserts this scrub ran by
 * importing the same list.
 */
import { scrubSignerEnvKeys } from './packages/shared/src/utils/signer-env-keys';

/**
 * Node >=22 test environments can expose `window` without Web Storage
 * backends (localStorage/sessionStorage exist only behind
 * --localstorage-file). Suites that exercise snapshot/session storage
 * then crash — ~360 tests across dozens of files under Node 26 while
 * jsdom environments silently mask it.
 *
 * When the `Storage` class exists but the surfaces are missing, patch
 * the prototype itself (per-instance state via WeakMap) and hand out
 * `Storage`-derived objects — so `vi.spyOn(Storage.prototype, 'setItem')`
 * still intercepts, which a plain-object shim would silently bypass.
 * Only installed where the real surface is absent, so jsdom keeps its own.
 */
if (
  typeof Storage !== 'undefined' &&
  typeof window !== 'undefined' &&
  (!window.localStorage || !window.sessionStorage)
) {
  const stores = new WeakMap<object, Map<string, string>>();
  const mem = (o: object) => {
    let m = stores.get(o);
    if (!m) {
      m = new Map();
      stores.set(o, m);
    }
    return m;
  };
  const proto = Storage.prototype as unknown as Record<string, unknown>;
  proto.getItem = function (k: string) {
    return stores.get(this)?.get(k) ?? null;
  };
  proto.setItem = function (this: object, k: string, v: string) {
    mem(this).set(k, String(v));
  };
  proto.removeItem = function (k: string) {
    stores.get(this)?.delete(k);
  };
  proto.clear = function () {
    stores.get(this)?.clear();
  };
  proto.key = function (i: number) {
    return [...(stores.get(this)?.keys() ?? [])][i] ?? null;
  };
  Object.defineProperty(proto, 'length', {
    configurable: true,
    get: function (this: object) {
      return stores.get(this)?.size ?? 0;
    },
  });
}

const newStorageSurface = (): unknown => {
  if (typeof Storage !== 'undefined') {
    return Object.create(Storage.prototype);
  }
  // No Storage class at all — plain-object fallback with an internal map.
  const mem = new Map<string, string>();
  return {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, String(v)),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
    get length() {
      return mem.size;
    },
    key: (i: number) => [...mem.keys()][i] ?? null,
  };
};

for (const name of ['localStorage', 'sessionStorage'] as const) {
  // One shared surface per name — a test spying through `window` must see
  // code that writes through `globalThis` and vice versa.
  const w = typeof window !== 'undefined' ? window : undefined;
  if (w && !w[name]) {
    Object.defineProperty(w, name, {
      configurable: true,
      writable: true,
      value: newStorageSurface(),
    });
  }
  const g = globalThis as Record<string, unknown>;
  if (!g[name]) {
    Object.defineProperty(g, name, {
      configurable: true,
      writable: true,
      value: w?.[name] ?? newStorageSurface(),
    });
  }
}

scrubSignerEnvKeys();

// Load DOM cleanup only after credentials are scrubbed. Node-only service
// and API workers never import React Testing Library.
if (typeof document !== 'undefined') {
  const { configure } = await import('@testing-library/dom');
  // waitFor/findBy carry their own budget — testing-library's
  // asyncUtilTimeout, default 1s — which Vitest's testTimeout does not
  // cover. 374 files run in parallel on shared CPUs and framer-motion
  // mount/exit animations get starved of rAF under that load, so
  // animation-gated waitFor calls dice against 1s and flake. 8s matches
  // the manual budget the CurrencyStoryInspector helpers already carry
  // (9460bb69); a green path resolves as soon as the animation settles,
  // so this costs nothing when the suite is healthy.
  configure({ asyncUtilTimeout: 8000 });
  const { cleanup } = await import('@testing-library/react');
  afterEach(() => cleanup());
}
