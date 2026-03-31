import type { NextApiRequest, NextApiResponse } from 'next';
import { getGuardianState, updateGuardianState } from './_guardian-state';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { userAddress } = req.method === 'GET' ? req.query : req.body || {};

  if (!userAddress || typeof userAddress !== 'string') {
    return res.status(400).json({ error: 'Missing userAddress' });
  }

  if (req.method === 'GET') {
    const state = await getGuardianState(userAddress);
    return res.status(200).json({ success: true, state });
  }

  if (req.method === 'POST') {
    const { latestRecommendation, latestLoop } = req.body || {};
    const state = await updateGuardianState(userAddress, { latestRecommendation, latestLoop });
    return res.status(200).json({ success: true, state });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
