import type { NextApiRequest, NextApiResponse } from 'next';
import { openClawService } from '@diversifi/shared';

/**
 * OpenClaw Execute API Endpoint
 * 
 * Proxies on-chain execution requests to the external OpenClaw instance.
 * Executes transactions via the synthesis API.
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
      error: 'OpenClaw integration is not enabled',
      fallback: 'arc-agent'
    });
  }

  // Check circuit breaker
  if (openClawService.isUnavailable()) {
    return res.status(503).json({ 
      error: 'OpenClaw service is temporarily unavailable',
      fallback: 'arc-agent'
    });
  }

  try {
    const { runId, track, rpcUrl, rawTx, explorerBase } = req.body;

    // Validate required fields
    if (!runId || !track || !rpcUrl || !rawTx || !explorerBase) {
      return res.status(400).json({ 
        error: 'Missing required fields: runId, track, rpcUrl, rawTx, explorerBase' 
      });
    }

    // Validate track
    const validTracks = ['base-autonomous-trading', 'status-l2-gasless', 'open-track', 'tether-galactica-wdk', 'celo-mento', 'uniswap-agentic-finance'];
    if (!validTracks.includes(track)) {
      return res.status(400).json({ 
        error: `Invalid track. Must be one of: ${validTracks.join(', ')}` 
      });
    }

    // Validate rawTx format (should be hex)
    if (!rawTx.startsWith('0x')) {
      return res.status(400).json({ error: 'rawTx must be a hex string starting with 0x' });
    }

    const result = await openClawService.executeOnchain({
      run_id: runId,
      track,
      rpc_url: rpcUrl,
      raw_tx: rawTx,
      explorer_base: explorerBase,
      metadata: req.body.metadata, // Pass through metadata (augmentation, hackathon, etc.)
    });

    return res.status(200).json({
      success: result.success,
      runId: result.run_id,
      track: result.track,
      txHash: result.tx_hash,
      explorerUrl: result.explorer_url,
      status: result.status,
      error: result.error,
    });
  } catch (error: any) {
    console.error('[OpenClaw Execute] Error:', error.message);
    
    return res.status(500).json({ 
      error: 'Failed to execute via OpenClaw',
      details: error.message,
      fallback: 'arc-agent'
    });
  }
}
