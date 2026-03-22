import type { NextApiRequest, NextApiResponse } from 'next';
import { openClawService } from '@diversifi/shared';

/**
 * OpenClaw Webhook Endpoint
 * 
 * Receives execution receipts and summaries from the external OpenClaw instance.
 * Data is pushed here by OpenClaw to avoid terminal polling restrictions.
 * 
 * SECURITY: We could implement header-based shared secret validation here.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check if OpenClaw is enabled
  if (!openClawService.isEnabled()) {
    return res.status(503).json({ 
      error: 'OpenClaw integration is not enabled'
    });
  }

  try {
    const payload = req.body;

    // Basic structural validation
    if (!payload.type || !payload.payload) {
      return res.status(400).json({ error: 'Invalid webhook payload structure' });
    }

    const result = await openClawService.ingressWebhook(payload);

    if (result.success) {
      return res.status(200).json({ status: 'ok' });
    } else {
      return res.status(500).json({ error: 'Failed to ingest webhook data' });
    }
  } catch (error: any) {
    console.error('[OpenClaw Webhook] Error:', error.message);
    
    return res.status(500).json({ 
      error: 'Internal server error processing webhook',
      details: error.message
    });
  }
}
