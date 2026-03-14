import { describe, expect, it, vi, beforeEach } from 'vitest';
import { HyperliquidPositionService } from '../hyperliquid-position.service';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockFetchResponse(data: any, ok = true) {
    mockFetch.mockResolvedValueOnce({
        ok,
        status: ok ? 200 : 500,
        json: () => Promise.resolve(data),
        text: () => Promise.resolve(JSON.stringify(data)),
    });
}

const mockUserState = {
    assetPositions: [
        {
            position: {
                coin: 'GOLD',
                szi: '0.5',
                entryPx: '2000',
                positionValue: '1050',
                unrealizedPnl: '50',
                returnOnEquity: '0.05',
                liquidationPx: '1500',
                leverage: { type: 'cross', value: 1 },
                marginUsed: '1000',
                maxLeverage: 50,
            },
            type: 'oneWay',
        },
        {
            position: {
                coin: 'SILVER',
                szi: '-10',
                entryPx: '25',
                positionValue: '240',
                unrealizedPnl: '-10',
                returnOnEquity: '-0.04',
                liquidationPx: '30',
                leverage: { type: 'cross', value: 1 },
                marginUsed: '250',
                maxLeverage: 50,
            },
            type: 'oneWay',
        },
        {
            position: {
                coin: 'BTC',
                szi: '0.01',
                entryPx: '50000',
                positionValue: '510',
                unrealizedPnl: '10',
                returnOnEquity: '0.02',
                liquidationPx: null,
                leverage: { type: 'cross', value: 5 },
                marginUsed: '100',
                maxLeverage: 100,
            },
            type: 'oneWay',
        },
    ],
    crossMarginSummary: {
        accountValue: '5000',
        totalMarginUsed: '1350',
        totalNtlPos: '1800',
        totalRawUsd: '3650',
    },
    marginSummary: {
        accountValue: '5000',
        totalMarginUsed: '1350',
        totalNtlPos: '1800',
        totalRawUsd: '3650',
    },
    withdrawable: '2500',
};

const mockPrices = {
    GOLD: '2100',
    SILVER: '24',
    BTC: '51000',
    OIL: '75',
    COPPER: '4.5',
};

describe('HyperliquidPositionService', () => {
    let service: HyperliquidPositionService;

    beforeEach(() => {
        service = new HyperliquidPositionService();
        service.clearCache();
        vi.clearAllMocks();
    });

    describe('getPositions', () => {
        it('returns only commodity positions', async () => {
            mockFetchResponse(mockUserState); // clearinghouseState
            mockFetchResponse(mockPrices);     // allMids

            const positions = await service.getPositions('0xuser');
            expect(positions).toHaveLength(2);
            expect(positions.map(p => p.coin)).toEqual(['GOLD', 'SILVER']);
        });

        it('correctly maps long position', async () => {
            mockFetchResponse(mockUserState);
            mockFetchResponse(mockPrices);

            const positions = await service.getPositions('0xuser');
            const gold = positions.find(p => p.coin === 'GOLD')!;

            expect(gold.side).toBe('long');
            expect(gold.size).toBe(0.5);
            expect(gold.entryPrice).toBe(2000);
            expect(gold.currentPrice).toBe(2100);
            expect(gold.unrealizedPnl).toBe(50);
            expect(gold.liquidationPrice).toBe(1500);
            expect(gold.leverage).toBe(1);
        });

        it('correctly maps short position', async () => {
            mockFetchResponse(mockUserState);
            mockFetchResponse(mockPrices);

            const positions = await service.getPositions('0xuser');
            const silver = positions.find(p => p.coin === 'SILVER')!;

            expect(silver.side).toBe('short');
            expect(silver.size).toBe(10);
        });

        it('filters out zero-size positions', async () => {
            const stateWithZero = {
                ...mockUserState,
                assetPositions: [
                    ...mockUserState.assetPositions,
                    {
                        position: {
                            coin: 'OIL',
                            szi: '0',
                            entryPx: '75',
                            positionValue: '0',
                            unrealizedPnl: '0',
                            returnOnEquity: '0',
                            liquidationPx: null,
                            leverage: { type: 'cross', value: 1 },
                            marginUsed: '0',
                            maxLeverage: 50,
                        },
                        type: 'oneWay',
                    },
                ],
            };
            mockFetchResponse(stateWithZero);
            mockFetchResponse(mockPrices);

            const positions = await service.getPositions('0xuser');
            expect(positions.find(p => p.coin === 'OIL')).toBeUndefined();
        });
    });

    describe('getPortfolioSummary', () => {
        it('returns correct summary', async () => {
            mockFetchResponse(mockUserState);
            mockFetchResponse(mockPrices);

            const summary = await service.getPortfolioSummary('0xuser');
            expect(summary.positions).toHaveLength(2);
            expect(summary.totalValue).toBe(1050 + 240);
            expect(summary.totalMarginUsed).toBe(1000 + 250);
            expect(summary.totalUnrealizedPnl).toBe(50 + (-10));
            expect(summary.availableBalance).toBe(2500);
            expect(summary.lastUpdated).toBeGreaterThan(0);
        });
    });

    describe('getPosition', () => {
        it('returns specific position', async () => {
            mockFetchResponse(mockUserState);
            mockFetchResponse(mockPrices);

            const pos = await service.getPosition('0xuser', 'GOLD');
            expect(pos).not.toBeNull();
            expect(pos!.coin).toBe('GOLD');
        });

        it('returns null for non-existent position', async () => {
            mockFetchResponse(mockUserState);
            mockFetchResponse(mockPrices);

            const pos = await service.getPosition('0xuser', 'COPPER');
            expect(pos).toBeNull();
        });
    });

    describe('hasOpenPositions', () => {
        it('returns true when positions exist', async () => {
            mockFetchResponse(mockUserState);
            mockFetchResponse(mockPrices);

            expect(await service.hasOpenPositions('0xuser')).toBe(true);
        });

        it('returns false when no commodity positions', async () => {
            const emptyState = {
                ...mockUserState,
                assetPositions: [mockUserState.assetPositions[2]], // Only BTC
            };
            mockFetchResponse(emptyState);
            mockFetchResponse(mockPrices);

            expect(await service.hasOpenPositions('0xuser')).toBe(false);
        });
    });

    describe('getAtRiskPositions', () => {
        it('returns positions near liquidation', async () => {
            // SILVER has liq at 30, current at 24 -> distance = 25% -> not at risk
            // Make a position close to liquidation
            const riskyState = {
                ...mockUserState,
                assetPositions: [
                    {
                        position: {
                            coin: 'COPPER',
                            szi: '100',
                            entryPx: '4.5',
                            positionValue: '430',
                            unrealizedPnl: '-20',
                            returnOnEquity: '-0.04',
                            liquidationPx: '4.2', // 4.5 current, 4.2 liq = 6.7% distance
                            leverage: { type: 'cross', value: 1 },
                            marginUsed: '450',
                            maxLeverage: 50,
                        },
                        type: 'oneWay',
                    },
                ],
            };
            mockFetchResponse(riskyState);
            mockFetchResponse(mockPrices);

            const atRisk = await service.getAtRiskPositions('0xuser');
            expect(atRisk).toHaveLength(1);
            expect(atRisk[0].coin).toBe('COPPER');
        });
    });

    describe('caching', () => {
        it('uses cache for rapid successive calls', async () => {
            mockFetchResponse(mockUserState);
            mockFetchResponse(mockPrices);

            await service.getPositions('0xuser');
            await service.getPositions('0xuser');

            // Only 2 fetch calls (state + prices), not 4
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        it('clearCache forces refetch', async () => {
            mockFetchResponse(mockUserState);
            mockFetchResponse(mockPrices);
            await service.getPositions('0xuser');

            service.clearCache();

            mockFetchResponse(mockUserState);
            mockFetchResponse(mockPrices);
            await service.getPositions('0xuser');

            expect(mockFetch).toHaveBeenCalledTimes(4);
        });
    });
});
