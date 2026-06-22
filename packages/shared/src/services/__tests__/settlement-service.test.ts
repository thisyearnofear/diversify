import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

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
});
