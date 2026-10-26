import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { stellarNativeAsset, stellarTestnetUsdc } from "@diversifi/shared/src/types/stellar";
import type { PreparedStellarAction, StellarAccountState } from "@diversifi/shared/src/types/stellar";

const ACCOUNT = "GBJ52E7FRWATGDIDBMVUBSMKU7PXXPR65KR62TRSLUHSCYR5RBK7B6ML";
const HASH = "ab".repeat(32);
const future = (ms: number) => new Date(Date.now() + ms).toISOString();

const accountState = (opts: { line?: "missing" | "ok" | "unauthorized" | "full"; unfunded?: boolean } = {}): StellarAccountState => {
  const { line = "ok", unfunded = false } = opts;
  return {
    network: "stellar:testnet", account: ACCOUNT, accountKind: "classic", exists: !unfunded,
    subentryCount: line === "missing" ? 0 : 1,
    reserveStroops: line === "missing" ? "10000000" : "15000000",
    baseReserveStroops: "5000000", baseFeeStroops: "100", numSponsoring: 0, numSponsored: 0,
    balances: [
      { asset: stellarNativeAsset(), balanceUnits: unfunded ? "0" : "100000000", spendableUnits: unfunded ? "0" : "84999900", authorized: true },
      ...(line === "missing" ? [] : [{
        asset: stellarTestnetUsdc(), balanceUnits: "0", spendableUnits: "0",
        authorized: line !== "unauthorized",
        limitUnits: line === "full" ? "100" : "9223372036854775807",
        buyingLiabilitiesUnits: line === "full" ? "100" : "0",
      }]),
    ],
    issues: [
      ...(unfunded ? ["account_unfunded" as const] : []),
      ...(line === "missing" ? ["trustline_required" as const] : []),
      ...(line === "unauthorized" ? ["trustline_unauthorized" as const] : []),
      ...(line === "full" ? ["trustline_full" as const] : []),
    ],
    observedLedger: 5, observedAt: future(0),
  };
};

const preparedTx = (expiresInMs = 60_000): Extract<PreparedStellarAction, { kind: "transaction" }> => ({
  kind: "transaction", proposalId: "q1",
  quote: {
    id: "q1", revision: 1, network: "stellar:testnet", account: ACCOUNT,
    kind: "path-payment-strict-send", destination: ACCOUNT,
    source: stellarNativeAsset(), destinationAsset: stellarTestnetUsdc(),
    amountInUnits: "100000000", expectedOutUnits: "87094750", minimumOutUnits: "86223802",
    slippageBps: 100, priceImpactBps: null, feeMaxStroops: "100", path: [],
    observedAt: future(0), expiresAt: future(expiresInMs),
  },
  unsignedXdr: "AAAA", transactionHash: HASH, sequence: "101", expiresAt: future(300_000),
});

const preparedTl = (): PreparedStellarAction => ({
  kind: "trustline", proposalId: "tl1", network: "stellar:testnet", account: ACCOUNT,
  asset: stellarTestnetUsdc(), limit: "9223372036854775807",
  reserveIncreaseStroops: "5000000", feeMaxStroops: "100",
  unsignedXdr: "BBBB", transactionHash: "cd".repeat(32), sequence: "101", expiresAt: future(300_000),
});

const confirmed = {
  status: "confirmed" as const, proposalId: "q1", txHash: HASH, network: "stellar:testnet" as const,
  ledger: 42, confirmedAt: future(0), amountInUnits: "100000000", actualOutUnits: "86900000",
  feeChargedStroops: "100", explorerUrl: `https://stellar.expert/explorer/testnet/tx/${HASH}`, reasoningEvidence: "none" as const,
};
const tlConfirmed = {
  status: "trustline_confirmed" as const, proposalId: "tl1", txHash: "cd".repeat(32),
  network: "stellar:testnet" as const, ledger: 41, confirmedAt: future(0), feeChargedStroops: "100",
  explorerUrl: `https://stellar.expert/explorer/testnet/tx/${"cd".repeat(32)}`, reasoningEvidence: "none" as const,
};

const fake = {
  connect: vi.fn(), disconnect: vi.fn(), restore: vi.fn(), logout: vi.fn(), getBalances: vi.fn(), quote: vi.fn(),
  prepare: vi.fn(), prepareTrustline: vi.fn(), sign: vi.fn(), submit: vi.fn(),
  getSettlement: vi.fn(), validatePrepared: vi.fn(),
};
vi.mock("@/lib/stellar/adapter", () => ({
  StellarTestnetAdapter: class {
    connect = fake.connect; disconnect = fake.disconnect; restore = fake.restore; logout = fake.logout;
    getBalances = fake.getBalances;
    quote = fake.quote; prepare = fake.prepare; prepareTrustline = fake.prepareTrustline;
    sign = fake.sign; submit = fake.submit; getSettlement = fake.getSettlement;
    validatePrepared = fake.validatePrepared;
  },
}));
vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  return {
    ...actual,
    useReducedMotion: () => true,
    motion: new Proxy(actual.motion, {
      get: (t, k) => {
        const C = (t as unknown as Record<PropertyKey, React.ElementType>)[k];
        return C ?? (({ children, ...p }: React.PropsWithChildren<Record<string, unknown>>) => {
          const { whileTap, layoutId, transition, ...rest } = p as Record<string, unknown>;
          return React.createElement("div", rest, children);
        });
      },
    }),
    AnimatePresence: ({ children }: React.PropsWithChildren) => React.createElement(React.Fragment, null, children),
    LayoutGroup: ({ children }: React.PropsWithChildren) => React.createElement(React.Fragment, null, children),
  };
});

const demoState = vi.hoisted(() => ({ active: false, disableDemoMode: vi.fn() }));
vi.mock("@/context/app/DemoModeContext", () => ({
  useDemoMode: () => ({ demoMode: { isActive: demoState.active }, disableDemoMode: demoState.disableDemoMode }),
}));
vi.mock("@/context/app/NavigationContext", () => ({
  useNavigation: () => ({ setSwapPrefill: vi.fn(), exchangeNetwork: "stellar:testnet" }),
  useNavigationOptional: () => ({ setSwapPrefill: vi.fn(), exchangeNetwork: "stellar:testnet" }),
}));
vi.mock("@/context/app/BalanceVisibilityContext", () => ({
  useBalanceVisibility: () => ({ hidden: balanceHidden.value }),
}));
const balanceHidden = vi.hoisted(() => ({ value: false }));
const friendbot = vi.hoisted(() => ({
  fund: vi.fn(async (): Promise<{ ok: true } | { ok: false; reason: string }> => ({ ok: true })),
}));
vi.mock("@/lib/stellar/friendbot", () => ({ fundWithFriendbot: friendbot.fund }));
const beats = vi.hoisted(() => ({ publish: vi.fn() }));
vi.mock("@/lib/beat-impulse", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/beat-impulse")>();
  return { ...actual, publishBeat: beats.publish };
});

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

import StellarExchange from "../StellarExchange";
import { disconnectStellarSession, restoreStellarSession } from "@/lib/stellar/session";

const renderStellar = () => render(<StellarExchange />);

beforeEach(() => {
  // The session store is module-level — tear it down before touching
  // storage/mocks so no account leaks across tests.
  disconnectStellarSession();
  (globalThis as { localStorage?: Storage }).localStorage = new MemStorage() as unknown as Storage;
  demoState.active = false;
  demoState.disableDemoMode.mockClear();
  balanceHidden.value = false;
  for (const fn of Object.values(fake)) fn.mockReset();
  fake.connect.mockResolvedValue({ ok: true, value: { account: ACCOUNT } });
  fake.restore.mockResolvedValue({ ok: true, value: { account: ACCOUNT, network: "stellar:testnet" } });
  fake.getBalances.mockResolvedValue({ ok: true, value: accountState() });
  fake.validatePrepared.mockImplementation(async (p) => ({ ok: true, value: p }));
});

// A returning session: the remembered-session marker is in place and the
// wallet answers a silent fetchAddress — no picker, no connect.
const restoreSession = async () => {
  localStorage.setItem("diversifi.stellar.session", ACCOUNT);
  await restoreStellarSession();
};

describe("StellarExchange", () => {
  it("demo gate shows Use test funds and never connects a wallet", async () => {
    vi.stubEnv("NEXT_PUBLIC_STELLAR_TESTNET", "true");
    demoState.active = true;
    renderStellar();
    fireEvent.click(screen.getByTestId("stellar-primary"));
    expect(demoState.disableDemoMode).toHaveBeenCalled();
    expect(fake.connect).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("full user flow: connect → missing line → review setup → sign → confirmed → review exchange → sign → receipt", async () => {
    vi.stubEnv("NEXT_PUBLIC_STELLAR_TESTNET", "true");
    fake.getBalances
      .mockResolvedValueOnce({ ok: true, value: accountState({ line: "missing" }) })
      .mockResolvedValue({ ok: true, value: accountState() });
    fake.prepareTrustline.mockResolvedValue({ ok: true, value: preparedTl() });
    fake.sign.mockResolvedValue({ ok: true, value: { signedXdr: "S", signer: ACCOUNT } });
    fake.submit.mockResolvedValueOnce({ ok: true, value: tlConfirmed });
    fake.quote.mockResolvedValue({ ok: true, value: (preparedTx() as Extract<PreparedStellarAction, { kind: "transaction" }>).quote });
    fake.prepare.mockResolvedValue({ ok: true, value: preparedTx() });

    renderStellar();
    fireEvent.click(screen.getByTestId("stellar-primary")); // Connect a Stellar wallet
    await act(async () => {});
    expect(screen.getByTestId("stellar-primary").textContent).toContain("Review USDC setup");

    fireEvent.click(screen.getByTestId("stellar-primary")); // Review USDC setup
    await act(async () => {});
    expect(screen.getByTestId("stellar-review").textContent).toContain("Enable Circle testnet USDC");
    expect(fake.sign).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("stellar-primary")); // Sign USDC setup
    await act(async () => {});
    expect(screen.getByTestId("stellar-primary").textContent).toContain("Review exchange");

    fireEvent.change(screen.getByTestId("stellar-amount"), { target: { value: "10" } });
    fireEvent.click(screen.getByTestId("stellar-primary")); // Review exchange
    await act(async () => {});
    expect(screen.getByTestId("stellar-review").textContent).toContain("Quoted receive");
    expect(screen.getByTestId("stellar-review").textContent).toContain("Minimum received");

    fake.submit.mockResolvedValue({ ok: true, value: confirmed });
    fireEvent.click(screen.getByTestId("stellar-primary")); // Sign exchange
    await act(async () => {});
    expect(screen.getByTestId("pair-receipt").textContent).toContain("8.6900000 USDC");
    vi.unstubAllEnvs();
  });

  it("a remembered session restores silently and its pending record offers Check transaction, never connect or sign", async () => {
    vi.stubEnv("NEXT_PUBLIC_STELLAR_TESTNET", "true");
    localStorage.setItem("diversifi.stellar.pending.v1", JSON.stringify({ version: 1, prepared: preparedTx() }));
    fake.getSettlement.mockResolvedValue({ ok: true, value: { status: "pending", proposalId: "q1", txHash: HASH } });
    await restoreSession();
    renderStellar();
    await act(async () => {});
    await act(async () => {});
    expect(screen.getByTestId("stellar-primary").textContent).toContain("Check transaction");
    expect(screen.queryByText(/Connect a Stellar wallet/)).toBeNull();
    // Silent restore adopted the session — the picker never opened.
    expect(fake.restore).toHaveBeenCalled();
    expect(fake.connect).not.toHaveBeenCalled();
    expect(fake.sign).not.toHaveBeenCalled();
    expect(fake.submit).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("a pending record for a different account is never adopted — it waits for its owner", async () => {
    vi.stubEnv("NEXT_PUBLIC_STELLAR_TESTNET", "true");
    localStorage.setItem("diversifi.stellar.pending.v1", JSON.stringify({ version: 1, prepared: preparedTx() }));
    // No session at all: the record belongs to ACCOUNT and nothing is connected.
    renderStellar();
    await act(async () => {});
    await act(async () => {});
    expect(screen.getByTestId("stellar-primary").textContent).toContain("Connect a Stellar wallet");
    expect(fake.getSettlement).not.toHaveBeenCalled();
    expect(fake.sign).not.toHaveBeenCalled();
    expect(fake.submit).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("unauthorized, full, and unfunded accounts never offer USDC setup", async () => {
    vi.stubEnv("NEXT_PUBLIC_STELLAR_TESTNET", "true");
    for (const state of [
      accountState({ line: "unauthorized" }),
      accountState({ line: "full" }),
      accountState({ unfunded: true }),
    ]) {
      fake.getBalances.mockResolvedValue({ ok: true, value: state });
      const { unmount } = render(<StellarExchange />);
      fireEvent.click(screen.getByTestId("stellar-primary"));
      await act(async () => {});
      expect(screen.queryByText(/Review USDC setup/)).toBeNull();
      unmount();
      disconnectStellarSession(); // module store survives unmount — reset between states
    }
    vi.unstubAllEnvs();
  });

  it("masks spendable balance when balances are hidden", async () => {
    vi.stubEnv("NEXT_PUBLIC_STELLAR_TESTNET", "true");
    balanceHidden.value = true;
    renderStellar();
    fireEvent.click(screen.getByTestId("stellar-primary"));
    await act(async () => {});
    expect(screen.getByTestId("stellar-exchange-object").textContent).not.toContain("8.49999");
    vi.unstubAllEnvs();
  });

  it("a lookup network error never offers a discard control", async () => {
    vi.stubEnv("NEXT_PUBLIC_STELLAR_TESTNET", "true");
    localStorage.setItem("diversifi.stellar.pending.v1", JSON.stringify({ version: 1, prepared: preparedTx() }));
    fake.getSettlement.mockResolvedValue({ ok: true, value: { status: "unknown", proposalId: "q1", txHash: HASH, code: "lookup_failed", retry: "lookup" } });
    await restoreSession();
    renderStellar();
    await act(async () => {});
    await act(async () => {});
    expect(screen.queryByTestId("stellar-clear-invalid")).toBeNull();
    vi.unstubAllEnvs();
  });

  it("a chain record that contradicts the review offers an explicit discard", async () => {
    vi.stubEnv("NEXT_PUBLIC_STELLAR_TESTNET", "true");
    localStorage.setItem("diversifi.stellar.pending.v1", JSON.stringify({ version: 1, prepared: preparedTx() }));
    fake.getSettlement.mockResolvedValue({ ok: false, code: "proposal_mismatch", message: "The ledger record does not match the reviewed proposal.", retry: "none" });
    await restoreSession();
    renderStellar();
    await act(async () => {});
    await act(async () => {});
    expect(screen.getByRole("alert").textContent).toContain("does not match");
    fireEvent.click(screen.getByTestId("stellar-clear-invalid"));
    await act(async () => {});
    expect(localStorage.getItem("diversifi.stellar.pending.v1")).toBeNull();
    // Session still live — discard lands on the ready action, not connect.
    expect(screen.getByTestId("stellar-primary").textContent).toContain("Review exchange");
    vi.unstubAllEnvs();
  });


  it("quote expiry swaps Sign for Refresh quote and re-issues a review", async () => {
    vi.useFakeTimers();
    try {
      vi.stubEnv("NEXT_PUBLIC_STELLAR_TESTNET", "true");
      fake.quote
        .mockResolvedValueOnce({ ok: true, value: { ...preparedTx(30_000).quote } })
        // Second quote is built lazily so its expiry is computed after time advanced.
        .mockImplementationOnce(async () => ({ ok: true, value: { ...preparedTx(60_000).quote, id: "q2" } }));
      fake.prepare
        .mockResolvedValueOnce({ ok: true, value: preparedTx(30_000) })
        .mockImplementationOnce(async () => ({ ok: true, value: { ...preparedTx(60_000), proposalId: "q2", quote: { ...preparedTx(60_000).quote, id: "q2" } } }));

      renderStellar();
      fireEvent.click(screen.getByTestId("stellar-primary")); // connect
      await act(async () => {});
      fireEvent.change(screen.getByTestId("stellar-amount"), { target: { value: "10" } });
      fireEvent.click(screen.getByTestId("stellar-primary")); // review
      await act(async () => {});
      expect(screen.getByTestId("stellar-primary").textContent).toContain("Sign exchange in your wallet");

      // Advance past the quote's 60s TTL but inside the tx's 300s TTL.
      act(() => { vi.advanceTimersByTime(61_000); });
      expect(screen.getByTestId("stellar-primary").textContent).toContain("Refresh quote");

      fireEvent.click(screen.getByTestId("stellar-primary")); // refresh quote
      await act(async () => {});
      expect(fake.quote).toHaveBeenCalledTimes(2);
      expect(fake.prepare).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId("stellar-primary").textContent).toContain("Sign exchange in your wallet");
      expect(fake.sign).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
      vi.unstubAllEnvs();
    }
  });

  it("a trustline Check that confirms shows a success notice (not alert) and returns to ready", async () => {
    vi.stubEnv("NEXT_PUBLIC_STELLAR_TESTNET", "true");
    localStorage.setItem("diversifi.stellar.pending.v1", JSON.stringify({ version: 1, prepared: preparedTl() }));
    fake.getSettlement
      .mockResolvedValueOnce({ ok: true, value: { status: "pending", proposalId: "tl1", txHash: "cd".repeat(32) } })
      .mockResolvedValueOnce({ ok: true, value: tlConfirmed });
    fake.getBalances.mockResolvedValue({ ok: true, value: accountState() });
    await restoreSession();
    renderStellar();
    await act(async () => {});
    await act(async () => {});
    // Auto recovery resolves pending → Check transaction.
    const check = screen.getByTestId("stellar-primary");
    expect(check.textContent).toContain("Check transaction");
    fireEvent.click(check);
    await act(async () => {});
    await act(async () => {});
    // Confirmed setup → notice, not a role=alert error; usable next state.
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByTestId("stellar-exchange-object").textContent).toContain("USDC setup confirmed. Review your exchange next.");
    const next = screen.getByTestId("stellar-primary");
    expect(["Review USDC setup"].includes(next.textContent ?? "")).toBe(false);
    expect(fake.sign).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("a recovered failed settlement surfaces a visible error and a usable action", async () => {
    vi.stubEnv("NEXT_PUBLIC_STELLAR_TESTNET", "true");
    localStorage.setItem("diversifi.stellar.pending.v1", JSON.stringify({ version: 1, prepared: preparedTx() }));
    fake.getSettlement.mockResolvedValue({ ok: true, value: { status: "failed", proposalId: "q1", txHash: HASH, code: "expired_unseen", retry: "requote" } });
    await restoreSession();
    renderStellar();
    await act(async () => {});
    await act(async () => {});
    await act(async () => {});
    expect(screen.getByRole("alert").textContent).toContain("expired without being recorded");
    // Failed recovery is resolved — the session survives and the ready
    // action is usable (Review exchange, not a stuck Check).
    expect(screen.queryByText(/Check transaction/)).toBeNull();
    expect(screen.getByTestId("stellar-primary").textContent).toContain("Review exchange");
    vi.unstubAllEnvs();
  });

  it("an unfunded account offers Get test XLM — friendbot funds, then balances refresh", async () => {
    vi.stubEnv("NEXT_PUBLIC_STELLAR_TESTNET", "true");
    // Both loads report unfunded — the refresh hasn't landed the new
    // balance yet, so the confirmation line stays visible.
    fake.getBalances.mockResolvedValue({ ok: true, value: accountState({ unfunded: true }) });
    renderStellar();
    fireEvent.click(screen.getByTestId("stellar-primary")); // Connect a Stellar wallet
    await act(async () => {});

    const btn = screen.getByTestId("stellar-friendbot");
    expect(btn.textContent).toContain("Get test XLM");
    fireEvent.click(btn);
    await act(async () => {});

    expect(friendbot.fund).toHaveBeenCalledWith(ACCOUNT);
    // refresh() picks the account up again after funding
    expect(fake.getBalances).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/Test XLM requested/)).toBeTruthy();
    vi.unstubAllEnvs();
  });

  it("a failed friendbot call reports honestly — never claims funded", async () => {
    vi.stubEnv("NEXT_PUBLIC_STELLAR_TESTNET", "true");
    friendbot.fund.mockResolvedValueOnce({ ok: false, reason: "request_failed" });
    fake.getBalances.mockResolvedValue({ ok: true, value: accountState({ unfunded: true }) });
    renderStellar();
    fireEvent.click(screen.getByTestId("stellar-primary"));
    await act(async () => {});

    fireEvent.click(screen.getByTestId("stellar-friendbot"));
    await act(async () => {});
    expect(screen.getByTestId("stellar-friendbot").textContent).toContain("Funding failed");
    expect(screen.queryByText(/Test XLM requested/)).toBeNull();
    vi.unstubAllEnvs();
  });

  it("a confirmed settlement publishes a settle beat keyed by the tx hash", async () => {
    vi.stubEnv("NEXT_PUBLIC_STELLAR_TESTNET", "true");
    fake.getBalances.mockResolvedValue({ ok: true, value: accountState() });
    fake.quote.mockResolvedValue({ ok: true, value: (preparedTx() as Extract<PreparedStellarAction, { kind: "transaction" }>).quote });
    fake.prepare.mockResolvedValue({ ok: true, value: preparedTx() });
    fake.sign.mockResolvedValue({ ok: true, value: { signedXdr: "S", signer: ACCOUNT } });
    fake.submit.mockResolvedValue({ ok: true, value: confirmed });

    renderStellar();
    fireEvent.click(screen.getByTestId("stellar-primary")); // Connect
    await act(async () => {});
    fireEvent.change(screen.getByTestId("stellar-amount"), { target: { value: "10" } });
    fireEvent.click(screen.getByTestId("stellar-primary")); // Review exchange
    await act(async () => {});
    fireEvent.click(screen.getByTestId("stellar-primary")); // Sign exchange
    await act(async () => {});

    expect(beats.publish).toHaveBeenCalledWith({ surface: "exchange", key: `settle-stellar-${HASH}` });
    vi.unstubAllEnvs();
  });
});
