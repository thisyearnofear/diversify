/**
 * Circle service — chain-code resolution and request shapes against the
 * installed @circle-fin/developer-controlled-wallets SDK (10.8.0).
 * Chain codes per https://developers.circle.com/wallets: 'ARC' mainnet,
 * 'ARC-TESTNET' testnet.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockClient = {
    listWallets: vi.fn(async (..._args: any[]): Promise<any> => ({ data: { wallets: [] } })),
    createWalletSet: vi.fn(async (..._args: any[]): Promise<any> => ({ data: { walletSet: { id: 'ws-1' } } })),
    createWallets: vi.fn(async (..._args: any[]): Promise<any> => ({ data: { wallets: [{ id: 'w-1', address: '0xabc', blockchain: 'ARC', accountType: 'SCA' }] } })),
    createTransaction: vi.fn(async (..._args: any[]): Promise<any> => ({ data: { id: 'tx-1' } })),
};

vi.mock('@circle-fin/developer-controlled-wallets', () => ({
    initiateDeveloperControlledWalletsClient: vi.fn(() => mockClient),
}));

import { circleWalletBlockchain, CircleService } from '../circle-service';

describe('circleWalletBlockchain', () => {
    const env = { ...process.env };
    afterEach(() => { process.env = { ...env }; });

    it('resolves ARC on mainnet, ARC-TESTNET otherwise', () => {
        delete process.env.CIRCLE_WALLET_BLOCKCHAIN;
        process.env.SETTLEMENT_ENV = 'mainnet';
        expect(circleWalletBlockchain()).toBe('ARC');
        process.env.SETTLEMENT_ENV = 'testnet';
        expect(circleWalletBlockchain()).toBe('ARC-TESTNET');
    });

    it('honours CIRCLE_WALLET_BLOCKCHAIN override', () => {
        process.env.SETTLEMENT_ENV = 'testnet';
        process.env.CIRCLE_WALLET_BLOCKCHAIN = 'ARC';
        expect(circleWalletBlockchain()).toBe('ARC');
    });
});

describe('CircleService.transferUSDCViaGateway request shape', () => {
    const env = { ...process.env };
    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.CIRCLE_WALLET_BLOCKCHAIN;
        process.env.SETTLEMENT_ENV = 'testnet';
        process.env.CIRCLE_API_KEY = 'test-key';
        process.env.CIRCLE_ENTITY_SECRET = 'a'.repeat(64);
        mockClient.listWallets.mockResolvedValue({
            data: { wallets: [{ id: 'w-1', blockchain: 'ARC-TESTNET' }] },
        });
    });
    afterEach(() => { process.env = { ...env }; });

    it('uses amounts[] + tokenAddress + fee:{type:level} — not tokenId/amount/feeLevel', async () => {
        const svc = new CircleService();
        const txId = await svc.transferUSDCViaGateway(5042002, 42161, '0.01', '0xdest');
        expect(txId).toBe('tx-1');
        const call = mockClient.createTransaction.mock.calls[0][0];
        expect(call.amounts).toEqual(['0.01']);
        expect(call.tokenAddress).toBe('0x3600000000000000000000000000000000000000');
        expect(call).not.toHaveProperty('tokenId');
        expect(call).not.toHaveProperty('amount');
        expect(call.fee).toEqual({ type: 'level', config: { feeLevel: 'MEDIUM' } });
        expect(call.blockchain).toBe('ARC-TESTNET');
        expect(call.destinationAddress).toBe('0xdest');
    });
});
