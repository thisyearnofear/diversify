import { describe, expect, it, vi } from "vitest";
import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";
import { STELLAR_TESTNET_PASSPHRASE, stellarNativeAsset, stellarTestnetUsdc } from "@diversifi/shared/src/types/stellar";
import { StellarTestnetAdapter } from "../adapter";
import type { WalletBridge } from "../wallet";

const NOW = Date.parse("2026-10-25T18:00:00.000Z");
const ACCOUNT = Keypair.random().publicKey();
const RECIPIENT = Keypair.random().publicKey();

function account(balances: Array<Record<string, unknown>>, sequence = "100") {
  return {
    id: ACCOUNT,
    sequence,
    subentry_count: balances.length - 1,
    last_modified_ledger: 5,
    balances,
  };
}

function native(balance = "20.0000000") {
  return { asset_type: "native", balance, selling_liabilities: "0.0000000" };
}

function usdc() {
  return {
    asset_type: "credit_alphanum4",
    asset_code: "USDC",
    asset_issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    balance: "0.0000000",
    selling_liabilities: "0.0000000",
    is_authorized: true,
  };
}

function horizon(overrides: Record<string, unknown> = {}) {
  return {
    loadAccount: vi.fn(async () => account([native(), usdc()])),
    strictSendPaths: vi.fn(() => ({
      call: async () => ({ records: [{ destination_amount: "8.7094750", source_amount: "10.0000000", path: [] }] }),
    })),
    submitTransaction: vi.fn(),
    transactions: vi.fn(() => ({ transaction: () => ({ call: async () => { throw Object.assign(new Error("missing"), { name: "NotFoundError", status: 404 }); } }) })),
    ...overrides,
  };
}

function wallet(partial: Partial<WalletBridge> = {}): WalletBridge {
  return {
    isAvailable: async () => true,
    connect: async () => ({ address: ACCOUNT }),
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

describe("Stellar testnet adapter", () => {
  it("stays disabled unless the testnet flag is on", async () => {
    const disabled = new StellarTestnetAdapter({ enabled: false, wallet: wallet() });
    const capabilities = await disabled.getCapabilities();
    expect(capabilities.enabled).toBe(false);
    expect(capabilities.canSign).toBe(false);
    expect(capabilities.autonomy).toBe(false);
    await expect(disabled.connect()).resolves.toMatchObject({ ok: false, code: "disabled" });
  });

  it("rejects a mainnet passphrase and a contract-shaped account", async () => {
    const wrong = adapter(horizon(), wallet({ network: async () => ({ networkPassphrase: "Public Global Stellar Network ; September 2015" }) }));
    await expect(wrong.connect()).resolves.toMatchObject({ ok: false, code: "wrong_network" });
    const contract = adapter(horizon(), wallet({ connect: async () => ({ address: "CCEAFOGSGIRVXSNLZ6K6ODOZRPB4HCMJOEQZUNU4OEHTHTEUDWJMNR4S" }) }));
    await expect(contract.connect()).resolves.toMatchObject({ ok: false, code: "wallet_missing" });
  });

  it("reports an unfunded account and a missing trustline without a price", async () => {
    const missing = horizon({ loadAccount: vi.fn(async () => { throw Object.assign(new Error("missing"), { status: 404 }); }) });
    await expect(adapter(missing).quote(conversion)).resolves.toMatchObject({ ok: false, code: "account_unfunded" });
    const noTrust = horizon({ loadAccount: vi.fn(async () => account([native()])) });
    await expect(adapter(noTrust).quote(conversion)).resolves.toMatchObject({ ok: false, code: "trustline_required" });
  });

  it("quotes a strict-send path in 7-decimal units and binds the minimum", async () => {
    const result = await adapter().quote(conversion);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.amountInUnits).toBe("100000000");
    expect(result.value.expectedOutUnits).toBe("87094750");
    expect(result.value.minimumOutUnits).toBe("86223802");
    expect(result.value.slippageBps).toBe(100);
    expect(result.value.kind).toBe("path-payment-strict-send");
  });

  it("does not turn a missing path into a payment", async () => {
    const empty = horizon({ strictSendPaths: vi.fn(() => ({ call: async () => ({ records: [] }) })) });
    await expect(adapter(empty).quote(conversion)).resolves.toMatchObject({ ok: false, code: "no_route" });
    await expect(adapter().quote({ ...conversion, kind: "payment", destination: RECIPIENT })).resolves.toMatchObject({ ok: false, code: "invalid_asset" });
  });

  it("prepares one operation and invalidates an expired quote", async () => {
    const live = adapter();
    const quoted = await live.quote(conversion);
    if (!quoted.ok) throw new Error("expected a quote");
    const prepared = await live.prepare(quoted.value);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const decoded = TransactionBuilder.fromXDR(prepared.value.unsignedXdr, STELLAR_TESTNET_PASSPHRASE);
    expect(decoded.operations).toHaveLength(1);
    expect(decoded.operations[0].type).toBe("pathPaymentStrictSend");
    const expired = new StellarTestnetAdapter({
      enabled: true,
      now: () => NOW + 120_000,
      horizonFactory: () => horizon() as never,
      wallet: wallet(),
    });
    await expect(expired.prepare(quoted.value)).resolves.toMatchObject({ ok: false, code: "quote_expired" });
  });

  it("treats wallet rejection as cancellation and does not submit", async () => {
    const server = horizon();
    const live = adapter(server);
    const quoted = await live.quote(conversion);
    if (!quoted.ok) throw new Error("expected a quote");
    const prepared = await live.prepare(quoted.value);
    if (!prepared.ok) throw new Error("expected a prepared transaction");
    await expect(live.sign(prepared.value)).resolves.toMatchObject({ ok: false, code: "cancelled" });
    expect(server.submitTransaction).not.toHaveBeenCalled();
  });

  it("rejects a signed envelope whose operation body changed", async () => {
    const live = adapter();
    const quoted = await live.quote(conversion);
    if (!quoted.ok) throw new Error("expected a quote");
    const prepared = await live.prepare(quoted.value);
    if (!prepared.ok) throw new Error("expected a prepared transaction");
    const tampered = TransactionBuilder.fromXDR(prepared.value.unsignedXdr, STELLAR_TESTNET_PASSPHRASE);
    tampered.operations[0] = { ...tampered.operations[0], destination: RECIPIENT } as never;
    const bridge = wallet({
      sign: async () => ({ signedTxXdr: tampered.toXDR(), signerAddress: ACCOUNT }),
    });
    const signing = adapter(horizon(), bridge);
    await expect(signing.sign(prepared.value)).resolves.toMatchObject({ ok: false, code: "proposal_mismatch" });
  });

  it("looks up a timed-out hash instead of building another transaction", async () => {
    const server = horizon({
      submitTransaction: vi.fn(async () => { throw new Error("timeout"); }),
    });
    const live = adapter(server);
    const quoted = await live.quote(conversion);
    if (!quoted.ok) throw new Error("expected a quote");
    const prepared = await live.prepare(quoted.value);
    if (!prepared.ok) throw new Error("expected a prepared transaction");
    const signed = TransactionBuilder.fromXDR(prepared.value.unsignedXdr, STELLAR_TESTNET_PASSPHRASE);
    signed.sign(Keypair.random());
    await expect(live.submit(signed.toXDR(), prepared.value)).resolves.toMatchObject({ ok: false, code: "submit_timeout", retry: "lookup" });
    expect(server.submitTransaction).toHaveBeenCalledTimes(1);
    await expect(live.getSettlement("c".repeat(64), quoted.value.id)).resolves.toMatchObject({ ok: true, value: { status: "pending" } });
  });
});
