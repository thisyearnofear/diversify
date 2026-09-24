/**
 * Gateway Nanopayments service — routing + verify/settle semantics with a
 * mocked BatchFacilitatorClient.
 * Doc shape asserted: https://developers.circle.com/gateway/nanopayments/howtos/x402-integration
 * (accepts[] entry: scheme 'exact', network 'eip155:<id>', extra.name
 * 'GatewayWalletBatched', extra.version '1', extra.verifyingContract = Gateway
 * Wallet contract).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    buildGatewayRequirements,
    buildGatewayChallengeBlock,
    buildPaymentRequiredHeader,
    buildPaymentResponseHeader,
    decodePaymentSignature,
    gatewayProofId,
    settleGatewayPayment,
    setGatewayFacilitatorFactory,
    gatewayFacilitatorUrl,
} from '../nanopayments-service';

const PAY_TO = '0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B';
const ARC_MAINNET_USDC = '0x3600000000000000000000000000000000000000';
const MAINNET_GATEWAY_WALLET = '0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE';
const TESTNET_GATEWAY_WALLET = '0x0077777d7EBA4688BDeF3E311b846F25870A19B9';

function makePayload(nonce = '0x01', from = '0xBuyer') {
    return {
        x402Version: 2,
        payload: { authorization: { nonce, from } },
    };
}

describe('buildGatewayRequirements', () => {
    it('returns null on non-Arc rails', () => {
        expect(buildGatewayRequirements({ env: 'mainnet', rail: 'ARBITRUM', amountMicroUsdc: 5000, payTo: PAY_TO })).toBeNull();
        expect(buildGatewayRequirements({ env: 'testnet', rail: 'ZERO_G', amountMicroUsdc: 5000, payTo: PAY_TO })).toBeNull();
    });

    it('advertises Arc mainnet requirements per the SDK contract', () => {
        const req = buildGatewayRequirements({ env: 'mainnet', rail: 'ARC', amountMicroUsdc: 5000, payTo: PAY_TO })!;
        expect(req.scheme).toBe('exact');
        expect(req.network).toBe('eip155:5042');
        expect(req.asset).toBe(ARC_MAINNET_USDC);
        expect(req.amount).toBe('5000');
        expect(req.payTo).toBe(PAY_TO);
        expect(req.maxTimeoutSeconds).toBeGreaterThan(0);
        expect(req.extra).toEqual({
            name: 'GatewayWalletBatched',
            version: '1',
            verifyingContract: MAINNET_GATEWAY_WALLET,
        });
    });

    it('advertises Arc testnet requirements on the testnet rail', () => {
        const req = buildGatewayRequirements({ env: 'testnet', rail: 'ARC', amountMicroUsdc: 1000, payTo: PAY_TO })!;
        expect(req.network).toBe('eip155:5042002');
        expect(req.extra.verifyingContract).toBe(TESTNET_GATEWAY_WALLET);
    });
});

describe('buildGatewayChallengeBlock', () => {
    it('includes the batched option only on the Arc rail', () => {
        const arc = buildGatewayChallengeBlock({ env: 'mainnet', rail: 'ARC', amountMicroUsdc: 5000, payTo: PAY_TO });
        expect(arc.x402Version).toBe(2);
        expect((arc.accepts as any[])[0].extra.name).toBe('GatewayWalletBatched');

        expect(buildGatewayChallengeBlock({ env: 'mainnet', rail: 'ARBITRUM', amountMicroUsdc: 5000, payTo: PAY_TO })).toEqual({});
        expect(buildGatewayChallengeBlock({ env: 'mainnet', rail: 'ZERO_G', amountMicroUsdc: 5000, payTo: PAY_TO })).toEqual({});
        expect(buildGatewayChallengeBlock({ env: 'testnet', rail: 'HASHKEY', amountMicroUsdc: 5000, payTo: PAY_TO })).toEqual({});
    });
});

describe('gatewayFacilitatorUrl', () => {
    const env = { ...process.env };
    afterEach(() => { process.env = { ...env }; });

    it('uses gateway-api.circle.com on mainnet, -testnet on testnet', () => {
        delete process.env.CIRCLE_GATEWAY_API_URL;
        expect(gatewayFacilitatorUrl('mainnet')).toBe('https://gateway-api.circle.com');
        expect(gatewayFacilitatorUrl('testnet')).toBe('https://gateway-api-testnet.circle.com');
    });

    it('CIRCLE_GATEWAY_API_URL overrides both', () => {
        process.env.CIRCLE_GATEWAY_API_URL = 'https://custom.example.com';
        expect(gatewayFacilitatorUrl('mainnet')).toBe('https://custom.example.com');
        expect(gatewayFacilitatorUrl('testnet')).toBe('https://custom.example.com');
    });
});

describe('decodePaymentSignature', () => {
    it('decodes a base64 PAYMENT-SIGNATURE payload', () => {
        const header = Buffer.from(JSON.stringify({ x402Version: 2, payload: { a: 1 } })).toString('base64');
        expect(decodePaymentSignature(header)).toEqual({ x402Version: 2, payload: { a: 1 } });
    });
    it('rejects malformed payloads', () => {
        expect(() => decodePaymentSignature(Buffer.from('{"x402Version":2}').toString('base64'))).toThrow();
        expect(() => decodePaymentSignature('not-base64!!!')).toThrow();
    });
});

describe('gatewayProofId', () => {
    it('is stable for the same authorization', () => {
        expect(gatewayProofId(makePayload('0xabc', '0xBuyer'))).toBe(gatewayProofId(makePayload('0xabc', '0xBUYER')));
    });
    it('differs per nonce', () => {
        expect(gatewayProofId(makePayload('0x1'))).not.toBe(gatewayProofId(makePayload('0x2')));
    });
});

describe('settleGatewayPayment', () => {
    const requirements = buildGatewayRequirements({ env: 'testnet', rail: 'ARC', amountMicroUsdc: 4000, payTo: PAY_TO })!;

    beforeEach(() => {
        setGatewayFacilitatorFactory(null);
    });

    it('rejects when verify fails (→ 402)', async () => {
        setGatewayFacilitatorFactory(() => ({
            verify: async () => ({ isValid: false, invalidReason: 'bad signature' }),
            settle: async () => { throw new Error('settle must not run'); },
        }));
        await expect(settleGatewayPayment({ paymentPayload: makePayload(), requirements }))
            .rejects.toThrow(/verification failed/i);
    });

    it('rejects when settle fails — no credit semantics leak through', async () => {
        let settledCalled = 0;
        setGatewayFacilitatorFactory(() => ({
            verify: async () => ({ isValid: true, payer: '0xBuyer' }),
            settle: async () => { settledCalled++; return { success: false, errorReason: 'insufficient gateway balance', transaction: '', network: 'eip155:5042002' }; },
        }));
        await expect(settleGatewayPayment({ paymentPayload: makePayload(), requirements }))
            .rejects.toThrow(/settlement failed/i);
        expect(settledCalled).toBe(1);
    });

    it('returns the settled amount + payer on success', async () => {
        setGatewayFacilitatorFactory(() => ({
            verify: async () => ({ isValid: true, payer: '0xBuyer' }),
            settle: async () => ({ success: true, payer: '0xBuyer', transaction: '0xsettled', network: 'eip155:5042002' }),
        }));
        const result = await settleGatewayPayment({ paymentPayload: makePayload(), requirements });
        expect(result.amountUSDC).toBeCloseTo(0.004, 6);
        expect(result.payer).toBe('0xBuyer');
        expect(result.transaction).toBe('0xsettled');
    });
});

/**
 * Wire-compat test: run our 402/200 headers through the SDK's own
 * GatewayClient (dist/client/index.js pay()/supports() read the
 * PAYMENT-REQUIRED / PAYMENT-RESPONSE headers, base64 JSON). Only fetch is
 * mocked — signing is local and the facilitator is never contacted.
 */
describe('SDK wire compatibility (PAYMENT-REQUIRED / PAYMENT-RESPONSE)', () => {
    const BUYER_KEY = `0x${'11'.repeat(32)}` as const;
    const SETTLE_TX = `0x${'ab'.repeat(32)}`;
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => { originalFetch = globalThis.fetch; });
    afterEach(() => { globalThis.fetch = originalFetch; });

    function challengeResponse(): Response {
        const header = buildPaymentRequiredHeader({
            env: 'mainnet',
            rail: 'ARC',
            amountMicroUsdc: 1000,
            payTo: PAY_TO,
            resourceUrl: 'https://api.example.com/x402-gateway?source=fx_protection',
        })!;
        return new Response('{}', {
            status: 402,
            headers: { 'PAYMENT-REQUIRED': header, 'Content-Type': 'application/json' },
        });
    }

    it('GatewayClient.supports() accepts our 402 challenge', async () => {
        const { GatewayClient } = await import('@circle-fin/x402-batching/client');
        globalThis.fetch = async () => challengeResponse();
        const client = new GatewayClient({ chain: 'arc', privateKey: BUYER_KEY });
        const result = await client.supports('https://api.example.com/x402-gateway');
        expect(result.supported).toBe(true);
        expect(result.requirements).toMatchObject({
            network: 'eip155:5042',
            amount: '1000',
            payTo: PAY_TO,
            extra: { name: 'GatewayWalletBatched', version: '1', verifyingContract: MAINNET_GATEWAY_WALLET },
        });
    });

    it('GatewayClient.pay() completes against our header contract and its signature parses server-side', async () => {
        const { GatewayClient } = await import('@circle-fin/x402-batching/client');
        const { isBatchPayment } = await import('@circle-fin/x402-batching/server');
        let capturedSignature: string | undefined;
        let calls = 0;
        globalThis.fetch = async (_url: unknown, init?: RequestInit) => {
            calls++;
            if (calls === 1) return challengeResponse();
            capturedSignature = new Headers(init?.headers).get('Payment-Signature') ?? undefined;
            return new Response(JSON.stringify({ data: { ok: true } }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'PAYMENT-RESPONSE': buildPaymentResponseHeader({
                        env: 'mainnet', success: true, transaction: SETTLE_TX, payer: '0xBuyer',
                    }),
                },
            });
        };
        const client = new GatewayClient({ chain: 'arc', privateKey: BUYER_KEY });
        const result = await client.pay('https://api.example.com/x402-gateway?source=fx_protection');

        expect(calls).toBe(2);
        expect(result.status).toBe(200);
        expect(result.transaction).toBe(SETTLE_TX);      // decoded from PAYMENT-RESPONSE
        expect(result.amount).toBe(1000n);               // from requirements.amount
        expect(result.formattedAmount).toBe('0.001');

        // The Payment-Signature the SDK sent must round-trip through our server decode path.
        const payload = decodePaymentSignature(capturedSignature!);
        expect(payload.x402Version).toBe(2);
        const accepted = (payload as unknown as { accepted: Record<string, unknown> }).accepted;
        expect(isBatchPayment(accepted as never)).toBe(true);
        expect(gatewayProofId(payload)).toMatch(/^gateway:0x[0-9a-f]+:/);
    });
});
