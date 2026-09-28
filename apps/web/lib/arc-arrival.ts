/**
 * Arc arrival — bring USDC held on Arc to Arbitrum over CCTP V2, so it can
 * be protected there. Pure helpers (no ethers): route config, reads over
 * plain JSON-RPC, Circle delivery status, and the one piece of persisted
 * state (an in-flight transfer survives a reload).
 *
 * Why Arbitrum, not Celo: Celo is neither a CCTP nor a Gateway domain, so
 * there is no native USDC path Arc → Celo. Arbitrum is a CCTP domain AND
 * one of the app's executable chains, holding the protective assets
 * (PAXG, USDY). See docs/rails.md § Arc Rail.
 *
 * The destination mint is done by Circle's Forwarding Service, so the user
 * needs no ETH on Arbitrum to RECEIVE. Arc gas is paid in USDC.
 */
import { NETWORKS } from "../config";

export type ArcArrivalEnv = "mainnet" | "testnet";

export interface ArcArrivalRoute {
  env: ArcArrivalEnv;
  /** cctp-service chain keys. */
  sourceKey: "arc" | "arc-testnet";
  destinationKey: "arbitrum" | "arbitrum-sepolia";
  sourceChainId: number;
  destinationChainId: number;
  sourceRpc: string;
  destinationRpc: string;
  /** Arc's USDC ERC-20 interface (6 decimals; native gas uses 18). */
  sourceUsdc: string;
  destinationUsdc: string;
  /** CCTP domain of the source chain (Arc = 26). */
  sourceDomain: number;
  irisBase: string;
}

const ROUTES: Record<ArcArrivalEnv, ArcArrivalRoute> = {
  mainnet: {
    env: "mainnet",
    sourceKey: "arc",
    destinationKey: "arbitrum",
    sourceChainId: NETWORKS.ARC_MAINNET.chainId,
    destinationChainId: NETWORKS.ARBITRUM_ONE.chainId,
    sourceRpc: NETWORKS.ARC_MAINNET.rpcUrl,
    destinationRpc: NETWORKS.ARBITRUM_ONE.rpcUrl,
    sourceUsdc: "0x3600000000000000000000000000000000000000",
    destinationUsdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    sourceDomain: 26,
    irisBase: "https://iris-api.circle.com",
  },
  testnet: {
    env: "testnet",
    sourceKey: "arc-testnet",
    destinationKey: "arbitrum-sepolia",
    sourceChainId: NETWORKS.ARC_TESTNET.chainId,
    destinationChainId: NETWORKS.ARBITRUM_SEPOLIA.chainId,
    sourceRpc: NETWORKS.ARC_TESTNET.rpcUrl,
    destinationRpc: NETWORKS.ARBITRUM_SEPOLIA.rpcUrl,
    sourceUsdc: "0x3600000000000000000000000000000000000000",
    destinationUsdc: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
    sourceDomain: 26,
    irisBase: "https://iris-api-sandbox.circle.com",
  },
};

/**
 * `NEXT_PUBLIC_ARC_ARRIVAL` = `mainnet` | `testnet` | `off`.
 * Default: testnet in development, OFF everywhere else (production, tests)
 * — mainnet is enabled explicitly after a real rehearsal transfer, never
 * by accident.
 */
export function arcArrivalRoute(
  flag = process.env.NEXT_PUBLIC_ARC_ARRIVAL,
  nodeEnv = process.env.NODE_ENV,
): ArcArrivalRoute | null {
  const value = (flag ?? (nodeEnv === "development" ? "testnet" : "off")).toLowerCase();
  if (value === "mainnet") return ROUTES.mainnet;
  if (value === "testnet") return ROUTES.testnet;
  return null;
}

/** USDC kept on Arc for the approve + burn gas (Arc gas is paid in USDC). */
export const ARC_GAS_RESERVE_USDC = 0.05;
/** Below this, the prompt stays silent — dust isn't worth a bridge. */
export const ARC_ARRIVAL_MIN_USDC = 1;

// ── Units (USDC has 6 decimals) ─────────────────────────────────────────

export function toSubunits(amount: string): bigint | null {
  const trimmed = amount.trim();
  if (!/^\d*(\.\d*)?$/.test(trimmed) || trimmed === "" || trimmed === ".") return null;
  const [whole, frac = ""] = trimmed.split(".");
  return BigInt(whole || "0") * 1_000_000n + BigInt((frac + "000000").slice(0, 6));
}

export function fromSubunits(subunits: bigint): string {
  const negative = subunits < 0n;
  const abs = negative ? -subunits : subunits;
  const whole = abs / 1_000_000n;
  const frac = (abs % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${frac ? `.${frac}` : ""}`;
}

/** "$12.40" — cents for display; sub-cent amounts say so instead of "$0.00". */
export function formatUsd(subunits: bigint): string {
  if (subunits > 0n && subunits < 10_000n) return "<$0.01";
  const cents = (subunits + 5_000n) / 10_000n;
  return `$${(cents / 100n).toLocaleString("en-US")}.${(cents % 100n).toString().padStart(2, "0")}`;
}

/** Largest amount that still leaves the gas reserve and the delivery fee. */
export function maxSendable(balance: bigint, maxFee: bigint): bigint {
  const reserve = BigInt(Math.round(ARC_GAS_RESERVE_USDC * 1_000_000));
  const max = balance - reserve - maxFee;
  return max > 0n ? max : 0n;
}

export interface FeeEntry {
  finalityThreshold: number;
  minimumFee: number;
  forwardFee?: { low: number; med: number; high: number };
}

/**
 * The same maxFee cctp-service.computeMaxFee charges (protocol bps +
 * forwarding fee, ×1.2 buffer), in bigint so the ticket can show it
 * without loading ethers. With forwarding the burn is amount + maxFee, so
 * the user receives at least `amount` on the destination.
 */
export function maxFeeFor(amount: bigint, entry: FeeEntry, forward = true): bigint {
  const protocol = (amount * BigInt(Math.round(entry.minimumFee * 100))) / 1_000_000n;
  const forwarding = forward && entry.forwardFee ? BigInt(Math.round(entry.forwardFee.med)) : 0n;
  return ((protocol + forwarding) * 120n) / 100n;
}

// ── Reads over plain JSON-RPC (no ethers in this path) ─────────────────

async function rpc<T>(url: string, method: string, params: unknown[], signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal,
  });
  if (!res.ok) throw new Error(`RPC ${res.status}`);
  const json = (await res.json()) as { result?: T; error?: { message?: string } };
  if (json.error) throw new Error(json.error.message ?? "RPC error");
  return json.result as T;
}

/** ERC-20 balanceOf, in subunits. */
export async function readUsdcBalance(
  rpcUrl: string,
  token: string,
  owner: string,
  signal?: AbortSignal,
): Promise<bigint> {
  const data = `0x70a08231${owner.toLowerCase().replace(/^0x/, "").padStart(64, "0")}`;
  const result = await rpc<string>(rpcUrl, "eth_call", [{ to: token, data }, "latest"], signal);
  return BigInt(result && result !== "0x" ? result : "0x0");
}

/** Native balance in wei — used to tell the user when Arbitrum gas is missing. */
export async function readNativeBalance(rpcUrl: string, owner: string, signal?: AbortSignal): Promise<bigint> {
  const result = await rpc<string>(rpcUrl, "eth_getBalance", [owner, "latest"], signal);
  return BigInt(result || "0x0");
}

// ── Circle delivery status ──────────────────────────────────────────────

export type DeliveryStatus =
  | { state: "pending" }
  | { state: "attested"; message: string; attestation: string; forwardFailed: boolean }
  | { state: "delivered"; forwardTxHash: string };

interface IrisMessage {
  status?: string;
  message?: string;
  attestation?: string;
  forwardTxHash?: string;
  forwardState?: string;
}

/** Interpret one Iris `/v2/messages` response. Pure — unit-tested. */
export function interpretIris(body: unknown): DeliveryStatus {
  const msg = (body as { messages?: IrisMessage[] } | null)?.messages?.[0];
  if (!msg) return { state: "pending" };
  if (msg.forwardTxHash) return { state: "delivered", forwardTxHash: msg.forwardTxHash };
  if (msg.status === "complete" && msg.message && msg.attestation) {
    return {
      state: "attested",
      message: msg.message,
      attestation: msg.attestation,
      forwardFailed: (msg.forwardState ?? "").toUpperCase() === "FAILED",
    };
  }
  return { state: "pending" };
}

export async function checkDelivery(
  route: ArcArrivalRoute,
  burnTxHash: string,
  signal?: AbortSignal,
): Promise<DeliveryStatus> {
  const res = await fetch(
    `${route.irisBase}/v2/messages/${route.sourceDomain}?transactionHash=${burnTxHash}`,
    { signal },
  );
  // 404 = Iris hasn't indexed the burn yet — that's "pending", not an error.
  if (res.status === 404) return { state: "pending" };
  if (!res.ok) throw new Error(`Circle status ${res.status}`);
  return interpretIris(await res.json());
}

// ── The one persisted record: an in-flight (or just-arrived) transfer ──

export interface ArcArrivalRecord {
  env: ArcArrivalEnv;
  burnTxHash: string;
  /** What the user asked to move (subunits, string for JSON). */
  amount: string;
  startedAt: number;
  forwardTxHash?: string;
  arrivedAt?: number;
}

const storageKey = (address: string) => `diversifi.arcArrival.${address.toLowerCase()}`;

export function loadArrival(address: string): ArcArrivalRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(address));
    if (!raw) return null;
    const rec = JSON.parse(raw) as ArcArrivalRecord;
    if (!rec?.burnTxHash || !/^0x[0-9a-fA-F]{64}$/.test(rec.burnTxHash)) return null;
    return rec;
  } catch {
    return null;
  }
}

export function saveArrival(address: string, rec: ArcArrivalRecord | null): void {
  if (typeof window === "undefined") return;
  try {
    if (rec) window.localStorage.setItem(storageKey(address), JSON.stringify(rec));
    else window.localStorage.removeItem(storageKey(address));
  } catch {
    // Storage full/blocked — the transfer still completes; only resume is lost.
  }
}
