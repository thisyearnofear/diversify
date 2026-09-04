/**
 * Signer credential env keys — single source of truth.
 *
 * These are REAL private keys that must never reach the test environment.
 * Vitest auto-loads `.env.local`, so production signer keys leak into the
 * test process; any code path guarded by "is a signer configured" then
 * skips its mock-fallback and attempts real network I/O (the guardian-loop
 * DA snapshot hung three tests this way). vitest.setup.ts scrubs them out
 * per test file; a tripwire test asserts the scrub actually ran (see
 * `apps/web/lib/__tests__/signer-env-leak.test.ts`).
 *
 * Dependency-free by design: vitest.setup.ts must be importable without
 * the shared package's server-side graph, and the tripwire test must not
 * drag heavy modules into its own process just to check env keys.
 *
 * Matching is suffix-based on the canonical key: `VAULT_PRIVATE_KEY`
 * catches `VAULT_PRIVATE_KEY` and prefixed variants like
 * `HOODI_VAULT_PRIVATE_KEY` or `TESTNET_VAULT_PRIVATE_KEY`. `_PRIVATE_KEY`
 * alone is NOT a pattern — too broad (it would match benign test keys
 * like `EXAMPLE_PRIVATE_KEY` set deliberately by unit tests).
 */

export const SIGNER_ENV_KEY_PATTERNS = [
  'VAULT_PRIVATE_KEY',
  'LEDGER_PRIVATE_KEY',
  'GUARDIAN_PRIVATE_KEY',
  'DEPLOYER_PRIVATE_KEY',
  'MAINNET_DEPLOYER_KEY',
  'FIREBLOCKS_PRIVATE_KEY',
  'TURNKEY_PRIVATE_KEY',
] as const;

export type SignerEnvKeyPattern = (typeof SIGNER_ENV_KEY_PATTERNS)[number];

/** True when an env var name holds (or may hold) a real signer credential. */
export function isSignerEnvKey(name: string): boolean {
  return SIGNER_ENV_KEY_PATTERNS.some((p) => name === p || name.endsWith(`_${p}`));
}

/** Names of all env vars in the given process-like object that hold a
 *  non-empty value matching a signer pattern. An empty value is not a
 *  credential (no "is a signer configured" guard treats it as true),
 *  so reporting it would only produce false-positive alarms. */
export function findSignerEnvKeys(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): string[] {
  return Object.keys(env).filter((name) => isSignerEnvKey(name) && env[name]);
}

/**
 * Delete every signer key from the given env object (mutates).
 * @returns the names that were removed.
 */
export function scrubSignerEnvKeys(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): string[] {
  const removed = findSignerEnvKeys(env);
  for (const name of removed) {
    delete env[name];
  }
  return removed;
}
