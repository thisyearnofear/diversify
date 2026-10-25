/**
 * POST /api/agent/speak — text-to-speech for the Advisor's voice responses.
 *
 * Bridges the client `useAgentVoice().generateSpeech()` to the server-side
 * AI speech orchestrator. Returns raw audio
 * bytes (audio/mpeg) so the client can play the Blob directly.
 *
 * Requires ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { generateSpeech } from '@diversifi/shared/src/services/ai/ai-service';
import { rateLimit, getClientIp } from '../../../lib/rate-limit';
import { elevenLabsCapabilities } from '@diversifi/shared/src/services/ai/providers/elevenlabs-provider';

const MAX_TEXT_LENGTH = 1200;
// Unauthenticated paid TTS (Venice/ElevenLabs). Per-IP throttle so one caller
// can't amplify our per-character voice spend.
const RATE_LIMIT = 20; // requests
const RATE_WINDOW_MS = 60_000; // per minute

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rl = rateLimit(`speak:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfterSec));
    return res.status(429).json({ error: 'Too many requests — slow down' });
  }

  const capabilities = elevenLabsCapabilities({
    elevenlabsApiKey: process.env.ELEVENLABS_API_KEY,
    elevenlabsVoiceId: process.env.ELEVENLABS_VOICE_ID,
    elevenlabsTtsModel: process.env.GUARDIAN_TTS_MODEL,
  });
  if (!capabilities.speech) {
    return res.status(503).json({ error: 'Voice output is not configured' });
  }

  const { text, voice } = req.body ?? {};
  if (typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'text is required' });
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return res.status(400).json({ error: 'Spoken responses must be short enough to read in full' });
  }

  try {
    const result = await generateSpeech({
      text,
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
