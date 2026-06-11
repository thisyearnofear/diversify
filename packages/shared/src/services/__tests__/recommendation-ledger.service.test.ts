import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock ethers so we can exercise the service without an RPC.
const mockTx = { hash: '0x' + '11'.repeat(32), wait: vi.fn() };
const mockContract = {
    recordRecommendation: vi.fn().mockResolvedValue(mockTx),
    interface: {
        parseLog: vi.fn().mockReturnValue(null),
    },
    totalRecommendations: vi.fn().mockResolvedValue(42),
};

vi.mock('ethers6', () => {
    const wallet = { privateKey: '0x' + '22'.repeat(32), address: '0x' + '33'.repeat(20) };
    return {
        ethers: {
            JsonRpcProvider: vi.fn().mockImplementation(() => ({})),
            Contract: vi.fn().mockImplementation(() => mockContract),
            Wallet: vi.fn().mockImplementation(() => wallet),
            utils: { hexlify: vi.fn(), randomBytes: vi.fn() },
        },
    };
});

describe('RecommendationLedgerService.recordRecommendation — return shape', () => {
    const ORIGINAL_ENV = process.env;

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...ORIGINAL_ENV, VAULT_PRIVATE_KEY: '0x' + 'aa'.repeat(32) };
        mockTx.wait.mockReset();
    });

    afterEach(() => {
        process.env = ORIGINAL_ENV;
    });

    it('returns "anchored" with an id when the receipt contains the event', async () => {
        mockTx.wait.mockResolvedValue({ status: 1, logs: [] });
        const { recordRecommendation } = await import('../recommendation-ledger.service');

        const result = await recordRecommendation({
            user: '0x' + 'ab'.repeat(20),
            action: 'SWAP',
            targetToken: 'cUSD',
            reasoning: 'test',
            evidenceCid: '',
            servingModel: 'test',
            confidence: 8000,
        });

        expect(result.status).toBe('anchored');
        if (result.status === 'anchored') {
            expect(result.id).toBe(42);
            expect(result.txHash).toBe(mockTx.hash);
            expect(result.explorerUrl).toContain('chainscan-galileo.0g.ai');
        }
    });

    it('returns "pending" when the receipt times out but the tx was broadcast', async () => {
        mockTx.wait.mockRejectedValue(new Error('confirmation timeout'));
        const { recordRecommendation } = await import('../recommendation-ledger.service');

        const result = await recordRecommendation({
            user: '0x' + 'ab'.repeat(20),
            action: 'SWAP',
            targetToken: 'cUSD',
            reasoning: 'test',
            evidenceCid: '',
            servingModel: 'test',
            confidence: 8000,
        });

        expect(result.status).toBe('pending');
        if (result.status === 'pending') {
            expect(result.txHash).toBe(mockTx.hash);
            expect(result.explorerUrl).toContain('chainscan-galileo.0g.ai');
        }
    });

    it('returns "failed" when the receipt shows a revert', async () => {
        mockTx.wait.mockResolvedValue({ status: 0, logs: [] });
        const { recordRecommendation } = await import('../recommendation-ledger.service');

        const result = await recordRecommendation({
            user: '0x' + 'ab'.repeat(20),
            action: 'SWAP',
            targetToken: 'cUSD',
            reasoning: 'test',
            evidenceCid: '',
            servingModel: 'test',
            confidence: 8000,
        });

        expect(result.status).toBe('failed');
        if (result.status === 'failed') {
            expect(result.error).toBe('On-chain transaction reverted');
            expect(result.chainId).toBe(16602);
        }
    });

    it('returns "failed" with the broadcast error when the RPC throws before sending', async () => {
        mockContract.recordRecommendation.mockRejectedValueOnce(new Error('insufficient funds'));
        const { recordRecommendation } = await import('../recommendation-ledger.service');

        const result = await recordRecommendation({
            user: '0x' + 'ab'.repeat(20),
            action: 'SWAP',
            targetToken: 'cUSD',
            reasoning: 'test',
            evidenceCid: '',
            servingModel: 'test',
            confidence: 8000,
        });

        expect(result.status).toBe('failed');
        if (result.status === 'failed') {
            expect(result.error).toBe('insufficient funds');
        }
        // Restore the default behaviour for the next test
        mockContract.recordRecommendation.mockResolvedValue(mockTx);
    });

    it('returns "failed" with an explainable error when the write contract is unavailable', async () => {
        const envWithoutSigner = { ...ORIGINAL_ENV };
        delete envWithoutSigner.VAULT_PRIVATE_KEY;
        process.env = envWithoutSigner;
        vi.resetModules();

        const { recordRecommendation } = await import('../recommendation-ledger.service');
        const result = await recordRecommendation({
            user: '0x' + 'ab'.repeat(20),
            action: 'SWAP',
            targetToken: 'cUSD',
            reasoning: 'test',
            evidenceCid: '',
            servingModel: 'test',
            confidence: 8000,
        });

        expect(result.status).toBe('failed');
        if (result.status === 'failed') {
            expect(result.error).toMatch(/unavailable|missing/i);
            expect(result.chainId).toBe(16602);
        }

        process.env = { ...ORIGINAL_ENV, VAULT_PRIVATE_KEY: '0x' + 'aa'.repeat(32) };
    });
});
