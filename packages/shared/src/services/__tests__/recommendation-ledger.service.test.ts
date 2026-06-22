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
            keccak256: vi.fn().mockImplementation(() => '0x' + '99'.repeat(32)),
            toUtf8Bytes: vi.fn().mockImplementation((s: string) => s),
            ZeroHash: '0x' + '00'.repeat(32),
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

describe('RecommendationLedgerService — chain-aware config', () => {
    const ORIGINAL_ENV = process.env;

    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        process.env = ORIGINAL_ENV;
    });

    it('defaults to 0G Galileo when Arbitrum contract is not configured', async () => {
        process.env = {
            ...ORIGINAL_ENV,
            VAULT_PRIVATE_KEY: '0x' + 'aa'.repeat(32),
            ARBITRUM_LEDGER_CONTRACT: '',
            ZERO_G_LEDGER_CONTRACT: '0xFADc8a7220Fa152eBE3Dfc5f7828Be289559D4ED',
        };
        const { getDefaultLedgerChainId, getLedgerContractAddress } = await import('../recommendation-ledger.service');
        expect(getDefaultLedgerChainId()).toBe(16602);
        expect(getLedgerContractAddress()).toBe('0xFADc8a7220Fa152eBE3Dfc5f7828Be289559D4ED');
    });

    it('prefers Arbitrum Sepolia when its contract address is configured', async () => {
        process.env = {
            ...ORIGINAL_ENV,
            VAULT_PRIVATE_KEY: '0x' + 'aa'.repeat(32),
            ARBITRUM_LEDGER_CONTRACT: '0x' + 'ab'.repeat(20),
        };
        const { getDefaultLedgerChainId, getLedgerContractAddress, buildLedgerExplorerUrl } = await import('../recommendation-ledger.service');
        expect(getDefaultLedgerChainId()).toBe(421614);
        expect(getLedgerContractAddress()).toBe('0x' + 'ab'.repeat(20));
        expect(buildLedgerExplorerUrl('0x1234')).toContain('sepolia.arbiscan.io');
    });

    it('allows setting a custom Arbitrum Sepolia contract address at runtime', async () => {
        process.env = {
            ...ORIGINAL_ENV,
            VAULT_PRIVATE_KEY: '0x' + 'aa'.repeat(32),
            ARBITRUM_LEDGER_CONTRACT: '0x' + 'ab'.repeat(20),
        };
        const { setLedgerContractAddress, getLedgerContractAddress } = await import('../recommendation-ledger.service');
        const newAddress = '0x' + 'cd'.repeat(20);
        setLedgerContractAddress(newAddress, 421614);
        expect(getLedgerContractAddress(421614)).toBe(newAddress);
    });
});

describe('buildLedgerExplorerUrl — chain-aware URL builder (Phase 0 audit A5)', () => {
    it('builds Arbitrum One URLs for chainId 42161', async () => {
        const { buildLedgerExplorerUrl } = await import('../recommendation-ledger.service');
        const url = buildLedgerExplorerUrl('0xabc123', 42161);
        expect(url).toBe('https://arbiscan.io/tx/0xabc123');
    });

    it('builds Arbitrum Sepolia URLs for chainId 421614', async () => {
        const { buildLedgerExplorerUrl } = await import('../recommendation-ledger.service');
        const url = buildLedgerExplorerUrl('0xabc123', 421614);
        expect(url).toBe('https://sepolia.arbiscan.io/tx/0xabc123');
    });

    it('builds 0G Galileo URLs for chainId 16602', async () => {
        const { buildLedgerExplorerUrl } = await import('../recommendation-ledger.service');
        const url = buildLedgerExplorerUrl('0xabc123', 16602);
        expect(url).toBe('https://chainscan-galileo.0g.ai/tx/0xabc123');
    });

    it('falls back to 0G Galileo explorer for unknown chain IDs', async () => {
        const { buildLedgerExplorerUrl } = await import('../recommendation-ledger.service');
        const url = buildLedgerExplorerUrl('0xabc123', 99999);
        expect(url).toBe('https://chainscan-galileo.0g.ai/tx/0xabc123');
    });

    it('uses the default chain ID when none is specified', async () => {
        const { buildLedgerExplorerUrl, getDefaultLedgerChainId } = await import('../recommendation-ledger.service');
        const url = buildLedgerExplorerUrl('0xabc123');
        const defaultChain = getDefaultLedgerChainId();
        if (defaultChain === 421614) {
            expect(url).toBe('https://sepolia.arbiscan.io/tx/0xabc123');
        } else {
            expect(url).toBe('https://chainscan-galileo.0g.ai/tx/0xabc123');
        }
    });
});
