import type { NextApiRequest, NextApiResponse } from 'next';
import { getSoSoValueIntelligence, toCardData } from '../../../lib/sosovalue';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const premium = req.query.tier === 'premium';

  try {
    const result = await getSoSoValueIntelligence(premium);
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({ ...toCardData(result), fallback: result.fallback ?? false });
  } catch (error) {
    console.error('[SoSoValue API]', error);
    return res.status(500).json({ error: 'SoSoValue service unavailable' });
  }
}
