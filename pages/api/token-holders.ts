import type { NextApiRequest, NextApiResponse } from 'next';

const BLOCKSCOUT_BASE = 'https://explorer.testnet.chain.robinhood.com/api/v2/tokens';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, limit } = req.query;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "token" query parameter' });
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(token)) {
    return res.status(400).json({ error: 'Invalid token address format' });
  }

  const holderLimit = Math.min(
    Math.max(1, parseInt(typeof limit === 'string' ? limit : '10', 10) || 10),
    50
  );

  try {
    const [tokenInfoRes, holdersRes] = await Promise.all([
      fetch(`${BLOCKSCOUT_BASE}/${token}`),
      fetch(`${BLOCKSCOUT_BASE}/${token}/holders`),
    ]);

    if (!tokenInfoRes.ok) {
      return res.status(500).json({
        error: `Failed to fetch token info: ${tokenInfoRes.status} ${tokenInfoRes.statusText}`,
      });
    }

    if (!holdersRes.ok) {
      return res.status(500).json({
        error: `Failed to fetch token holders: ${holdersRes.status} ${holdersRes.statusText}`,
      });
    }

    const tokenInfo = await tokenInfoRes.json();
    const holdersData = await holdersRes.json();

    const totalSupply: string = tokenInfo.total_supply ?? '0';
    const holdersCount: number = tokenInfo.holders_count ? Number(tokenInfo.holders_count) : 0;
    const totalSupplyNum = Number(totalSupply);

    const items: Array<{ address: { hash: string }; value: string }> =
      holdersData.items ?? [];

    const topHolders = items.slice(0, holderLimit).map((holder) => {
      const value = holder.value ?? '0';
      const percentage =
        totalSupplyNum > 0 ? (Number(value) / totalSupplyNum) * 100 : 0;

      return {
        address: holder.address.hash,
        value,
        percentage: Math.round(percentage * 100) / 100,
      };
    });

    res.setHeader(
      'Cache-Control',
      'public, max-age=60, stale-while-revalidate=120'
    );

    return res.status(200).json({
      holdersCount,
      totalSupply,
      topHolders,
    });
  } catch (error) {
    console.error('[Token Holders API] Error:', error);
    return res.status(500).json({
      error: 'Failed to fetch token holder data',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
