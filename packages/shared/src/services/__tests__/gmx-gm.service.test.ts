import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getGmMarkets, getStableGmMarkets } from '../gmx-gm.service';
import { unifiedCache } from '../../utils/unified-cache-service';

const USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
const WBTC = '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f';

function mockGmx() {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes('/markets/info')) {
      return new Response(
        JSON.stringify({
          markets: [
            { marketToken: '0xMKT1', name: 'BTC/USD [WBTC-USDC]', longToken: WBTC, shortToken: USDC, isListed: true },
            { marketToken: '0xMKT2', name: 'ETH/USD [WETH-USDC]', longToken: '0xweth', shortToken: USDC, isListed: true },
          ],
        }),
        { status: 200 },
      );
    }
    if (url.includes('/apy')) {
      return new Response(
        JSON.stringify({
          markets: {
            '0xMKT1': { apy: 0.107, baseApy: 0.10, bonusApr: 0.007 },
            '0xMKT2': { apy: 0.05, baseApy: 0.05, bonusApr: 0 },
          },
        }),
        { status: 200 },
      );
    }
    return new Response('not found', { status: 404 });
  });
}

describe('getGmMarkets', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    unifiedCache.clear('gmx:'); // GM markets are cached by a fixed key
  });

  it('joins markets + apy, converts to %, ranks best-first', async () => {
    mockGmx();
    const markets = await getGmMarkets();
    expect(markets).toHaveLength(2);
    expect(markets[0]).toMatchObject({ marketToken: '0xMKT1', apyPct: 10.7, baseApyPct: 10, bonusAprPct: 0.7 });
    expect(markets[0].apyPct).toBeGreaterThan(markets[1].apyPct); // ranked
  });

  it('degrades to [] on failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('err', { status: 500 }));
    expect(await getGmMarkets()).toEqual([]);
  });

  it('getStableGmMarkets keeps only USDC-short, positive-APY, listed markets', async () => {
    mockGmx();
    const stable = await getStableGmMarkets();
    expect(stable.every((m) => m.shortToken.toLowerCase() === USDC.toLowerCase())).toBe(true);
    expect(stable.every((m) => m.apyPct > 0)).toBe(true);
  });
});
