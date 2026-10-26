/**
 * Classic Stellar testnet adapter.
 *
 * Quotes, prepares, and verifies. Signing is a separate method the review
 * control calls. This module does not import the SDK at the top level.
 */

import { stellarCapabilities, stellarEndpoints, stellarTestnetEnabled } from "@diversifi/shared/src/config/stellar";
import {
  STELLAR_DECIMALS,
  STELLAR_DEFAULT_SLIPPAGE_BPS,
  STELLAR_INT64_MAX,
  STELLAR_MAX_SLIPPAGE_BPS,
  STELLAR_QUOTE_TTL_MS,
  STELLAR_TESTNET,
  STELLAR_TESTNET_PASSPHRASE,
  STELLAR_TX_HASH,
  STELLAR_TX_TTL_SECONDS,
  assetsEqual,
  explorerTxUrl,
  isAllowlistedAsset,
  isQuoteFresh,
  isStellarGAddress,
  minimumOutUnits,
  parseAmountUnits,
  parseNonnegativeUnits,
  parsePreparedStellarAction,
  parseStellarAsset,
  parseStellarQuote,
  slippageBpsOf,
  spendableNativeStroops,
  stellarNativeAsset,
  stellarTestnetUsdc,
  type PreparedStellarAction,
  type PreparedStellarTransaction,
  type PreparedStellarTrustline,
  type StellarAccountState,
  type StellarAsset,
  type StellarBalance,
  type StellarCapabilities,
  type StellarFailure,
  type StellarQuote,
  type StellarQuoteRequest,
  type StellarReadinessCode,
  type StellarResult,
  type StellarSettlement,
} from "@diversifi/shared/src/types/stellar";
import type { HorizonServer } from "./sdk";
import type { WalletBridge } from "./wallet";
import { clearPendingStellar, readPendingStellar, writePendingStellar } from "./pending";

export type StellarAdapterOptions = {
  horizonFactory?: (url: string) => HorizonServer;
  wallet?: WalletBridge;
  now?: () => number;
  enabled?: boolean;
};

type BalanceRecord = {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
  selling_liabilities?: string;
  buying_liabilities?: string;
  limit?: string;
  is_authorized?: boolean;
};

type AccountRecord = {
  id: string;
  sequence: string;
  subentry_count: number;
  num_sponsoring?: number;
  num_sponsored?: number;
  last_modified_ledger?: number;
  balances: BalanceRecord[];
};

type LedgerRecord = {
  base_reserve_in_stroops?: unknown;
  base_fee_in_stroops?: unknown;
};

type LedgerParams = { baseReserveStroops: bigint; baseFeeStroops: bigint };

type PathRecord = {
  destination_amount: string;
  source_amount: string;
  path: Array<{ asset_type: string; asset_code?: string; asset_issuer?: string }>;
};

type TransactionRecord = {
  hash: string;
  ledger_attr?: number;
  successful?: boolean;
  result_xdr?: string;
  envelope_xdr?: string;
  fee_charged?: number | string;
  created_at?: string;
  source_account?: string;
};

const TRUSTLINE_LIMIT_UNITS = STELLAR_INT64_MAX.toString();

function fail(code: StellarFailure["code"], message: string, retry: StellarFailure["retry"]): StellarFailure {
  return { ok: false, code, message, retry };
}

function httpStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const value = error as { status?: unknown; response?: { status?: unknown } };
  const status = value.status ?? value.response?.status;
  return typeof status === "number" && Number.isInteger(status) ? status : undefined;
}

function isNotFound(error: unknown): boolean {
  return httpStatus(error) === 404 || (error instanceof Error && error.name === "NotFoundError");
}

function isTimeout(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return /timeout|network|ECONN|fetch failed/i.test(message) || httpStatus(error) === 504;
}

function positiveInt(value: unknown): bigint | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return BigInt(value);
  if (typeof value === "string" && /^[1-9]\d*$/.test(value)) return BigInt(value);
  return null;
}

async function sdk() {
  return import("./sdk");
}

/** Coalesces same-hash submissions across adapter instances (double clicks, remounts). */
const INFLIGHT = new Map<string, Promise<StellarResult<StellarSettlement>>>();

export class StellarTestnetAdapter {
  private account: string | null = null;
  private networkOk = false;
  private readonly now: () => number;
  private readonly enabled: boolean;
  private readonly wallet: WalletBridge | null;
  private readonly horizonFactory?: (url: string) => HorizonServer;

  constructor(private readonly options: StellarAdapterOptions = {}) {
    this.now = options.now ?? Date.now;
    this.enabled = options.enabled ?? stellarTestnetEnabled();
    this.wallet = options.wallet ?? null;
    this.horizonFactory = options.horizonFactory;
  }

  private async horizon(): Promise<StellarResult<HorizonServer>> {
    let endpoints;
    try {
      endpoints = stellarEndpoints();
    } catch (error) {
      return fail("network_error", error instanceof Error ? error.message : "Stellar endpoints are misconfigured.", "none");
    }
    if (this.horizonFactory) return { ok: true, value: this.horizonFactory(endpoints.horizonUrl) };
    const { createHorizon } = await sdk();
    return { ok: true, value: createHorizon(endpoints.horizonUrl) };
  }

  private async walletBridge(): Promise<WalletBridge> {
    if (this.wallet) return this.wallet;
    const { createWalletsKitBridge, createFreighterBridge } = await import("./wallet");
    const kit = createWalletsKitBridge();
    // The kit's picker covers Freighter + LOBSTR + more; if the heavy kit
    // chunk can't load, degrade to the direct Freighter path rather than
    // dead-ending the connect control.
    return (await kit.isAvailable()) ? kit : createFreighterBridge();
  }

  /** Latest ledger reserve and fee. Missing or malformed is a network error, never a default. */
  private async ledgerParams(server: HorizonServer): Promise<StellarResult<LedgerParams>> {
    try {
      const page = await server.ledgers().order("desc").limit(1).call() as { records?: LedgerRecord[] };
      const record = page.records?.[0];
      const reserve = positiveInt(record?.base_reserve_in_stroops);
      const fee = positiveInt(record?.base_fee_in_stroops);
      if (!reserve || !fee) {
        return fail("network_error", "Horizon did not report a usable base reserve and base fee.", "lookup");
      }
      return { ok: true, value: { baseReserveStroops: reserve, baseFeeStroops: fee } };
    } catch {
      return fail("network_error", "Could not read the latest Stellar ledger.", "lookup");
    }
  }

  async getCapabilities(): Promise<StellarCapabilities> {
    if (!this.enabled) return stellarCapabilities({ enabled: false, connected: false, correctNetwork: false, walletAvailable: false });
    const bridge = await this.walletBridge();
    const available = await bridge.isAvailable();
    return stellarCapabilities({
      enabled: true,
      connected: this.account !== null,
      correctNetwork: this.networkOk,
      walletAvailable: available,
    });
  }

  async connect(): Promise<StellarResult<{ account: string; network: typeof STELLAR_TESTNET }>> {
    if (!this.enabled) return fail("disabled", "Stellar testnet is off. Set NEXT_PUBLIC_STELLAR_TESTNET=true to enable the testnet adapter only.", "none");
    this.disconnect();
    const bridge = await this.walletBridge();
    const session = await bridge.connect();
    const { StrKey } = await sdk();
    if ("error" in session || !isStellarGAddress(session.address) || !StrKey.isValidEd25519PublicKey(session.address)) {
      return fail("wallet_missing", "error" in session ? session.error : "Freighter did not return a classic account.", "reconnect");
    }
    const network = await bridge.network();
    if ("error" in network) return fail("wrong_network", network.error, "reconnect");
    if (network.networkPassphrase !== STELLAR_TESTNET_PASSPHRASE) {
      this.disconnect();
      return fail("wrong_network", "Freighter is not on Stellar testnet. Switch the wallet to testnet and connect again.", "reconnect");
    }
    this.account = session.address;
    this.networkOk = true;
    return { ok: true, value: { account: session.address, network: STELLAR_TESTNET } };
  }

  disconnect(): void {
    this.account = null;
    this.networkOk = false;
  }

  async getBalances(account: string): Promise<StellarResult<StellarAccountState>> {
    if (!this.enabled) return fail("disabled", "Stellar testnet is off.", "none");
    const { StrKey } = await sdk();
    if (!isStellarGAddress(account) || !StrKey.isValidEd25519PublicKey(account)) {
      return fail("invalid_destination", "A classic G-address is required.", "none");
    }
    const serverResult = await this.horizon();
    if (!serverResult.ok) return serverResult;
    const server = serverResult.value;
    const params = await this.ledgerParams(server);
    if (!params.ok) return params;
    try {
      const loaded = await server.loadAccount(account) as unknown as AccountRecord;
      return this.readAccount(loaded, params.value, account);
    } catch (error) {
      if (isNotFound(error)) {
        return {
          ok: true,
          value: {
            network: STELLAR_TESTNET,
            account,
            accountKind: "classic",
            exists: false,
            subentryCount: 0,
            reserveStroops: "0",
            baseReserveStroops: params.value.baseReserveStroops.toString(),
            baseFeeStroops: params.value.baseFeeStroops.toString(),
            numSponsoring: 0,
            numSponsored: 0,
            balances: [],
            issues: ["account_unfunded"],
            observedLedger: null,
            observedAt: new Date(this.now()).toISOString(),
          },
        };
      }
      return fail("network_error", "Could not read the Stellar account.", "lookup");
    }
  }

  async quote(request: StellarQuoteRequest): Promise<StellarResult<StellarQuote>> {
    if (!this.enabled) return fail("disabled", "Stellar testnet is off.", "none");
    if (request.kind !== "payment" && request.kind !== "path-payment-strict-send") {
      return fail("unexpected_operation", "Only a same-asset payment or an XLM → USDC conversion can be quoted.", "none");
    }
    const usdc = stellarTestnetUsdc();
    if (!isAllowlistedAsset(request.source) || !isAllowlistedAsset(request.destinationAsset)) {
      return fail("invalid_asset", "Only testnet XLM and Circle testnet USDC are allowed.", "none");
    }
    if (request.kind === "path-payment-strict-send") {
      // The only supported conversion direction and pair.
      if (request.source.kind !== "native" || !assetsEqual(request.destinationAsset, usdc)) {
        return fail("invalid_asset", "The only supported conversion is XLM into Circle testnet USDC.", "none");
      }
      if (request.account !== request.destination) {
        return fail("invalid_destination", "A conversion stays on the connected account. A payment to someone else is a separate reviewed action.", "none");
      }
    } else {
      if (!assetsEqual(request.source, request.destinationAsset)) {
        return fail("invalid_asset", "A payment must send and receive the same asset.", "none");
      }
      if (request.account === request.destination) {
        return fail("invalid_destination", "A payment needs a reviewed destination that is not the sender.", "none");
      }
    }
    if (!isStellarGAddress(request.account) || !isStellarGAddress(request.destination)) {
      return fail("invalid_destination", "Source and destination must be classic G-addresses.", "none");
    }
    const amountIn = parseAmountUnits(request.amount, STELLAR_DECIMALS);
    if (!amountIn) {
      return fail("invalid_amount", "Amount must be a positive 7-decimal value within Stellar's int64 maximum.", "none");
    }
    const readiness = await this.getBalances(request.account);
    if (!readiness.ok) return readiness;
    const state = readiness.value;
    if (state.issues.includes("account_unfunded")) {
      return fail("account_unfunded", readinessMessage("account_unfunded"), "none");
    }
    const native = state.balances.find((balance) => balance.asset.kind === "native");
    if (!native) return fail("network_error", "Horizon did not report the native balance.", "lookup");

    if (request.kind === "payment") {
      return this.paymentReadiness(request, state, amountIn, native);
    }

    for (const issue of ["trustline_required", "trustline_unauthorized", "trustline_full"] as const) {
      if (state.issues.includes(issue)) return fail(issue, readinessMessage(issue), "none");
    }
    if (BigInt(native.spendableUnits) < BigInt(amountIn)) {
      return fail("insufficient_spendable_balance", readinessMessage("insufficient_spendable_balance"), "none");
    }
    const quoted = await this.pathQuote(request, amountIn, state);
    if (!quoted.ok) return quoted;
    // The account's own USDC line must be able to receive the quoted output.
    const line = state.balances.find((balance) => assetsEqual(balance.asset, usdc));
    const capacity = trustlineCapacity(line);
    if (capacity !== null && BigInt(quoted.value.expectedOutUnits) > capacity) {
      return fail("trustline_full", "The USDC trustline limit cannot receive the converted amount. Raise the limit first.", "none");
    }
    return quoted;
  }

  private async paymentReadiness(
    request: StellarQuoteRequest,
    state: StellarAccountState,
    amountIn: string,
    native: StellarBalance,
  ): Promise<StellarResult<StellarQuote>> {
    const source = state.balances.find((balance) => assetsEqual(balance.asset, request.source));
    if (request.source.kind === "native") {
      if (BigInt(native.spendableUnits) < BigInt(amountIn)) {
        return fail("insufficient_spendable_balance", readinessMessage("insufficient_spendable_balance"), "none");
      }
    } else {
      if (!source || BigInt(source.spendableUnits) < BigInt(amountIn)) {
        return fail("insufficient_spendable_balance", "Not enough spendable balance in the payment asset.", "none");
      }
      if (source.authorized === false) {
        return fail("trustline_unauthorized", "The payment asset's trustline is not authorized.", "none");
      }
      // The XLM fee is separate from the payment asset's balance — exact
      // un-clamped eligibility: balance − reserve − selling ≥ base fee.
      const available = BigInt(native.balanceUnits) - BigInt(state.reserveStroops) - BigInt(native.sellingLiabilitiesUnits ?? "0");
      if (available < BigInt(state.baseFeeStroops)) {
        return fail("insufficient_spendable_balance", "Not enough spendable XLM for the fee.", "none");
      }
    }
    const recipient = await this.getBalances(request.destination);
    if (!recipient.ok) return recipient;
    if (!recipient.value.exists) {
      return fail("account_unfunded", "The recipient account does not exist on testnet.", "none");
    }
    if (request.source.kind === "issued") {
      const line = recipient.value.balances.find((balance) => assetsEqual(balance.asset, request.source));
      if (!line) return fail("trustline_required", "The recipient has no USDC trustline.", "none");
      if (!line.authorized) return fail("trustline_unauthorized", "The recipient's USDC trustline is not authorized.", "none");
      const capacity = trustlineCapacity(line);
      if (capacity !== null && BigInt(amountIn) > capacity) {
        return fail("trustline_full", "The recipient's USDC trustline limit cannot receive this amount.", "none");
      }
    }
    return this.paymentQuote(request, amountIn, state);
  }

  async prepare(quote: StellarQuote): Promise<StellarResult<PreparedStellarTransaction>> {
    if (!this.enabled) return fail("disabled", "Stellar testnet is off.", "none");
    const parsed = parseStellarQuote(quote);
    if (!parsed) return fail("proposal_mismatch", "The quote is malformed or no longer matches the supported action.", "requote");
    if (!isQuoteFresh(parsed, this.now())) return fail("quote_expired", "The quote expired. Request a new one before signing.", "requote");
    const check = await this.revalidate({
      account: parsed.account,
      kind: parsed.kind === "payment" ? "payment" : "conversion",
      amountInUnits: parsed.amountInUnits,
      expectedOutUnits: parsed.expectedOutUnits,
      source: parsed.source,
      destination: parsed.destination,
      reviewedFeeStroops: BigInt(parsed.feeMaxStroops),
    });
    if (!check.ok) return check;
    const loaded = check.value.loaded;
    const { Account, TransactionBuilder } = await sdk();
    const expiry = Math.floor(this.now() / 1000) + STELLAR_TX_TTL_SECONDS;
    const source = new Account(loaded.id, loaded.sequence);
    const built = new TransactionBuilder(source, {
      fee: parsed.feeMaxStroops,
      networkPassphrase: STELLAR_TESTNET_PASSPHRASE,
      timebounds: { minTime: 0, maxTime: expiry },
    }).addOperation(await expectedOperation(parsed)).build();
    return {
      ok: true,
      value: {
        kind: "transaction",
        proposalId: parsed.id,
        quote: parsed,
        unsignedXdr: built.toXDR(),
        transactionHash: built.hash().toString("hex"),
        sequence: built.sequence,
        expiresAt: new Date(expiry * 1000).toISOString(),
      },
    };
  }

  async prepareTrustline(account: string, proposalId: string): Promise<StellarResult<PreparedStellarTrustline>> {
    if (!this.enabled) return fail("disabled", "Stellar testnet is off.", "none");
    if (typeof proposalId !== "string" || proposalId.length === 0) {
      return fail("proposal_mismatch", "A trustline proposal needs an id.", "none");
    }
    const { Account, Operation, StrKey, TransactionBuilder, toSdkAsset } = await sdk();
    if (!isStellarGAddress(account) || !StrKey.isValidEd25519PublicKey(account)) {
      return fail("invalid_destination", "A classic G-address is required.", "none");
    }
    // No reviewed fee yet — the latest base fee becomes the reviewed one.
    const check = await this.revalidate({ account, kind: "trustline" });
    if (!check.ok) return check;
    const { loaded, params } = check.value;
    const expiry = Math.floor(this.now() / 1000) + STELLAR_TX_TTL_SECONDS;
    const source = new Account(loaded.id, loaded.sequence);
    const built = new TransactionBuilder(source, {
      fee: params.baseFeeStroops.toString(),
      networkPassphrase: STELLAR_TESTNET_PASSPHRASE,
      timebounds: { minTime: 0, maxTime: expiry },
    }).addOperation(Operation.changeTrust({
      asset: toSdkAsset(stellarTestnetUsdc()),
      limit: decimal(TRUSTLINE_LIMIT_UNITS),
    })).build();
    return {
      ok: true,
      value: {
        kind: "trustline",
        proposalId,
        network: STELLAR_TESTNET,
        account,
        asset: stellarTestnetUsdc(),
        limit: TRUSTLINE_LIMIT_UNITS,
        reserveIncreaseStroops: params.baseReserveStroops.toString(),
        feeMaxStroops: params.baseFeeStroops.toString(),
        unsignedXdr: built.toXDR(),
        transactionHash: built.hash().toString("hex"),
        sequence: built.sequence,
        expiresAt: new Date(expiry * 1000).toISOString(),
      },
    };
  }

  /**
   * Shared readiness revalidation for prepare() and sign(). Constraints,
   * never recommendations: a moved balance, changed sequence, or new
   * trustline state fails instead of adapting the reviewed transaction.
   */
  private async revalidate(input: {
    account: string;
    kind: "conversion" | "payment" | "trustline";
    amountInUnits?: string;
    expectedOutUnits?: string;
    source?: StellarAsset;
    destination?: string;
    /** Reviewed max fee; absent means the latest base fee becomes reviewed. */
    reviewedFeeStroops?: bigint;
    reviewedReserveStroops?: bigint;
    /** When set (pre-sign), the account sequence must still be sequence-1. */
    sequence?: string;
  }): Promise<StellarResult<{ state: StellarAccountState; loaded: AccountRecord; params: LedgerParams }>> {
    const serverResult = await this.horizon();
    if (!serverResult.ok) return serverResult;
    const server = serverResult.value;
    const params = await this.ledgerParams(server);
    if (!params.ok) return params;
    const fee = input.reviewedFeeStroops ?? params.value.baseFeeStroops;
    if (params.value.baseFeeStroops > fee) {
      return fail("quote_stale", "The network fee rose above the reviewed maximum. Re-quote before signing.", "requote");
    }
    if (input.reviewedReserveStroops !== undefined && params.value.baseReserveStroops > input.reviewedReserveStroops) {
      return fail("quote_stale", "The base reserve rose above the reviewed amount. Re-prepare before signing.", "requote");
    }
    let loaded: AccountRecord;
    try {
      loaded = await server.loadAccount(input.account) as unknown as AccountRecord;
    } catch (error) {
      if (isNotFound(error)) return fail("account_unfunded", readinessMessage("account_unfunded"), "none");
      return fail("network_error", "Could not re-read the account.", "lookup");
    }
    if (input.sequence !== undefined && loaded.sequence !== (BigInt(input.sequence) - 1n).toString()) {
      return fail("quote_stale", "The account sequence changed since review. Re-quote before signing.", "requote");
    }
    const stateResult = this.readAccount(loaded, params.value, input.account);
    if (!stateResult.ok) return stateResult;
    const state = stateResult.value;
    if (state.issues.includes("account_unfunded")) return fail("account_unfunded", readinessMessage("account_unfunded"), "none");
    // Un-clamped native availability: balance − reserve − selling liabilities.
    const native = state.balances.find((balance) => balance.asset.kind === "native");
    if (!native) return fail("network_error", "Horizon did not report the native balance.", "lookup");
    const available = BigInt(native.balanceUnits) - BigInt(state.reserveStroops) - BigInt(native.sellingLiabilitiesUnits ?? "0");
    if (input.kind === "trustline") {
      const existing = state.balances.find((balance) => assetsEqual(balance.asset, stellarTestnetUsdc()));
      if (existing) {
        if (!existing.authorized) {
          return fail("trustline_unauthorized", "The USDC trustline exists but is not authorized. A repeat trustline cannot repair issuer authorization.", "none");
        }
        return fail("unexpected_operation", "The account already has a USDC trustline.", "none");
      }
      if (available - fee < params.value.baseReserveStroops) {
        return fail("insufficient_spendable_balance", "Not enough spendable XLM for the trustline's extra reserve.", "none");
      }
      return { ok: true, value: { state, loaded, params: params.value } };
    }
    const amountIn = BigInt(input.amountInUnits ?? "0");
    if (input.kind === "conversion") {
      for (const issue of ["trustline_required", "trustline_unauthorized", "trustline_full"] as const) {
        if (state.issues.includes(issue)) return fail(issue, readinessMessage(issue), "none");
      }
      if (available - fee < amountIn) {
        return fail("insufficient_spendable_balance", readinessMessage("insufficient_spendable_balance"), "none");
      }
      const line = state.balances.find((balance) => assetsEqual(balance.asset, stellarTestnetUsdc()));
      const capacity = trustlineCapacity(line);
      if (capacity !== null && BigInt(input.expectedOutUnits ?? "0") > capacity) {
        return fail("trustline_full", "The USDC trustline limit cannot receive the converted amount.", "none");
      }
      return { ok: true, value: { state, loaded, params: params.value } };
    }
    // payment
    if (input.source?.kind === "native") {
      if (available - fee < amountIn) {
        return fail("insufficient_spendable_balance", readinessMessage("insufficient_spendable_balance"), "none");
      }
    } else {
      const source = state.balances.find((balance) => input.source && assetsEqual(balance.asset, input.source));
      if (!source || BigInt(source.spendableUnits) < amountIn) {
        return fail("insufficient_spendable_balance", "Not enough spendable balance in the payment asset.", "none");
      }
      if (!source.authorized) {
        return fail("trustline_unauthorized", "The payment asset's trustline is not authorized.", "none");
      }
      // Exact fee eligibility: balance − reserve − selling ≥ reviewed fee.
      if (available < fee) {
        return fail("insufficient_spendable_balance", "Not enough spendable XLM for the fee.", "none");
      }
    }
    if (input.destination) {
      const { StrKey } = await sdk();
      if (!isStellarGAddress(input.destination) || !StrKey.isValidEd25519PublicKey(input.destination)) {
        return fail("invalid_destination", "The destination is not a classic G-address.", "none");
      }
      const recipient = await this.getBalances(input.destination);
      if (!recipient.ok) return recipient;
      if (!recipient.value.exists) {
        return fail("account_unfunded", "The recipient account does not exist on testnet.", "none");
      }
      if (input.source?.kind === "issued") {
        const line = recipient.value.balances.find((balance) => input.source && assetsEqual(balance.asset, input.source));
        if (!line) return fail("trustline_required", "The recipient has no USDC trustline.", "none");
        if (!line.authorized) return fail("trustline_unauthorized", "The recipient's USDC trustline is not authorized.", "none");
        const capacity = trustlineCapacity(line);
        if (capacity !== null && amountIn > capacity) {
          return fail("trustline_full", "The recipient's USDC trustline limit cannot receive this amount.", "none");
        }
      }
    }
    return { ok: true, value: { state, loaded, params: params.value } };
  }

  /**
   * Structural + cryptographic validation of a prepared action. No freshness
   * checks here — sign/prepare own expiry so old confirmations stay verifiable.
   */
  async validatePrepared(prepared: unknown): Promise<StellarResult<PreparedStellarAction>> {
    if (!this.enabled) return fail("disabled", "Stellar testnet is off.", "none");
    const parsed = parsePreparedStellarAction(prepared);
    if (!parsed) return fail("proposal_mismatch", "The prepared action is malformed or was tampered with.", "none");
    const { Transaction, TransactionBuilder } = await sdk();
    let tx;
    try {
      tx = TransactionBuilder.fromXDR(parsed.unsignedXdr, STELLAR_TESTNET_PASSPHRASE);
    } catch {
      return fail("proposal_mismatch", "The prepared envelope is not decodable.", "none");
    }
    if (!(tx instanceof Transaction)) {
      return fail("proposal_mismatch", "Fee-bump and non-classic envelopes are not accepted.", "none");
    }
    let envelope;
    try {
      envelope = tx.toEnvelope();
    } catch {
      return fail("proposal_mismatch", "The prepared envelope is not decodable.", "none");
    }
    if (envelope.switch().name !== "envelopeTypeTx") {
      return fail("proposal_mismatch", "Only a v1 classic envelope is accepted.", "none");
    }
    if (tx.signatures.length !== 0) {
      return fail("proposal_mismatch", "The reviewed envelope must be unsigned.", "none");
    }
    const account = parsed.kind === "transaction" ? parsed.quote.account : parsed.account;
    const feeMax = parsed.kind === "transaction" ? parsed.quote.feeMaxStroops : parsed.feeMaxStroops;
    if (parsed.kind === "trustline" && parsed.limit !== TRUSTLINE_LIMIT_UNITS) {
      return fail("proposal_mismatch", "The trustline limit is not the reviewed maximum.", "none");
    }
    const expiryMs = Date.parse(parsed.expiresAt);
    if (!Number.isInteger(expiryMs / 1000)) {
      return fail("proposal_mismatch", "The proposal expiry is not a whole-second timestamp.", "none");
    }
    // Reconstruct the whole reviewed transaction — one operation, no memo,
    // no extra preconditions — and compare the canonical body, not fields.
    const { Account, Operation, TransactionBuilder: TB, toSdkAsset } = await sdk();
    let expected;
    try {
      const operation = parsed.kind === "transaction"
        ? await expectedOperation(parsed.quote)
        : Operation.changeTrust({ asset: toSdkAsset(parsed.asset), limit: decimal(parsed.limit) });
      expected = new TB(new Account(account, (BigInt(parsed.sequence) - 1n).toString()), {
        fee: feeMax,
        networkPassphrase: STELLAR_TESTNET_PASSPHRASE,
        timebounds: { minTime: 0, maxTime: expiryMs / 1000 },
      }).addOperation(operation).build();
    } catch {
      return fail("proposal_mismatch", "The reviewed transaction cannot be reconstructed.", "none");
    }
    if (envelope.v1().tx().toXDR("base64") !== expected.toEnvelope().v1().tx().toXDR("base64")) {
      return fail("proposal_mismatch", "The transaction body does not match the reviewed fields.", "requote");
    }
    if (tx.hash().toString("hex") !== parsed.transactionHash) {
      return fail("proposal_mismatch", "The transaction hash does not match the reviewed body.", "requote");
    }
    if (parsed.kind === "transaction" && parsed.proposalId !== parsed.quote.id) {
      return fail("proposal_mismatch", "The proposal id does not match the reviewed quote.", "none");
    }
    return { ok: true, value: parsed };
  }

  /**
   * Browser-only. Call from the review control's click handler.
   * Cancellation is a typed result, not an exception the UI must guess at.
   */
  async sign(prepared: PreparedStellarAction): Promise<StellarResult<{ signedXdr: string; signer: string }>> {
    if (!this.enabled) return fail("disabled", "Stellar testnet is off.", "none");
    const validated = await this.validatePrepared(prepared);
    if (!validated.ok) return validated;
    const parsed = validated.value;
    const account = parsed.kind === "transaction" ? parsed.quote.account : parsed.account;
    if (Date.parse(parsed.expiresAt) <= this.now()) {
      return fail("quote_expired", "The proposal expired before signing.", "requote");
    }
    if (parsed.kind === "transaction" && !isQuoteFresh(parsed.quote, this.now())) {
      return fail("quote_expired", "The quote expired before signing.", "requote");
    }
    const check = await this.revalidate(
      parsed.kind === "transaction"
        ? {
            account,
            kind: parsed.quote.kind === "payment" ? "payment" : "conversion",
            amountInUnits: parsed.quote.amountInUnits,
            expectedOutUnits: parsed.quote.expectedOutUnits,
            source: parsed.quote.source,
            destination: parsed.quote.destination,
            reviewedFeeStroops: BigInt(parsed.quote.feeMaxStroops),
            sequence: parsed.sequence,
          }
        : {
            account,
            kind: "trustline",
            reviewedFeeStroops: BigInt(parsed.feeMaxStroops),
            reviewedReserveStroops: BigInt(parsed.reserveIncreaseStroops),
            sequence: parsed.sequence,
          },
    );
    if (!check.ok) return check;
    const bridge = await this.walletBridge();
    const network = await bridge.network();
    if ("error" in network || network.networkPassphrase !== STELLAR_TESTNET_PASSPHRASE) {
      this.disconnect();
      return fail("wrong_network", "error" in network ? network.error : "Freighter is no longer on Stellar testnet.", "reconnect");
    }
    const current = await bridge.currentAccount();
    if ("error" in current) {
      this.disconnect();
      return fail("wallet_missing", current.error, "reconnect");
    }
    if (current.address !== account) {
      this.disconnect();
      return fail("proposal_mismatch", "The connected wallet account changed since the proposal was reviewed.", "reconnect");
    }
    if (Date.parse(parsed.expiresAt) <= this.now()
      || (parsed.kind === "transaction" && !isQuoteFresh(parsed.quote, this.now()))) {
      return fail("quote_expired", "The proposal expired while waiting for readiness checks.", "requote");
    }
    const signed = await bridge.sign(parsed.unsignedXdr, account);
    if ("error" in signed) {
      return fail(signed.rejected ? "cancelled" : "network_error", signed.error, signed.rejected ? "none" : "reconnect");
    }
    if (signed.signerAddress !== account) {
      return fail("proposal_mismatch", "Freighter signed with a different account than the one reviewed.", "reconnect");
    }
    const checked = await this.signedEnvelopeMatches(parsed, signed.signedTxXdr);
    if (!checked.ok) return checked;
    return { ok: true, value: { signedXdr: signed.signedTxXdr, signer: signed.signerAddress } };
  }

  async submit(signedXdr: string, prepared: PreparedStellarAction): Promise<StellarResult<StellarSettlement>> {
    if (!this.enabled) return fail("disabled", "Stellar testnet is off.", "none");
    const validated = await this.validatePrepared(prepared);
    if (!validated.ok) return validated;
    const parsed = validated.value;
    const checked = await this.signedEnvelopeMatches(parsed, signedXdr);
    if (!checked.ok) return checked;
    const hash = parsed.transactionHash;
    const existing = INFLIGHT.get(hash);
    if (existing) return existing;
    const task = this.submitOnce(parsed, signedXdr, hash).finally(() => INFLIGHT.delete(hash));
    INFLIGHT.set(hash, task);
    return task;
  }

  private async submitOnce(
    parsed: PreparedStellarAction,
    signedXdr: string,
    hash: string,
  ): Promise<StellarResult<StellarSettlement>> {
    const pending = readPendingStellar();
    if (pending) {
      if (pending.prepared.transactionHash === hash) {
        // A persisted record always means look up, never resubmit.
        return this.finalize(await this.lookupSettlement(parsed), hash);
      }
      return fail("submission_pending", "Another Stellar transaction is still pending. Resolve it before submitting a new one.", "lookup");
    }
    // Only a 404 authorizes the first POST — an existing record (even an
    // incomplete-looking one) is answered by lookup, never reposted.
    const prior = await this.lookupRecord(parsed);
    if (prior.found) return this.finalize(prior.result, hash);
    if (parsed.kind === "transaction" && !isQuoteFresh(parsed.quote, this.now())) {
      return fail("quote_expired", "The reviewed quote expired. Request a new quote.", "requote");
    }
    if (Date.parse(parsed.expiresAt) <= this.now()) {
      return fail("quote_expired", "The proposal expired before submission.", "requote");
    }
    if (!writePendingStellar(parsed)) {
      return fail("storage_unavailable", "The reviewed proposal could not be persisted, so submission is refused before posting.", "none");
    }
    const serverResult = await this.horizon();
    if (!serverResult.ok) return serverResult;
    const server = serverResult.value;
    const { TransactionBuilder } = await sdk();
    const signed = TransactionBuilder.fromXDR(signedXdr, STELLAR_TESTNET_PASSPHRASE);
    try {
      const response = await server.submitTransaction(signed);
      if (response.hash !== hash) {
        return fail("proposal_mismatch", "Horizon accepted a different hash than the reviewed proposal.", "lookup");
      }
      // The submit response alone is not a receipt; read the stored record.
      return this.finalize(await this.lookupSettlement(parsed), hash);
    } catch (error) {
      const codes = horizonResultCodes(error);
      if (!codes) {
        // Ambiguous transport/server failure — the transaction may have
        // landed. Retain the pending record and answer unknown.
        return {
          ok: true,
          value: {
            status: "unknown",
            proposalId: parsed.proposalId,
            txHash: hash,
            code: isTimeout(error) ? "submit_timeout" : "submit_ambiguous",
            retry: "lookup",
          },
        };
      }
      const transaction = codes.transaction ?? "";
      const operation = codes.operations[0] ?? "";
      if (transaction === "tx_bad_seq") {
        // The same hash may still have landed under an earlier sequence.
        const after = await this.lookupSettlement(parsed);
        if (!after.ok || after.value.status !== "pending") return this.finalize(after, hash);
        clearPendingStellar(hash);
        return { ok: true, value: { status: "failed", proposalId: parsed.proposalId, txHash: hash, code: "tx_bad_seq", retry: "requote" } };
      }
      if (operation === "op_under_dest_min" || operation === "op_over_source_max") {
        clearPendingStellar(hash);
        return {
          ok: true,
          value: { status: "failed", proposalId: parsed.proposalId, txHash: hash, code: "below_minimum", retry: "requote" },
        };
      }
      clearPendingStellar(hash);
      return {
        ok: true,
        value: { status: "failed", proposalId: parsed.proposalId, txHash: hash, code: transaction || operation || "rejected", retry: "requote" },
      };
    }
  }

  /** 404 is the only "not found"; everything else is a found-or-unknown result. */
  private async lookupRecord(
    parsed: PreparedStellarAction,
  ): Promise<{ found: false } | { found: true; result: StellarResult<StellarSettlement> }> {
    const serverResult = await this.horizon();
    if (!serverResult.ok) return { found: true, result: serverResult };
    try {
      const record = await serverResult.value.transactions().transaction(parsed.transactionHash).call() as TransactionRecord;
      return { found: true, result: await this.settlementFromRecord(record, parsed) };
    } catch (error) {
      if (isNotFound(error)) return { found: false };
      return {
        found: true,
        result: {
          ok: true,
          value: { status: "unknown", proposalId: parsed.proposalId, txHash: parsed.transactionHash, code: "lookup_failed", retry: "lookup" },
        },
      };
    }
  }

  /** Latest ledger close time in ms, or null when Horizon can't prove it. */
  private async latestLedgerCloseMs(): Promise<number | null> {
    const serverResult = await this.horizon();
    if (!serverResult.ok) return null;
    try {
      const page = await serverResult.value.ledgers().order("desc").limit(1).call() as { records?: Array<{ closed_at?: unknown }> };
      const closed = Date.parse(typeof page.records?.[0]?.closed_at === "string" ? page.records[0].closed_at : "");
      return Number.isFinite(closed) ? closed : null;
    } catch {
      return null;
    }
  }

  /** Clear the persisted record only on a definitive outcome. */
  private finalize(result: StellarResult<StellarSettlement>, hash: string): StellarResult<StellarSettlement> {
    if (result.ok && (result.value.status === "confirmed" || result.value.status === "trustline_confirmed" || result.value.status === "failed")) {
      clearPendingStellar(hash);
    }
    return result;
  }

  async getSettlement(txHash: string, prepared: PreparedStellarAction): Promise<StellarResult<StellarSettlement>> {
    if (!this.enabled) return fail("disabled", "Stellar testnet is off.", "none");
    if (!STELLAR_TX_HASH.test(txHash)) return fail("network_error", "Not a Stellar transaction hash.", "none");
    const validated = await this.validatePrepared(prepared);
    if (!validated.ok) return validated;
    const parsed = validated.value;
    if (txHash !== parsed.transactionHash) {
      return fail("proposal_mismatch", "The hash does not belong to the reviewed proposal.", "none");
    }
    return this.finalize(await this.lookupSettlement(parsed), txHash);
  }

  private async lookupSettlement(parsed: PreparedStellarAction): Promise<StellarResult<StellarSettlement>> {
    const serverResult = await this.horizon();
    if (!serverResult.ok) return serverResult;
    const found = await this.lookupRecord(parsed);
    if (found.found) return found.result;
    // A never-seen hash is pending only while the ledger could still hold it.
    // Once the latest closed ledger is safely past the proposal's expiry
    // (+60s drift margin) it is definitively failed — never auto-resubmitted.
    const closedMs = await this.latestLedgerCloseMs();
    if (closedMs !== null && closedMs > Date.parse(parsed.expiresAt) + 60_000) {
      // Race guard: the tx may have been ingested between the first 404 and
      // the ledger read — look up once more before declaring expiry.
      const again = await this.lookupRecord(parsed);
      if (again.found) return again.result;
      // Note: this proves expiry only while Horizon serves the ledger window;
      // testnet history resets can still lose old records.
      return {
        ok: true,
        value: { status: "failed", proposalId: parsed.proposalId, txHash: parsed.transactionHash, code: "expired_unseen", retry: "requote" },
      };
    }
    return { ok: true, value: { status: "pending", proposalId: parsed.proposalId, txHash: parsed.transactionHash } };
  }

  private async settlementFromRecord(
    record: TransactionRecord,
    parsed: PreparedStellarAction,
  ): Promise<StellarResult<StellarSettlement>> {
    const hash = parsed.transactionHash;
    const account = parsed.kind === "transaction" ? parsed.quote.account : parsed.account;
    const pending: StellarSettlement = { status: "pending", proposalId: parsed.proposalId, txHash: hash };
    if (record.hash !== hash || record.source_account !== account) {
      return fail("proposal_mismatch", "The ledger record does not match the reviewed proposal.", "none");
    }
    const { Transaction, TransactionBuilder, xdr } = await sdk();
    let onChain;
    try {
      if (typeof record.envelope_xdr !== "string") return { ok: true, value: pending };
      onChain = TransactionBuilder.fromXDR(record.envelope_xdr, STELLAR_TESTNET_PASSPHRASE);
    } catch {
      return { ok: true, value: { status: "unknown", proposalId: parsed.proposalId, txHash: hash, code: "malformed_receipt", retry: "lookup" } };
    }
    if (!(onChain instanceof Transaction)) {
      return fail("proposal_mismatch", "The ledger envelope is not the reviewed classic transaction.", "none");
    }
    if (onChain.hash().toString("hex") !== hash) {
      return fail("proposal_mismatch", "The ledger envelope hash does not match the reviewed proposal.", "none");
    }
    let reviewed;
    try {
      reviewed = TransactionBuilder.fromXDR(parsed.unsignedXdr, STELLAR_TESTNET_PASSPHRASE) as InstanceType<typeof Transaction>;
    } catch {
      return fail("proposal_mismatch", "The reviewed envelope is not decodable.", "none");
    }
    const onChainBody = onChain.toEnvelope().v1().tx().toXDR("base64");
    const reviewedBody = reviewed.toEnvelope().v1().tx().toXDR("base64");
    if (onChainBody !== reviewedBody) {
      return fail("proposal_mismatch", "The ledgered transaction body differs from the reviewed proposal.", "none");
    }
    // Definitive failure needs both an explicit false and a readable result.
    if (typeof record.successful !== "boolean" || typeof record.result_xdr !== "string") {
      return { ok: true, value: pending };
    }
    let result;
    try {
      result = xdr.TransactionResult.fromXDR(record.result_xdr, "base64");
    } catch {
      return { ok: true, value: { status: "unknown", proposalId: parsed.proposalId, txHash: hash, code: "malformed_receipt", retry: "lookup" } };
    }
    const outcomeKind = result.result().switch().name;
    if (record.successful === false) {
      // false + a failed result is definitive; false + txSuccess disagrees.
      if (outcomeKind !== "txSuccess") {
        return { ok: true, value: { status: "failed", proposalId: parsed.proposalId, txHash: hash, code: outcomeKind || "rejected", retry: "requote" } };
      }
      return { ok: true, value: { status: "unknown", proposalId: parsed.proposalId, txHash: hash, code: "result_inconsistent", retry: "lookup" } };
    }
    if (outcomeKind !== "txSuccess") {
      return { ok: true, value: { status: "unknown", proposalId: parsed.proposalId, txHash: hash, code: "result_inconsistent", retry: "lookup" } };
    }
    const outcome = await this.confirmedOutcome(result, parsed);
    if (!outcome.ok) return outcome;
    if (outcome.value === null) {
      return { ok: true, value: { status: "unknown", proposalId: parsed.proposalId, txHash: hash, code: "result_inconsistent", retry: "lookup" } };
    }
    if (outcome.value.kind === "mismatch") {
      return fail("proposal_mismatch", "The ledgered result does not match the reviewed operation.", "none");
    }
    // The charged fee is bound twice: record.fee_charged must equal the
    // result XDR's feeCharged and stay within the reviewed maximum.
    const feeMax = parsed.kind === "transaction" ? parsed.quote.feeMaxStroops : parsed.feeMaxStroops;
    const fee = positiveInt(record.fee_charged);
    if (record.fee_charged === undefined) return { ok: true, value: pending };
    if (fee === null) {
      return { ok: true, value: { status: "unknown", proposalId: parsed.proposalId, txHash: hash, code: "malformed_receipt", retry: "lookup" } };
    }
    const resultFee = positiveInt(result.feeCharged().toString());
    if (resultFee === null || resultFee !== fee || fee > BigInt(feeMax)) {
      return fail("proposal_mismatch", "The charged fee does not match the result or exceeded the reviewed maximum.", "none");
    }
    if (!Number.isInteger(record.ledger_attr) || (record.ledger_attr as number) < 1 || typeof record.created_at !== "string" || !Number.isFinite(Date.parse(record.created_at))) {
      // A successful record missing receipt fields is still pending, never invented.
      return { ok: true, value: pending };
    }
    const url = explorerTxUrl(hash);
    if (!url) return { ok: true, value: pending };
    if (parsed.kind === "trustline") {
      return {
        ok: true,
        value: {
          status: "trustline_confirmed",
          proposalId: parsed.proposalId,
          txHash: hash,
          network: STELLAR_TESTNET,
          ledger: record.ledger_attr as number,
          confirmedAt: record.created_at,
          feeChargedStroops: fee.toString(),
          explorerUrl: url,
          reasoningEvidence: "none",
        },
      };
    }
    return {
      ok: true,
      value: {
        status: "confirmed",
        proposalId: parsed.proposalId,
        txHash: hash,
        network: STELLAR_TESTNET,
        ledger: record.ledger_attr as number,
        confirmedAt: record.created_at,
        amountInUnits: parsed.quote.amountInUnits,
        actualOutUnits: outcome.value.actualOut,
        feeChargedStroops: fee.toString(),
        explorerUrl: url,
        reasoningEvidence: "none",
      },
    };
  }

  /** Returns null when the operation did not succeed, "mismatch" when it lies about the proposal. */
  private async confirmedOutcome(
    result: InstanceType<SdkModule["xdr"]["TransactionResult"]>,
    parsed: PreparedStellarAction,
  ): Promise<StellarResult<{ kind: "ok"; actualOut: string } | { kind: "mismatch" } | null>> {
    const { Asset, StrKey } = await sdk();
    if (result.result().switch().name !== "txSuccess") return { ok: true, value: null };
    const results = result.result().results();
    if (!results || results.length !== 1) {
      return fail("unexpected_operation", "The ledgered transaction does not contain exactly one operation result.", "none");
    }
    const operation = results[0];
    if (operation.switch().name !== "opInner") return { ok: true, value: null };
    const body = operation.tr();
    if (!body) return { ok: true, value: null };
    if (parsed.kind === "trustline") {
      if (body.switch().name !== "changeTrust" || body.changeTrustResult().switch().name !== "changeTrustSuccess") {
        return { ok: true, value: { kind: "mismatch" } };
      }
      return { ok: true, value: { kind: "ok", actualOut: "0" } };
    }
    const quote = parsed.quote;
    if (quote.kind === "payment") {
      if (body.switch().name !== "payment" || body.paymentResult().switch().name !== "paymentSuccess") {
        return { ok: true, value: { kind: "mismatch" } };
      }
      return { ok: true, value: { kind: "ok", actualOut: quote.amountInUnits } };
    }
    if (body.switch().name !== "pathPaymentStrictSend") {
      return { ok: true, value: { kind: "mismatch" } };
    }
    const sent = body.pathPaymentStrictSendResult();
    if (sent.switch().name !== "pathPaymentStrictSendSuccess") return { ok: true, value: null };
    const last = sent.success().last();
    const amount = last.amount().toString();
    if (!/^[1-9]\d*$/.test(amount)) {
      return { ok: true, value: { kind: "mismatch" } };
    }
    const destination = StrKey.encodeEd25519PublicKey(last.destination().ed25519());
    const asset = fromSdkAssetSafe(Asset.fromOperation(last.asset()));
    if (destination !== quote.destination || !asset || !assetsEqual(asset, quote.destinationAsset)) {
      return { ok: true, value: { kind: "mismatch" } };
    }
    if (BigInt(amount) < BigInt(quote.minimumOutUnits)) {
      return fail("below_minimum", "The ledgered conversion paid less than the reviewed minimum.", "requote");
    }
    return { ok: true, value: { kind: "ok", actualOut: amount } };
  }

  private async pathQuote(request: StellarQuoteRequest, amountIn: string, state: StellarAccountState): Promise<StellarResult<StellarQuote>> {
    const serverResult = await this.horizon();
    if (!serverResult.ok) return serverResult;
    const { toSdkAsset } = await sdk();
    const slippage = request.slippageBps ?? STELLAR_DEFAULT_SLIPPAGE_BPS;
    try {
      const page = await serverResult.value.strictSendPaths(
        toSdkAsset(request.source),
        decimal(amountIn),
        [toSdkAsset(request.destinationAsset)],
      ).call();
      const record = page.records[0] as PathRecord | undefined;
      if (!record) return fail("no_route", "No Stellar path can fill this amount. No price is available.", "requote");
      const sent = parseAmountUnits(record.source_amount, STELLAR_DECIMALS);
      if (sent !== amountIn) {
        return fail("no_route", "Horizon's path answer does not match the requested amount.", "requote");
      }
      const expected = parseAmountUnits(record.destination_amount, STELLAR_DECIMALS);
      if (!expected) return fail("no_route", "Horizon returned a destination amount that is not a 7-decimal value.", "requote");
      const minimum = minimumOutUnits(expected, slippage);
      if (!minimum) return fail("invalid_amount", "Slippage must be an integer from 0 to 100 basis points, and the minimum must stay positive.", "none");
      const path = record.path.map((hop) => hopToAsset(hop)).filter((hop): hop is StellarAsset => hop !== null);
      if (path.length !== record.path.length) return fail("invalid_asset", "The path includes an asset outside the allowlist.", "none");
      const implied = slippageBpsOf(expected, minimum);
      if (implied === null) return fail("invalid_amount", "Could not bind slippage to the quoted output.", "requote");
      // Integer flooring can push the implied bps above the reviewed
      // maximum on dust-sized outputs — such a quote could never be
      // prepared, so fail the input here instead of at sign time.
      if (implied > STELLAR_MAX_SLIPPAGE_BPS) {
        return fail("invalid_amount", "The converted amount is too small to hold the reviewed slippage floor in whole units. Increase the amount.", "none");
      }
      return {
        ok: true,
        value: {
          id: request.requestId,
          revision: request.revision,
          network: STELLAR_TESTNET,
          account: request.account,
          kind: "path-payment-strict-send",
          destination: request.destination,
          source: request.source,
          destinationAsset: request.destinationAsset,
          amountInUnits: amountIn,
          expectedOutUnits: expected,
          minimumOutUnits: minimum,
          slippageBps: implied,
          priceImpactBps: null,
          feeMaxStroops: state.baseFeeStroops,
          path,
          observedAt: new Date(this.now()).toISOString(),
          expiresAt: new Date(this.now() + STELLAR_QUOTE_TTL_MS).toISOString(),
        },
      };
    } catch (error) {
      if (isNotFound(error)) return fail("no_route", "No Stellar path can fill this amount.", "requote");
      return fail("network_error", "Could not read a Stellar path.", "lookup");
    }
  }

  private paymentQuote(request: StellarQuoteRequest, amountIn: string, state: StellarAccountState): StellarResult<StellarQuote> {
    return {
      ok: true,
      value: {
        id: request.requestId,
        revision: request.revision,
        network: STELLAR_TESTNET,
        account: request.account,
        kind: "payment",
        destination: request.destination,
        source: request.source,
        destinationAsset: request.destinationAsset,
        amountInUnits: amountIn,
        expectedOutUnits: amountIn,
        minimumOutUnits: amountIn,
        slippageBps: 0,
        priceImpactBps: 0,
        feeMaxStroops: state.baseFeeStroops,
        path: [],
        observedAt: new Date(this.now()).toISOString(),
        expiresAt: new Date(this.now() + STELLAR_QUOTE_TTL_MS).toISOString(),
      },
    };
  }

  private readAccount(loaded: AccountRecord, params: LedgerParams, requested: string): StellarResult<StellarAccountState> {
    if (loaded.id !== requested) {
      return fail("network_error", "Horizon returned a different account than requested.", "lookup");
    }
    if (typeof loaded.subentry_count !== "number" || !Number.isSafeInteger(loaded.subentry_count) || loaded.subentry_count < 0) {
      return fail("network_error", "Horizon reported a malformed subentry count.", "lookup");
    }
    const subentryCount = loaded.subentry_count;
    if (typeof loaded.sequence !== "string" || !/^[0-9]+$/.test(loaded.sequence) || BigInt(loaded.sequence) > 18446744073709551615n) {
      return fail("network_error", "Horizon reported a malformed account sequence.", "lookup");
    }
    const sponsorship = (value: unknown): number | null => {
      if (value === undefined) return 0;
      return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
    };
    const numSponsoring = sponsorship(loaded.num_sponsoring);
    const numSponsored = sponsorship(loaded.num_sponsored);
    if (numSponsoring === null || numSponsored === null) {
      return fail("network_error", "Horizon reported malformed sponsorship counts.", "lookup");
    }
    const balances: StellarBalance[] = [];
    const issues: StellarReadinessCode[] = [];
    let usdc: StellarBalance | null = null;
    for (const line of loaded.balances ?? []) {
      const asset = line.asset_type === "native"
        ? stellarNativeAsset()
        : parseStellarAsset({
            network: STELLAR_TESTNET,
            kind: "issued",
            code: line.asset_code,
            issuer: line.asset_issuer,
            decimals: 7,
          });
      if (!asset) continue;
      const balanceUnits = parseNonnegativeUnits(line.balance, 7);
      const selling = parseNonnegativeUnits(line.selling_liabilities ?? "0", 7);
      const buying = parseNonnegativeUnits(line.buying_liabilities ?? "0", 7);
      if (balanceUnits === null || selling === null || buying === null) {
        return fail("network_error", "Horizon reported a malformed balance or liability.", "lookup");
      }
      if (asset.kind === "native") {
        const spendable = spendableNativeStroops({
          balanceStroops: BigInt(balanceUnits),
          subentryCount,
          baseReserveStroops: params.baseReserveStroops,
          numSponsoring,
          numSponsored,
          sellingLiabilitiesStroops: BigInt(selling),
          feeStroops: params.baseFeeStroops,
        }).toString();
        balances.push({ asset, balanceUnits, spendableUnits: spendable, authorized: true, sellingLiabilitiesUnits: selling });
      } else {
        // Issued lines must carry a parseable limit and an explicit
        // authorization flag — never default to unlimited or authorized.
        if (line.limit === undefined || typeof line.is_authorized !== "boolean") {
          return fail("network_error", "Horizon reported an issued balance without a limit or authorization flag.", "lookup");
        }
        const limitUnits = parseNonnegativeUnits(line.limit, 7);
        if (limitUnits === null) {
          return fail("network_error", "Horizon reported a malformed trustline limit.", "lookup");
        }
        const authorized = line.is_authorized;
        const spendable = authorized ? BigInt(balanceUnits) - BigInt(selling) : 0n;
        balances.push({
          asset,
          balanceUnits,
          spendableUnits: (spendable > 0n ? spendable : 0n).toString(),
          authorized,
          limitUnits,
          buyingLiabilitiesUnits: buying,
          sellingLiabilitiesUnits: selling,
        });
        if (assetsEqual(asset, stellarTestnetUsdc())) usdc = balances[balances.length - 1];
      }
    }
    if (!balances.some((balance) => balance.asset.kind === "native")) {
      return fail("network_error", "Horizon did not report the native balance.", "lookup");
    }
    if (!usdc) {
      issues.push("trustline_required");
    } else if (!usdc.authorized) {
      issues.push("trustline_unauthorized");
    } else {
      const capacity = trustlineCapacity(usdc);
      if (capacity !== null && capacity <= 0n) issues.push("trustline_full");
    }
    const reserve = spendableReserve({ subentryCount, numSponsoring, numSponsored }, params.baseReserveStroops);
    return {
      ok: true,
      value: {
        network: STELLAR_TESTNET,
        account: loaded.id,
        accountKind: "classic",
        exists: true,
        subentryCount,
        reserveStroops: reserve.toString(),
        baseReserveStroops: params.baseReserveStroops.toString(),
        baseFeeStroops: params.baseFeeStroops.toString(),
        numSponsoring,
        numSponsored,
        balances,
        issues,
        observedLedger: loaded.last_modified_ledger ?? null,
        observedAt: new Date(this.now()).toISOString(),
      },
    };
  }

  private async signedEnvelopeMatches(prepared: PreparedStellarAction, signedXdr: string): Promise<StellarResult<true>> {
    const { Transaction, TransactionBuilder } = await sdk();
    let signed;
    try {
      signed = TransactionBuilder.fromXDR(signedXdr, STELLAR_TESTNET_PASSPHRASE);
    } catch {
      return fail("proposal_mismatch", "The signed envelope is not a testnet transaction.", "none");
    }
    if (!(signed instanceof Transaction)) {
      return fail("proposal_mismatch", "A fee-bump or non-classic envelope is not the reviewed transaction.", "none");
    }
    if (signed.signatures.length === 0) {
      return fail("proposal_mismatch", "The envelope has no signature.", "none");
    }
    if (signed.toEnvelope().switch().name !== "envelopeTypeTx") {
      return fail("proposal_mismatch", "The signed envelope is not a v1 classic transaction.", "none");
    }
    if (signed.hash().toString("hex") !== prepared.transactionHash) {
      return fail("proposal_mismatch", "The signed transaction hash does not match the reviewed proposal.", "requote");
    }
    let unsigned;
    try {
      unsigned = TransactionBuilder.fromXDR(prepared.unsignedXdr, STELLAR_TESTNET_PASSPHRASE);
    } catch {
      return fail("proposal_mismatch", "The reviewed envelope is not decodable.", "none");
    }
    const signedBody = signed.toEnvelope().v1().tx().toXDR("base64");
    const reviewedBody = unsigned.toEnvelope().v1().tx().toXDR("base64");
    if (signedBody !== reviewedBody) {
      return fail("proposal_mismatch", "Signing changed the reviewed transaction body.", "requote");
    }
    return { ok: true, value: true };
  }
}

function readinessMessage(code: StellarReadinessCode): string {
  switch (code) {
    case "account_unfunded":
      return "This testnet account does not exist yet. Fund it with Friendbot, then connect again. That is testnet-only.";
    case "trustline_required":
      return "Circle testnet USDC needs its own reviewed trustline before a conversion can be quoted.";
    case "trustline_unauthorized":
      return "The USDC trustline exists but the issuer has not authorized it.";
    case "trustline_full":
      return "The USDC trustline limit leaves no room to receive.";
    case "insufficient_spendable_balance":
      return "Not enough spendable XLM after reserves and the fee.";
    default:
      return code;
  }
}

function decimal(units: string): string {
  const padded = units.padStart(8, "0");
  return `${padded.slice(0, -7)}.${padded.slice(-7)}`;
}

async function expectedOperation(quote: StellarQuote): Promise<BuiltOperation> {
  const { Operation, toSdkAsset } = await sdk();
  if (quote.kind === "payment") {
    return Operation.payment({
      destination: quote.destination,
      asset: toSdkAsset(quote.source),
      amount: decimal(quote.amountInUnits),
    });
  }
  return Operation.pathPaymentStrictSend({
    sendAsset: toSdkAsset(quote.source),
    sendAmount: decimal(quote.amountInUnits),
    destination: quote.destination,
    destAsset: toSdkAsset(quote.destinationAsset),
    destMin: decimal(quote.minimumOutUnits),
    path: quote.path.map(toSdkAsset),
  });
}

function hopToAsset(hop: { asset_type: string; asset_code?: string; asset_issuer?: string }): StellarAsset | null {
  if (hop.asset_type === "native") return stellarNativeAsset();
  return parseStellarAsset({
    network: STELLAR_TESTNET,
    kind: "issued",
    code: hop.asset_code,
    issuer: hop.asset_issuer,
    decimals: 7,
  });
}

function fromSdkAssetSafe(asset: SdkAsset): StellarAsset | null {
  if (asset.isNative()) return stellarNativeAsset();
  const issuer = asset.getIssuer();
  if (!issuer) return null;
  return parseStellarAsset({
    network: STELLAR_TESTNET,
    kind: "issued",
    code: asset.getCode(),
    issuer,
    decimals: 7,
  });
}

/** limit − balance − buying liabilities, in units. Null when the limit is unreported. */
function trustlineCapacity(line: StellarBalance | undefined | null): bigint | null {
  if (!line || line.limitUnits === undefined) return null;
  return BigInt(line.limitUnits) - BigInt(line.balanceUnits) - BigInt(line.buyingLiabilitiesUnits ?? "0");
}

function spendableReserve(
  input: { subentryCount: number; numSponsoring: number; numSponsored: number },
  baseReserveStroops: bigint,
): bigint {
  return BigInt(Math.max(0, 2 + input.subentryCount + input.numSponsoring - input.numSponsored)) * baseReserveStroops;
}

type SdkModule = typeof import("./sdk");
type BuiltOperation = ReturnType<SdkModule["Operation"]["payment"]>;
type SdkAsset = ReturnType<SdkModule["Asset"]["fromOperation"]>;

/** Structured Horizon rejection codes; null for transport/ambiguous errors. */
function horizonResultCodes(error: unknown): { transaction?: string; operations: string[] } | null {
  if (typeof error !== "object" || error === null || !("response" in error)) return null;
  // Only a structured 400 rejection is definitive; anything else (5xx,
  // transports, malformed codes) stays ambiguous and keeps pending.
  const status = httpStatus(error);
  if (status !== 400) return null;
  const data = (error as { response?: { data?: { extras?: { result_codes?: unknown } } } }).response?.data;
  const codes = data?.extras?.result_codes;
  if (typeof codes !== "object" || codes === null) return null;
  const record = codes as { transaction?: unknown; operations?: unknown };
  if (typeof record.transaction !== "string" || !/^tx_[a-z_]+$/.test(record.transaction) || record.transaction === "tx_success") return null;
  if (typeof record.transaction !== "string" && !Array.isArray(record.operations)) return null;
  return {
    transaction: typeof record.transaction === "string" ? record.transaction : undefined,
    operations: Array.isArray(record.operations) ? record.operations.filter((code): code is string => typeof code === "string") : [],
  };
}
