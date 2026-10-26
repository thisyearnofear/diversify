/**
 * Stellar session store — the single owner of the connected wallet family.
 * restore never prompts and never writes on failure; disconnect is final and
 * generation-guarded so stale in-flight work can't resurrect a torn-down
 * session.
 */
// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { StellarAccountState } from "@diversifi/shared/src/types/stellar";

const adapter = vi.hoisted(() => ({
  restore: vi.fn(),
  connect: vi.fn(),
  getBalances: vi.fn(),
  disconnect: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@/lib/stellar/adapter", () => ({
  StellarTestnetAdapter: class {
    restore = adapter.restore;
    connect = adapter.connect;
    getBalances = adapter.getBalances;
    disconnect = adapter.disconnect;
    logout = adapter.logout;
  },
}));

import {
  connectStellarSession,
  disconnectStellarSession,
  getStellarSession,
  refreshStellarSession,
  restoreStellarSession,
  subscribeStellarSession,
} from "@/lib/stellar/session";

const ACCOUNT = "G" + "A".repeat(55);
const accountState = (): StellarAccountState => ({
  network: "stellar:testnet",
  account: ACCOUNT,
  accountKind: "classic",
  exists: true,
  subentryCount: 0,
  reserveStroops: "10000000",
  baseReserveStroops: "5000000",
  baseFeeStroops: "100",
  numSponsoring: 0,
  numSponsored: 0,
  balances: [],
  issues: [],
  observedLedger: 5,
  observedAt: new Date().toISOString(),
});

const okSession = { ok: true as const, value: { account: ACCOUNT, network: "stellar:testnet" as const } };

beforeEach(() => {
  // Teardown first (it may call adapter.logout on a live adapter),
  // then reset the mocks so counts start clean.
  disconnectStellarSession();
  localStorage.clear();
  for (const fn of Object.values(adapter)) fn.mockReset();
});

// Restore is gated on the app's remembered-session marker — a logged-out
// browser never resurrects a session.
const rememberSession = () =>
  localStorage.setItem("diversifi.stellar.session", ACCOUNT);

describe("stellar session store", () => {
  it("silent restore adopts the wallet's account and notifies subscribers", async () => {
    adapter.restore.mockResolvedValue(okSession);
    adapter.getBalances.mockResolvedValue({ ok: true, value: accountState() });
    rememberSession();
    const seen: StellarAccountState[] = [];
    const unsub = subscribeStellarSession(() => {
      const s = getStellarSession();
      if (s.account) seen.push(s.account);
    });
    const result = await restoreStellarSession();
    unsub();
    expect(result?.account).toBe(ACCOUNT);
    expect(getStellarSession().account?.account).toBe(ACCOUNT);
    expect(seen.length).toBe(1);
  });

  it("a missing wallet session restores to null and never writes state", async () => {
    adapter.restore.mockResolvedValue({
      ok: false,
      code: "wallet_missing",
      message: "none",
      retry: "none",
    });
    rememberSession();
    expect(await restoreStellarSession()).toBeNull();
    expect(getStellarSession().account).toBeNull();
  });

  it("without the remembered marker, restore is a no-op that never touches the wallet", async () => {
    // No marker — as after an explicit logout.
    expect(await restoreStellarSession()).toBeNull();
    expect(getStellarSession().account).toBeNull();
    expect(adapter.restore).not.toHaveBeenCalled();
  });

  it("explicit connect updates the session and reads balances", async () => {
    adapter.connect.mockResolvedValue(okSession);
    adapter.getBalances.mockResolvedValue({ ok: true, value: accountState() });
    const result = await connectStellarSession();
    expect(result.ok).toBe(true);
    expect(getStellarSession().account?.account).toBe(ACCOUNT);
  });

  it("disconnect is final — a restore resolved mid-teardown cannot resurrect", async () => {
    adapter.restore.mockResolvedValue(okSession);
    adapter.getBalances.mockResolvedValue({ ok: true, value: accountState() });
    rememberSession();
    const pending = restoreStellarSession();
    disconnectStellarSession(); // generation bump before the reads land
    expect(await pending).toBeNull();
    expect(getStellarSession().account).toBeNull();
    expect(adapter.logout).toHaveBeenCalledTimes(0); // adapter was still a promise, not yet constructed — teardown is lazy-safe
  });

  it("disconnect on a live session tears down the adapter", async () => {
    adapter.connect.mockResolvedValue(okSession);
    adapter.getBalances.mockResolvedValue({ ok: true, value: accountState() });
    await connectStellarSession();
    disconnectStellarSession();
    expect(getStellarSession().account).toBeNull();
    expect(adapter.logout).toHaveBeenCalled();
  });

  it("refresh without a session reports wallet_missing instead of touching the adapter", async () => {
    const result = await refreshStellarSession();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("wallet_missing");
    expect(adapter.getBalances).not.toHaveBeenCalled();
  });
});
