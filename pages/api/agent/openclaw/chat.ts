import type { NextApiRequest, NextApiResponse } from 'next';
import { openClawService } from '@diversifi/shared';

/**
 * OpenClaw Chat API Endpoint
 * 
 * Proxies chat requests to the external OpenClaw instance.
 * Provides conversational AI interface for wealth diversification.
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
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    // Validate message format
    for (const msg of messages) {
      if (!msg.role || !msg.content) {
        return res.status(400).json({ error: 'Each message must have role and content' });
      }
      if (!['system', 'user', 'assistant'].includes(msg.role)) {
        return res.status(400).json({ error: 'Invalid message role' });
      }
    }

    // Rate limiting (simple in-memory, per-IP)
    // TODO: Replace with Redis-based rate limiting in production
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    
    const response = await openClawService.chat(messages);
    
    return res.status(200).json({
      success: true,
      response: response.choices[0]?.message?.content || '',
      model: response.model,
    });
  } catch (error: any) {
    console.error('[OpenClaw Chat] Error:', error.message);
    
    return res.status(500).json({ 
      error: 'Failed to communicate with OpenClaw',
      details: error.message,
      fallback: 'arc-agent'
    });
  }
}
