import { beforeEach, describe, expect, it, vi } from "vitest";
import { Account, Asset, Keypair, StrKey, TransactionBuilder, xdr } from "@stellar/stellar-sdk";
import {
  STELLAR_TESTNET_PASSPHRASE,
  STELLAR_TX_TTL_SECONDS,
  stellarNativeAsset,
  stellarTestnetUsdc,
  type PreparedStellarAction,
} from "@diversifi/shared/src/types/stellar";
import { StellarTestnetAdapter } from "../adapter";
import type { WalletBridge } from "../wallet";
import { clearPendingStellar, readPendingStellar, writePendingStellar } from "../pending";

const NOW = Date.parse("2026-10-25T18:00:00.000Z");
const ACCOUNT = Keypair.random().publicKey();
const RECIPIENT = Keypair.random().publicKey();
const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const USDC = new Asset("USDC", USDC_ISSUER);
const BASE_RESERVE = "5000000";
const BASE_FEE = "100";

class MemStorage {
  private map = new Map<string, string>();
  getItem(key: string) { return this.map.has(key) ? this.map.get(key)! : null; }
  setItem(key: string, value: string) { this.map.set(key, String(value)); }
  removeItem(key: string) { this.map.delete(key); }
  clear() { this.map.clear(); }
}

beforeEach(() => {
  (globalThis as { localStorage?: Storage }).localStorage = new MemStorage() as unknown as Storage;
});

function account(balances: Array<Record<string, unknown>>, id = ACCOUNT, sequence = "100", extra: Record<string, unknown> = {}) {
  return {
    id,
    sequence,
    subentry_count: balances.length - 1,
    last_modified_ledger: 5,
    balances,
    ...extra,
  };
}

function native(balance = "20.0000000") {
  return { asset_type: "native", balance, selling_liabilities: "0.0000000" };
}

function usdc(overrides: Record<string, unknown> = {}) {
  return {
    asset_type: "credit_alphanum4",
    asset_code: "USDC",
    asset_issuer: USDC_ISSUER,
    balance: "0.0000000",
    limit: "922337203685.4775807",
    buying_liabilities: "0.0000000",
    selling_liabilities: "0.0000000",
    is_authorized: true,
    ...overrides,
  };
}

function ledgers(reserve = BASE_RESERVE, fee = BASE_FEE) {
  return vi.fn(() => ({
    order: () => ({ limit: () => ({ call: async () => ({ records: [{ base_reserve_in_stroops: reserve, base_fee_in_stroops: fee }] }) }) }),
  }));
}

function notFoundTransactions() {
  return vi.fn(() => ({
    transaction: () => ({
      call: async () => { throw Object.assign(new Error("missing"), { name: "NotFoundError", status: 404 }); },
    }),
  }));
}

function horizon(overrides: Record<string, unknown> = {}) {
  return {
    loadAccount: vi.fn(async () => account([native(), usdc()])),
    ledgers: ledgers(),
    strictSendPaths: vi.fn(() => ({
      call: async () => ({ records: [{ destination_amount: "8.7094750", source_amount: "10.0000000", path: [] }] }),
    })),
    submitTransaction: vi.fn(),
    transactions: notFoundTransactions(),
    ...overrides,
  };
}

function wallet(partial: Partial<WalletBridge> = {}): WalletBridge {
  return {
    isAvailable: async () => true,
    connect: async () => ({ address: ACCOUNT }),
    currentAccount: async () => ({ address: ACCOUNT }),
    restore: async () => ({ address: ACCOUNT }),
    disconnect: async () => {},
    network: async () => ({ networkPassphrase: STELLAR_TESTNET_PASSPHRASE }),
    sign: async () => ({ error: "The user rejected this request.", rejected: true }),
    ...partial,
  };
}

function adapter(server = horizon(), bridge = wallet()) {
  return new StellarTestnetAdapter({
    enabled: true,
    now: () => NOW,
    horizonFactory: () => server as never,
    wallet: bridge,
  });
}

const conversion = {
  kind: "path-payment-strict-send" as const,
  account: ACCOUNT,
  destination: ACCOUNT,
  source: stellarNativeAsset(),
  destinationAsset: stellarTestnetUsdc(),
  amount: "10",
  requestId: "req-1",
  revision: 1,
};

async function prepareConversion(live: StellarTestnetAdapter) {
  const quoted = await live.quote(conversion);
  if (!quoted.ok) throw new Error(`expected a quote, got ${quoted.code}`);
  const prepared = await live.prepare(quoted.value);
  if (!prepared.ok) throw new Error(`expected a prepared transaction, got ${prepared.code}`);
  return prepared.value;
}

function signXdr(unsignedXdr: string) {
  const tx = TransactionBuilder.fromXDR(unsignedXdr, STELLAR_TESTNET_PASSPHRASE);
  tx.sign(Keypair.random());
  return tx.toXDR();
}

function ppsResultXdr(destination: string, asset: Asset, amount: string): string {
  const success = new xdr.PathPaymentStrictSendResultSuccess({
    offers: [],
    last: new xdr.SimplePaymentResult({
      destination: xdr.PublicKey.publicKeyTypeEd25519(StrKeyBytes(destination)),
      asset: asset.toXDRObject(),
      amount: xdr.Int64.fromString(amount),
    }),
  });
  const inner = xdr.OperationResult.opInner(
    xdr.OperationResultTr.pathPaymentStrictSend(
      xdr.PathPaymentStrictSendResult.pathPaymentStrictSendSuccess(success)));
  return new xdr.TransactionResult({
    feeCharged: xdr.Int64.fromString("100"),
    result: xdr.TransactionResultResult.txSuccess([inner]),
    ext: new xdr.TransactionResultExt(0),
  }).toXDR("base64");
}

function paymentResultXdr(): string {
  const inner = xdr.OperationResult.opInner(xdr.OperationResultTr.payment(xdr.PaymentResult.paymentSuccess()));
  return new xdr.TransactionResult({
    feeCharged: xdr.Int64.fromString("100"),
    result: xdr.TransactionResultResult.txSuccess([inner]),
    ext: new xdr.TransactionResultExt(0),
  }).toXDR("base64");
}

function changeTrustResultXdr(): string {
  const inner = xdr.OperationResult.opInner(xdr.OperationResultTr.changeTrust(xdr.ChangeTrustResult.changeTrustSuccess()));
  return new xdr.TransactionResult({
    feeCharged: xdr.Int64.fromString("100"),
    result: xdr.TransactionResultResult.txSuccess([inner]),
    ext: new xdr.TransactionResultExt(0),
  }).toXDR("base64");
}

function StrKeyBytes(address: string): Buffer {
  return StrKey.decodeEd25519PublicKey(address);
}

function confirmedRecord(prepared: PreparedStellarAction, signedXdr: string, resultXdr: string, overrides: Record<string, unknown> = {}) {
  const sourceAccount = prepared.kind === "transaction" ? prepared.quote.account : prepared.account;
  return {
    hash: prepared.transactionHash,
    ledger_attr: 42,
    successful: true,
    envelope_xdr: signedXdr,
    result_xdr: resultXdr,
    fee_charged: "100",
    created_at: "2026-10-25T18:00:30.000Z",
    source_account: sourceAccount,
    ...overrides,
  };
}

function recordTransactions(record: unknown) {
  return vi.fn(() => ({ transaction: () => ({ call: async () => record }) }));
}

describe("Stellar testnet adapter", () => {
  it("stays disabled unless the testnet flag is on", async () => {
    const disabled = new StellarTestnetAdapter({ enabled: false, wallet: wallet() });
    const capabilities = await disabled.getCapabilities();
    expect(capabilities.enabled).toBe(false);
    expect(capabilities.canSign).toBe(false);
    expect(capabilities.autonomy).toBe(false);
    await expect(disabled.connect()).resolves.toMatchObject({ ok: false, code: "disabled" });
    await expect(disabled.quote(conversion)).resolves.toMatchObject({ ok: false, code: "disabled" });
    await expect(disabled.getBalances(ACCOUNT)).resolves.toMatchObject({ ok: false, code: "disabled" });
    await expect(disabled.prepareTrustline(ACCOUNT, "p1")).resolves.toMatchObject({ ok: false, code: "disabled" });
    await expect(disabled.validatePrepared({})).resolves.toMatchObject({ ok: false, code: "disabled" });
  });

  it("rejects a mainnet passphrase and a contract-shaped account", async () => {
    const wrong = adapter(horizon(), wallet({ network: async () => ({ networkPassphrase: "Public Global Stellar Network ; September 2015" }) }));
    await expect(wrong.connect()).resolves.toMatchObject({ ok: false, code: "wrong_network" });
    const contract = adapter(horizon(), wallet({ connect: async () => ({ address: "CCEAFOGSGIRVXSNLZ6K6ODOZRPB4HCMJOEQZUNU4OEHTHTEUDWJMNR4S" }) }));
    await expect(contract.connect()).resolves.toMatchObject({ ok: false, code: "wallet_missing" });
  });

  it("computes reserves from the latest ledger: 10 XLM with one subentry leaves 8.49999", async () => {
    const server = horizon({ loadAccount: vi.fn(async () => account([native("10.0000000"), usdc()])) });
    const state = await adapter(server).getBalances(ACCOUNT);
    expect(state.ok).toBe(true);
    if (!state.ok) return;
    expect(state.value.reserveStroops).toBe("15000000");
    expect(state.value.baseReserveStroops).toBe(BASE_RESERVE);
    const nativeBalance = state.value.balances[0];
    expect(nativeBalance.spendableUnits).toBe("84999900");
  });

  it("applies the sponsorship formula to the reserve", async () => {
    const server = horizon({
      loadAccount: vi.fn(async () => account([native("10.0000000"), usdc()], ACCOUNT, "100", { num_sponsoring: 2, num_sponsored: 1 })),
    });
    const state = await adapter(server).getBalances(ACCOUNT);
    if (!state.ok) throw new Error("expected account state");
    // (2 + 1 subentry + 2 sponsoring - 1 sponsored) * 0.5 XLM = 2 XLM
    expect(state.value.reserveStroops).toBe("20000000");
    expect(state.value.balances[0].spendableUnits).toBe("79999900");
  });

  it("fails a network_error instead of defaulting to 1 XLM when the ledger is malformed", async () => {
    const server = horizon({ ledgers: ledgers("not-a-number", BASE_FEE) });
    await expect(adapter(server).getBalances(ACCOUNT)).resolves.toMatchObject({ ok: false, code: "network_error" });
  });

  it("reports an unfunded account and a missing trustline without a price", async () => {
    const missing = horizon({ loadAccount: vi.fn(async () => { throw Object.assign(new Error("missing"), { status: 404 }); }) });
    await expect(adapter(missing).quote(conversion)).resolves.toMatchObject({ ok: false, code: "account_unfunded" });
    const noTrust = horizon({ loadAccount: vi.fn(async () => account([native()])) });
    await expect(adapter(noTrust).quote(conversion)).resolves.toMatchObject({ ok: false, code: "trustline_required" });
  });

  it("distinguishes an unauthorized and a full trustline", async () => {
    const unauthorized = horizon({ loadAccount: vi.fn(async () => account([native(), usdc({ is_authorized: false })])) });
    const state = await adapter(unauthorized).getBalances(ACCOUNT);
    if (!state.ok) throw new Error("expected account state");
    expect(state.value.issues).toContain("trustline_unauthorized");
    await expect(adapter(unauthorized).quote(conversion)).resolves.toMatchObject({ ok: false, code: "trustline_unauthorized" });

    const full = horizon({ loadAccount: vi.fn(async () => account([native(), usdc({ balance: "5.0000000", limit: "5.0000000" })])) });
    const fullState = await adapter(full).getBalances(ACCOUNT);
    if (!fullState.ok) throw new Error("expected account state");
    expect(fullState.value.issues).toContain("trustline_full");
    await expect(adapter(full).quote(conversion)).resolves.toMatchObject({ ok: false, code: "trustline_full" });
  });

  it("rejects an unsupported conversion direction and kind before any reads", async () => {
    const live = adapter();
    await expect(live.quote({ ...conversion, source: stellarTestnetUsdc(), destinationAsset: stellarNativeAsset() }))
      .resolves.toMatchObject({ ok: false, code: "invalid_asset" });
    const server = horizon();
    const spy = adapter(server);
    await expect(spy.quote({ ...conversion, destinationAsset: stellarNativeAsset(), source: stellarTestnetUsdc() }))
      .resolves.toMatchObject({ ok: false, code: "invalid_asset" });
    expect(server.loadAccount).not.toHaveBeenCalled();
  });

  it("bounds the amount to the signed int64 maximum", async () => {
    await expect(adapter().quote({ ...conversion, amount: "922337203685.4775808" }))
      .resolves.toMatchObject({ ok: false, code: "invalid_amount" });
    await expect(adapter().quote({ ...conversion, amount: "922337203685.4775807" }))
      .resolves.toMatchObject({ ok: false }); // valid bound, but exceeds the mocked balance
  });

  it("quotes a strict-send path in 7-decimal units, binds the minimum, and leaves impact unmeasured", async () => {
    const result = await adapter().quote(conversion);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.amountInUnits).toBe("100000000");
    expect(result.value.expectedOutUnits).toBe("87094750");
    expect(result.value.minimumOutUnits).toBe("86223802");
    expect(result.value.slippageBps).toBe(100);
    expect(result.value.priceImpactBps).toBeNull();
    expect(result.value.feeMaxStroops).toBe(BASE_FEE);
    expect(result.value.kind).toBe("path-payment-strict-send");
  });

  it("does not turn a missing path into a payment", async () => {
    const empty = horizon({ strictSendPaths: vi.fn(() => ({ call: async () => ({ records: [] }) })) });
    await expect(adapter(empty).quote(conversion)).resolves.toMatchObject({ ok: false, code: "no_route" });
    await expect(adapter().quote({ ...conversion, kind: "payment", destination: RECIPIENT })).resolves.toMatchObject({ ok: false, code: "invalid_asset" });
  });

  it("fails a USDC payment on USDC balance even with ample XLM", async () => {
    const server = horizon({
      loadAccount: vi.fn(async (id: string) => id === RECIPIENT
        ? account([native(), usdc()], RECIPIENT)
        : account([native("20.0000000"), usdc({ balance: "1.0000000" })])),
    });
    const live = adapter(server);
    const payment = {
      kind: "payment" as const,
      account: ACCOUNT,
      destination: RECIPIENT,
      source: stellarTestnetUsdc(),
      destinationAsset: stellarTestnetUsdc(),
      amount: "5",
      requestId: "pay-1",
      revision: 1,
    };
    await expect(live.quote(payment)).resolves.toMatchObject({ ok: false, code: "insufficient_spendable_balance" });
  });

  it("quotes a USDC payment when the recipient line can receive", async () => {
    const server = horizon({
      loadAccount: vi.fn(async (id: string) => id === RECIPIENT
        ? account([native(), usdc()], RECIPIENT)
        : account([native("20.0000000"), usdc({ balance: "10.0000000" })])),
    });
    const live = adapter(server);
    const quoted = await live.quote({
      kind: "payment",
      account: ACCOUNT,
      destination: RECIPIENT,
      source: stellarTestnetUsdc(),
      destinationAsset: stellarTestnetUsdc(),
      amount: "5",
      requestId: "pay-2",
      revision: 1,
    });
    expect(quoted.ok).toBe(true);
    if (!quoted.ok) return;
    expect(quoted.value.priceImpactBps).toBe(0);
    expect(quoted.value.expectedOutUnits).toBe("50000000");
    const prepared = await live.prepare(quoted.value);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const decoded = TransactionBuilder.fromXDR(prepared.value.unsignedXdr, STELLAR_TESTNET_PASSPHRASE);
    expect(decoded.operations[0].type).toBe("payment");
  });

  it("prepares one operation and invalidates an expired quote", async () => {
    const live = adapter();
    const prepared = await prepareConversion(live);
    const decoded = TransactionBuilder.fromXDR(prepared.unsignedXdr, STELLAR_TESTNET_PASSPHRASE);
    expect(decoded.operations).toHaveLength(1);
    expect(decoded.operations[0].type).toBe("pathPaymentStrictSend");
    const stale = await live.quote(conversion);
    if (!stale.ok) throw new Error("expected a quote");
    const expired = new StellarTestnetAdapter({
      enabled: true,
      now: () => NOW + 120_000,
      horizonFactory: () => horizon() as never,
      wallet: wallet(),
    });
    await expect(expired.prepare(stale.value)).resolves.toMatchObject({ ok: false, code: "quote_expired" });
  });

  it("prepares a trustline with the pinned asset, explicit limit, and real reserve", async () => {
    const server = horizon({ loadAccount: vi.fn(async () => account([native()])) });
    const live = adapter(server);
    const prepared = await live.prepareTrustline(ACCOUNT, "tl-1");
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.value.kind).toBe("trustline");
    expect(prepared.value.limit).toBe("9223372036854775807");
    expect(prepared.value.reserveIncreaseStroops).toBe(BASE_RESERVE);
    expect(prepared.value.feeMaxStroops).toBe(BASE_FEE);
    const decoded = TransactionBuilder.fromXDR(prepared.value.unsignedXdr, STELLAR_TESTNET_PASSPHRASE);
    expect(decoded.operations).toHaveLength(1);
    expect(decoded.operations[0].type).toBe("changeTrust");
    expect((decoded.operations[0] as { limit: string }).limit).toBe("922337203685.4775807");
    const validated = await live.validatePrepared(prepared.value);
    expect(validated.ok).toBe(true);
  });

  it("refuses a repeat trustline, including an unauthorized one", async () => {
    await expect(adapter().prepareTrustline(ACCOUNT, "tl-2")).resolves.toMatchObject({ ok: false, code: "unexpected_operation" });
    const unauthorized = horizon({ loadAccount: vi.fn(async () => account([native(), usdc({ is_authorized: false })])) });
    await expect(adapter(unauthorized).prepareTrustline(ACCOUNT, "tl-3")).resolves.toMatchObject({ ok: false, code: "trustline_unauthorized" });
  });

  it("refuses a trustline the native balance cannot reserve", async () => {
    const server = horizon({ loadAccount: vi.fn(async () => account([native("1.2000000")])) });
    await expect(adapter(server).prepareTrustline(ACCOUNT, "tl-4")).resolves.toMatchObject({ ok: false, code: "insufficient_spendable_balance" });
  });

  it("treats wallet rejection as cancellation and does not submit", async () => {
    const server = horizon();
    const live = adapter(server);
    const prepared = await prepareConversion(live);
    await expect(live.sign(prepared)).resolves.toMatchObject({ ok: false, code: "cancelled" });
    expect(server.submitTransaction).not.toHaveBeenCalled();
  });

  it("refuses to sign when the wallet account or network changed", async () => {
    const live = adapter();
    const prepared = await prepareConversion(live);
    const sign = vi.fn(async () => ({ signedTxXdr: signXdr(prepared.unsignedXdr), signerAddress: ACCOUNT }));
    const other = adapter(horizon(), wallet({ currentAccount: async () => ({ address: RECIPIENT }), sign }));
    await expect(other.sign(prepared)).resolves.toMatchObject({ ok: false, code: "proposal_mismatch" });
    expect(sign).not.toHaveBeenCalled();
    const wrongNet = adapter(horizon(), wallet({ network: async () => ({ networkPassphrase: "Public Global Stellar Network ; September 2015" }), sign }));
    await expect(wrongNet.sign(prepared)).resolves.toMatchObject({ ok: false, code: "wrong_network" });
    expect(sign).not.toHaveBeenCalled();
  });

  it("rejects a fee bump and a tampered quote before the wallet is asked", async () => {
    const live = adapter();
    const prepared = await prepareConversion(live);
    const sign = vi.fn(async () => ({ signedTxXdr: "AAAA", signerAddress: ACCOUNT }));
    const signing = adapter(horizon(), wallet({ sign }));
    const bump = TransactionBuilder.buildFeeBumpTransaction(ACCOUNT, "200",
      TransactionBuilder.fromXDR(prepared.unsignedXdr, STELLAR_TESTNET_PASSPHRASE) as never, STELLAR_TESTNET_PASSPHRASE);
    await expect(signing.validatePrepared({ ...prepared, unsignedXdr: bump.toXDR() }))
      .resolves.toMatchObject({ ok: false, code: "proposal_mismatch" });
    await expect(signing.sign({ ...prepared, unsignedXdr: bump.toXDR() }))
      .resolves.toMatchObject({ ok: false, code: "proposal_mismatch" });
    expect(sign).not.toHaveBeenCalled();
    const mutated = { ...prepared, quote: { ...prepared.quote, amountInUnits: "200000000" } };
    await expect(signing.sign(mutated)).resolves.toMatchObject({ ok: false, code: "proposal_mismatch" });
    expect(sign).not.toHaveBeenCalled();
  });

  it("rejects an extra operation and a mismatched hash", async () => {
    const live = adapter();
    const prepared = await prepareConversion(live);
    const source = new Account(ACCOUNT, "5");
    const twoOps = new TransactionBuilder(source, {
      fee: "100",
      networkPassphrase: STELLAR_TESTNET_PASSPHRASE,
      timebounds: { minTime: 0, maxTime: Math.floor(NOW / 1000) + STELLAR_TX_TTL_SECONDS },
    })
      .addOperation((await import("../sdk")).Operation.changeTrust({ asset: USDC }))
      .addOperation((await import("../sdk")).Operation.changeTrust({ asset: USDC }))
      .build();
    const tampered: PreparedStellarAction = {
      kind: "transaction",
      proposalId: prepared.proposalId,
      quote: prepared.quote,
      unsignedXdr: twoOps.toXDR(),
      transactionHash: twoOps.hash().toString("hex"),
      sequence: twoOps.sequence,
      expiresAt: new Date((Math.floor(NOW / 1000) + STELLAR_TX_TTL_SECONDS) * 1000).toISOString(),
    };
    await expect(live.validatePrepared(tampered)).resolves.toMatchObject({ ok: false, code: "proposal_mismatch" });
    await expect(live.validatePrepared({ ...prepared, transactionHash: "ff".repeat(32) }))
      .resolves.toMatchObject({ ok: false, code: "proposal_mismatch" });
  });

  it("rejects a signed envelope whose operation body changed", async () => {
    const live = adapter();
    const prepared = await prepareConversion(live);
    const { Operation } = await import("../sdk");
    const tampered = new TransactionBuilder(new Account(ACCOUNT, "100"), {
      fee: "100",
      networkPassphrase: STELLAR_TESTNET_PASSPHRASE,
      timebounds: { minTime: 0, maxTime: Math.floor(NOW / 1000) + STELLAR_TX_TTL_SECONDS },
    }).addOperation(Operation.payment({ destination: RECIPIENT, asset: USDC, amount: "1" })).build();
    tampered.sign(Keypair.random());
    const bridge = wallet({
      sign: async () => ({ signedTxXdr: tampered.toXDR(), signerAddress: ACCOUNT }),
    });
    const signing = adapter(horizon(), bridge);
    await expect(signing.sign(prepared)).resolves.toMatchObject({ ok: false, code: "proposal_mismatch" });
  });

  it("confirms a conversion from the ledger result, not the quote", async () => {
    const prepared = await prepareConversion(adapter(horizon({ ledgers: ledgers(BASE_RESERVE, "300") })));
    expect(prepared.quote.feeMaxStroops).toBe("300");
    const signedXdr = signXdr(prepared.unsignedXdr);
    const record = confirmedRecord(prepared, signedXdr, ppsResultXdr(ACCOUNT, USDC, "86900000"));
    const server = horizon({
      ledgers: ledgers(BASE_RESERVE, "300"),
      submitTransaction: vi.fn(async () => ({ hash: prepared.transactionHash, successful: true })),
      transactions: recordTransactions(record),
    });
    const submitting = adapter(server);
    const settled = await submitting.submit(signedXdr, prepared);
    expect(settled).toMatchObject({
      ok: true,
      value: {
        status: "confirmed",
        txHash: prepared.transactionHash,
        amountInUnits: "100000000",
        actualOutUnits: "86900000",
        feeChargedStroops: "100",
        ledger: 42,
      },
    });
    expect(readPendingStellar()).toBeNull();
  });

  it("won't confirm a wrong result kind, destination, issuer, or below-minimum output", async () => {
    const live = adapter();
    const prepared = await prepareConversion(live);
    const signedXdr = signXdr(prepared.unsignedXdr);
    const cases: Array<[string, string]> = [
      ["kind", paymentResultXdr()],
      ["destination", ppsResultXdr(RECIPIENT, USDC, "86900000")],
      ["issuer", ppsResultXdr(ACCOUNT, new Asset("USDC", Keypair.random().publicKey()), "86900000")],
      ["below-minimum", ppsResultXdr(ACCOUNT, USDC, "86223801")],
    ];
    for (const [name, resultXdr] of cases) {
      const server = horizon({ ledgers: ledgers(BASE_RESERVE, "300"), transactions: recordTransactions(confirmedRecord(prepared, signedXdr, resultXdr)) });
      const result = await adapter(server).getSettlement(prepared.transactionHash, prepared);
      if (name === "below-minimum") {
        expect(result, name).toMatchObject({ ok: false, code: "below_minimum" });
      } else {
        expect(result, name).toMatchObject({ ok: false, code: "proposal_mismatch" });
      }
    }
  });

  it("keeps a record pending when fee or timestamp are missing instead of fabricating them", async () => {
    const live = adapter();
    const prepared = await prepareConversion(live);
    const signedXdr = signXdr(prepared.unsignedXdr);
    const result = ppsResultXdr(ACCOUNT, USDC, "86900000");
    for (const drop of ["fee_charged", "created_at"] as const) {
      const record = { ...confirmedRecord(prepared, signedXdr, result), [drop]: undefined };
      const server = horizon({ ledgers: ledgers(BASE_RESERVE, "300"), transactions: recordTransactions(record) });
      const settled = await adapter(server).getSettlement(prepared.transactionHash, prepared);
      expect(settled).toMatchObject({ ok: true, value: { status: "pending" } });
    }
  });

  it("recovers a persisted proposal by lookup only, with identical figures", async () => {
    const live = adapter();
    const prepared = await prepareConversion(live);
    expect(writePendingStellar(prepared)).toBe(true);
    const signedXdr = signXdr(prepared.unsignedXdr);
    const record = confirmedRecord(prepared, signedXdr, ppsResultXdr(ACCOUNT, USDC, "86900000"));
    const server = horizon({ ledgers: ledgers(BASE_RESERVE, "300"), transactions: recordTransactions(record) });
    const fresh = adapter(server);
    expect(prepared.quote.feeMaxStroops).toBe("100");
    const settled = await fresh.getSettlement(prepared.transactionHash, prepared);
    expect(settled).toMatchObject({
      ok: true,
      value: { status: "confirmed", amountInUnits: "100000000", actualOutUnits: "86900000", feeChargedStroops: "100" },
    });
    // A submit with a persisted same-hash record must look up, never POST again.
    const submitResult = await fresh.submit(signedXdr, prepared);
    expect(submitResult).toMatchObject({ ok: true, value: { status: "confirmed" } });
    expect(server.submitTransaction).not.toHaveBeenCalled();
  });

  it("refuses to submit when a different hash is still pending", async () => {
    const live = adapter();
    const prepared = await prepareConversion(live);
    const other: PreparedStellarAction = {
      ...prepared,
      proposalId: "other",
      transactionHash: "cd".repeat(32),
      quote: { ...prepared.quote, id: "other" },
    };
    expect(writePendingStellar(other)).toBe(true);
    const signedXdr = signXdr(prepared.unsignedXdr);
    const server = horizon();
    await expect(adapter(server).submit(signedXdr, prepared)).resolves.toMatchObject({ ok: false, code: "submission_pending" });
    expect(server.submitTransaction).not.toHaveBeenCalled();
    clearPendingStellar(other.transactionHash);
  });

  it("discards tampered persisted data without crashing", () => {
    const live = adapter();
    void live;
    (globalThis.localStorage as Storage).setItem("diversifi.stellar.pending.v1", JSON.stringify({ version: 1, prepared: { kind: "transaction", forged: true } }));
    expect(readPendingStellar()).toBeNull();
    (globalThis.localStorage as Storage).setItem("diversifi.stellar.pending.v1", "not json");
    expect(readPendingStellar()).toBeNull();
  });

  it("looks up a timed-out hash and coalesces double submits into one POST", async () => {
    const server = horizon({
      submitTransaction: vi.fn(async () => { throw new Error("timeout"); }),
    });
    const live = adapter(server);
    const prepared = await prepareConversion(live);
    const signedXdr = signXdr(prepared.unsignedXdr);
    const first = live.submit(signedXdr, prepared);
    const second = live.submit(signedXdr, prepared);
    const [a, b] = await Promise.all([first, second]);
    expect(a).toMatchObject({ ok: true, value: { status: "unknown", code: "submit_timeout", txHash: prepared.transactionHash } });
    expect(b).toEqual(a);
    expect(server.submitTransaction).toHaveBeenCalledTimes(1);
    // The pending record stays for lookup, and a third call looks up instead of reposting.
    expect(readPendingStellar()?.prepared.transactionHash).toBe(prepared.transactionHash);
    clearPendingStellar(prepared.transactionHash);
  });

  it("fails safe before posting when storage is unavailable", async () => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
    const server = horizon();
    const live = adapter(server);
    const prepared = await prepareConversion(live);
    const signedXdr = signXdr(prepared.unsignedXdr);
    await expect(live.submit(signedXdr, prepared)).resolves.toMatchObject({ ok: false, code: "storage_unavailable" });
    expect(server.submitTransaction).not.toHaveBeenCalled();
  });

  it("rejects signing when the balance drained or the sequence moved", async () => {
    const prepared = await prepareConversion(adapter(horizon({ ledgers: ledgers(BASE_RESERVE, "300") })));
    expect(prepared.quote.feeMaxStroops).toBe("300");
    const sign = vi.fn(async () => ({ signedTxXdr: "AAAA", signerAddress: ACCOUNT }));
    // Drained: 1 XLM no longer covers the input.
    const drained = horizon({ ledgers: ledgers(BASE_RESERVE, "300"), loadAccount: vi.fn(async () => account([native("1.0000000"), usdc()])) });
    await expect(adapter(drained, wallet({ sign })).sign(prepared)).resolves.toMatchObject({ ok: false, code: "insufficient_spendable_balance" });
    expect(sign).not.toHaveBeenCalled();
    // Sequence moved — another transaction consumed the reviewed sequence.
    const moved = horizon({ ledgers: ledgers(BASE_RESERVE, "300"), loadAccount: vi.fn(async () => account([native(), usdc()], ACCOUNT, "101")) });
    await expect(adapter(moved, wallet({ sign })).sign(prepared)).resolves.toMatchObject({ ok: false, code: "quote_stale" });
    expect(sign).not.toHaveBeenCalled();
    // Fee rose above the reviewed maximum.
    const pricier = horizon({ ledgers: ledgers(BASE_RESERVE, "400") });
    await expect(adapter(pricier, wallet({ sign })).sign(prepared)).resolves.toMatchObject({ ok: false, code: "quote_stale" });
  });

  it("uses un-clamped native math at the exact fee boundary", async () => {
    // Issued payment: balance − reserve − selling === reviewed fee exactly is valid.
    const server = horizon({
      loadAccount: vi.fn(async (id: string) => id === RECIPIENT
        ? account([native(), usdc()], RECIPIENT)
        : account([{ ...native("1.5000100"), selling_liabilities: "0.0000000" }, usdc({ balance: "10.0000000" })])),
    });
    const live = adapter(server);
    const quoted = await live.quote({
      kind: "payment", account: ACCOUNT, destination: RECIPIENT,
      source: stellarTestnetUsdc(), destinationAsset: stellarTestnetUsdc(),
      amount: "5", requestId: "pay-edge", revision: 1,
    });
    expect(quoted.ok).toBe(true);
  });

  it("rejects sign when the recipient trustline disappeared after review", async () => {
    let recipientHasLine = true;
    const server = horizon({
      loadAccount: vi.fn(async (id: string) => id === RECIPIENT
        ? account(recipientHasLine ? [native(), usdc()] : [native()], RECIPIENT)
        : account([native("20.0000000"), usdc({ balance: "10.0000000" })])),
    });
    const live = adapter(server, wallet({ sign: async () => ({ signedTxXdr: "unused", signerAddress: ACCOUNT }) }));
    const quoted = await live.quote({
      kind: "payment", account: ACCOUNT, destination: RECIPIENT,
      source: stellarTestnetUsdc(), destinationAsset: stellarTestnetUsdc(),
      amount: "5", requestId: "pay-3", revision: 1,
    });
    if (!quoted.ok) throw new Error("expected a quote");
    const prepared = await live.prepare(quoted.value);
    if (!prepared.ok) throw new Error("expected prepared");
    recipientHasLine = false;
    await expect(live.sign(prepared.value)).resolves.toMatchObject({ ok: false, code: "trustline_required" });
  });

  it("rejects a trustline sign when the line appeared after review", async () => {
    let hasLine = false;
    const server = horizon({ loadAccount: vi.fn(async () => account(hasLine ? [native(), usdc()] : [native()])) });
    const live = adapter(server);
    const prepared = await live.prepareTrustline(ACCOUNT, "tl-late");
    if (!prepared.ok) throw new Error("expected a prepared trustline");
    hasLine = true;
    const sign = vi.fn(async () => ({ signedTxXdr: "unused", signerAddress: ACCOUNT }));
    const signing = new StellarTestnetAdapter({ enabled: true, now: () => NOW, horizonFactory: () => server as never, wallet: wallet({ sign }) });
    await expect(signing.sign(prepared.value)).resolves.toMatchObject({ ok: false, code: "unexpected_operation" });
    expect(sign).not.toHaveBeenCalled();
  });

  it("clears a stale session before connecting again", async () => {
    const bridge = wallet();
    const live = adapter(horizon(), bridge);
    await live.connect();
    let capabilities = await live.getCapabilities();
    expect(capabilities.canSign).toBe(true);
    // A failing reconnect must not leave the previous session "ready".
    const previously = new StellarTestnetAdapter({ enabled: true, now: () => NOW, horizonFactory: () => horizon() as never, wallet: wallet({ connect: async () => ({ error: "gone" }) }) });
    await previously.connect();
    expect((await previously.getCapabilities()).canSign).toBe(false);
  });

  it("marks a never-seen expired hash failed once the ledger has passed its expiry", async () => {
    const live = adapter();
    const prepared = await prepareConversion(live);
    // Stale ledger close → still pending.
    const stale = horizon({ ledgers: vi.fn(() => ({ order: () => ({ limit: () => ({ call: async () => ({ records: [{ base_reserve_in_stroops: BASE_RESERVE, base_fee_in_stroops: BASE_FEE, closed_at: "2026-10-25T18:00:30.000Z" }] }) }) }) })) });
    await expect(adapter(stale).getSettlement(prepared.transactionHash, prepared))
      .resolves.toMatchObject({ ok: true, value: { status: "pending" } });
    // Ledger closed past expiry + 60s → definitive failed, and the persisted record clears.
    expect(writePendingStellar(prepared)).toBe(true);
    const fresh = horizon({ ledgers: vi.fn(() => ({ order: () => ({ limit: () => ({ call: async () => ({ records: [{ base_reserve_in_stroops: BASE_RESERVE, base_fee_in_stroops: BASE_FEE, closed_at: "2026-10-25T19:00:00.000Z" }] }) }) }) })) });
    await expect(adapter(fresh).getSettlement(prepared.transactionHash, prepared))
      .resolves.toMatchObject({ ok: true, value: { status: "failed", code: "expired_unseen" } });
    expect(readPendingStellar()).toBeNull();
  });

  it("coalesces a double submit across adapter instances and never reposts", async () => {
    const prepared = await prepareConversion(adapter(horizon({ ledgers: ledgers(BASE_RESERVE, "300") })));
    const signedXdr = signXdr(prepared.unsignedXdr);
    const record = confirmedRecord(prepared, signedXdr, ppsResultXdr(ACCOUNT, USDC, "86900000"));
    let posted = false;
    const submitTransaction = vi.fn(async () => { posted = true; return { hash: prepared.transactionHash, successful: true }; });
    const transactions = vi.fn(() => ({
      transaction: () => ({ call: async () => {
        if (!posted) throw Object.assign(new Error("missing"), { name: "NotFoundError", status: 404 });
        return record;
      } }),
    }));
    const server = horizon({ ledgers: ledgers(BASE_RESERVE, "300"), submitTransaction, transactions });
    const first = adapter(server);
    const second = adapter(server);
    const [a, b] = await Promise.all([
      first.submit(signedXdr, prepared),
      second.submit(signedXdr, prepared),
    ]);
    expect(a).toMatchObject({ ok: true, value: { status: "confirmed", actualOutUnits: "86900000" } });
    expect(b).toEqual(a);
    expect(submitTransaction).toHaveBeenCalledTimes(1);
  });

  it("retains pending on 503 and never reposts an existing incomplete record", async () => {
    const prepared = await prepareConversion(adapter());
    const signedXdr = signXdr(prepared.unsignedXdr);
    // First submit: Horizon 503s on POST — ambiguous, pending retained.
    const failing = horizon({ submitTransaction: vi.fn(async () => { throw Object.assign(new Error("server"), { status: 503 }); }) });
    const first = await adapter(failing).submit(signedXdr, prepared);
    expect(first).toMatchObject({ ok: true, value: { status: "unknown", code: "submit_ambiguous" } });
    expect(readPendingStellar()?.prepared.transactionHash).toBe(prepared.transactionHash);
    expect(failing.submitTransaction).toHaveBeenCalledTimes(1);
    // Second adapter instance: same-hash pending goes through lookup only.
    const record = confirmedRecord(prepared, signedXdr, ppsResultXdr(ACCOUNT, USDC, "86900000"), { successful: undefined, result_xdr: undefined });
    const server = horizon({ transactions: recordTransactions(record) });
    const again = await adapter(server).submit(signedXdr, prepared);
    expect(again).toMatchObject({ ok: true, value: { status: "pending" } });
    expect(server.submitTransaction).not.toHaveBeenCalled();
    expect(readPendingStellar()?.prepared.transactionHash).toBe(prepared.transactionHash);
    clearPendingStellar(prepared.transactionHash);
  });

  it("rejects a dust conversion whose floored slippage exceeds the reviewed maximum", async () => {
    // 150-unit output: min = floor(150*0.99)=148, implied = floor(2*10000/150)=133bps > 100.
    // Failing here beats emitting a quote prepare() would reject as mismatched.
    const server = horizon({
      strictSendPaths: vi.fn(() => ({
        call: async () => ({ records: [{ destination_amount: "0.0000150", source_amount: "10.0000000", path: [] }] }),
      })),
    });
    await expect(adapter(server).quote(conversion)).resolves.toMatchObject({ ok: false, code: "invalid_amount" });
  });

  it("rejects a path quote whose source amount does not match the request", async () => {
    const mismatched = horizon({ strictSendPaths: vi.fn(() => ({ call: async () => ({ records: [{ destination_amount: "8.7094750", source_amount: "9.0000000", path: [] }] }) })) });
    await expect(adapter(mismatched).quote(conversion)).resolves.toMatchObject({ ok: false, code: "no_route" });
  });

  it("keeps a 503 ambiguous even when its body carries result codes", async () => {
    const prepared = await prepareConversion(adapter());
    const signedXdr = signXdr(prepared.unsignedXdr);
    const boom = Object.assign(new Error("server"), {
      status: 503,
      response: { data: { extras: { result_codes: { transaction: "tx_failed", operations: ["op_under_dest_min"] } } } },
    });
    const failing = horizon({ submitTransaction: vi.fn(async () => { throw boom; }) });
    const first = await adapter(failing).submit(signedXdr, prepared);
    expect(first).toMatchObject({ ok: true, value: { status: "unknown", code: "submit_ambiguous" } });
    expect(readPendingStellar()?.prepared.transactionHash).toBe(prepared.transactionHash);
    clearPendingStellar(prepared.transactionHash);
    // Nested response.status form — still ambiguous, still retained.
    const nested = Object.assign(new Error("server"), {
      response: { status: 503, data: { extras: { result_codes: { transaction: "tx_failed", operations: ["op_under_dest_min"] } } } },
    });
    const failingNested = horizon({ submitTransaction: vi.fn(async () => { throw nested; }) });
    const second = await adapter(failingNested).submit(signedXdr, prepared);
    expect(second).toMatchObject({ ok: true, value: { status: "unknown", code: "submit_ambiguous" } });
    expect(readPendingStellar()?.prepared.transactionHash).toBe(prepared.transactionHash);
    clearPendingStellar(prepared.transactionHash);
  });

  it("treats success/failure disagreement in chain data as unknown, never definitive", async () => {
    const prepared = await prepareConversion(adapter());
    const signedXdr = signXdr(prepared.unsignedXdr);
    // successful=false + txSuccess result → unknown, pending retained.
    const lying = confirmedRecord(prepared, signedXdr, ppsResultXdr(ACCOUNT, USDC, "86900000"), { successful: false });
    const server = horizon({ transactions: recordTransactions(lying) });
    const got = await adapter(server).getSettlement(prepared.transactionHash, prepared);
    expect(got).toMatchObject({ ok: true });
    expect((got as { value: { status: string } }).value.status).not.toBe("confirmed");
    expect((got as { value: { status: string } }).value.status).not.toBe("failed");
  });

  it("re-checks the hash once after an expired ledger before declaring expired_unseen", async () => {
    const prepared = await prepareConversion(adapter());
    const signedXdr = signXdr(prepared.unsignedXdr);
    const record = confirmedRecord(prepared, signedXdr, ppsResultXdr(ACCOUNT, USDC, "86900000"));
    let lookups = 0;
    const transactions = vi.fn(() => ({
      transaction: () => ({ call: async () => {
        lookups += 1;
        if (lookups < 2) throw Object.assign(new Error("missing"), { name: "NotFoundError", status: 404 });
        return record;
      } }),
    }));
    // Ledger closed far past expiry + 60s margin.
    const late = vi.fn(() => ({ order: () => ({ limit: () => ({ call: async () => ({ records: [{ base_reserve_in_stroops: BASE_RESERVE, base_fee_in_stroops: BASE_FEE, closed_at: "2026-10-25T19:00:00.000Z" }] }) }) }) }));
    const server = horizon({ ledgers: late, transactions });
    const got = await adapter(server).getSettlement(prepared.transactionHash, prepared);
    expect(got).toMatchObject({ ok: true, value: { status: "confirmed", actualOutUnits: "86900000" } });
    expect(lookups).toBe(2);
  });

  it("confirms a prepared trustline from its changeTrust result", async () => {
    const noLine = horizon({ loadAccount: vi.fn(async () => account([native()])) });
    const live = adapter(noLine);
    const prepared = await live.prepareTrustline(ACCOUNT, "tl-ok");
    if (!prepared.ok) throw new Error("expected a prepared trustline");
    const signedXdr = signXdr(prepared.value.unsignedXdr);
    const server = horizon({ ledgers: ledgers(BASE_RESERVE, "300"), transactions: recordTransactions(confirmedRecord(prepared.value, signedXdr, changeTrustResultXdr())) });
    const settled = await adapter(server).getSettlement(prepared.value.transactionHash, prepared.value);
    expect(settled).toMatchObject({ ok: true, value: { status: "trustline_confirmed", feeChargedStroops: "100", ledger: 42 } });
  });
});
