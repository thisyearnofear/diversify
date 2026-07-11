import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getGmMarkets, getStableGmMarkets, getBlueChipStableGmMarkets } from '../gmx-gm.service';
import { unifiedCache } from '../../utils/unified-cache-service';

const USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
const WBTC = '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f';
const WETH = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1';
const MEME = '0x1111111111111111111111111111111111111111';

function mockGmx() {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes('/markets/info')) {
      return new Response(
        JSON.stringify({
          markets: [
            // Exotic memecoin pool with the HIGHEST apy — must be excluded from blue-chip.
            { marketToken: '0xMEME', name: 'MEME/USD [MEME-USDC]', indexToken: MEME, longToken: MEME, shortToken: USDC, isListed: true },
            { marketToken: '0xMKT1', name: 'BTC/USD [WBTC-USDC]', indexToken: WBTC, longToken: WBTC, shortToken: USDC, isListed: true },
            { marketToken: '0xMKT2', name: 'ETH/USD [WETH-USDC]', indexToken: WETH, longToken: WETH, shortToken: USDC, isListed: true },
          ],
        }),
        { status: 200 },
      );
    }
    if (url.includes('/apy')) {
      return new Response(
        JSON.stringify({
          markets: {
            '0xMEME': { apy: 0.95, baseApy: 0.95, bonusApr: 0 }, // 95% — the trap
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
    expect(markets).toHaveLength(3);
    // unfiltered getGmMarkets ranks the 95% MEME pool first (blue-chip filter is separate)
    expect(markets[0]).toMatchObject({ marketToken: '0xMEME', apyPct: 95 });
    expect(markets[1]).toMatchObject({ marketToken: '0xMKT1', apyPct: 10.7, baseApyPct: 10, bonusAprPct: 0.7 });
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

  it('getBlueChipStableGmMarkets EXCLUDES the exotic pool even at higher APY', async () => {
    mockGmx();
    const blue = await getBlueChipStableGmMarkets();
    const names = blue.map((m) => m.name).sort();
    expect(names).toEqual(['BTC/USD [WBTC-USDC]', 'ETH/USD [WETH-USDC]']);
    // the 95%-APY MEME pool must NOT be the top pick a saver gets
    expect(blue.some((m) => m.name.includes('MEME'))).toBe(false);
    expect(blue[0].name).toBe('BTC/USD [WBTC-USDC]'); // best blue-chip APY first
  });
});
