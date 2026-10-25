/**
 * Client-side holder for the server-minted demo session token.
 *
 * Sample mode proves itself to the advisor gate with a token the server
 * minted (POST /api/agent/demo-token → lib/demo-token.ts), carried in the
 * JSON body — never a custom header (which would add a CORS preflight the
 * API host may not allow) and never a client-asserted flag (which was
 * spoofable into unlimited paid calls).
 *
 * One token per session: cached until 5 minutes before expiry, shared
 * across in-flight callers, mint failures resolve to undefined so the
 * request proceeds under normal gating instead of erroring.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

let cached: { token: string; expiresAtMs: number } | null = null;
let inflight: Promise<string | undefined> | null = null;

export function getDemoToken(): Promise<string | undefined> {
  if (typeof window === "undefined") return Promise.resolve(undefined);
  if (cached && cached.expiresAtMs > Date.now() + REFRESH_MARGIN_MS) {
    return Promise.resolve(cached.token);
  }
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/agent/demo-token`, { method: "POST" });
      if (!res.ok) return undefined;
      const data = await res.json().catch(() => null);
      const expiresAtMs = Date.parse(data?.expiresAt ?? "");
      if (typeof data?.token === "string" && Number.isFinite(expiresAtMs)) {
        cached = { token: data.token, expiresAtMs };
        return data.token;
      }
    } catch {
      // No token — the advisor request falls back to normal IP-keyed gating.
    } finally {
      inflight = null;
    }
    return undefined;
  })();
  return inflight;
}
