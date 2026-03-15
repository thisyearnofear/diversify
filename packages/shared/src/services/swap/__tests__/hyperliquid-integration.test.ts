import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { HyperliquidPerpStrategy } from '../strategies/hyperliquid-perp.strategy';
import {
    HyperliquidBridgeService,
    getHyperliquidAccountStatus,
    activateHyperliquidAccount,
    withdrawToArbitrum,
} from '../hyperliquid-bridge.service';
import type { SwapParams } from '../strategies/base-swap.strategy';

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

// Mock signer that simulates real wallet behavior
const createMockSigner = (address: string = '0xTRADER123456789012345678901234567890ABCD') => {
    return {
        getAddress: vi.fn().mockResolvedValue(address),
        _signTypedData: vi.fn().mockResolvedValue('0x' + 'deadbeef'.repeat(16)), // 66 char signature
    } as any;
};

const HYPERLIQUID_CHAIN_ID = 998;

/**
 * Integration Tests for Hyperliquid Deposit-Trade-Withdraw Lifecycle
 * 
 * These tests verify the complete user journey:
 * 1. Check account status (not activated)
 * 2. Activate account (EIP-712 signature)
 * 3. Deposit USDC (via external bridge - instructions provided)
 * 4. Execute commodity trade (open position)
 * 5. Close position (sell commodity)
 * 6. Withdraw to Arbitrum
 */
describe('Hyperliquid Integration: Full Lifecycle', () => {
    let strategy: HyperliquidPerpStrategy;
    let bridgeService: HyperliquidBridgeService;
    let mockSigner: any;
    const userAddress = '0xTRADER123456789012345678901234567890ABCD';

    beforeEach(() => {
        strategy = new HyperliquidPerpStrategy();
        bridgeService = new HyperliquidBridgeService();
        mockSigner = createMockSigner(userAddress);
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('New User Journey', () => {
        it('Step 1: Check account status - not activated', async () => {
            // New user has no Hyperliquid account - returns empty object or null
            mockFetchResponse({});

            const status = await getHyperliquidAccountStatus(userAddress);

            // Empty response returns a default object with isActivated=false
            expect(status?.isActivated).toBe(false);
            expect(status?.balance).toBe(0);
        });

        it('Step 2: Get deposit instructions before activation', () => {
            const instructions = bridgeService.getDepositInstructions();

            expect(instructions.steps).toHaveLength(6);
            expect(instructions.bridgeUrl).toBe('https://app.hyperliquid.xyz/trade');
            expect(instructions.requiredChains).toContain('Arbitrum');
        });

        it('Step 3: Activate account (Enable Trading)', async () => {
            // Simulate successful activation
            mockFetchResponse({ status: 'ok' });

            const result = await activateHyperliquidAccount(mockSigner, 'DiversiFi Trading');

            expect(result.success).toBe(true);
            expect(result.status).toBe('activated');
            expect(mockSigner._signTypedData).toHaveBeenCalledTimes(1);
        });

        it('Step 4: Verify account is now activated but empty', async () => {
            // Account exists but has no balance
            mockFetchResponse({
                crossMarginSummary: {
                    accountValue: '0',
                    totalNtlPos: '0',
                },
                withdrawable: '0',
                assetPositions: [],
            });

            const ready = await bridgeService.isAccountReady(userAddress);

            expect(ready.isActivated).toBe(true);
            expect(ready.hasBalance).toBe(false);
            expect(ready.balance).toBe(0);
        });
    });

    describe('Funded Account: Trading Flow', () => {
        it('Step 5: Check account with deposited funds', async () => {
            // User has deposited 1000 USDC
            mockFetchResponse({
                crossMarginSummary: {
                    accountValue: '1000.00',
                    totalNtlPos: '0',
                },
                withdrawable: '1000.00',
                assetPositions: [],
            });

            const status = await getHyperliquidAccountStatus(userAddress);

            expect(status?.isActivated).toBe(true);
            expect(status?.balance).toBe(1000);
            expect(status?.availableBalance).toBe(1000);
            expect(status?.hasPositions).toBe(false);
        });

        it('Step 6: Execute buy trade (open GOLD position)', async () => {
            // Mock price fetch
            mockFetchResponse({ GOLD: '2000.00' });

            const params: SwapParams = {
                fromToken: 'USDC',
                toToken: 'GOLD',
                amount: '100', // $100 worth
                fromChainId: 42161, // Arbitrum
                toChainId: HYPERLIQUID_CHAIN_ID,
                userAddress,
            };

            const result = await strategy.execute(params);

            expect(result.success).toBe(true);
            expect(result.steps).toHaveLength(1);
            expect(result.steps![0].action).toBe('open_long');
            expect(result.steps![0].coin).toBe('GOLD');
            expect(result.steps![0].leverage).toBe(1);
            expect(result.steps![0].requiresClientSigning).toBe(true);
        });

        it('Step 7: Verify position appears in account status', async () => {
            mockFetchResponse({
                crossMarginSummary: {
                    accountValue: '1000.00',
                    totalNtlPos: '100.00',
                },
                withdrawable: '900.00',
                assetPositions: [
                    {
                        position: {
                            coin: 'GOLD',
                            szi: '0.05',
                            entryPx: '2000.00',
                            positionValue: '100.00',
                            unrealizedPnl: '0.00',
                        },
                    },
                ],
            });

            const status = await getHyperliquidAccountStatus(userAddress);

            expect(status?.hasPositions).toBe(true);
            expect(status?.totalPositionValue).toBe(100);
        });

        it('Step 8: Execute sell trade (close GOLD position)', async () => {
            // Mock price fetch
            mockFetchResponse({ GOLD: '2050.00' }); // Price went up!

            // For sells, amount should be >= $10 worth
            // 0.05 oz * $2050 = $102.50 worth
            const params: SwapParams = {
                fromToken: 'GOLD',
                toToken: 'USDC',
                amount: '50', // $50 worth of GOLD to close
                fromChainId: HYPERLIQUID_CHAIN_ID,
                toChainId: 42161,
                userAddress,
            };

            const result = await strategy.execute(params);

            expect(result.success).toBe(true);
            expect(result.steps![0].action).toBe('close_long');
            expect(result.steps![0].coin).toBe('GOLD');
        });
    });

    describe('Withdrawal Flow', () => {
        it('Step 9: Initiate withdrawal to Arbitrum', async () => {
            mockFetchResponse({ status: 'ok' });

            const result = await withdrawToArbitrum(mockSigner, '500');

            expect(result.success).toBe(true);
            expect(result.status).toBe('withdrawal_initiated');
            expect(result.txHash).toMatch(/^hl-withdraw-\d+$/);
        });

        it('Step 10: Verify reduced balance after withdrawal initiated', async () => {
            mockFetchResponse({
                crossMarginSummary: {
                    accountValue: '500.00',
                    totalNtlPos: '0',
                },
                withdrawable: '500.00', // Still shows until withdrawal completes
                assetPositions: [],
            });

            const status = await getHyperliquidAccountStatus(userAddress);

            expect(status?.balance).toBe(500);
        });
    });

    describe('Error Handling: Insufficient Balance', () => {
        it('prevents trade when account has insufficient balance', async () => {
            // Mock price and balance check
            mockFetchResponse({ GOLD: '2000.00' });
            mockFetchResponse({
                crossMarginSummary: { accountValue: '50', totalNtlPos: '0' },
                withdrawable: '50',
                assetPositions: [],
            });

            const params: SwapParams = {
                fromToken: 'USDC',
                toToken: 'GOLD',
                amount: '100', // Trying to trade $100 with only $50
                fromChainId: 42161,
                toChainId: HYPERLIQUID_CHAIN_ID,
                userAddress,
            };

            const result = await strategy.execute(params);

            // Strategy should either reject or return error
            expect(result.success).toBe(false);
        });
    });

    describe('Multi-Commodity Trading', () => {
        it('supports trading multiple commodities sequentially', async () => {
            // Buy GOLD
            mockFetchResponse({ GOLD: '2000.00' });
            const goldParams: SwapParams = {
                fromToken: 'USDC',
                toToken: 'GOLD',
                amount: '100',
                fromChainId: 42161,
                toChainId: HYPERLIQUID_CHAIN_ID,
                userAddress,
            };
            const goldResult = await strategy.execute(goldParams);
            expect(goldResult.success).toBe(true);

            // Buy SILVER
            mockFetchResponse({ SILVER: '25.00' });
            const silverParams: SwapParams = {
                fromToken: 'USDC',
                toToken: 'SILVER',
                amount: '50',
                fromChainId: 42161,
                toChainId: HYPERLIQUID_CHAIN_ID,
                userAddress,
            };
            const silverResult = await strategy.execute(silverParams);
            expect(silverResult.success).toBe(true);
            expect(silverResult.steps![0].coin).toBe('SILVER');
        });

        it('supports OIL and COPPER trading', async () => {
            mockFetchResponse({ OIL: '75.00' });
            const oilParams: SwapParams = {
                fromToken: 'USDC',
                toToken: 'OIL',
                amount: '150',
                fromChainId: 42161,
                toChainId: HYPERLIQUID_CHAIN_ID,
                userAddress,
            };
            const oilResult = await strategy.execute(oilParams);
            expect(oilResult.success).toBe(true);

            mockFetchResponse({ COPPER: '4.50' });
            const copperParams: SwapParams = {
                fromToken: 'USDC',
                toToken: 'COPPER',
                amount: '45',
                fromChainId: 42161,
                toChainId: HYPERLIQUID_CHAIN_ID,
                userAddress,
            };
            const copperResult = await strategy.execute(copperParams);
            expect(copperResult.success).toBe(true);
        });
    });

    describe('Minimum Order Validation', () => {
        it('rejects orders below $10 minimum', async () => {
            mockFetchResponse({ GOLD: '2000.00' });

            const params: SwapParams = {
                fromToken: 'USDC',
                toToken: 'GOLD',
                amount: '5', // Below $10 minimum
                fromChainId: 42161,
                toChainId: HYPERLIQUID_CHAIN_ID,
                userAddress,
            };

            const result = await strategy.execute(params);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Minimum order value');
        });

        it('accepts orders at exactly $10', async () => {
            mockFetchResponse({ GOLD: '2000.00' });

            const params: SwapParams = {
                fromToken: 'USDC',
                toToken: 'GOLD',
                amount: '10', // Exactly $10
                fromChainId: 42161,
                toChainId: HYPERLIQUID_CHAIN_ID,
                userAddress,
            };

            const result = await strategy.execute(params);

            expect(result.success).toBe(true);
        });
    });

    describe('EIP-712 Signature Consistency', () => {
        it('uses correct domain for all signed actions', async () => {
            // Verify domain is consistent across activation and withdrawal
            const expectedChainId = 42161; // Arbitrum One

            // Activation signature
            mockFetchResponse({ status: 'ok' });
            await activateHyperliquidAccount(mockSigner);

            const activationCall = mockSigner._signTypedData.mock.calls[0];
            expect(activationCall[0].chainId).toBe(expectedChainId);

            // Reset for withdrawal
            mockSigner._signTypedData.mockClear();
            mockFetchResponse({ status: 'ok' });
            await withdrawToArbitrum(mockSigner, '100');

            const withdrawalCall = mockSigner._signTypedData.mock.calls[0];
            expect(withdrawalCall[0].chainId).toBe(expectedChainId);
        });

        it('uses Mainnet hyperliquidChain for all actions', async () => {
            mockFetchResponse({ status: 'ok' });
            await activateHyperliquidAccount(mockSigner);

            const typedData = mockSigner._signTypedData.mock.calls[0][2];
            expect(typedData.hyperliquidChain).toBe('Mainnet');
            expect(typedData.signatureChainId).toBe('0xa4b1');
        });
    });

    describe('API Error Recovery', () => {
        it('handles rate limiting gracefully', async () => {
            mockFetchResponse({}, false, 429);

            const status = await getHyperliquidAccountStatus(userAddress);

            expect(status).toBeNull();
        });

        it('handles network timeout gracefully', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

            const status = await getHyperliquidAccountStatus(userAddress);

            expect(status).toBeNull();
        });

        it('handles malformed API response', async () => {
            // When API returns a primitive string instead of object, balance extraction uses defaults
            mockFetchResponse('invalid json string');

            const status = await getHyperliquidAccountStatus(userAddress);

            // Should return an object with default zero values since there's no crossMarginSummary
            expect(status?.isActivated).toBe(false);
            expect(status?.balance).toBe(0);
        });
    });
});
