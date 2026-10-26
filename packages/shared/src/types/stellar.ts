/**
 * Stellar testnet settlement boundary.
 *
 * SDK-free on purpose. Rendering, voice, and the shared barrel must not import
 * `@stellar/stellar-sdk` or `@stellar/freighter-api`. The browser adapter in
 * `apps/web/lib/stellar/` is the only module allowed to.
 *
 * P0 has no mainnet branch and no numeric EVM chain id. A G-address is not an
 * `0x` address and must not be passed to EVM auth, sanctions, or token maps.
 */

export const STELLAR_TESTNET = "stellar:testnet" as const;
export type StellarNetwork = typeof STELLAR_TESTNET;

export const STELLAR_DECIMALS = 7 as const;
/** One XLM = 10_000_000 stroops. Fees are always stroops, never asset units. */
export const STROOPS_PER_XLM = 10_000_000n;

/**
 * Test SDF Network ; September 2015.
 * Pass this as Freighter `networkPassphrase` alone. Freighter 6.0.1 ignores
 * the passphrase when `network` is also set, so the adapter must not pass both.
 */
export const STELLAR_TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";

export const STELLAR_HORIZON_TESTNET = "https://horizon-testnet.stellar.org";
export const STELLAR_RPC_TESTNET = "https://soroban-testnet.stellar.org";
export const STELLAR_EXPLORER_TX_TESTNET = "https://stellar.expert/explorer/testnet/tx";

/**
 * Circle's documented Stellar testnet USDC issuer.
 * Re-verify against Circle before any rehearsal. This is not a mainnet issuer
 * and not an EVM USDC contract. Classic Stellar USDC has 7 decimal places.
 */
export const STELLAR_TESTNET_USDC_CODE = "USDC";
export const STELLAR_TESTNET_USDC_ISSUER =
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

/**
 * Classic account. The charset check is not checksum validation — call
 * `isStellarGAddress`, which also requires a zero version byte. Contract
 * (C…) addresses are a different execution path and fail this check.
 */
export const STELLAR_G_ADDRESS = /^G[A-Z2-7]{55}$/;
export const STELLAR_TX_HASH = /^[a-f0-9]{64}$/;

export const STELLAR_QUOTE_TTL_MS = 60_000;
export const STELLAR_TX_TTL_SECONDS = 300;
/** 1% of the pathfinding destination amount, integer basis points. */
export const STELLAR_DEFAULT_SLIPPAGE_BPS = 100;
export const STELLAR_MAX_SLIPPAGE_BPS = 100;
/** Largest positive amount any classic Stellar operation can carry. */
export const STELLAR_INT64_MAX = 9223372036854775807n;

const AMOUNT_RE = /^(0|[1-9]\d*)(\.\d+)?$/;

export type StellarAsset =
  | { network: StellarNetwork; kind: "native"; code: "XLM"; decimals: 7 }
  | {
      network: StellarNetwork;
      kind: "issued";
      code: string;
      issuer: string;
      decimals: 7;
    };

export type StellarCapabilities = {
  network: StellarNetwork;
  wallet: "freighter";
  accountKind: "classic";
  /** False unless the testnet flag is on. Connectivity alone is not support. */
  enabled: boolean;
  canQuote: boolean;
  canSign: boolean;
  canSubmit: boolean;
  autonomy: false;
  reasoningEvidence: "none";
};

export type StellarReadinessCode =
  | "not_connected"
  | "wrong_network"
  | "account_unfunded"
  | "trustline_required"
  | "trustline_unauthorized"
  | "trustline_full"
  | "insufficient_spendable_balance"
  | "wallet_missing";

export type StellarBalance = {
  asset: StellarAsset;
  /** Total balance, integer asset units. */
  balanceUnits: string;
  /**
   * Amount that can leave the account without dropping below reserves,
   * selling liabilities, or the fee this proposal will reserve.
   */
  spendableUnits: string;
  authorized: boolean;
  /** Integer units offered for sale (open orders) — needed for exact fee arithmetic. */
  sellingLiabilitiesUnits?: string;
  /** Issued balances only: trustline limit and buying liabilities, integer units. */
  limitUnits?: string;
  buyingLiabilitiesUnits?: string;
};

export type StellarAccountState = {
  network: StellarNetwork;
  account: string;
  accountKind: "classic";
  exists: boolean;
  subentryCount: number;
  /** (2 + subentries + sponsoring − sponsored) × base reserve, in stroops. */
  reserveStroops: string;
  /** Latest ledger base reserve and base fee, in stroops. "0" when unavailable. */
  baseReserveStroops: string;
  baseFeeStroops: string;
  numSponsoring: number;
  numSponsored: number;
  balances: StellarBalance[];
  issues: StellarReadinessCode[];
  observedLedger: number | null;
  observedAt: string;
};

export type StellarQuoteKind = "path-payment-strict-send" | "payment";

export type StellarQuote = {
  id: string;
  revision: number;
  network: StellarNetwork;
  account: string;
  kind: StellarQuoteKind;
  /** Same account for a conversion. A reviewed G-address for a payment. */
  destination: string;
  source: StellarAsset;
  destinationAsset: StellarAsset;
  amountInUnits: string;
  expectedOutUnits: string;
  minimumOutUnits: string;
  /** Integer basis points: (expected − minimum) / expected. */
  slippageBps: number;
  /** Always 0 for a same-asset payment. Null for a conversion: unmeasured, never fabricated. */
  priceImpactBps: number | null;
  feeMaxStroops: string;
  path: StellarAsset[];
  observedAt: string;
  expiresAt: string;
};

export type StellarQuoteRequest = {
  kind: StellarQuoteKind;
  account: string;
  destination: string;
  source: StellarAsset;
  destinationAsset: StellarAsset;
  /** Decimal user amount. Parsed with the asset's decimals. Never a float multiply. */
  amount: string;
  slippageBps?: number;
  requestId: string;
  revision: number;
};

export type PreparedStellarTransaction = {
  kind: "transaction";
  proposalId: string;
  quote: StellarQuote;
  /** Adapter/signer boundary. Never put this in model context. */
  unsignedXdr: string;
  /** Hex of the network-bound transaction hash of the reviewed body. */
  transactionHash: string;
  sequence: string;
  expiresAt: string;
};

export type PreparedStellarTrustline = {
  kind: "trustline";
  proposalId: string;
  network: StellarNetwork;
  account: string;
  asset: StellarAsset;
  /** Integer asset units. */
  limit: string;
  reserveIncreaseStroops: string;
  feeMaxStroops: string;
  unsignedXdr: string;
  transactionHash: string;
  sequence: string;
  expiresAt: string;
};

export type PreparedStellarAction = PreparedStellarTransaction | PreparedStellarTrustline;

export type StellarSettlement =
  | { status: "submitted" | "pending"; proposalId: string; txHash: string }
  | {
      status: "confirmed";
      proposalId: string;
      txHash: string;
      network: StellarNetwork;
      ledger: number;
      confirmedAt: string;
      amountInUnits: string;
      /** From the operation result, never from the quote. */
      actualOutUnits: string;
      feeChargedStroops: string;
      explorerUrl: string;
      reasoningEvidence: "none";
    }
  | {
      status: "trustline_confirmed";
      proposalId: string;
      txHash: string;
      network: StellarNetwork;
      ledger: number;
      confirmedAt: string;
      feeChargedStroops: string;
      explorerUrl: string;
      reasoningEvidence: "none";
    }
  | {
      status: "failed" | "unknown";
      proposalId: string;
      txHash?: string;
      code: string;
      retry: "lookup" | "requote" | "reconnect" | "none";
    };

export type StellarFailureCode =
  | StellarReadinessCode
  | "disabled"
  | "invalid_amount"
  | "invalid_asset"
  | "invalid_destination"
  | "no_route"
  | "quote_expired"
  | "quote_stale"
  | "proposal_mismatch"
  | "cancelled"
  | "submit_timeout"
  | "tx_bad_seq"
  | "below_minimum"
  | "unexpected_operation"
  | "settlement_rejected"
  | "submission_pending"
  | "storage_unavailable"
  | "network_error";

export type StellarFailure = {
  ok: false;
  code: StellarFailureCode;
  message: string;
  retry: "lookup" | "requote" | "reconnect" | "none";
};

export type StellarResult<T> = { ok: true; value: T } | StellarFailure;

export function stellarNativeAsset(): StellarAsset {
  return { network: STELLAR_TESTNET, kind: "native", code: "XLM", decimals: STELLAR_DECIMALS };
}

export function stellarTestnetUsdc(): StellarAsset {
  return {
    network: STELLAR_TESTNET,
    kind: "issued",
    code: STELLAR_TESTNET_USDC_CODE,
    issuer: STELLAR_TESTNET_USDC_ISSUER,
    decimals: STELLAR_DECIMALS,
  };
}

/**
 * Charset and length only. A leading `G` is the ed25519 account version, so a
 * contract address cannot pass. The browser bridge checks the checksum with
 * the SDK before a network call.
 */
export function isStellarGAddress(value: string): boolean {
  return STELLAR_G_ADDRESS.test(value);
}

export function assetsEqual(a: StellarAsset, b: StellarAsset): boolean {
  if (a.network !== b.network || a.kind !== b.kind || a.code !== b.code || a.decimals !== b.decimals) {
    return false;
  }
  if (a.kind === "native" || b.kind === "native") return a.kind === b.kind;
  return a.issuer === b.issuer;
}

/** Strict allowlist. Same code, different issuer, is a different asset. */
export function isAllowlistedAsset(asset: StellarAsset): boolean {
  if (asset.network !== STELLAR_TESTNET || asset.decimals !== STELLAR_DECIMALS) return false;
  if (asset.kind === "native") return asset.code === "XLM";
  return asset.code === STELLAR_TESTNET_USDC_CODE && asset.issuer === STELLAR_TESTNET_USDC_ISSUER;
}

/**
 * Parse a decimal amount into integer asset units.
 * Rejects signs, exponent notation, and more fractional digits than `decimals`.
 */
export function parseAmountUnits(amount: string, decimals: number): string | null {
  if (typeof amount !== "string" || !AMOUNT_RE.test(amount) || decimals < 0 || decimals > 18) return null;
  const [whole, frac = ""] = amount.split(".");
  if (frac.length > decimals) return null;
  try {
    const units = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, "0") || "0");
    if (units <= 0n || units > STELLAR_INT64_MAX) return null;
    return units.toString();
  } catch {
    return null;
  }
}

/** Same rules as parseAmountUnits, but a zero balance is a valid network value. */
export function parseNonnegativeUnits(amount: string, decimals: number): string | null {
  if (typeof amount !== "string" || !AMOUNT_RE.test(amount) || decimals < 0 || decimals > 18) return null;
  const [whole, frac = ""] = amount.split(".");
  if (frac.length > decimals) return null;
  try {
    const units = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, "0") || "0");
    if (units < 0n || units > STELLAR_INT64_MAX) return null;
    return units.toString();
  } catch {
    return null;
  }
}

/** Format integer units for display. Does not parse. Trailing zeros are kept to `decimals`. */
export function formatAmountUnits(units: string, decimals: number): string | null {
  if (!/^(0|[1-9]\d*)$/.test(units) || decimals < 0) return null;
  const padded = units.padStart(decimals + 1, "0");
  const whole = padded.slice(0, padded.length - decimals);
  const frac = decimals === 0 ? "" : padded.slice(padded.length - decimals);
  return decimals === 0 ? whole : `${whole}.${frac}`;
}

/**
 * Classic spendable native balance, in stroops.
 * Reserve = (2 + subentries + sponsoring − sponsored) × the latest base
 * reserve. Selling liabilities and the fee this proposal will reserve are
 * subtracted. Trustlines are subentries.
 */
export function spendableNativeStroops(input: {
  balanceStroops: bigint;
  subentryCount: number;
  /** From the latest ledger. Never default to 1 XLM. */
  baseReserveStroops: bigint;
  numSponsoring?: number;
  numSponsored?: number;
  sellingLiabilitiesStroops: bigint;
  feeStroops: bigint;
}): bigint {
  const reserve = BigInt(
    Math.max(0, 2 + input.subentryCount + (input.numSponsoring ?? 0) - (input.numSponsored ?? 0)),
  ) * input.baseReserveStroops;
  const spendable = input.balanceStroops - reserve - input.sellingLiabilitiesStroops - input.feeStroops;
  return spendable > 0n ? spendable : 0n;
}

/** minimum = expected × (10_000 − bps) / 10_000, rounding down. */
export function minimumOutUnits(expectedUnits: string, slippageBps: number): string | null {
  if (!/^(0|[1-9]\d*)$/.test(expectedUnits)) return null;
  if (!Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps > STELLAR_MAX_SLIPPAGE_BPS) return null;
  const expected = BigInt(expectedUnits);
  if (expected <= 0n) return null;
  const minimum = (expected * BigInt(10_000 - slippageBps)) / 10_000n;
  return minimum > 0n ? minimum.toString() : null;
}

export function slippageBpsOf(expectedUnits: string, minimumUnits: string): number | null {
  if (!/^[1-9]\d*$/.test(expectedUnits) || !/^[1-9]\d*$/.test(minimumUnits)) return null;
  const expected = BigInt(expectedUnits);
  const minimum = BigInt(minimumUnits);
  if (minimum > expected) return null;
  return Number(((expected - minimum) * 10_000n) / expected);
}

export function explorerTxUrl(txHash: string): string | null {
  if (!STELLAR_TX_HASH.test(txHash)) return null;
  return `${STELLAR_EXPLORER_TX_TESTNET}/${txHash}`;
}

export function isQuoteFresh(quote: StellarQuote, nowMs: number): boolean {
  const expires = Date.parse(quote.expiresAt);
  return Number.isFinite(expires) && expires > nowMs;
}

export function disabledCapabilities(): StellarCapabilities {
  return {
    network: STELLAR_TESTNET,
    wallet: "freighter",
    accountKind: "classic",
    enabled: false,
    canQuote: false,
    canSign: false,
    canSubmit: false,
    autonomy: false,
    reasoningEvidence: "none",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseStellarAsset(value: unknown): StellarAsset | null {
  if (!isRecord(value) || value.network !== STELLAR_TESTNET || value.decimals !== STELLAR_DECIMALS) return null;
  if (value.kind === "native" && value.code === "XLM") return stellarNativeAsset();
  if (
    value.kind === "issued"
    && value.code === STELLAR_TESTNET_USDC_CODE
    && value.issuer === STELLAR_TESTNET_USDC_ISSUER
  ) {
    return stellarTestnetUsdc();
  }
  return null;
}

const RETRIES = new Set(["lookup", "requote", "reconnect", "none"]);

/** Rejects extra fields and any quote whose terms disagree with each other. */
export function parseStellarQuote(value: unknown): StellarQuote | null {
  if (!isRecord(value)) return null;
  const allowed = [
    "id", "revision", "network", "account", "kind", "destination", "source",
    "destinationAsset", "amountInUnits", "expectedOutUnits", "minimumOutUnits",
    "slippageBps", "priceImpactBps", "feeMaxStroops", "path", "observedAt", "expiresAt",
  ];
  if (Object.keys(value).some((key) => !allowed.includes(key))) return null;
  const source = parseStellarAsset(value.source);
  const destinationAsset = parseStellarAsset(value.destinationAsset);
  if (!source || !destinationAsset) return null;
  if (typeof value.id !== "string" || !value.id) return null;
  if (typeof value.account !== "string" || typeof value.destination !== "string") return null;
  if (!isStellarGAddress(value.account) || !isStellarGAddress(value.destination)) return null;
  if (value.network !== STELLAR_TESTNET) return null;
  if (value.kind !== "path-payment-strict-send" && value.kind !== "payment") return null;
  if (!Number.isInteger(value.revision) || (value.revision as number) < 1) return null;
  if (!Number.isInteger(value.slippageBps)) return null;
  if (value.priceImpactBps !== null && !Number.isInteger(value.priceImpactBps)) return null;
  const amountIn = value.amountInUnits;
  const expected = value.expectedOutUnits;
  const minimum = value.minimumOutUnits;
  const fee = value.feeMaxStroops;
  if (typeof amountIn !== "string" || typeof expected !== "string" || typeof minimum !== "string" || typeof fee !== "string") {
    return null;
  }
  if ([amountIn, expected, minimum, fee].some((part) => !/^[1-9]\d*$/.test(part) || BigInt(part) > STELLAR_INT64_MAX)) {
    return null;
  }
  if (!Array.isArray(value.path) || value.path.some((hop) => !parseStellarAsset(hop))) return null;
  if (typeof value.observedAt !== "string" || typeof value.expiresAt !== "string") return null;
  const observed = Date.parse(value.observedAt);
  const expires = Date.parse(value.expiresAt);
  if (!Number.isFinite(observed) || !Number.isFinite(expires) || expires <= observed) return null;
  if (value.kind === "payment") {
    if (!assetsEqual(source, destinationAsset) || value.path.length !== 0) return null;
    if (amountIn !== expected || expected !== minimum || value.priceImpactBps !== 0) return null;
    if (value.account === value.destination) return null;
  } else {
    // The only supported conversion is XLM into pinned Circle testnet USDC.
    if (source.kind !== "native" || !assetsEqual(destinationAsset, stellarTestnetUsdc())) return null;
    if (value.account !== value.destination || assetsEqual(source, destinationAsset)) return null;
    if (value.priceImpactBps !== null) return null;
  }
  const implied = slippageBpsOf(expected, minimum);
  if (implied === null || implied !== value.slippageBps) return null;
  if ((value.slippageBps as number) > STELLAR_MAX_SLIPPAGE_BPS) return null;
  return value as unknown as StellarQuote;
}

const PREPARED_TX_KEYS = ["kind", "proposalId", "quote", "unsignedXdr", "transactionHash", "sequence", "expiresAt"];
const PREPARED_TL_KEYS = [
  "kind", "proposalId", "network", "account", "asset", "limit",
  "reserveIncreaseStroops", "feeMaxStroops", "unsignedXdr", "transactionHash", "sequence", "expiresAt",
];

function isPositiveUnits(value: unknown): value is string {
  return typeof value === "string" && /^[1-9]\d*$/.test(value) && BigInt(value) <= STELLAR_INT64_MAX;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isSequence(value: unknown): value is string {
  return typeof value === "string" && /^[0-9]+$/.test(value);
}

/**
 * Structural validation of a persisted prepared action. Explicit field picks,
 * never a wholesale cast. Cryptographic binding is the adapter's job.
 */
export function parsePreparedStellarAction(value: unknown): PreparedStellarAction | null {
  if (!isRecord(value)) return null;
  if (value.kind === "transaction") {
    if (Object.keys(value).some((key) => !PREPARED_TX_KEYS.includes(key))) return null;
    const quote = parseStellarQuote(value.quote);
    if (!quote || quote.id !== value.proposalId) return null;
    if (typeof value.unsignedXdr !== "string" || value.unsignedXdr.length === 0) return null;
    if (typeof value.transactionHash !== "string" || !STELLAR_TX_HASH.test(value.transactionHash)) return null;
    if (!isSequence(value.sequence) || !isIsoDate(value.expiresAt)) return null;
    return {
      kind: "transaction",
      proposalId: quote.id,
      quote,
      unsignedXdr: value.unsignedXdr,
      transactionHash: value.transactionHash,
      sequence: value.sequence,
      expiresAt: value.expiresAt,
    };
  }
  if (value.kind === "trustline") {
    if (Object.keys(value).some((key) => !PREPARED_TL_KEYS.includes(key))) return null;
    const asset = parseStellarAsset(value.asset);
    if (!asset || !assetsEqual(asset, stellarTestnetUsdc())) return null;
    if (value.network !== STELLAR_TESTNET) return null;
    if (typeof value.proposalId !== "string" || value.proposalId.length === 0) return null;
    if (typeof value.account !== "string" || !isStellarGAddress(value.account)) return null;
    if (!isPositiveUnits(value.limit) || !isPositiveUnits(value.reserveIncreaseStroops) || !isPositiveUnits(value.feeMaxStroops)) {
      return null;
    }
    if (typeof value.unsignedXdr !== "string" || value.unsignedXdr.length === 0) return null;
    if (typeof value.transactionHash !== "string" || !STELLAR_TX_HASH.test(value.transactionHash)) return null;
    if (!isSequence(value.sequence) || !isIsoDate(value.expiresAt)) return null;
    return {
      kind: "trustline",
      proposalId: value.proposalId,
      network: STELLAR_TESTNET,
      account: value.account,
      asset,
      limit: value.limit,
      reserveIncreaseStroops: value.reserveIncreaseStroops,
      feeMaxStroops: value.feeMaxStroops,
      unsignedXdr: value.unsignedXdr,
      transactionHash: value.transactionHash,
      sequence: value.sequence,
      expiresAt: value.expiresAt,
    };
  }
  return null;
}

export function parseStellarSettlement(value: unknown): StellarSettlement | null {
  if (!isRecord(value) || typeof value.status !== "string" || typeof value.proposalId !== "string") return null;
  if (value.status === "submitted" || value.status === "pending") {
    if (typeof value.txHash !== "string" || !STELLAR_TX_HASH.test(value.txHash)) return null;
    if (Object.keys(value).some((key) => !["status", "proposalId", "txHash"].includes(key))) return null;
    return { status: value.status, proposalId: value.proposalId, txHash: value.txHash };
  }
  if (value.status === "confirmed") {
    if (value.network !== STELLAR_TESTNET || value.reasoningEvidence !== "none") return null;
    if (typeof value.txHash !== "string" || !STELLAR_TX_HASH.test(value.txHash)) return null;
    if (!Number.isInteger(value.ledger) || (value.ledger as number) < 1) return null;
    if (typeof value.confirmedAt !== "string" || !Number.isFinite(Date.parse(value.confirmedAt))) return null;
    for (const key of ["amountInUnits", "actualOutUnits", "feeChargedStroops"] as const) {
      if (typeof value[key] !== "string" || !/^[1-9]\d*$/.test(value[key] as string)) return null;
    }
    const explorer = explorerTxUrl(value.txHash);
    if (!explorer || value.explorerUrl !== explorer) return null;
    return value as unknown as StellarSettlement;
  }
  if (value.status === "trustline_confirmed") {
    if (value.network !== STELLAR_TESTNET || value.reasoningEvidence !== "none") return null;
    if (typeof value.txHash !== "string" || !STELLAR_TX_HASH.test(value.txHash)) return null;
    if (!Number.isInteger(value.ledger) || (value.ledger as number) < 1) return null;
    if (typeof value.confirmedAt !== "string" || !Number.isFinite(Date.parse(value.confirmedAt))) return null;
    if (typeof value.feeChargedStroops !== "string" || !/^[1-9]\d*$/.test(value.feeChargedStroops)) return null;
    const explorer = explorerTxUrl(value.txHash);
    if (!explorer || value.explorerUrl !== explorer) return null;
    return value as unknown as StellarSettlement;
  }
  if (value.status === "failed" || value.status === "unknown") {
    if (typeof value.code !== "string" || !RETRIES.has(value.retry as string)) return null;
    if (value.txHash !== undefined && (typeof value.txHash !== "string" || !STELLAR_TX_HASH.test(value.txHash))) return null;
    return value as unknown as StellarSettlement;
  }
  return null;
}
