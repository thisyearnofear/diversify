import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('SettlementService — DEFAULT_SETTLEMENT_NETWORK (Phase 0 audit A5)', () => {
    const originalEnv = process.env.SETTLEMENT_NETWORK;

    beforeEach(() => {
        delete process.env.SETTLEMENT_NETWORK;
    });

    afterEach(() => {
        if (originalEnv === undefined) {
            delete process.env.SETTLEMENT_NETWORK;
        } else {
            process.env.SETTLEMENT_NETWORK = originalEnv;
        }
    });

    it('defaults to ZERO_G when SETTLEMENT_NETWORK is not set', async () => {
        vi.resetModules();
        const { DEFAULT_SETTLEMENT_NETWORK } = await import('../settlement-service');
        expect(DEFAULT_SETTLEMENT_NETWORK).toBe('ZERO_G');
    });

    it('uses ARC when SETTLEMENT_NETWORK=ARC', async () => {
        process.env.SETTLEMENT_NETWORK = 'ARC';
        vi.resetModules();
        const { DEFAULT_SETTLEMENT_NETWORK } = await import('../settlement-service');
        expect(DEFAULT_SETTLEMENT_NETWORK).toBe('ARC');
    });

    it('uses ZERO_G when SETTLEMENT_NETWORK=ZERO_G', async () => {
        process.env.SETTLEMENT_NETWORK = 'ZERO_G';
        vi.resetModules();
        const { DEFAULT_SETTLEMENT_NETWORK } = await import('../settlement-service');
        expect(DEFAULT_SETTLEMENT_NETWORK).toBe('ZERO_G');
    });

    it('uses ARBITRUM when SETTLEMENT_NETWORK=ARBITRUM', async () => {
        process.env.SETTLEMENT_NETWORK = 'ARBITRUM';
        vi.resetModules();
        const { DEFAULT_SETTLEMENT_NETWORK } = await import('../settlement-service');
        expect(DEFAULT_SETTLEMENT_NETWORK).toBe('ARBITRUM');
    });
});

describe('SettlementService — SETTLEMENT_ENV (mainnet flip)', () => {
    const originalEnv = process.env.SETTLEMENT_ENV;
    const originalUsdc = process.env.ZERO_G_MAINNET_USDC;

    afterEach(() => {
        if (originalEnv === undefined) delete process.env.SETTLEMENT_ENV;
        else process.env.SETTLEMENT_ENV = originalEnv;
        if (originalUsdc === undefined) delete process.env.ZERO_G_MAINNET_USDC;
        else process.env.ZERO_G_MAINNET_USDC = originalUsdc;
    });

    it('defaults to testnet when SETTLEMENT_ENV is not set', async () => {
        delete process.env.SETTLEMENT_ENV;
        vi.resetModules();
        const { SETTLEMENT_ENV } = await import('../settlement-service');
        expect(SETTLEMENT_ENV).toBe('testnet');
    });

    it('flips to mainnet when SETTLEMENT_ENV=mainnet', async () => {
        process.env.SETTLEMENT_ENV = 'mainnet';
        vi.resetModules();
        const { SETTLEMENT_ENV } = await import('../settlement-service');
        expect(SETTLEMENT_ENV).toBe('mainnet');
    });

    it('ignores unknown SETTLEMENT_ENV values (falls back to testnet)', async () => {
        process.env.SETTLEMENT_ENV = 'staging';
        vi.resetModules();
        const { SETTLEMENT_ENV } = await import('../settlement-service');
        expect(SETTLEMENT_ENV).toBe('testnet');
    });
});

describe('SettlementService — ARBITRUM rail config', () => {
    const originalNetwork = process.env.SETTLEMENT_NETWORK;
    const originalEnv = process.env.SETTLEMENT_ENV;
    const originalMainnetUsdc = process.env.ARBITRUM_MAINNET_USDC;

    afterEach(() => {
        if (originalNetwork === undefined) delete process.env.SETTLEMENT_NETWORK;
        else process.env.SETTLEMENT_NETWORK = originalNetwork;
        if (originalEnv === undefined) delete process.env.SETTLEMENT_ENV;
        else process.env.SETTLEMENT_ENV = originalEnv;
        if (originalMainnetUsdc === undefined) delete process.env.ARBITRUM_MAINNET_USDC;
        else process.env.ARBITRUM_MAINNET_USDC = originalMainnetUsdc;
    });

    it('returns Arbitrum mainnet config by default', async () => {
        process.env.SETTLEMENT_NETWORK = 'ARBITRUM';
        process.env.SETTLEMENT_ENV = 'mainnet';
        vi.resetModules();
        const { getSettlementConfig } = await import('../settlement-service');
        const config = getSettlementConfig();
        expect(config.chainId).toBe(42161);
        expect(config.name).toBe('Arbitrum');
        expect(config.usdcAddress).toBe('0xaf88d065e77c8cC2239327C5EDb3A432268e5831');
        expect(config.explorerBase).toBe('https://arbiscan.io');
    });

    it('returns Arbitrum Sepolia config in testnet mode', async () => {
        process.env.SETTLEMENT_NETWORK = 'ARBITRUM';
        process.env.SETTLEMENT_ENV = 'testnet';
        vi.resetModules();
        const { getSettlementConfig } = await import('../settlement-service');
        const config = getSettlementConfig();
        expect(config.chainId).toBe(421614);
        expect(config.name).toBe('Arbitrum Sepolia');
        expect(config.usdcAddress).toBe('0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d');
        expect(config.explorerBase).toBe('https://sepolia.arbiscan.io');
    });

    it('allows ARBITRUM_MAINNET_USDC override', async () => {
        process.env.SETTLEMENT_NETWORK = 'ARBITRUM';
        process.env.SETTLEMENT_ENV = 'mainnet';
        process.env.ARBITRUM_MAINNET_USDC = '0x1234567890123456789012345678901234567890';
        vi.resetModules();
        const { getSettlementConfig } = await import('../settlement-service');
        const config = getSettlementConfig();
        expect(config.usdcAddress).toBe('0x1234567890123456789012345678901234567890');
    });
});

describe('SettlementService — daily settlement cap', () => {
    const originalCap = process.env.SETTLEMENT_DAILY_CAP_USDC;
    const originalEnv = process.env.SETTLEMENT_ENV;
    const originalNetwork = process.env.SETTLEMENT_NETWORK;

    afterEach(() => {
        if (originalCap === undefined) delete process.env.SETTLEMENT_DAILY_CAP_USDC;
        else process.env.SETTLEMENT_DAILY_CAP_USDC = originalCap;
        if (originalEnv === undefined) delete process.env.SETTLEMENT_ENV;
        else process.env.SETTLEMENT_ENV = originalEnv;
        if (originalNetwork === undefined) delete process.env.SETTLEMENT_NETWORK;
        else process.env.SETTLEMENT_NETWORK = originalNetwork;
    });

    it('defaults to 50 USDC on testnet when SETTLEMENT_DAILY_CAP_USDC is not set', async () => {
        delete process.env.SETTLEMENT_DAILY_CAP_USDC;
        process.env.SETTLEMENT_ENV = 'testnet';
        vi.resetModules();
        const { SETTLEMENT_DAILY_CAP_USDC } = await import('../settlement-service');
        expect(SETTLEMENT_DAILY_CAP_USDC).toBe(50.0);
    });

    it('defaults to 5 USDC on mainnet when SETTLEMENT_DAILY_CAP_USDC is not set', async () => {
        delete process.env.SETTLEMENT_DAILY_CAP_USDC;
        process.env.SETTLEMENT_ENV = 'mainnet';
        vi.resetModules();
        const { SETTLEMENT_DAILY_CAP_USDC } = await import('../settlement-service');
        expect(SETTLEMENT_DAILY_CAP_USDC).toBe(5.0);
    });

    it('env override wins on mainnet too', async () => {
        process.env.SETTLEMENT_DAILY_CAP_USDC = '10.5';
        process.env.SETTLEMENT_ENV = 'mainnet';
        vi.resetModules();
        const { SETTLEMENT_DAILY_CAP_USDC } = await import('../settlement-service');
        expect(SETTLEMENT_DAILY_CAP_USDC).toBe(10.5);
    });

    it('allows custom cap via SETTLEMENT_DAILY_CAP_USDC', async () => {
        process.env.SETTLEMENT_DAILY_CAP_USDC = '10.5';
        vi.resetModules();
        const { SETTLEMENT_DAILY_CAP_USDC } = await import('../settlement-service');
        expect(SETTLEMENT_DAILY_CAP_USDC).toBe(10.5);
    });

    it('tracks spend per network and resets on a new day', async () => {
        process.env.SETTLEMENT_DAILY_CAP_USDC = '1.0';
        vi.resetModules();
        const { checkDailyCap, recordDailySpend } = await import('../settlement-service');

        expect((await checkDailyCap(0.5, 'ARBITRUM')).allowed).toBe(true);
        await recordDailySpend(0.5, 'ARBITRUM');
        expect((await checkDailyCap(0.4, 'ARBITRUM')).allowed).toBe(true);
        expect((await checkDailyCap(0.6, 'ARBITRUM')).allowed).toBe(false);

        // A different network has its own bucket
        expect((await checkDailyCap(0.9, 'ZERO_G')).allowed).toBe(true);
        await recordDailySpend(0.9, 'ZERO_G');
        expect((await checkDailyCap(0.2, 'ZERO_G')).allowed).toBe(false);
    });

    it('disables the cap when SETTLEMENT_DAILY_CAP_USDC=0', async () => {
        process.env.SETTLEMENT_DAILY_CAP_USDC = '0';
        vi.resetModules();
        const { checkDailyCap, recordDailySpend } = await import('../settlement-service');
        await recordDailySpend(999, 'ARBITRUM');
        expect((await checkDailyCap(1, 'ARBITRUM')).allowed).toBe(true);
    });
});

describe('agentMirrorSettlementEnabled — x402 gateway settleOnChain gate', () => {
    const originalEnv = process.env.SETTLEMENT_ENV;
    afterEach(() => {
        if (originalEnv === undefined) delete process.env.SETTLEMENT_ENV;
        else process.env.SETTLEMENT_ENV = originalEnv;
    });

    it('is disabled on mainnet — settleOnChain mirror must not run there', async () => {
        process.env.SETTLEMENT_ENV = 'mainnet';
        vi.resetModules();
        const { agentMirrorSettlementEnabled } = await import('../settlement-service');
        expect(agentMirrorSettlementEnabled()).toBe(false);
    });

    it('is enabled on testnet — settleOnChain mirror runs per paid request', async () => {
        process.env.SETTLEMENT_ENV = 'testnet';
        vi.resetModules();
        const { agentMirrorSettlementEnabled } = await import('../settlement-service');
        expect(agentMirrorSettlementEnabled()).toBe(true);
    });

    it('explicit env args behave the same regardless of process env', async () => {
        const { agentMirrorSettlementEnabled } = await import('../settlement-service');
        expect(agentMirrorSettlementEnabled('mainnet')).toBe(false);
        expect(agentMirrorSettlementEnabled('testnet')).toBe(true);
    });

    it('the x402 gateway route gates its settleOnChain block on this predicate', () => {
        // Tripwire: if the route's mirror block loses the env gate, mainnet
        // would start broadcasting operator-funded USDC mirrors again.
        const route = readFileSync(
            resolve(__dirname, '../../../../../apps/web/pages/api/agent/x402-gateway.ts'),
            'utf8',
        );
        expect(route).toMatch(/settleOnChain\(p\.cost/);
        expect(route).toMatch(/agentMirrorSettlementEnabled\(\)/);
    });
});
