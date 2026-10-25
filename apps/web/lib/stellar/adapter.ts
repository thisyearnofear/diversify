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
  STELLAR_QUOTE_TTL_MS,
  STELLAR_TESTNET,
  STELLAR_TESTNET_PASSPHRASE,
  STELLAR_TX_TTL_SECONDS,
  assetsEqual,
  explorerTxUrl,
  isAllowlistedAsset,
  isQuoteFresh,
  isStellarGAddress,
  minimumOutUnits,
  parseAmountUnits,
  parseStellarAsset,
  slippageBpsOf,
  spendableNativeStroops,
  stellarNativeAsset,
  type PreparedStellarTransaction,
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

const SUBMITTED = new Map<string, string>();

export type StellarAdapterOptions = {
  horizonFactory?: (url: string) => HorizonServer;
  wallet?: WalletBridge;
  now?: () => number;
  enabled?: boolean;
};

type AccountRecord = {
  id: string;
  sequence: string;
  subentry_count: number;
  last_modified_ledger?: number;
  balances: Array<{
    asset_type: string;
    asset_code?: string;
    asset_issuer?: string;
    balance: string;
    selling_liabilities?: string;
    buying_liabilities?: string;
    is_authorized?: boolean;
  }>;
};

type PathRecord = {
  destination_amount: string;
  source_amount: string;
  path: Array<{ asset_type: string; asset_code?: string; asset_issuer?: string }>;
};

function fail(code: StellarFailure["code"], message: string, retry: StellarFailure["retry"]): StellarFailure {
  return { ok: false, code, message, retry };
}

function httpStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
}

function isNotFound(error: unknown): boolean {
  return httpStatus(error) === 404 || (error instanceof Error && error.name === "NotFoundError");
}

function isTimeout(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return /timeout|network|ECONN|fetch failed/i.test(message) || httpStatus(error) === 504;
}

async function sdk() {
  return import("./sdk");
}

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

  private async horizon(): Promise<HorizonServer> {
    const endpoints = stellarEndpoints();
    if (this.horizonFactory) return this.horizonFactory(endpoints.horizonUrl);
    const { createHorizon } = await sdk();
    return createHorizon(endpoints.horizonUrl);
  }

  private async walletBridge(): Promise<WalletBridge> {
    if (this.wallet) return this.wallet;
    const { createFreighterBridge } = await import("./wallet");
    return createFreighterBridge();
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
    const bridge = await this.walletBridge();
    const session = await bridge.connect();
    if ("error" in session || !isStellarGAddress(session.address)) {
      return fail("wallet_missing", "error" in session ? session.error : "Freighter did not return a classic account.", "reconnect");
    }
    const network = await bridge.network();
    if ("error" in network) return fail("wrong_network", network.error, "reconnect");
    if (network.networkPassphrase !== STELLAR_TESTNET_PASSPHRASE) {
      this.account = null;
      this.networkOk = false;
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
    if (!isStellarGAddress(account)) return fail("invalid_destination", "A classic G-address is required.", "none");
    const server = await this.horizon();
    try {
      const loaded = await server.loadAccount(account) as unknown as AccountRecord;
      return { ok: true, value: this.readAccount(loaded) };
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
    if (!isAllowlistedAsset(request.source) || !isAllowlistedAsset(request.destinationAsset)) {
      return fail("invalid_asset", "Only testnet XLM and Circle testnet USDC are allowed.", "none");
    }
    if (!isStellarGAddress(request.account) || !isStellarGAddress(request.destination)) {
      return fail("invalid_destination", "Source and destination must be classic G-addresses.", "none");
    }
    const amountIn = parseAmountUnits(request.amount, STELLAR_DECIMALS);
    if (!amountIn) return fail("invalid_amount", "Amount must be a positive decimal with at most 7 fractional digits.", "none");
    const readiness = await this.getBalances(request.account);
    if (!readiness.ok) return readiness;
    const blocking = readiness.value.issues.find((issue) => issue === "account_unfunded" || issue === "trustline_required");
    if (blocking && request.destinationAsset.kind === "issued") {
      return fail(blocking, readinessMessage(blocking), blocking === "account_unfunded" ? "none" : "none");
    }
    if (readiness.value.issues.includes("account_unfunded")) {
      return fail("account_unfunded", readinessMessage("account_unfunded"), "none");
    }
    const native = readiness.value.balances.find((balance) => balance.asset.kind === "native");
    if (!native || BigInt(native.spendableUnits) < BigInt(amountIn)) {
      return fail("insufficient_spendable_balance", "Not enough spendable XLM after reserves, liabilities, and the fee.", "none");
    }
    if (request.kind === "payment") return this.paymentQuote(request, amountIn);
    if (request.account !== request.destination) {
      return fail("invalid_destination", "A conversion stays on the connected account. A payment to someone else is a separate reviewed action.", "none");
    }
    if (assetsEqual(request.source, request.destinationAsset)) {
      return fail("invalid_asset", "A conversion needs two different allowlisted assets.", "none");
    }
    return this.pathQuote(request, amountIn);
  }

  async prepare(quote: StellarQuote): Promise<StellarResult<PreparedStellarTransaction>> {
    if (!this.enabled) return fail("disabled", "Stellar testnet is off.", "none");
    if (!isQuoteFresh(quote, this.now())) return fail("quote_expired", "The quote expired. Request a new one before signing.", "requote");
    const server = await this.horizon();
    let loaded: AccountRecord;
    try {
      loaded = await server.loadAccount(quote.account) as unknown as AccountRecord;
    } catch (error) {
      if (isNotFound(error)) return fail("account_unfunded", readinessMessage("account_unfunded"), "none");
      return fail("network_error", "Could not re-read the account sequence.", "lookup");
    }
    const state = this.readAccount(loaded);
    if (state.issues.includes("account_unfunded")) return fail("account_unfunded", readinessMessage("account_unfunded"), "none");
    if (quote.destinationAsset.kind === "issued" && state.issues.includes("trustline_required") && quote.kind !== "payment") {
      return fail("trustline_required", readinessMessage("trustline_required"), "none");
    }
    const { Account, Asset, BASE_FEE_STROOPS, Operation, TransactionBuilder, toSdkAsset } = await sdk();
    const operation = quote.kind === "payment"
      ? Operation.payment({
          destination: quote.destination,
          asset: toSdkAsset(quote.source),
          amount: decimal(quote.amountInUnits),
        })
      : Operation.pathPaymentStrictSend({
          sendAsset: toSdkAsset(quote.source),
          sendAmount: decimal(quote.amountInUnits),
          destination: quote.destination,
          destAsset: toSdkAsset(quote.destinationAsset),
          destMin: decimal(quote.minimumOutUnits),
          path: quote.path.map(toSdkAsset),
        });
    const expiry = Math.floor(this.now() / 1000) + STELLAR_TX_TTL_SECONDS;
    const source = new Account(loaded.id, loaded.sequence);
    const built = new TransactionBuilder(source, {
      fee: BASE_FEE_STROOPS,
      networkPassphrase: STELLAR_TESTNET_PASSPHRASE,
      timebounds: { minTime: 0, maxTime: expiry },
    }).addOperation(operation).build();
    const reviewed = reviewBuilt(built, quote);
    if (!reviewed.ok) return reviewed;
    return {
      ok: true,
      value: {
        proposalId: quote.id,
        quote,
        unsignedXdr: built.toXDR(),
        transactionHash: built.hash().toString("hex"),
        sequence: built.sequence,
        expiresAt: new Date(expiry * 1000).toISOString(),
      },
    };
  }

  /**
   * Browser-only. Call from the review control's click handler.
   * Cancellation is a typed result, not an exception the UI must guess at.
   */
  async sign(prepared: PreparedStellarTransaction): Promise<StellarResult<{ signedXdr: string; signer: string }>> {
    if (!this.enabled) return fail("disabled", "Stellar testnet is off.", "none");
    if (!isQuoteFresh(prepared.quote, this.now())) return fail("quote_expired", "The proposal expired before signing.", "requote");
    const bridge = await this.walletBridge();
    const signed = await bridge.sign(prepared.unsignedXdr, prepared.quote.account);
    if ("error" in signed) {
      return fail(signed.rejected ? "cancelled" : "network_error", signed.error, signed.rejected ? "none" : "reconnect");
    }
    if (signed.signerAddress !== prepared.quote.account) {
      return fail("proposal_mismatch", "Freighter signed with a different account than the one reviewed.", "reconnect");
    }
    const checked = await this.signedBodyMatches(prepared, signed.signedTxXdr);
    if (!checked.ok) return checked;
    return { ok: true, value: { signedXdr: signed.signedTxXdr, signer: signed.signerAddress } };
  }

  async submit(signedXdr: string, prepared: PreparedStellarTransaction): Promise<StellarResult<StellarSettlement>> {
    if (!this.enabled) return fail("disabled", "Stellar testnet is off.", "none");
    const checked = await this.signedBodyMatches(prepared, signedXdr);
    if (!checked.ok) return checked;
    const existing = SUBMITTED.get(prepared.transactionHash);
    if (existing) return this.getSettlement(existing, prepared.proposalId);
    const server = await this.horizon();
    const { TransactionBuilder } = await sdk();
    const signed = TransactionBuilder.fromXDR(signedXdr, STELLAR_TESTNET_PASSPHRASE);
    try {
      const response = await server.submitTransaction(signed);
      SUBMITTED.set(prepared.transactionHash, response.hash);
      if (!response.successful) {
        return {
          ok: true,
          value: { status: "failed", proposalId: prepared.proposalId, txHash: response.hash, code: "rejected", retry: "requote" },
        };
      }
      return await this.confirmedFrom(response, prepared);
    } catch (error) {
      if (isTimeout(error)) {
        return fail("submit_timeout", "Submission timed out. Look up the same hash before trying again.", "lookup");
      }
      const body = errorBody(error);
      if (body.includes("tx_bad_seq")) return fail("tx_bad_seq", "The account sequence changed. Re-quote and review again.", "requote");
      if (body.includes("op_under_dest_min") || body.includes("op_over_source_max")) {
        return fail("below_minimum", "The path paid less than the reviewed minimum.", "requote");
      }
      return {
        ok: true,
        value: { status: "failed", proposalId: prepared.proposalId, code: body || "rejected", retry: "requote" },
      };
    }
  }

  async getSettlement(txHash: string, proposalId: string): Promise<StellarResult<StellarSettlement>> {
    if (!/^[a-f0-9]{64}$/.test(txHash)) return fail("network_error", "Not a Stellar transaction hash.", "none");
    const server = await this.horizon();
    try {
      const record = await server.transactions().transaction(txHash).call();
      if (!record.successful) {
        return { ok: true, value: { status: "failed", proposalId, txHash, code: "rejected", retry: "requote" } };
      }
      const prepared = preparedStub(proposalId, record.source_account);
      return await this.confirmedFrom({
        hash: record.hash,
        ledger: record.ledger_attr,
        successful: record.successful,
        result_xdr: record.result_xdr,
        fee_charged: record.fee_charged,
        created_at: record.created_at,
      }, prepared);
    } catch (error) {
      if (isNotFound(error)) {
        return { ok: true, value: { status: "pending", proposalId, txHash } };
      }
      return { ok: true, value: { status: "unknown", proposalId, txHash, code: "lookup_failed", retry: "lookup" } };
    }
  }

  private async pathQuote(request: StellarQuoteRequest, amountIn: string): Promise<StellarResult<StellarQuote>> {
    const server = await this.horizon();
    const { toSdkAsset } = await sdk();
    const slippage = request.slippageBps ?? STELLAR_DEFAULT_SLIPPAGE_BPS;
    try {
      const page = await server.strictSendPaths(
        toSdkAsset(request.source),
        decimal(amountIn),
        [toSdkAsset(request.destinationAsset)],
      ).call();
      const record = page.records[0] as PathRecord | undefined;
      if (!record) return fail("no_route", "No Stellar path can fill this amount. No price is available.", "requote");
      const expected = parseAmountUnits(record.destination_amount, STELLAR_DECIMALS);
      if (!expected) return fail("no_route", "Horizon returned a destination amount that is not a 7-decimal value.", "requote");
      const minimum = minimumOutUnits(expected, slippage);
      if (!minimum) return fail("invalid_amount", "Slippage must be an integer from 0 to 100 basis points, and the minimum must stay positive.", "none");
      const path = record.path.map((hop) => hopToAsset(hop)).filter((hop): hop is StellarAsset => hop !== null);
      if (path.length !== record.path.length) return fail("invalid_asset", "The path includes an asset outside the allowlist.", "none");
      const implied = slippageBpsOf(expected, minimum);
      if (implied === null) return fail("invalid_amount", "Could not bind slippage to the quoted output.", "requote");
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
          priceImpactBps: 0,
          feeMaxStroops: "100",
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

  private paymentQuote(request: StellarQuoteRequest, amountIn: string): StellarResult<StellarQuote> {
    if (!assetsEqual(request.source, request.destinationAsset)) {
      return fail("invalid_asset", "A payment must send and receive the same asset.", "none");
    }
    if (request.account === request.destination) {
      return fail("invalid_destination", "A payment needs a reviewed destination that is not the sender.", "none");
    }
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
        feeMaxStroops: "100",
        path: [],
        observedAt: new Date(this.now()).toISOString(),
        expiresAt: new Date(this.now() + STELLAR_QUOTE_TTL_MS).toISOString(),
      },
    };
  }

  private readAccount(loaded: AccountRecord): StellarAccountState {
    const subentryCount = loaded.subentry_count ?? 0;
    const balances: StellarBalance[] = [];
    const issues: StellarReadinessCode[] = [];
    let hasUsdc = false;
    for (const line of loaded.balances) {
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
      const balanceUnits = parseAmountUnits(line.balance, 7) ?? "0";
      const selling = parseAmountUnits(line.selling_liabilities ?? "0", 7) ?? 0n;
      const spendable = asset.kind === "native"
        ? spendableNativeStroops({
            balanceStroops: BigInt(parseAmountUnits(line.balance, 7) ?? "0"),
            subentryCount,
            sellingLiabilitiesStroops: BigInt(selling),
            feeStroops: 100n,
          }).toString()
        : balanceUnits;
      if (asset.kind === "issued") hasUsdc = line.is_authorized !== false;
      balances.push({ asset, balanceUnits: parseAmountUnits(line.balance, 7) ?? "0", spendableUnits: spendable, authorized: line.is_authorized !== false });
    }
    if (!hasUsdc) issues.push("trustline_required");
    return {
      network: STELLAR_TESTNET,
      account: loaded.id,
      accountKind: "classic",
      exists: true,
      subentryCount,
      reserveStroops: ((2n + BigInt(subentryCount)) * 10_000_000n).toString(),
      balances,
      issues,
      observedLedger: loaded.last_modified_ledger ?? null,
      observedAt: new Date(this.now()).toISOString(),
    };
  }

  private async signedBodyMatches(prepared: PreparedStellarTransaction, signedXdr: string): Promise<StellarResult<true>> {
    const { TransactionBuilder } = await sdk();
    let signed: ReturnType<typeof TransactionBuilder.fromXDR>;
    try {
      signed = TransactionBuilder.fromXDR(signedXdr, STELLAR_TESTNET_PASSPHRASE);
    } catch {
      return fail("proposal_mismatch", "The signed envelope is not a testnet transaction.", "none");
    }
    if (signed.operations.length !== 1) return fail("unexpected_operation", "The signed transaction does not contain exactly one operation.", "none");
    const unsigned = TransactionBuilder.fromXDR(prepared.unsignedXdr, STELLAR_TESTNET_PASSPHRASE);
    if (signed.hash().toString("hex") !== prepared.transactionHash) {
      return fail("proposal_mismatch", "The signed transaction hash does not match the reviewed proposal.", "requote");
    }
    if (signed.signatures.length === 0) {
      return fail("proposal_mismatch", "The envelope has no signature.", "none");
    }
    if ("sequence" in signed && "sequence" in unsigned && (operationBody(signed) !== operationBody(unsigned) || signed.sequence !== unsigned.sequence)) {
      return fail("proposal_mismatch", "Signing changed the reviewed transaction body.", "requote");
    }
    return { ok: true, value: true };
  }

  private async confirmedFrom(
    response: { hash: string; ledger?: number; successful: boolean; result_xdr?: string; fee_charged?: number | string; created_at?: string },
    prepared: PreparedStellarTransaction,
    record?: { fee_charged?: number | string; created_at?: string; result_xdr?: string; ledger?: number },
  ): Promise<StellarResult<StellarSettlement>> {
    const url = explorerTxUrl(response.hash);
    if (!url || !response.ledger) {
      return { ok: true, value: { status: "pending", proposalId: prepared.proposalId, txHash: response.hash } };
    }
    const actual = await actualOut(record?.result_xdr ?? response.result_xdr, prepared.quote);
    const fee = String(record?.fee_charged ?? response.fee_charged ?? prepared.quote.feeMaxStroops);
    if (!/^[1-9]\d*$/.test(fee) || !actual) {
      return { ok: true, value: { status: "pending", proposalId: prepared.proposalId, txHash: response.hash } };
    }
    return {
      ok: true,
      value: {
        status: "confirmed",
        proposalId: prepared.proposalId,
        txHash: response.hash,
        network: STELLAR_TESTNET,
        ledger: response.ledger,
        confirmedAt: record?.created_at ?? response.created_at ?? new Date(this.now()).toISOString(),
        amountInUnits: prepared.quote.amountInUnits,
        actualOutUnits: actual,
        feeChargedStroops: fee,
        explorerUrl: url,
        reasoningEvidence: "none",
      },
    };
  }
}

function readinessMessage(code: StellarReadinessCode): string {
  switch (code) {
    case "account_unfunded":
      return "This testnet account does not exist yet. Fund it with Friendbot, then connect again. That is testnet-only.";
    case "trustline_required":
      return "Circle testnet USDC needs its own reviewed trustline before a conversion can be quoted.";
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

function reviewBuilt(
  built: { operations: ReadonlyArray<{ type: string; destination?: string }>; source: string },
  quote: StellarQuote,
): StellarResult<true> {
  if (built.operations.length !== 1) return fail("unexpected_operation", "A proposal may contain one operation.", "none");
  if (built.source !== quote.account) return fail("proposal_mismatch", "The transaction source is not the reviewed account.", "requote");
  const operation = built.operations[0];
  if (quote.kind === "payment" && operation.type !== "payment") {
    return fail("unexpected_operation", "A payment proposal built a different operation.", "none");
  }
  if (quote.kind === "path-payment-strict-send" && operation.type !== "pathPaymentStrictSend") {
    return fail("unexpected_operation", "A conversion proposal built a different operation.", "none");
  }
  if (operation.destination !== quote.destination) {
    return fail("unexpected_operation", "The operation destination is not the reviewed destination.", "none");
  }
  return { ok: true, value: true };
}

function operationBody(tx: { operations: unknown[] }): string {
  return JSON.stringify(tx.operations);
}

async function actualOut(resultXdr: string | undefined, quote: StellarQuote): Promise<string | null> {
  if (!resultXdr) return null;
  try {
    const { xdr } = await import("@stellar/stellar-sdk");
    const result = xdr.TransactionResult.fromXDR(resultXdr, "base64");
    const code = result.result().switch().name;
    if (code !== "txSuccess") return null;
    const operation = result.result().results()?.[0];
    if (!operation || operation.switch().name !== "opInner") return null;
    const body = operation.tr();
    if (!body || body.switch().name !== "pathPaymentStrictSend") return quote.kind === "payment" ? quote.amountInUnits : null;
    const sent = body.pathPaymentStrictSendResult();
    if (sent.switch().name !== "pathPaymentStrictSendSuccess") return null;
    const amount = sent.success().last().amount().toString();
    return /^[1-9]\d*$/.test(amount) ? amount : null;
  } catch {
    return null;
  }
}

function preparedStub(proposalId: string, account: string): PreparedStellarTransaction {
  const asset = stellarNativeAsset();
  return {
    proposalId,
    quote: {
      id: proposalId,
      revision: 1,
      network: STELLAR_TESTNET,
      account,
      kind: "payment",
      destination: account,
      source: asset,
      destinationAsset: asset,
      amountInUnits: "1",
      expectedOutUnits: "1",
      minimumOutUnits: "1",
      slippageBps: 0,
      priceImpactBps: 0,
      feeMaxStroops: "100",
      path: [],
      observedAt: new Date(0).toISOString(),
      expiresAt: new Date(0).toISOString(),
    },
    unsignedXdr: "",
    transactionHash: "",
    sequence: "0",
    expiresAt: new Date(0).toISOString(),
  };
}

function errorBody(error: unknown): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const data = (error as { response?: { data?: { extras?: { result_codes?: unknown } } } }).response?.data;
    return JSON.stringify(data?.extras?.result_codes ?? data ?? "");
  }
  return error instanceof Error ? error.message : "";
}
