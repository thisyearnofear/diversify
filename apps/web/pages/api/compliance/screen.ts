/**
 * GET /api/compliance/screen?address=0x… — wallet sanctions screening.
 *
 * Thin pass-through to the shared screening service (Chainalysis). The API
 * key lives server-side and is never echoed. Blocks are logged — declines
 * are recorded, not hidden.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { screenAddress } from '@diversifi/shared/src/services/compliance/sanctions-screening.service';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end();
  }

  const address = typeof req.query.address === 'string' ? req.query.address : '';
  const result = await screenAddress(address);

  if (result.status === 'blocked') {
    console.warn('[compliance] sanctions_block', { address: address.toLowerCase() });
  }

  return res.status(200).json(result);
}
