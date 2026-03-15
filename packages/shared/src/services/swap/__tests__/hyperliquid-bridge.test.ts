import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
    getAccountActivationStatus,
    getHyperliquidAccountStatus,
    activateHyperliquidAccount,
    withdrawToArbitrum,
    transferBetweenAccounts,
    HyperliquidBridgeService,
    HYPERLIQUID_WITHDRAW_TYPES,
    HYPERLIQUID_USD_SEND_TYPES,
    HYPERLIQUID_ACTIVATE_TYPES,
} from '../hyperliquid-bridge.service';
import { HYPERLIQUID_EIP712_DOMAIN } from '../strategies/hyperliquid-perp.strategy';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockFetchResponse(data: any, ok = true, status = 200) {
    mockFetch.mockResolvedValueOnce({
        ok,
        status,
        json: () => Promise.resolve(data),
        text: () => Promise.resolve(JSON.stringify(data)),
    });
}

// Mock signer
const createMockSigner = (address: string = '0xABC123def456789012345678901234567890ABCD') => {
    return {
        getAddress: vi.fn().mockResolvedValue(address),
        _signTypedData: vi.fn().mockResolvedValue('0x' + 'a'.repeat(130)), // Mock signature
    } as any;
};

describe('getAccountActivationStatus', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns true for activated account with crossMarginSummary', async () => {
        mockFetchResponse({
            crossMarginSummary: {
                accountValue: '1000.50',
                totalNtlPos: '0',
            },
            withdrawable: '1000.50',
            assetPositions: [],
        });

        const result = await getAccountActivationStatus('0xABC123');
        expect(result).toBe(true);
        expect(mockFetch).toHaveBeenCalledWith(
            'https://api.hyperliquid.xyz/info',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({
                    type: 'clearinghouseState',
                    user: '0xABC123',
                }),
            })
        );
    });

    it('returns true for activated account with marginSummary', async () => {
        mockFetchResponse({
            marginSummary: {
                accountValue: '500.00',
            },
            withdrawable: '500.00',
        });

        const result = await getAccountActivationStatus('0xDEF456');
        expect(result).toBe(true);
    });

    it('returns false for non-activated account', async () => {
        mockFetchResponse({});

        const result = await getAccountActivationStatus('0xNEWUSER');
        expect(result).toBe(false);
    });

    it('returns false on API error', async () => {
        mockFetchResponse({}, false, 500);

        const result = await getAccountActivationStatus('0xABC123');
        expect(result).toBe(false);
    });

    it('returns false on network error', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        const result = await getAccountActivationStatus('0xABC123');
        expect(result).toBe(false);
    });
});

describe('getHyperliquidAccountStatus', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns full account status for active account', async () => {
        mockFetchResponse({
            crossMarginSummary: {
                accountValue: '2500.75',
                totalNtlPos: '150.00',
            },
            withdrawable: '2350.75',
            assetPositions: [
                { position: { coin: 'GOLD', szi: '0.05' } },
            ],
        });

        const status = await getHyperliquidAccountStatus('0xTRADER');

        expect(status).toEqual({
            isActivated: true,
            balance: 2500.75,
            availableBalance: 2350.75,
            totalPositionValue: 150.00,
            hasPositions: true,
        });
    });

    it('returns zero values for account with no balance', async () => {
        mockFetchResponse({
            crossMarginSummary: {
                accountValue: '0',
                totalNtlPos: '0',
            },
            withdrawable: '0',
            assetPositions: [],
        });

        const status = await getHyperliquidAccountStatus('0xEMPTY');

        expect(status).toEqual({
            isActivated: true,
            balance: 0,
            availableBalance: 0,
            totalPositionValue: 0,
            hasPositions: false,
        });
    });

    it('returns null for non-existent account', async () => {
        mockFetchResponse(null);

        const status = await getHyperliquidAccountStatus('0xNONEXISTENT');
        expect(status).toBeNull();
    });

    it('returns null on API error', async () => {
        mockFetchResponse({}, false, 404);

        const status = await getHyperliquidAccountStatus('0xABC');
        expect(status).toBeNull();
    });

    it('handles missing crossMarginSummary gracefully', async () => {
        mockFetchResponse({
            marginSummary: {
                accountValue: '100.00',
            },
            withdrawable: '100.00',
            assetPositions: [],
        });

        const status = await getHyperliquidAccountStatus('0xLEGACY');
        expect(status?.balance).toBe(100.00);
        expect(status?.totalPositionValue).toBe(0);
    });
});

describe('activateHyperliquidAccount', () => {
    let mockSigner: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockSigner = createMockSigner();
    });

    it('successfully activates account', async () => {
        mockFetchResponse({ status: 'ok' });

        const result = await activateHyperliquidAccount(mockSigner, 'Test Agent');

        expect(result.success).toBe(true);
        expect(result.status).toBe('activated');
        expect(result.txHash).toMatch(/^hl-activate-\d+$/);
        expect(mockSigner._signTypedData).toHaveBeenCalledWith(
            HYPERLIQUID_EIP712_DOMAIN,
            HYPERLIQUID_ACTIVATE_TYPES,
            expect.objectContaining({
                hyperliquidChain: 'Mainnet',
                signatureChainId: '0xa4b1',
                agentName: 'Test Agent',
            })
        );
    });

    it('uses default agent name if not provided', async () => {
        mockFetchResponse({ status: 'ok' });

        await activateHyperliquidAccount(mockSigner);

        expect(mockSigner._signTypedData).toHaveBeenCalledWith(
            HYPERLIQUID_EIP712_DOMAIN,
            HYPERLIQUID_ACTIVATE_TYPES,
            expect.objectContaining({
                agentName: 'DiversiFi Trading',
            })
        );
    });

    it('returns error on activation failure', async () => {
        mockFetchResponse({
            status: 'err',
            response: { error: 'Account already activated' },
        });

        const result = await activateHyperliquidAccount(mockSigner);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Account already activated');
    });

    it('returns error on signing failure', async () => {
        mockSigner._signTypedData.mockRejectedValueOnce(new Error('User rejected'));

        const result = await activateHyperliquidAccount(mockSigner);

        expect(result.success).toBe(false);
        expect(result.error).toContain('User rejected');
    });

    it('sends correct API request structure', async () => {
        mockFetchResponse({ status: 'ok' });

        await activateHyperliquidAccount(mockSigner, 'My Agent');

        const fetchCall = mockFetch.mock.calls.find(
            call => call[0] === 'https://api.hyperliquid.xyz/exchange'
        );
        const requestBody = JSON.parse(fetchCall[1].body);

        expect(requestBody.action.type).toBe('approveAgent');
        expect(requestBody.action.hyperliquidChain).toBe('Mainnet');
        expect(requestBody.action.signatureChainId).toBe('0xa4b1');
        expect(requestBody.signature).toHaveProperty('r');
        expect(requestBody.signature).toHaveProperty('s');
        expect(requestBody.signature).toHaveProperty('v');
    });
});

describe('withdrawToArbitrum', () => {
    let mockSigner: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockSigner = createMockSigner('0xRECIPIENT');
    });

    it('successfully initiates withdrawal', async () => {
        mockFetchResponse({ status: 'ok' });

        const result = await withdrawToArbitrum(mockSigner, '100');

        expect(result.success).toBe(true);
        expect(result.status).toBe('withdrawal_initiated');
        expect(result.txHash).toMatch(/^hl-withdraw-\d+$/);
    });

    it('withdraws to custom destination address', async () => {
        mockFetchResponse({ status: 'ok' });

        const result = await withdrawToArbitrum(mockSigner, '50', '0xCUSTOM');

        expect(result.success).toBe(true);
        expect(mockSigner._signTypedData).toHaveBeenCalledWith(
            HYPERLIQUID_EIP712_DOMAIN,
            HYPERLIQUID_WITHDRAW_TYPES,
            expect.objectContaining({
                destination: '0xCUSTOM',
                amount: '50',
            })
        );
    });

    it('uses signer address as default destination', async () => {
        mockFetchResponse({ status: 'ok' });

        await withdrawToArbitrum(mockSigner, '25');

        expect(mockSigner._signTypedData).toHaveBeenCalledWith(
            HYPERLIQUID_EIP712_DOMAIN,
            HYPERLIQUID_WITHDRAW_TYPES,
            expect.objectContaining({
                destination: '0xRECIPIENT',
            })
        );
    });

    it('returns error on withdrawal failure', async () => {
        mockFetchResponse({
            status: 'err',
            response: { error: 'Insufficient balance' },
        });

        const result = await withdrawToArbitrum(mockSigner, '10000');

        expect(result.success).toBe(false);
        expect(result.error).toContain('Insufficient balance');
    });

    it('returns error on signing rejection', async () => {
        mockSigner._signTypedData.mockRejectedValueOnce(new Error('User rejected signature'));

        const result = await withdrawToArbitrum(mockSigner, '100');

        expect(result.success).toBe(false);
        expect(result.error).toContain('User rejected signature');
    });

    it('sends correct withdraw3 action type', async () => {
        mockFetchResponse({ status: 'ok' });

        await withdrawToArbitrum(mockSigner, '100');

        const fetchCall = mockFetch.mock.calls.find(
            call => call[0] === 'https://api.hyperliquid.xyz/exchange'
        );
        const requestBody = JSON.parse(fetchCall[1].body);

        expect(requestBody.action.type).toBe('withdraw3');
        expect(requestBody.action.amount).toBe('100');
    });
});

describe('transferBetweenAccounts', () => {
    let mockSigner: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockSigner = createMockSigner();
    });

    it('transfers to perp account', async () => {
        mockFetchResponse({ status: 'ok' });

        const result = await transferBetweenAccounts(mockSigner, '100', true);

        expect(result.success).toBe(true);
        expect(result.status).toBe('transferred');
    });

    it('transfers from perp account (to spot)', async () => {
        mockFetchResponse({ status: 'ok' });

        const result = await transferBetweenAccounts(mockSigner, '50', false);

        expect(result.success).toBe(true);
    });

    it('returns error on transfer failure', async () => {
        mockFetchResponse({
            status: 'err',
            response: { error: 'Insufficient spot balance' },
        });

        const result = await transferBetweenAccounts(mockSigner, '1000', true);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Insufficient spot balance');
    });

    it('sends usdClassTransfer action type', async () => {
        mockFetchResponse({ status: 'ok' });

        await transferBetweenAccounts(mockSigner, '100', true);

        const fetchCall = mockFetch.mock.calls.find(
            call => call[0] === 'https://api.hyperliquid.xyz/exchange'
        );
        const requestBody = JSON.parse(fetchCall[1].body);

        expect(requestBody.action.type).toBe('usdClassTransfer');
        expect(requestBody.action.toPerp).toBe(true);
    });
});

describe('HyperliquidBridgeService', () => {
    let service: HyperliquidBridgeService;
    let mockSigner: any;

    beforeEach(() => {
        service = new HyperliquidBridgeService();
        mockSigner = createMockSigner();
        vi.clearAllMocks();
    });

    describe('isAccountReady', () => {
        it('returns ready status for activated account with balance', async () => {
            mockFetchResponse({
                crossMarginSummary: { accountValue: '500', totalNtlPos: '0' },
                withdrawable: '500',
                assetPositions: [],
            });

            const ready = await service.isAccountReady('0xTRADER');

            expect(ready).toEqual({
                isActivated: true,
                hasBalance: true,
                balance: 500,
            });
        });

        it('returns hasBalance false for zero balance', async () => {
            mockFetchResponse({
                crossMarginSummary: { accountValue: '0', totalNtlPos: '0' },
                withdrawable: '0',
                assetPositions: [],
            });

            const ready = await service.isAccountReady('0xEMPTY');

            expect(ready.hasBalance).toBe(false);
            expect(ready.balance).toBe(0);
        });

        it('returns not activated for non-existent account', async () => {
            mockFetchResponse(null);

            const ready = await service.isAccountReady('0xNEW');

            expect(ready).toEqual({
                isActivated: false,
                hasBalance: false,
                balance: 0,
            });
        });
    });

    describe('getDepositInstructions', () => {
        it('returns complete deposit instructions', () => {
            const instructions = service.getDepositInstructions();

            expect(instructions.steps).toHaveLength(6);
            expect(instructions.requiredChains).toContain('Arbitrum');
            expect(instructions.bridgeUrl).toBe('https://app.hyperliquid.xyz/trade');
            expect(instructions.steps[0]).toContain('USDC on Arbitrum');
        });
    });

    describe('initiateWithdrawal', () => {
        it('delegates to withdrawToArbitrum', async () => {
            mockFetchResponse({ status: 'ok' });

            const result = await service.initiateWithdrawal(mockSigner, '100');

            expect(result.success).toBe(true);
            expect(result.status).toBe('withdrawal_initiated');
        });

        it('passes destination address through', async () => {
            mockFetchResponse({ status: 'ok' });

            const result = await service.initiateWithdrawal(mockSigner, '50', '0xCUSTOM');

            expect(result.success).toBe(true);
        });
    });

    describe('activateAccount', () => {
        it('delegates to activateHyperliquidAccount', async () => {
            mockFetchResponse({ status: 'ok' });

            const result = await service.activateAccount(mockSigner, 'Test');

            expect(result.success).toBe(true);
            expect(result.status).toBe('activated');
        });
    });

    describe('getAccountStatus', () => {
        it('delegates to getHyperliquidAccountStatus', async () => {
            mockFetchResponse({
                crossMarginSummary: { accountValue: '1000', totalNtlPos: '100' },
                withdrawable: '900',
                assetPositions: [],
            });

            const status = await service.getAccountStatus('0xUSER');

            expect(status?.balance).toBe(1000);
            expect(status?.availableBalance).toBe(900);
        });
    });
});

describe('EIP-712 Type Constants', () => {
    it('HYPERLIQUID_WITHDRAW_TYPES has correct structure', () => {
        expect(HYPERLIQUID_WITHDRAW_TYPES).toHaveProperty('HyperliquidTransaction:Withdraw3');
        const types = HYPERLIQUID_WITHDRAW_TYPES['HyperliquidTransaction:Withdraw3'];
        expect(types).toEqual(
            expect.arrayContaining([
                { name: 'hyperliquidChain', type: 'string' },
                { name: 'signatureChainId', type: 'string' },
                { name: 'destination', type: 'string' },
                { name: 'amount', type: 'string' },
                { name: 'time', type: 'uint64' },
            ])
        );
    });

    it('HYPERLIQUID_ACTIVATE_TYPES has correct structure', () => {
        expect(HYPERLIQUID_ACTIVATE_TYPES).toHaveProperty('HyperliquidTransaction:ApproveAgent');
        const types = HYPERLIQUID_ACTIVATE_TYPES['HyperliquidTransaction:ApproveAgent'];
        expect(types).toEqual(
            expect.arrayContaining([
                { name: 'hyperliquidChain', type: 'string' },
                { name: 'signatureChainId', type: 'string' },
                { name: 'agentAddress', type: 'string' },
                { name: 'agentName', type: 'string' },
                { name: 'nonce', type: 'uint64' },
            ])
        );
    });

    it('HYPERLIQUID_USD_SEND_TYPES has correct structure', () => {
        expect(HYPERLIQUID_USD_SEND_TYPES).toHaveProperty('HyperliquidTransaction:UsdSend');
        const types = HYPERLIQUID_USD_SEND_TYPES['HyperliquidTransaction:UsdSend'];
        expect(types).toHaveLength(5);
    });
});
