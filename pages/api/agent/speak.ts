/**
 * POST /api/agent/speak — text-to-speech for the Advisor's voice responses.
 *
 * Bridges the client `useAgentVoice().generateSpeech()` to the server-side
 * AI speech orchestrator (Venice → ElevenLabs fallback). Returns raw audio
 * bytes (audio/mpeg) so the client can play the Blob directly.
 *
 * Requires VENICE_API_KEY or (ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID).
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { generateSpeech } from '@diversifi/shared/src/services/ai/ai-service';

const MAX_TEXT_LENGTH = 1200;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const hasVenice = !!process.env.VENICE_API_KEY;
  const hasElevenLabs = !!process.env.ELEVENLABS_API_KEY && !!process.env.ELEVENLABS_VOICE_ID;
  if (!hasVenice && !hasElevenLabs) {
    return res.status(503).json({ error: 'Voice output not configured (VENICE_API_KEY or ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID)' });
  }

  const { text, voice } = req.body ?? {};
  if (typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'text is required' });
  }

  try {
    const result = await generateSpeech({
      text: text.slice(0, MAX_TEXT_LENGTH),
      voice: typeof voice === 'string' ? voice : undefined,
    });

    // Providers return base64 audio (JSON-serializable through the cache layer).
    const payload = result.audio ?? result.data;
    const audio = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload), 'base64');

    res.setHeader('Content-Type', result.audioFormat === 'mp3' ? 'audio/mpeg' : 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(audio);
  } catch (err) {
    console.error('[api/agent/speak] TTS failed:', err instanceof Error ? err.message : err);
    return res.status(502).json({ error: 'Speech generation failed' });
  }
}
