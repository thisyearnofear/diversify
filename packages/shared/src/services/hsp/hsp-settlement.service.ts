/**
 * HSP (HashKey Settlement Protocol) Coordinator client — REST + EIP-712 only.
 *
 * No HSP SDK dependency: the Coordinator is a plain REST hub and the mandate is
 * standard EIP-712 (see ./eip712.ts). We bootstrap chain trust roots
 * (verifyingContract, adapter, token) from `GET /chains` at runtime rather than
 * hardcoding them — the docs report conflicting token addresses, so the
 * Coordinator is the single source of truth.
 *
 * Flow (HSP §5):
 *   1. buildMandateMessage + sign  → SignedMandate         (payer wallet)
 *   2. POST /payments              → { paymentId, status } (Bearer)
 *   3. wallet broadcasts ERC-20 transfer(recipient, amount)
 *   4. POST /payments/:id/observe  → adapter signs Receipt (Bearer)
 *   5. poll GET /payments/:id      → SETTLED
 */

import {
    decodeAbiParameters,
    getAddress,
    type Address,
    type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
    buildMandateMessage,
    mandateHash,
    buildDomain,
    MANDATE_TYPES,
    type BuildMandateParams,
    type MandateMessage,
} from './eip712';

export class HspError extends Error {
    constructor(message: string, readonly status?: number, readonly body?: unknown) {
        super(message);
        this.name = 'HspError';
    }
}

// ── Runtime config ──────────────────────────────────────────────────────────

export type HspEnv = 'testnet' | 'mainnet';

export interface HspRuntime {
    coordinatorUrl: string;
    apiKey?: string;
    /** Coordinator chain name, e.g. "hashkey-testnet" | "hashkey". */
    chainName: string;
    env: HspEnv;
}

/** Resolve HSP config from env. Testnet-first: SETTLEMENT_ENV=mainnet flips to chain 177. */
export function resolveHspRuntime(): HspRuntime {
    const env: HspEnv = process.env.SETTLEMENT_ENV === 'mainnet' ? 'mainnet' : 'testnet';
    const coordinatorUrl = (process.env.HSP_COORDINATOR_URL || '').replace(/\/+$/, '');
    if (!coordinatorUrl) {
        throw new HspError('HSP_COORDINATOR_URL is not set — register on the Coordinator (/register) to obtain it.');
    }
    return {
        coordinatorUrl,
        apiKey: process.env.HSP_API_KEY,
        chainName: env === 'mainnet' ? (process.env.HSP_CHAIN_NAME || 'hashkey') : (process.env.HSP_CHAIN_NAME || 'hashkey-testnet'),
        env,
    };
}

// ── REST primitives ─────────────────────────────────────────────────────────

export interface HspChainInfo {
    chainId: number;
    name: string;
    /** ERC-20 stablecoin address the Coordinator settles (authoritative). */
    stablecoin: Address;
    confirmations: number;
    /** EIP-712 domain verifyingContract for this chain. */
    verifyingContract: Address;
    /** Pinned adapter operator address (receipt signer). */
    adapterAddress: Address;
}

async function coordinatorFetch(
    runtime: Pick<HspRuntime, 'coordinatorUrl' | 'apiKey'>,
    path: string,
    init?: RequestInit & { auth?: boolean },
): Promise<unknown> {
    const headers: Record<string, string> = { 'content-type': 'application/json', ...(init?.headers as Record<string, string> | undefined) };
    if (init?.auth) {
        if (!runtime.apiKey) throw new HspError(`HSP_API_KEY required for ${path} (Coordinator write endpoint).`);
        headers['authorization'] = `Bearer ${runtime.apiKey}`;
    }
    const res = await fetch(`${runtime.coordinatorUrl}${path}`, { ...init, headers });
    const text = await res.text();
    let body: unknown = text;
    try { body = text ? JSON.parse(text) : undefined; } catch { /* keep raw text */ }
    if (!res.ok) throw new HspError(`HSP ${init?.method || 'GET'} ${path} → ${res.status}`, res.status, body);
    return body;
}

/** GET /chains → the chain registry. */
export async function getHspChains(runtime: Pick<HspRuntime, 'coordinatorUrl'>): Promise<HspChainInfo[]> {
    const body = (await coordinatorFetch(runtime, '/chains')) as { chains?: unknown[] } | unknown[];
    const raw = Array.isArray(body) ? body : (body?.chains ?? []);
    return (raw as Record<string, unknown>[]).map((c) => ({
        chainId: Number(c.chainId),
        name: String(c.name ?? ''),
        stablecoin: getAddress(String(c.stablecoin ?? c.token ?? c.usdc ?? '')),
        confirmations: Number(c.confirmations ?? 1),
        verifyingContract: getAddress(String(c.verifyingContract ?? '')),
        adapterAddress: getAddress(String(c.adapterAddress ?? c.adapter ?? '')),
    }));
}

/** Resolve one chain's trust roots by Coordinator chain name (e.g. "hashkey-testnet"). */
export async function getHspChainInfo(runtime: HspRuntime): Promise<HspChainInfo> {
    const chains = await getHspChains(runtime);
    const match = chains.find((c) => c.name === runtime.chainName);
    if (!match) {
        throw new HspError(`HSP chain "${runtime.chainName}" not found in GET /chains (got: ${chains.map((c) => c.name).join(', ')})`);
    }
    return match;
}

// ── Payment lifecycle ───────────────────────────────────────────────────────

export type HspStatus = 'PROPOSED' | 'ATTEMPTED' | 'SETTLED' | 'FAILED' | 'DISPUTED' | 'EXPIRED';

export interface SignedMandate {
    body: MandateMessage;
    signerProof: Hex;
    requiredCapabilities: Hex[];
}

/**
 * JSON-wire form of a SignedMandate (bigints → decimal strings). This is what a
 * browser builds and hands to the backend — the browser never holds the
 * Coordinator API key, so all authenticated writes (register/observe) happen
 * server-side.
 */
export interface WireSignedMandate {
    body: Omit<MandateMessage, 'amount' | 'chainId' | 'deadline'> & {
        amount: string;
        chainId: string;
        deadline: string;
    };
    signerProof: Hex;
    requiredCapabilities: Hex[];
}

/** SignedMandate (bigint) → WireSignedMandate (JSON-safe). */
export function toWireSignedMandate(signed: SignedMandate): WireSignedMandate {
    const b = signed.body;
    return {
        body: {
            ...b,
            amount: b.amount.toString(),
            chainId: b.chainId.toString(),
            deadline: b.deadline.toString(),
        },
        signerProof: signed.signerProof,
        requiredCapabilities: signed.requiredCapabilities,
    };
}

export interface HspPayment {
    paymentId: Hex;
    status: HspStatus;
    mandate?: { body?: Partial<MandateMessage> };
    receipts?: unknown[];
    lastDecision?: { ok?: boolean; outcomeClass?: string };
}

/**
 * POST /payments — register a signed mandate (idempotent on paymentId). Accepts
 * the JSON-wire mandate (what the browser produced); the API key is applied here,
 * server-side.
 */
export async function registerMandate(
    runtime: HspRuntime,
    mandate: WireSignedMandate,
    attestations: unknown[] = [],
): Promise<{ paymentId: Hex; status: HspStatus; existing?: boolean }> {
    const body = (await coordinatorFetch(runtime, '/payments', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({ chain: runtime.chainName, mandate, attestations }),
    })) as { paymentId: Hex; status: HspStatus; existing?: boolean };
    return body;
}

/** POST /payments/:id/observe — ask the Coordinator to observe the settlement tx. */
export async function observePayment(runtime: HspRuntime, paymentId: Hex, txHash: Hex): Promise<HspPayment> {
    return (await coordinatorFetch(runtime, `/payments/${paymentId}/observe`, {
        method: 'POST',
        auth: true,
        body: JSON.stringify({ txHash }),
    })) as HspPayment;
}

/** GET /payments/:id — status + stored triple (public read). */
export async function getPayment(runtime: Pick<HspRuntime, 'coordinatorUrl'>, paymentId: Hex): Promise<HspPayment> {
    return (await coordinatorFetch(runtime, `/payments/${paymentId}`)) as HspPayment;
}

export interface WaitOptions {
    /** Total attempts before giving up. */
    attempts?: number;
    /** Delay between polls (ms). */
    intervalMs?: number;
}

/** Poll GET /payments/:id until SETTLED (or FAILED/timeout). */
export async function waitForSettled(
    runtime: HspRuntime,
    paymentId: Hex,
    opts: WaitOptions = {},
): Promise<HspPayment> {
    const attempts = opts.attempts ?? 20;
    const intervalMs = opts.intervalMs ?? 3000;
    let last: HspPayment | undefined;
    for (let i = 0; i < attempts; i++) {
        last = await getPayment(runtime, paymentId);
        if (last.status === 'SETTLED') return last;
        if (last.status === 'FAILED' || last.status === 'EXPIRED') {
            throw new HspError(`HSP payment ${paymentId} ended ${last.status}`, undefined, last);
        }
        await sleep(intervalMs);
    }
    throw new HspError(`HSP payment ${paymentId} not SETTLED after ${attempts} polls (last: ${last?.status})`, undefined, last);
}

// ── Verification (server / merchant side) ────────────────────────────────────

export interface HspVerifyExpectation {
    recipient: Address;
    token: Address;
    chainId: number;
    /** Minimum amount in base units the mandate must satisfy. */
    minAmount: bigint;
}

export interface HspVerifyResult {
    settled: boolean;
    amount: bigint;
    payment: HspPayment;
}

/**
 * Server-side settlement verification for the x402 gateway. The buyer already
 * registered + broadcast + observed; here we (idempotently) observe again if a
 * txHash is supplied, poll to SETTLED, and assert the mandate matches what the
 * gateway challenged (recipient/token/chain/amount) so a payer cannot swap in a
 * cheaper or differently-addressed mandate.
 */
export async function verifyHspSettlement(
    runtime: HspRuntime,
    paymentId: Hex,
    expected: HspVerifyExpectation,
    txHash?: Hex,
): Promise<HspVerifyResult> {
    let payment = await getPayment(runtime, paymentId);
    if (payment.status !== 'SETTLED' && txHash) {
        await observePayment(runtime, paymentId, txHash).catch(() => undefined);
        payment = await waitForSettled(runtime, paymentId);
    } else if (payment.status !== 'SETTLED') {
        payment = await waitForSettled(runtime, paymentId);
    }

    const mandate = payment.mandate?.body;
    if (!mandate) throw new HspError(`HSP payment ${paymentId} has no mandate body`, undefined, payment);

    const gotToken = getAddress(String(mandate.token));
    if (gotToken !== getAddress(expected.token)) {
        throw new HspError(`HSP token mismatch: mandate ${gotToken} != expected ${getAddress(expected.token)}`);
    }
    const gotChain = Number(mandate.chainId);
    if (gotChain !== expected.chainId) {
        throw new HspError(`HSP chainId mismatch: mandate ${gotChain} != expected ${expected.chainId}`);
    }
    const gotRecipient = decodeRecipientAddress(mandate.recipient as { payload?: Hex } | undefined);
    if (!gotRecipient || gotRecipient !== getAddress(expected.recipient)) {
        throw new HspError(`HSP recipient mismatch: mandate ${gotRecipient} != expected ${getAddress(expected.recipient)}`);
    }
    const amount = BigInt(String(mandate.amount ?? '0'));
    if (amount < expected.minAmount) {
        throw new HspError(`HSP amount too low: ${amount} < required ${expected.minAmount}`);
    }
    return { settled: payment.status === 'SETTLED', amount, payment };
}

// ── Server-side signing (tests / merchant self-pay) ──────────────────────────

/** Build + sign a mandate with a private key (for scripts/tests; browsers sign in-wallet). */
export async function buildAndSignServerMandate(
    domain: { chainId: number; verifyingContract: Address },
    params: BuildMandateParams,
    privateKey: Hex,
): Promise<{ paymentId: Hex; signed: SignedMandate }> {
    const account = privateKeyToAccount(privateKey);
    if (getAddress(account.address) !== getAddress(params.payer)) {
        throw new HspError('signer key does not match params.payer');
    }
    const message = buildMandateMessage(params);
    const paymentId = mandateHash(domain, message);
    // Sign the digest directly (§4.1.6) — equivalent to eth_signTypedData_v4 over the same domain/types.
    const signerProof = await account.signTypedData({
        domain: buildDomain(domain),
        types: MANDATE_TYPES as unknown as Record<string, { name: string; type: string }[]>,
        primaryType: 'Mandate',
        message: message as unknown as Record<string, unknown>,
    });
    return {
        paymentId,
        signed: { body: message, signerProof, requiredCapabilities: params.requiredCapabilities ?? [] },
    };
}

// ── helpers ──────────────────────────────────────────────────────────────────

function decodeRecipientAddress(recipient: { payload?: Hex } | undefined): Address | undefined {
    if (!recipient?.payload) return undefined;
    try {
        return getAddress(decodeAbiParameters([{ type: 'address' }], recipient.payload)[0]);
    } catch {
        return undefined;
    }
}

/** 32-byte random nonce (browser + modern Node). */
export function randomNonce32(): Hex {
    const bytes = new Uint8Array(32);
    globalThis.crypto.getRandomValues(bytes);
    return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}` as Hex;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
