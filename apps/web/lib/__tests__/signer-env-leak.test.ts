/**
 * Tripwire: no real signer credentials may reach the test environment.
 *
 * Vitest auto-loads `.env.local`. When a production signer key leaks into
 * the test process, code paths guarded by "is a signer configured" skip
 * their mock-fallback and attempt REAL network I/O — the guardian-loop DA
 * snapshot hung three tests exactly this way (real 0G Storage upload
 * against the testnet indexer until the 5s timeout).
 *
 * `vitest.setup.ts` scrubs those keys in every worker before any test
 * file loads. This test is the alarm if that ever stops working — e.g. a
 * new credential name appears in `.env.local` that the scrub doesn't
 * cover, or someone "simplifies away" the setup hook. Run in the same
 * env the whole suite shares, so it observes what tests actually see.
 */

import { describe, expect, it } from "vitest";
import {
  findSignerEnvKeys,
  isSignerEnvKey,
  scrubSignerEnvKeys,
} from "@diversifi/shared/src/utils/signer-env-keys";

describe("signer-env-leak tripwire", () => {
  it("the live vitest process has no signer credentials (scrub ran)", () => {
    const leaked = findSignerEnvKeys();
    // Fail with the offending NAMES only — never echo values.
    expect(leaked).toEqual([]);
  });

  it("matches canonical keys and prefixed variants, not substrings", () => {
    expect(isSignerEnvKey("VAULT_PRIVATE_KEY")).toBe(true);
    expect(isSignerEnvKey("LEDGER_PRIVATE_KEY")).toBe(true);
    expect(isSignerEnvKey("HOODI_VAULT_PRIVATE_KEY")).toBe(true);
    expect(isSignerEnvKey("TESTNET_MAINNET_DEPLOYER_KEY")).toBe(true);
    // Too broad to match: benign keys a unit test may set deliberately.
    expect(isSignerEnvKey("EXAMPLE_PRIVATE_KEY")).toBe(false);
    expect(isSignerEnvKey("MY_MOCK_PRIVATE_KEY")).toBe(false);
    expect(isSignerEnvKey("PRIVATE_KEY")).toBe(false);
  });

  it("scrubSignerEnvKeys removes matching keys and reports their names", () => {
    const fakeEnv: Record<string, string | undefined> = {
      VAULT_PRIVATE_KEY: "synthetic",
      HOODI_VAULT_PRIVATE_KEY: "synthetic",
      SAFE_KEY: "keep me",
    };
    const removed = scrubSignerEnvKeys(fakeEnv);
    expect(removed.sort()).toEqual(["HOODI_VAULT_PRIVATE_KEY", "VAULT_PRIVATE_KEY"]);
    expect(fakeEnv.VAULT_PRIVATE_KEY).toBeUndefined();
    expect(fakeEnv.SAFE_KEY).toBe("keep me");
  });

  it("findSignerEnvKeys ignores unset entries and empty values in a custom env", () => {
    const fakeEnv: Record<string, string | undefined> = {
      LEDGER_PRIVATE_KEY: undefined,
      GUARDIAN_PRIVATE_KEY: "",
      OTHER: "x",
    };
    // Undefined/empty mean "not configured" — nothing to scrub.
    expect(findSignerEnvKeys(fakeEnv)).toEqual([]);
  });
});
