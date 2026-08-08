/**
 * POST /api/agent/transcribe — speech-to-text for voice input.
 *
 * Bridges the client `useAgentVoice().transcribeAudio()` (multipart audio
 * upload) to the server-side transcription orchestrator (OpenAI Whisper).
 * Returns { text }.
 *
 * Requires OPENAI_API_KEY. bodyParser is disabled so formidable can read
 * the multipart stream; the temp file is always cleaned up.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm } from 'formidable';
import * as fs from 'fs';
import { transcribe } from '@diversifi/shared/src/services/ai/ai-service';
import { rateLimit, getClientIp } from '../../../lib/rate-limit';

export const config = { api: { bodyParser: false } };

// Unauthenticated paid STT (Whisper). Per-IP throttle so one caller can't
// amplify our per-minute transcription spend.
const RATE_LIMIT = 20; // requests
const RATE_WINDOW_MS = 60_000; // per minute

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rl = rateLimit(`transcribe:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfterSec));
    return res.status(429).json({ error: 'Too many requests — slow down' });
  }

  if (!process.env.OPENAI_API_KEY && !process.env.ELEVENLABS_API_KEY) {
    return res.status(503).json({ error: 'Voice input not configured (OPENAI_API_KEY or ELEVENLABS_API_KEY)' });
  }

  let tempPath: string | null = null;
  try {
    const file = await new Promise<{ filepath: string } | null>((resolve, reject) => {
      const form = new IncomingForm({ maxFileSize: 25 * 1024 * 1024, keepExtensions: true });
      form.parse(req, (err, _fields, files) => {
        if (err) return reject(err);
        const audio = Array.isArray(files.audio) ? files.audio[0] : files.audio;
        resolve(audio ? { filepath: audio.filepath } : null);
      });
    });

    if (!file) {
      return res.status(400).json({ error: 'audio file is required' });
    }
    tempPath = file.filepath;

    const result = await transcribe(file.filepath);
    return res.status(200).json({ text: result.text ?? result.data ?? '' });
  } catch (err) {
    console.error('[api/agent/transcribe] transcription failed:', err instanceof Error ? err.message : err);
    return res.status(502).json({ error: 'Transcription failed' });
  } finally {
    if (tempPath) {
      fs.promises.unlink(tempPath).catch(() => {});
    }
  }
}
