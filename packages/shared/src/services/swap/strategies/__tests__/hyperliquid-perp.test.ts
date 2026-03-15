import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
    HyperliquidPerpStrategy,
    fetchHyperliquidPrice,
    fetchHyperliquidPrices,
    roundSize,
    roundPrice,
    HYPERLIQUID_MARKET_TICKERS,
    HYPERLIQUID_EIP712_DOMAIN,
} from '../hyperliquid-perp.strategy';
import type { SwapParams } from '../base-swap.strategy';

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

const HYPERLIQUID_CHAIN_ID = 998;

describe('HyperliquidPerpStrategy', () => {
    let strategy: HyperliquidPerpStrategy;

    beforeEach(() => {
        strategy = new HyperliquidPerpStrategy();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getName', () => {
        it('returns HyperliquidPerp', () => {
            expect(strategy.getName()).toBe('HyperliquidPerp');
        });
    });

    describe('supports', () => {
        it('supports buying commodity on Hyperliquid', () => {
            const params: SwapParams = {
                fromToken: 'USDC',
                toToken: 'GOLD',
                amount: '100',
                fromChainId: 42220,
                toChainId: HYPERLIQUID_CHAIN_ID,
                userAddress: '0xabc',
            };
            expect(strategy.supports(params)).toBe(true);
        });

        it('supports selling commodity from Hyperliquid', () => {
            const params: SwapParams = {
                fromToken: 'SILVER',
                toToken: 'USDC',
                amount: '100',
                fromChainId: HYPERLIQUID_CHAIN_ID,
                toChainId: 42220,
                userAddress: '0xabc',
            };
            expect(strategy.supports(params)).toBe(true);
        });

        it('supports all commodity tokens', () => {
            for (const token of ['GOLD', 'SILVER', 'OIL', 'COPPER']) {
                const params: SwapParams = {
                    fromToken: 'USDC',
                    toToken: token,
                    amount: '100',
                    fromChainId: 42220,
                    toChainId: HYPERLIQUID_CHAIN_ID,
                    userAddress: '0xabc',
                };
                expect(strategy.supports(params)).toBe(true);
            }
        });

        it('does not support non-commodity tokens', () => {
            const params: SwapParams = {
                fromToken: 'USDC',
                toToken: 'ETH',
                amount: '100',
                fromChainId: 42220,
                toChainId: HYPERLIQUID_CHAIN_ID,
                userAddress: '0xabc',
            };
            expect(strategy.supports(params)).toBe(false);
        });

        it('does not support non-Hyperliquid chains', () => {
            const params: SwapParams = {
                fromToken: 'USDC',
                toToken: 'GOLD',
                amount: '100',
                fromChainId: 42220,
                toChainId: 1,
                userAddress: '0xabc',
            };
            expect(strategy.supports(params)).toBe(false);
        });

        it('is case-insensitive for token symbols', () => {
            const params: SwapParams = {
                fromToken: 'USDC',
                toToken: 'gold',
                amount: '100',
                fromChainId: 42220,
                toChainId: HYPERLIQUID_CHAIN_ID,
                userAddress: '0xabc',
            };
            expect(strategy.supports(params)).toBe(true);
        });
    });

    describe('validate', () => {
        it('returns true for valid buy params', async () => {
            const params: SwapParams = {
                fromToken: 'USDC',
                toToken: 'GOLD',
                amount: '100',
                fromChainId: 42220,
                toChainId: HYPERLIQUID_CHAIN_ID,
                userAddress: '0xabc',
            };
            expect(await strategy.validate(params)).toBe(true);
        });

        it('returns false when no user address', async () => {
            const params: SwapParams = {
                fromToken: 'USDC',
                toToken: 'GOLD',
                amount: '100',
                fromChainId: 42220,
                toChainId: HYPERLIQUID_CHAIN_ID,
                userAddress: '',
            };
            expect(await strategy.validate(params)).toBe(false);
        });

        it('returns false for zero amount', async () => {
            const params: SwapParams = {
                fromToken: 'USDC',
                toToken: 'GOLD',
                amount: '0',
                fromChainId: 42220,
                toChainId: HYPERLIQUID_CHAIN_ID,
                userAddress: '0xabc',
            };
            expect(await strategy.validate(params)).toBe(false);
        });

        it('returns false for negative amount', async () => {
            const params: SwapParams = {
                fromToken: 'USDC',
                toToken: 'GOLD',
                amount: '-50',
                fromChainId: 42220,
                toChainId: HYPERLIQUID_CHAIN_ID,
                userAddress: '0xabc',
            };
            expect(await strategy.validate(params)).toBe(false);
        });

        it('returns false for amount below $10 minimum', async () => {
            const params: SwapParams = {
                fromToken: 'USDC',
                toToken: 'GOLD',
                amount: '5',
                fromChainId: 42220,
                toChainId: HYPERLIQUID_CHAIN_ID,
                userAddress: '0xabc',
            };
            expect(await strategy.validate(params)).toBe(false);
        });

        it('returns false for invalid amount', async () => {
            const params: SwapParams = {
                fromToken: 'USDC',
                toToken: 'GOLD',
                amount: 'abc',
                fromChainId: 42220,
                toChainId: HYPERLIQUID_CHAIN_ID,
                userAddress: '0xabc',
            };
            expect(await strategy.validate(params)).toBe(false);
        });
    });

    describe('getEstimate', () => {
        it('returns correct estimate for buy', async () => {
            mockFetchResponse({ GOLD: '2000.50' });

            const params: SwapParams = {
                fromToken: 'USDC',
                toToken: 'GOLD',
                amount: '1000',
                fromChainId: 42220,
                toChainId: HYPERLIQUID_CHAIN_ID,
                userAddress: '0xabc',
            };

            const estimate = await strategy.getEstimate(params);
            const expectedSize = 1000 / 2000.50;
            expect(parseFloat(estimate.expectedOutput)).toBeCloseTo(expectedSize, 4);
            expect(parseFloat(estimate.minimumOutput)).toBeLessThan(parseFloat(estimate.expectedOutput));
            expect(estimate.priceImpact).toBe(0.1);
        });

        it('returns correct estimate for sell', async () => {
            mockFetchResponse({ SILVER: '25.30' });

            const params: SwapParams = {
                fromToken: 'SILVER',
                toToken: 'USDC',
                amount: '10',
                fromChainId: HYPERLIQUID_CHAIN_ID,
                toChainId: 42220,
                userAddress: '0xabc',
            };

            const estimate = await strategy.getEstimate(params);
            const expectedOutput = 10 * 25.30;
            expect(parseFloat(estimate.expectedOutput)).toBeCloseTo(expectedOutput, 2);
        });

        it('applies custom slippage tolerance', async () => {
            mockFetchResponse({ GOLD: '2000' });

            const params: SwapParams = {
                fromToken: 'USDC',
                toToken: 'GOLD',
                amount: '1000',
                fromChainId: 42220,
                toChainId: HYPERLIQUID_CHAIN_ID,
                userAddress: '0xabc',
                slippageTolerance: 1.0,
            };

            const estimate = await strategy.getEstimate(params);
            const expectedSize = 1000 / 2000;
            const minWithSlippage = expectedSize * (1 - 1.0 / 100);
            expect(parseFloat(estimate.minimumOutput)).toBeCloseTo(minWithSlippage, 4);
        });
    });

    describe('execute', () => {
        it('returns structured result without signer', async () => {
            mockFetchResponse({ GOLD: '2000' });

            const params: SwapParams = {
                fromToken: 'USDC',
                toToken: 'GOLD',
                amount: '100',
                fromChainId: 42220,
                toChainId: HYPERLIQUID_CHAIN_ID,
                userAddress: '0xabc',
            };

            const result = await strategy.execute(params);
            expect(result.success).toBe(true);
            expect(result.steps).toHaveLength(1);
            expect(result.steps![0].type).toBe('hyperliquid_perp');
            expect(result.steps![0].action).toBe('open_long');
            expect(result.steps![0].coin).toBe('GOLD');
            expect(result.steps![0].requiresClientSigning).toBe(true);
            expect(result.steps![0].leverage).toBe(1);
        });

        it('returns close_long for sell direction', async () => {
            mockFetchResponse({ OIL: '75.50' });

            const params: SwapParams = {
                fromToken: 'OIL',
                toToken: 'USDC',
                amount: '50',
                fromChainId: HYPERLIQUID_CHAIN_ID,
                toChainId: 42220,
                userAddress: '0xabc',
            };

            const result = await strategy.execute(params);
            expect(result.success).toBe(true);
            expect(result.steps![0].action).toBe('close_long');
        });

        it('fails for unsupported commodity', async () => {
            const params: SwapParams = {
                fromToken: 'USDC',
                toToken: 'PLATINUM',
                amount: '100',
                fromChainId: 42220,
                toChainId: HYPERLIQUID_CHAIN_ID,
                userAddress: '0xabc',
            };

            const result = await strategy.execute(params);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Unsupported commodity');
        });

        it('fails for amount below minimum', async () => {
            mockFetchResponse({ GOLD: '2000' });

            const params: SwapParams = {
                fromToken: 'USDC',
                toToken: 'GOLD',
                amount: '5',
                fromChainId: 42220,
                toChainId: HYPERLIQUID_CHAIN_ID,
                userAddress: '0xabc',
            };

            const result = await strategy.execute(params);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Minimum order value');
        });

        it('calls onSwapSubmitted callback', async () => {
            mockFetchResponse({ COPPER: '4.50' });

            const params: SwapParams = {
                fromToken: 'USDC',
                toToken: 'COPPER',
                amount: '100',
                fromChainId: 42220,
                toChainId: HYPERLIQUID_CHAIN_ID,
                userAddress: '0xabc',
            };

            const onSwapSubmitted = vi.fn();
            await strategy.execute(params, { onSwapSubmitted });
            expect(onSwapSubmitted).toHaveBeenCalledWith('hyperliquid-pending');
        });

        it('handles API errors gracefully', async () => {
            mockFetchResponse({}, false, 500);

            const params: SwapParams = {
                fromToken: 'USDC',
                toToken: 'GOLD',
                amount: '100',
                fromChainId: 42220,
                toChainId: HYPERLIQUID_CHAIN_ID,
                userAddress: '0xabc',
            };

            const result = await strategy.execute(params);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Hyperliquid');
        });

        it('includes signing domain in client-side result', async () => {
            mockFetchResponse({ GOLD: '2000' });

            const params: SwapParams = {
                fromToken: 'USDC',
                toToken: 'GOLD',
                amount: '100',
                fromChainId: 42220,
                toChainId: HYPERLIQUID_CHAIN_ID,
                userAddress: '0xabc',
            };

            const result = await strategy.execute(params);
            expect(result.steps![0].signingDomain).toEqual(HYPERLIQUID_EIP712_DOMAIN);
        });
    });
});

describe('fetchHyperliquidPrices', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('fetches all mid prices', async () => {
        const mockPrices = { GOLD: '2000', SILVER: '25', OIL: '75', COPPER: '4.5' };
        mockFetchResponse(mockPrices);

        const prices = await fetchHyperliquidPrices();
        expect(prices).toEqual(mockPrices);
        expect(mockFetch).toHaveBeenCalledWith(
            'https://api.hyperliquid.xyz/info',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ type: 'allMids' }),
            })
        );
    });

    it('throws on API error', async () => {
        mockFetchResponse({}, false, 503);
        await expect(fetchHyperliquidPrices()).rejects.toThrow('Hyperliquid allMids failed');
    });
});

describe('fetchHyperliquidPrice', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns price for valid symbol', async () => {
        mockFetchResponse({ GOLD: '2050.75' });
        const price = await fetchHyperliquidPrice('GOLD');
        expect(price).toBe(2050.75);
    });

    it('is case-insensitive', async () => {
        mockFetchResponse({ SILVER: '25.30' });
        const price = await fetchHyperliquidPrice('silver');
        expect(price).toBe(25.30);
    });

    it('throws for unknown symbol', async () => {
        await expect(fetchHyperliquidPrice('PLATINUM')).rejects.toThrow('No Hyperliquid ticker');
    });

    it('throws when ticker has no price', async () => {
        mockFetchResponse({ BTC: '50000' }); // No GOLD price
        await expect(fetchHyperliquidPrice('GOLD')).rejects.toThrow('No matching commodity perp in current Hyperliquid universe');
    });
});

describe('roundSize', () => {
    it('rounds down to correct decimals', () => {
        expect(roundSize(1.23456, 2)).toBe('1.23');
        expect(roundSize(1.999, 2)).toBe('1.99');
        expect(roundSize(0.001, 3)).toBe('0.001');
    });

    it('handles zero decimals', () => {
        expect(roundSize(5.7, 0)).toBe('5');
    });

    it('handles large numbers', () => {
        expect(roundSize(12345.6789, 4)).toBe('12345.6789');
    });
});

describe('roundPrice', () => {
    it('rounds to 6 significant figures', () => {
        expect(roundPrice(2000.123456)).toBe('2000.12');
        expect(roundPrice(25.3456789)).toBe('25.3457');
    });

    it('handles small prices', () => {
        expect(roundPrice(0.00123456)).toBe('0.00123456');
    });

    it('handles large prices', () => {
        expect(roundPrice(123456.789)).toBe('123457');
    });
});

describe('HYPERLIQUID_EIP712_DOMAIN', () => {
    it('has correct domain values', () => {
        expect(HYPERLIQUID_EIP712_DOMAIN.name).toBe('HyperliquidSignTransaction');
        expect(HYPERLIQUID_EIP712_DOMAIN.version).toBe('1');
        expect(HYPERLIQUID_EIP712_DOMAIN.chainId).toBe(0x66eee);
        expect(HYPERLIQUID_EIP712_DOMAIN.verifyingContract).toBe('0x0000000000000000000000000000000000000000');
    });
});

describe('HYPERLIQUID_MARKET_TICKERS', () => {
    it('maps all supported commodities', () => {
        expect(HYPERLIQUID_MARKET_TICKERS).toEqual({
            GOLD: 'GOLD',
            SILVER: 'SILVER',
            OIL: 'OIL',
            COPPER: 'COPPER',
        });
    });
});
