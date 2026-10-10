import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { utils as ethersUtils } from 'ethers';
import {
  GUARD_CALC_V2,
  GUARD_CHECKOUT,
  buildCheckoutParams,
  buildWidgetParams,
  guardarianConfigured,
  type GuardIntent,
} from '@/lib/guardarian';

/**
 * GET /api/onramp/guardarian-url
 *
 * Mints the Guardarian entry URL for the connected wallet. Credentials
 * never ship to the client: the RSA key signs here, the API token is
 * only interpolated into the returned URL (as Guardarian's own design
 * expects — partner tokens appear in client-facing widget URLs).
 *
 *   200 { url, embed }   embed=true → Calculator v2 (iframe in our modal)
 *                        embed=false → checkout transaction link (new tab)
 *   501                  no partner credentials configured
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!guardarianConfigured()) {
    return res.status(501).json({ configured: false, error: 'Guardarian not configured' });
  }

  const address = String(req.query.address ?? '');
  if (!ethersUtils.isAddress(address)) {
    return res.status(400).json({ error: 'valid wallet address required' });
  }

  const mode = req.query.mode === 'sell' ? 'sell' : 'buy';
  const amountUsd = Number(req.query.amountUsd);
  const chainId = Number(req.query.chainId);

  const intent: GuardIntent = {
    mode,
    address,
    symbol: typeof req.query.symbol === 'string' ? req.query.symbol : undefined,
    amountUsd: Number.isFinite(amountUsd) && amountUsd > 0 ? amountUsd : undefined,
    chainId: Number.isInteger(chainId) && chainId > 0 ? chainId : undefined,
    origin: `${req.headers['x-forwarded-proto'] ?? 'https'}://${req.headers.host}`,
  };

  const privateKey = process.env.GUARDARIAN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (privateKey && process.env.NEXT_PUBLIC_GUARDARIAN_PARTNER_ID) {
    const query = buildWidgetParams(intent).toString();
    // Docs define the widget URL as requiring `signature` but don't pin
    // the signed payload — same RSA-SHA256 scheme as API requests,
    // applied to the exact final query string. If their checker expects
    // the full URL or a canonical form, this is the single seam to adjust.
    const signature = crypto
      .createSign('RSA-SHA256')
      .update(query)
      .end()
      .sign(privateKey)
      .toString('base64');
    const url = `${GUARD_CALC_V2}?${query}&signature=${encodeURIComponent(signature)}`;
    return res.status(200).json({ url, embed: true });
  }

  const token = process.env.GUARDARIAN_PARTNER_API_TOKEN;
  if (token) {
    const url = `${GUARD_CHECKOUT}?${buildCheckoutParams(intent, token).toString()}`;
    return res.status(200).json({ url, embed: false });
  }

  return res.status(501).json({ configured: false, error: 'Guardarian not configured' });
}
