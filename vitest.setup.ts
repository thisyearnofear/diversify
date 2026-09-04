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
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

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

scrubSignerEnvKeys();
