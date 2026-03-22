import type { NextApiRequest, NextApiResponse } from 'next';
import { openClawService } from '@diversifi/shared';

/**
 * OpenClaw Receipts API Endpoint
 * 
 * Fetches execution receipts and run summaries from the external OpenClaw instance.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check if OpenClaw is enabled
  if (!openClawService.isEnabled()) {
    return res.status(503).json({ 
      error: 'OpenClaw integration is not enabled'
    });
  }

  // Check circuit breaker
  if (openClawService.isUnavailable()) {
    return res.status(503).json({ 
      error: 'OpenClaw service is temporarily unavailable'
    });
  }

  try {
    const { runId, type } = req.query;

    if (type === 'identity') {
      // Get agent identity
      const identity = await openClawService.getIdentity();
      return res.status(200).json({
        success: true,
        identity,
      });
    }

    if (type === 'summary' && runId) {
      // Get run summary
      const summary = await openClawService.getRunSummary(runId as string);
      return res.status(200).json({
        success: true,
        summary,
      });
    }

    if (runId) {
      // Get receipts for specific run
      const receipts = await openClawService.getReceipts(runId as string);
      return res.status(200).json({
        success: true,
        runId,
        receipts,
        count: receipts.length,
      });
    }

    // Default: return available endpoints
    return res.status(200).json({
      success: true,
      endpoints: {
        identity: '/api/agent/openclaw/receipts?type=identity',
        summary: '/api/agent/openclaw/receipts?runId=xxx&type=summary',
        receipts: '/api/agent/openclaw/receipts?runId=xxx',
      },
    });
  } catch (error: any) {
    console.error('[OpenClaw Receipts] Error:', error.message);
    
    return res.status(500).json({ 
      error: 'Failed to fetch receipts from OpenClaw',
      details: error.message
    });
  }
}
