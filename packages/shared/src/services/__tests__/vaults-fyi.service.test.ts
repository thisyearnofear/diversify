import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { getBestDepositOptions, vaultsFyiService } from '../vaults-fyi.service';

const WALLET = '0xdd6204dd1b7e0311e184dbe458dcc268715ea061';

describe('getBestDepositOptions', () => {
  const orig = process.env.VAULTS_FYI_API_KEY;
  beforeEach(() => {
    process.env.VAULTS_FYI_API_KEY = 'test-key';
    vi.restoreAllMocks();
  });
  afterEach(() => {
    process.env.VAULTS_FYI_API_KEY = orig;
  });

  it('returns null (no throw) when unconfigured', async () => {
    delete process.env.VAULTS_FYI_API_KEY;
    expect(await getBestDepositOptions(WALLET)).toBeNull();
    expect(vaultsFyiService.isConfigured()).toBe(false);
  });

  it('returns null for an invalid wallet address without calling fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    expect(await getBestDepositOptions('not-an-address')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('maps rows and converts raw-decimal APY to a percentage', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { name: 'Aave USDC', protocol: 'Aave', network: 'arbitrum', asset: { symbol: 'USDC' }, apy: { total: 0.054 }, tvl: { usd: 1000000 }, riskRating: 'low', vaultAddress: '0xabc' },
          ],
        }),
        { status: 200 },
      ),
    );
    const r = await getBestDepositOptions(WALLET, { onlyTransactional: true });
    expect(r).not.toBeNull();
    expect(r!.options[0]).toMatchObject({
      vaultName: 'Aave USDC',
      protocol: 'Aave',
      assetSymbol: 'USDC',
      apyPct: 5.4, // 0.054 × 100
      tvlUsd: 1000000,
      risk: 'low',
    });
  });

  it('sends x-api-key and the wallet address in the path', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), { status: 200 }),
    );
    await getBestDepositOptions(WALLET, { maxVaultsPerAsset: 3 });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain(`/best-deposit-options/${WALLET}`);
    expect(String(url)).toContain('maxVaultsPerAsset=3');
    expect((init?.headers as Record<string, string>)['x-api-key']).toBe('test-key');
  });

  it('degrades to null on a non-OK response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('err', { status: 402 }));
    expect(await getBestDepositOptions('0x' + '1'.repeat(40))).toBeNull();
  });
});
