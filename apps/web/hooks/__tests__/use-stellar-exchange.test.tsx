import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useStellarExchange } from "../use-stellar-exchange";
import { readPendingStellar } from "@/lib/stellar/pending";
import { stellarNativeAsset, stellarTestnetUsdc } from "@diversifi/shared/src/types/stellar";
import type { PreparedStellarAction, StellarAccountState } from "@diversifi/shared/src/types/stellar";

const ACCOUNT = "GBJ52E7FRWATGDIDBMVUBSMKU7PXXPR65KR62TRSLUHSCYR5RBK7B6ML";
const HASH = "ab".repeat(32);
// Fixtures must be future-dated — the hook enforces review expiry.
const nowIso = (offsetMs = 0) => new Date(Date.now() + offsetMs).toISOString();

const accountState = (withLine = true): StellarAccountState => ({
  network: "stellar:testnet",
  account: ACCOUNT,
  accountKind: "classic",
  exists: true,
  subentryCount: withLine ? 1 : 0,
  reserveStroops: withLine ? "15000000" : "10000000",
  baseReserveStroops: "5000000",
  baseFeeStroops: "100",
  numSponsoring: 0,
  numSponsored: 0,
  balances: [
    { asset: stellarNativeAsset(), balanceUnits: "100000000", spendableUnits: "84999900", authorized: true },
    ...(withLine ? [{ asset: stellarTestnetUsdc(), balanceUnits: "0", spendableUnits: "0", authorized: true, limitUnits: "9223372036854775807", buyingLiabilitiesUnits: "0" }] : []),
  ],
  issues: withLine ? [] : ["trustline_required"],
  observedLedger: 5,
  observedAt: nowIso(),
});

const preparedTx: PreparedStellarAction = {
  kind: "transaction",
  proposalId: "q1",
  quote: {
    id: "q1", revision: 1, network: "stellar:testnet", account: ACCOUNT,
    kind: "path-payment-strict-send", destination: ACCOUNT,
    source: stellarNativeAsset(), destinationAsset: stellarTestnetUsdc(),
    amountInUnits: "100000000", expectedOutUnits: "87094750", minimumOutUnits: "86223802",
    slippageBps: 100, priceImpactBps: null, feeMaxStroops: "100", path: [],
    observedAt: nowIso(), expiresAt: nowIso(60_000),
  },
  unsignedXdr: "AAAA",
  transactionHash: HASH,
  sequence: "101",
  expiresAt: nowIso(300_000),
};

const preparedTl: PreparedStellarAction = {
  kind: "trustline",
  proposalId: "tl1",
  network: "stellar:testnet",
  account: ACCOUNT,
  asset: stellarTestnetUsdc(),
  limit: "9223372036854775807",
  reserveIncreaseStroops: "5000000",
  feeMaxStroops: "100",
  unsignedXdr: "BBBB",
  transactionHash: "cd".repeat(32),
  sequence: "101",
  expiresAt: nowIso(300_000),
};

const confirmed = {
  status: "confirmed" as const,
  proposalId: "q1",
  txHash: HASH,
  network: "stellar:testnet" as const,
  ledger: 42,
  confirmedAt: nowIso(),
  amountInUnits: "100000000",
  actualOutUnits: "86900000",
  feeChargedStroops: "100",
  explorerUrl: `https://stellar.expert/explorer/testnet/tx/${HASH}`,
  reasoningEvidence: "none" as const,
};

const trustlineConfirmed = {
  status: "trustline_confirmed" as const,
  proposalId: "tl1",
  txHash: "cd".repeat(32),
  network: "stellar:testnet" as const,
  ledger: 41,
  confirmedAt: nowIso(),
  feeChargedStroops: "100",
  explorerUrl: `https://stellar.expert/explorer/testnet/tx/${"cd".repeat(32)}`,
  reasoningEvidence: "none" as const,
};

// Controllable fake adapter — assertions only see calls, never a network.
const fake = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  getBalances: vi.fn(),
  quote: vi.fn(),
  prepare: vi.fn(),
  prepareTrustline: vi.fn(),
  sign: vi.fn(),
  submit: vi.fn(),
  getSettlement: vi.fn(),
  validatePrepared: vi.fn(),
};

vi.mock("@/lib/stellar/adapter", () => ({
  StellarTestnetAdapter: class {
    connect = fake.connect;
    disconnect = fake.disconnect;
    getBalances = fake.getBalances;
    quote = fake.quote;
    prepare = fake.prepare;
    prepareTrustline = fake.prepareTrustline;
    sign = fake.sign;
    submit = fake.submit;
    getSettlement = fake.getSettlement;
    validatePrepared = fake.validatePrepared;
  },
}));

class MemStorage {
  private map = new Map<string, string>();
  getItem(k: string) { return this.map.get(k) ?? null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
  removeItem(k: string) { this.map.delete(k); }
}

beforeEach(() => {
  (globalThis as { localStorage?: Storage }).localStorage = new MemStorage() as unknown as Storage;
  for (const fn of Object.values(fake)) fn.mockReset();
  fake.connect.mockResolvedValue({ ok: true, value: { account: ACCOUNT, network: "stellar:testnet" } });
  fake.getBalances.mockResolvedValue({ ok: true, value: accountState() });
  fake.validatePrepared.mockImplementation(async (p) => ({ ok: true, value: p }));
});

describe("useStellarExchange", () => {

  it("does nothing while disabled — no adapter, no wallet, no network", async () => {
    const { result } = renderHook(() => useStellarExchange(false));
    await act(async () => { await result.current.connect(); });
    expect(fake.connect).not.toHaveBeenCalled();
    expect(result.current.phase).toBe("connect");
  });

  it("walks connect → missing line → trustline review → sign → confirmed → ready → separate conversion review → confirmed receipt", async () => {
    fake.getBalances
      .mockResolvedValueOnce({ ok: true, value: accountState(false) }) // connect: no line
      .mockResolvedValue({ ok: true, value: accountState(true) });
    fake.prepareTrustline.mockResolvedValue({ ok: true, value: preparedTl });
    fake.sign.mockResolvedValue({ ok: true, value: { signedXdr: "SIGNED", signer: ACCOUNT } });
    fake.submit.mockResolvedValue({ ok: true, value: trustlineConfirmed });
    fake.quote.mockResolvedValue({ ok: true, value: preparedTx.kind === "transaction" ? preparedTx.quote : undefined });
    fake.prepare.mockResolvedValue({ ok: true, value: preparedTx });

    const { result } = renderHook(() => useStellarExchange(true));
    await act(async () => { await result.current.connect(); });
    expect(result.current.phase).toBe("ready");
    expect(result.current.account?.issues).toEqual(["trustline_required"]);

    await act(async () => { result.current.setAmount("10"); });
    await act(async () => { await result.current.reviewTrustline(); });
    expect(result.current.phase).toBe("review");
    expect(result.current.prepared?.kind).toBe("trustline");
    expect(fake.sign).not.toHaveBeenCalled();

    await act(async () => { await result.current.signReviewed(); });
    expect(fake.sign).toHaveBeenCalledTimes(1);
    expect(fake.submit).toHaveBeenCalledTimes(1);
    // Trustline confirmed → back to ready, amount preserved, no auto-review.
    expect(result.current.phase).toBe("ready");
    expect(result.current.amount).toBe("10");
    expect(result.current.account?.issues).toEqual([]); // refreshed

    fake.submit.mockResolvedValue({ ok: true, value: confirmed });
    await act(async () => { await result.current.review(); });
    expect(result.current.phase).toBe("review");
    expect(result.current.prepared?.kind).toBe("transaction");
    await act(async () => { await result.current.signReviewed(); });
    expect(result.current.phase).toBe("receipt");
    expect(result.current.settlement).toMatchObject({ status: "confirmed", actualOutUnits: "86900000", feeChargedStroops: "100" });
  });

  it("wallet rejection returns to ready without submit or receipt", async () => {
    fake.quote.mockResolvedValue({ ok: true, value: preparedTx.quote });
    fake.prepare.mockResolvedValue({ ok: true, value: preparedTx });
    fake.sign.mockResolvedValue({ ok: false, code: "cancelled", message: "rejected", retry: "none" });
    const { result } = renderHook(() => useStellarExchange(true));
    await act(async () => { await result.current.connect(); });
    await act(async () => { result.current.setAmount("10"); });
    await act(async () => { await result.current.review(); });
    await act(async () => { await result.current.signReviewed(); });
    expect(result.current.phase).toBe("ready");
    expect(result.current.error?.code).toBe("cancelled");
    expect(fake.submit).not.toHaveBeenCalled();
  });

  it("a changed amount during quoting cannot restore the review", async () => {
    let resolveQuote: (v: unknown) => void = () => {};
    fake.quote.mockImplementation(() => new Promise((r) => { resolveQuote = r; }));
    const { result } = renderHook(() => useStellarExchange(true));
    await act(async () => { await result.current.connect(); });
    await act(async () => { result.current.setAmount("10"); });
    act(() => { void result.current.review(); });
    await act(async () => { result.current.setAmount("20"); });
    await act(async () => { resolveQuote({ ok: true, value: preparedTx.quote }); });
    expect(result.current.phase).toBe("ready");
    expect(result.current.prepared).toBeNull();
  });

  it("double-clicked sign submits once", async () => {
    fake.quote.mockResolvedValue({ ok: true, value: preparedTx.quote });
    fake.prepare.mockResolvedValue({ ok: true, value: preparedTx });
    let resolveSign: (v: unknown) => void = () => {};
    fake.sign.mockImplementation(() => new Promise((r) => { resolveSign = r; }));
    fake.submit.mockResolvedValue({ ok: true, value: confirmed });
    const { result } = renderHook(() => useStellarExchange(true));
    await act(async () => { await result.current.connect(); });
    await act(async () => { result.current.setAmount("10"); });
    await act(async () => { await result.current.review(); });
    await act(async () => {
      void result.current.signReviewed();
      void result.current.signReviewed();
      await Promise.resolve();
    });
    await act(async () => { resolveSign({ ok: true, value: { signedXdr: "S", signer: ACCOUNT } }); });
    expect(fake.sign).toHaveBeenCalledTimes(1);
    expect(fake.submit).toHaveBeenCalledTimes(1);
  });

  it("unmount during signing never submits", async () => {
    fake.quote.mockResolvedValue({ ok: true, value: preparedTx.quote });
    fake.prepare.mockResolvedValue({ ok: true, value: preparedTx });
    let resolveSign: (v: unknown) => void = () => {};
    fake.sign.mockImplementation(() => new Promise((r) => { resolveSign = r; }));
    const { result, unmount } = renderHook(() => useStellarExchange(true));
    await act(async () => { await result.current.connect(); });
    await act(async () => { result.current.setAmount("10"); });
    await act(async () => { await result.current.review(); });
    void result.current.signReviewed();
    unmount();
    await act(async () => { resolveSign({ ok: true, value: { signedXdr: "S", signer: ACCOUNT } }); });
    expect(fake.submit).not.toHaveBeenCalled();
  });

  it("a persisted pending record is looked up, never signed or resubmitted", async () => {
    localStorage.setItem("diversifi.stellar.pending.v1", JSON.stringify({ version: 1, prepared: preparedTx }));
    fake.getSettlement.mockResolvedValue({ ok: true, value: confirmed });
    const { result } = renderHook(() => useStellarExchange(true));
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });
    expect(fake.getSettlement).toHaveBeenCalled();
    expect(fake.sign).not.toHaveBeenCalled();
    expect(fake.submit).not.toHaveBeenCalled();
    expect(result.current.phase).toBe("receipt");
    expect(result.current.settlement).toMatchObject({ actualOutUnits: "86900000" });
  });

  it("check settlement stays pending on unknown without requoting", async () => {
    fake.quote.mockResolvedValue({ ok: true, value: preparedTx.quote });
    fake.prepare.mockResolvedValue({ ok: true, value: preparedTx });
    fake.sign.mockResolvedValue({ ok: true, value: { signedXdr: "S", signer: ACCOUNT } });
    fake.submit.mockResolvedValue({ ok: true, value: { status: "unknown", proposalId: "q1", txHash: HASH, code: "submit_timeout", retry: "lookup" } });
    fake.getSettlement.mockResolvedValue({ ok: true, value: { status: "pending", proposalId: "q1", txHash: HASH } });
    const { result } = renderHook(() => useStellarExchange(true));
    await act(async () => { await result.current.connect(); });
    await act(async () => { result.current.setAmount("10"); });
    await act(async () => { await result.current.review(); });
    await act(async () => { await result.current.signReviewed(); });
    expect(result.current.phase).toBe("pending");
    await act(async () => { await result.current.checkSettlement(); });
    expect(result.current.phase).toBe("pending");
    expect(fake.quote).toHaveBeenCalledTimes(1);
    expect(fake.submit).toHaveBeenCalledTimes(1);
  });


  it("edits during quoting release busy and a new review uses the new amount", async () => {
    let resolveQuote: (v: unknown) => void = () => {};
    fake.quote.mockImplementation(() => new Promise((r) => { resolveQuote = r; }));
    fake.prepare.mockResolvedValue({ ok: true, value: preparedTx });
    const { result } = renderHook(() => useStellarExchange(true));
    await act(async () => { await result.current.connect(); });
    await act(async () => { result.current.setAmount("10"); });
    act(() => { void result.current.review(); });
    await act(async () => { result.current.setAmount("20"); });
    await act(async () => { resolveQuote({ ok: true, value: preparedTx.quote }); });
    expect(result.current.busy).toBe(false);
    expect(result.current.phase).toBe("ready");
    expect(result.current.prepared).toBeNull();
    // A fresh review proceeds with the edited amount.
    fake.quote.mockResolvedValue({ ok: true, value: { ...preparedTx.quote, amountInUnits: "200000000", id: "q2" } });
    fake.prepare.mockResolvedValue({ ok: true, value: { ...preparedTx, proposalId: "q2", quote: { ...preparedTx.quote, amountInUnits: "200000000", id: "q2" } } });
    await act(async () => { await result.current.review(); });
    expect(result.current.phase).toBe("review");
    expect(result.current.prepared?.kind === "transaction" && result.current.prepared.quote.amountInUnits).toBe("200000000");
  });

  it("in-flight signature makes edits/cancel/reset/disconnect no-ops; submit once", async () => {
    fake.quote.mockResolvedValue({ ok: true, value: preparedTx.quote });
    fake.prepare.mockResolvedValue({ ok: true, value: preparedTx });
    let resolveSign: (v: unknown) => void = () => {};
    fake.sign.mockImplementation(() => new Promise((r) => { resolveSign = r; }));
    fake.submit.mockResolvedValue({ ok: true, value: confirmed });
    const { result } = renderHook(() => useStellarExchange(true));
    await act(async () => { await result.current.connect(); });
    await act(async () => { result.current.setAmount("10"); });
    await act(async () => { await result.current.review(); });
    act(() => { void result.current.signReviewed(); });
    // While the wallet prompt is unresolved, all mutations are dead ends.
    await act(async () => { result.current.setAmount("99"); });
    act(() => { result.current.cancelReview(); result.current.reset(); result.current.disconnect(); });
    expect(result.current.amount).toBe("10");
    expect(result.current.prepared).not.toBeNull();
    expect(result.current.phase).toBe("signing");
    await act(async () => { resolveSign({ ok: true, value: { signedXdr: "S", signer: ACCOUNT } }); });
    expect(fake.sign).toHaveBeenCalledTimes(1);
    expect(fake.submit).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe("receipt");
  });

  it("unexpected submit throw stays pending with the original proposal, no resubmit", async () => {
    fake.quote.mockResolvedValue({ ok: true, value: preparedTx.quote });
    fake.prepare.mockResolvedValue({ ok: true, value: preparedTx });
    fake.sign.mockResolvedValue({ ok: true, value: { signedXdr: "S", signer: ACCOUNT } });
    // The real adapter persists the reviewed proposal before the first POST —
    // the fake mirrors that before throwing mid-flight.
    fake.submit.mockImplementation(async () => {
      localStorage.setItem("diversifi.stellar.pending.v1", JSON.stringify({ version: 1, prepared: preparedTx }));
      throw new Error("connection dropped");
    });
    fake.getSettlement.mockResolvedValue({ ok: true, value: { status: "pending", proposalId: "q1", txHash: HASH } });
    const { result } = renderHook(() => useStellarExchange(true));
    await act(async () => { await result.current.connect(); });
    await act(async () => { result.current.setAmount("10"); });
    await act(async () => { await result.current.review(); });
    await act(async () => { await result.current.signReviewed(); });
    expect(result.current.phase).toBe("pending");
    expect(result.current.prepared).toEqual(preparedTx);
    // Mutations are no-ops while unresolved.
    await act(async () => { result.current.setAmount("5"); });
    act(() => { result.current.reset(); result.current.cancelReview(); });
    await act(async () => { await result.current.review(); });
    await act(async () => { await result.current.signReviewed(); });
    expect(result.current.amount).toBe("10");
    expect(result.current.phase).toBe("pending");
    expect(fake.submit).toHaveBeenCalledTimes(1);
    await act(async () => { await result.current.checkSettlement(); });
    expect(fake.getSettlement).toHaveBeenCalledWith(HASH, preparedTx);
  });

  it("disabling mid-sign never submits", async () => {
    fake.quote.mockResolvedValue({ ok: true, value: preparedTx.quote });
    fake.prepare.mockResolvedValue({ ok: true, value: preparedTx });
    let resolveSign: (v: unknown) => void = () => {};
    fake.sign.mockImplementation(() => new Promise((r) => { resolveSign = r; }));
    const { result, rerender } = renderHook(({ on }: { on: boolean }) => useStellarExchange(on), { initialProps: { on: true } });
    await act(async () => { await result.current.connect(); });
    await act(async () => { result.current.setAmount("10"); });
    await act(async () => { await result.current.review(); });
    act(() => { void result.current.signReviewed(); });
    rerender({ on: false });
    await act(async () => { resolveSign({ ok: true, value: { signedXdr: "S", signer: ACCOUNT } }); });
    expect(fake.submit).not.toHaveBeenCalled();
  });

  it("pending recovery survives an unmount/remount and settles usable", async () => {
    localStorage.setItem("diversifi.stellar.pending.v1", JSON.stringify({ version: 1, prepared: preparedTx }));
    fake.getSettlement.mockResolvedValue({ ok: true, value: confirmed });
    // Unmount/remount coverage (not StrictMode equivalent): a first mount's
    // in-flight recovery must not corrupt the second mount's — generation
    // invalidation protects continuations.
    const first = renderHook(() => useStellarExchange(true));
    first.unmount();
    await act(async () => { await Promise.resolve(); });
    const { result } = renderHook(() => useStellarExchange(true));
    await waitFor(() => expect(result.current.phase).toBe("receipt"));
    expect(result.current.busy).toBe(false);
    expect(result.current.settlement).toMatchObject({ actualOutUnits: "86900000" });
    expect(fake.getSettlement).toHaveBeenCalledWith(HASH, preparedTx);
    expect(fake.sign).not.toHaveBeenCalled();
    expect(fake.submit).not.toHaveBeenCalled();
  });

  it("a failed settlement carries an honest code, not a blanket tx_bad_seq", async () => {
    localStorage.setItem("diversifi.stellar.pending.v1", JSON.stringify({ version: 1, prepared: preparedTx }));
    fake.getSettlement.mockResolvedValue({
      ok: true,
      value: { status: "failed", proposalId: "q1", txHash: HASH, code: "op_no_trust", retry: "requote" },
    });
    const { result, unmount } = renderHook(() => useStellarExchange(true));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error?.code).toBe("settlement_rejected");
    expect(result.current.phase).toBe("connect");
    unmount();

    fake.getSettlement.mockResolvedValue({
      ok: true,
      value: { status: "failed", proposalId: "q1", txHash: HASH, code: "expired_unseen", retry: "requote" },
    });
    const again = renderHook(() => useStellarExchange(true));
    await waitFor(() => expect(again.result.current.error).not.toBeNull());
    expect(again.result.current.error?.code).toBe("quote_expired");
  });

  it("a chain record that contradicts the review offers an explicit discard", async () => {
    localStorage.setItem("diversifi.stellar.pending.v1", JSON.stringify({ version: 1, prepared: preparedTx }));
    fake.getSettlement.mockResolvedValue({
      ok: false,
      code: "proposal_mismatch",
      message: "The ledger record does not match the reviewed proposal.",
      retry: "none",
    });
    const { result } = renderHook(() => useStellarExchange(true));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.phase).toBe("pending");
    expect(result.current.canDiscardInvalidPending).toBe(true);
    await act(async () => { result.current.clearInvalidPending(); });
    expect(readPendingStellar()).toBeNull();
    expect(result.current.phase).toBe("connect");
    expect(result.current.canDiscardInvalidPending).toBe(false);
  });
});
