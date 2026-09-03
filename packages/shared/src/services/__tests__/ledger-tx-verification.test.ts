import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// verifyLedgerTx talks to the chain's RPC over plain JSON-RPC (no ethers),
// so a DI fetch seam is all we need to exercise every path.
import { verifyLedgerTx, buildLedgerExplorerUrl } from '../recommendation-ledger.service';

const TX_HASH = '0x' + 'ab'.repeat(32);

function rpcResponse(result: unknown): Response {
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result }), { status: 200 });
}

describe('verifyLedgerTx — explorer source verification via chain RPC', () => {
    const ORIGINAL_ENV = process.env;

    beforeEach(() => {
        process.env = { ...ORIGINAL_ENV };
        // Isolate ledger chain selection from .env.local leakage: the
        // default-chain assertions below assume a clean registry.
        for (const key of [
            'CELO_MAINNET_LEDGER_CONTRACT',
            'ARBITRUM_MAINNET_LEDGER_CONTRACT',
            'ARBITRUM_LEDGER_CONTRACT',
            'ZERO_G_MAINNET_LEDGER_CONTRACT',
            'HASHKEY_LEDGER_CONTRACT',
        ]) {
            delete process.env[key];
        }
    });

    afterEach(() => {
        process.env = ORIGINAL_ENV;
        vi.restoreAllMocks();
    });

    it('returns found + receipt facts when the RPC has the receipt', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            rpcResponse({
                status: '0x1',
                blockNumber: '0x2b9',
                to: '0x' + '42'.repeat(20),
            }),
        );

        const v = await verifyLedgerTx(TX_HASH, 16661, fetchMock as any);

        expect(fetchMock).toHaveBeenCalledWith(
            'https://evmrpc.0g.ai',
            expect.objectContaining({ method: 'POST' }),
        );
        expect(v).toEqual({
            txHash: TX_HASH,
            chainId: 16661,
            explorerUrl: `https://chainscan.0g.ai/tx/${TX_HASH}`,
            found: true,
            status: 1,
            blockNumber: 697,
            to: '0x' + '42'.repeat(20),
            isLedgerContract: null,
        });
    });

    it('flags receipts addressed to the configured ledger contract', async () => {
        process.env.ZERO_G_MAINNET_LEDGER_CONTRACT = '0x' + '42'.repeat(20);
        const fetchMock = vi.fn().mockResolvedValue(
            rpcResponse({ status: '0x1', blockNumber: '0x1', to: '0x' + '42'.repeat(20) }),
        );

        const v = await verifyLedgerTx(TX_HASH, 16661, fetchMock as any);
        expect(v.isLedgerContract).toBe(true);
    });

    it('marks isLedgerContract false for a foreign contract', async () => {
        process.env.ZERO_G_MAINNET_LEDGER_CONTRACT = '0x' + '99'.repeat(20);
        const fetchMock = vi.fn().mockResolvedValue(
            rpcResponse({ status: '0x1', blockNumber: '0x1', to: '0x' + '42'.repeat(20) }),
        );

        const v = await verifyLedgerTx(TX_HASH, 16661, fetchMock as any);
        expect(v.isLedgerContract).toBe(false);
    });

    it('returns found: false when the tx is unknown (receipt null)', async () => {
        const fetchMock = vi.fn().mockResolvedValue(rpcResponse(null));

        const v = await verifyLedgerTx(TX_HASH, 16661, fetchMock as any);

        expect(v.found).toBe(false);
        expect(v.status).toBeNull();
        // The explorer link is still returned so callers can render it.
        expect(v.explorerUrl).toBe(`https://chainscan.0g.ai/tx/${TX_HASH}`);
    });

    it('returns found: false when the RPC errors', async () => {
        const fetchMock = vi.fn().mockRejectedValue(new Error('boom'));
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const v = await verifyLedgerTx(TX_HASH, 16661, fetchMock as any);

        expect(v.found).toBe(false);
        expect(warn).toHaveBeenCalled();
    });

    it('returns found: false for a malformed hash without hitting the RPC', async () => {
        const fetchMock = vi.fn();

        const v = await verifyLedgerTx('0xdeadbeef', 16661, fetchMock as any);

        expect(fetchMock).not.toHaveBeenCalled();
        expect(v.found).toBe(false);
    });

    it('defaults to the default ledger chain when none given', async () => {
        const fetchMock = vi.fn().mockResolvedValue(rpcResponse(null));

        await verifyLedgerTx(TX_HASH, undefined, fetchMock as any);

        const expectedRpc = new URL('https://evmrpc-testnet.0g.ai');
        const calledUrl = new URL(fetchMock.mock.calls[0][0] as string);
        expect(calledUrl.host).toBe(expectedRpc.host);
        expect(buildLedgerExplorerUrl(TX_HASH)).toContain('chainscan-galileo.0g.ai');
    });
});
