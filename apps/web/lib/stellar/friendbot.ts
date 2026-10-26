/**
 * friendbot — testnet funding for a Stellar account.
 * One GET funds the address with test XLM. Testnet only; a failure is a
 * result, never retried silently into a "funded" claim.
 */

export type FriendbotResult =
  | { ok: true }
  | { ok: false; reason: "invalid_address" | "request_failed" };

export async function fundWithFriendbot(account: string): Promise<FriendbotResult> {
  if (!account.startsWith("G") || account.length !== 56) {
    return { ok: false, reason: "invalid_address" };
  }
  try {
    const res = await fetch(
      `https://friendbot.stellar.org?addr=${encodeURIComponent(account)}`,
      { signal: AbortSignal.timeout(15_000) },
    );
    return res.ok ? { ok: true } : { ok: false, reason: "request_failed" };
  } catch {
    return { ok: false, reason: "request_failed" };
  }
}
