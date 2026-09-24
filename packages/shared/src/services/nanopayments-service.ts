/**
 * Gateway Nanopayments service — Circle Gateway batched x402 payments.
 *
 * A buyer deposits USDC once into the Gateway Wallet contract and then pays
 * gasless by signing a batched authorization (extra.name =
 * "GatewayWalletBatched", version "1"). The merchant verifies and settles via
 * Circle's facilitator (BatchFacilitatorClient), which burns from the buyer's
 * Gateway balance and mints on the destination — one batched on-chain tx per
 * settlement batch.
 *
 * Docs:
 *   https://developers.circle.com/gateway/nanopayments
 *   https://developers.circle.com/gateway/nanopayments/concepts/x402
 *   https://developers.circle.com/gateway/nanopayments/howtos/facilitator-integration
 *
 * Buyer header: `PAYMENT-SIGNATURE` (base64 of {x402Version, payload}).
 * The 402 challenge advertises the option in `accepts[]` per the x402 spec —
 * the SDK's GatewayClient.pay() scans accepts[] for
 * network 'eip155:<chainId>' + extra.name 'GatewayWalletBatched' + version '1'
 * + extra.verifyingContract.
 *
 * Server-side imports are lazy — this module is loaded by the API route which
 * runs on Node; keeping the facilitator client behind a factory keeps the
 * service unit-testable (mocked in tests).
 */

import { CHAIN_CONFIGS, type SupportedChainName } from '@circle-fin/x402-batching/client';

export interface GatewayPaymentRequirements {
    scheme: string;
    network: string;            // 'eip155:<chainId>' per CAIP-2
    asset: string;              // USDC ERC-20 address
    amount: string;             // atomic units (6 decimals)
    payTo: string;
    maxTimeoutSeconds: number;
    extra: {
        name: string;           // 'GatewayWalletBatched'
        version: string;        // '1'
        verifyingContract: string; // Gateway Wallet contract on this chain
    };
}

export interface GatewayPaymentPayload {
    x402Version: number;
    payload: Record<string, unknown>;
}

const GATEWAY_CHAIN_BY_ENV: Record<'testnet' | 'mainnet', SupportedChainName> = {
    testnet: 'arcTestnet',
    mainnet: 'arc',
};

/**
 * Build the x402 PaymentRequirements for a Gateway batched payment on the
 * env-active Arc rail. Returns null when the rail isn't Arc — the gateway
 * only advertises the option where Gateway settles (Arc, domain 26).
 */
export function buildGatewayRequirements(params: {
    env: 'testnet' | 'mainnet';
    rail: string;
    amountMicroUsdc: number;
    payTo: string;
}): GatewayPaymentRequirements | null {
    if (params.rail !== 'ARC') return null;
    const config = CHAIN_CONFIGS[GATEWAY_CHAIN_BY_ENV[params.env]];
    return {
        scheme: 'exact',
        network: `eip155:${config.chain.id}`,
        asset: config.usdc,
        amount: params.amountMicroUsdc.toString(),
        payTo: params.payTo,
        maxTimeoutSeconds: 300,
        extra: {
            name: 'GatewayWalletBatched',
            version: '1',
            verifyingContract: config.gatewayWallet,
        },
    };
}

/**
 * The 402-challenge block advertising the batched option — `{x402Version,
 * accepts: [requirements]}` on the Arc rail, `{}` elsewhere so non-Arc
 * challenges are byte-for-byte unchanged.
 */
export function buildGatewayChallengeBlock(params: {
    env: 'testnet' | 'mainnet';
    rail: string;
    amountMicroUsdc: number;
    payTo: string;
}): Record<string, unknown> {
    const requirements = buildGatewayRequirements(params);
    if (!requirements) return {};
    return { x402Version: 2, accepts: [requirements] };
}

/**
 * Decode the PAYMENT-SIGNATURE header (base64 JSON per x402 spec).
 */
export function decodePaymentSignature(header: string): GatewayPaymentPayload {
    const json = Buffer.from(header, 'base64').toString('utf8');
    const parsed = JSON.parse(json);
    if (typeof parsed?.x402Version !== 'number' || typeof parsed?.payload !== 'object') {
        throw new Error('Malformed PAYMENT-SIGNATURE payload');
    }
    return parsed as GatewayPaymentPayload;
}

/** Facilitator client factory — injectable for tests. */
export type FacilitatorFactory = () => {
    verify(payload: GatewayPaymentPayload, requirements: GatewayPaymentRequirements): Promise<{ isValid: boolean; invalidReason?: string; payer?: string }>;
    settle(payload: GatewayPaymentPayload, requirements: GatewayPaymentRequirements): Promise<{ success: boolean; errorReason?: string; payer?: string; transaction: string; network: string }>;
};

let facilitatorFactory: FacilitatorFactory | null = null;

export function setGatewayFacilitatorFactory(factory: FacilitatorFactory | null) {
    facilitatorFactory = factory;
}

/**
 * Facilitator URL: the SDK defaults to https://gateway-api.circle.com (mainnet)
 * and uses https://gateway-api-testnet.circle.com for testnet. Env-aware so the
 * testnet rail talks to the testnet facilitator; CIRCLE_GATEWAY_API_URL wins.
 */
export function gatewayFacilitatorUrl(env: 'testnet' | 'mainnet'): string {
    return process.env.CIRCLE_GATEWAY_API_URL
        || (env === 'mainnet'
            ? 'https://gateway-api.circle.com'
            : 'https://gateway-api-testnet.circle.com');
}

async function defaultFacilitator(env: 'testnet' | 'mainnet'): Promise<ReturnType<FacilitatorFactory>> {
    const { BatchFacilitatorClient } = await import('@circle-fin/x402-batching/server');
    return new BatchFacilitatorClient({ url: gatewayFacilitatorUrl(env) });
}

/**
 * Verify + settle a Gateway batched payment. Returns the settled amount in
 * USDC and the payer address. Throws on verify failure (402-worthy) or settle
 * failure (no credit).
 */
export async function settleGatewayPayment(params: {
    paymentPayload: GatewayPaymentPayload;
    requirements: GatewayPaymentRequirements;
    env?: 'testnet' | 'mainnet';
}): Promise<{ amountUSDC: number; payer?: string; transaction?: string }> {
    const { isBatchPayment } = await import('@circle-fin/x402-batching/server');
    if (!isBatchPayment(params.requirements)) {
        throw new Error('Payment requirements do not describe a Gateway batched payment');
    }

    const facilitator = facilitatorFactory
        ? facilitatorFactory()
        : await defaultFacilitator(params.env ?? (process.env.SETTLEMENT_ENV === 'mainnet' ? 'mainnet' : 'testnet'));

    const verifyResult = await facilitator.verify(params.paymentPayload, params.requirements);
    if (!verifyResult.isValid) {
        throw new Error(`Gateway verification failed: ${verifyResult.invalidReason || 'invalid payment'}`);
    }

    const settleResult = await facilitator.settle(params.paymentPayload, params.requirements);
    if (!settleResult.success) {
        throw new Error(`Gateway settlement failed: ${settleResult.errorReason || 'settlement rejected'}`);
    }

    // The settled amount is the authorized value — credit that, exactly once.
    const amountUSDC = Number(params.requirements.amount) / 1_000_000;
    return {
        amountUSDC,
        payer: settleResult.payer ?? verifyResult.payer,
        transaction: settleResult.transaction,
    };
}

/**
 * Stable replay-protection key for a batched payment — derived from the
 * authorization fields, not the header encoding.
 */
export function gatewayProofId(paymentPayload: GatewayPaymentPayload): string {
    const p = paymentPayload.payload as { authorization?: { nonce?: unknown; from?: unknown } } & Record<string, unknown>;
    const nonce = p?.authorization?.nonce ?? (p as any)?.nonce ?? JSON.stringify(paymentPayload.payload);
    const from = p?.authorization?.from ?? (p as any)?.from ?? 'unknown';
    return `gateway:${String(from).toLowerCase()}:${String(nonce)}`;
}
