/**
 * POST /api/country-request — user reports a missing country.
 *
 * Stores one record per requested country so the product team can
 * prioritise data onboarding. Coarse context (region from the detected
 * country code) is appended automatically. Fire-and-forget friendly
 * from the client side — the endpoint always returns 200 even on
 * write errors so the UX never breaks.
 *
 * Body: { country: 'UA', email?: string, source: string }
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import connectDB from '../../../lib/mongodb';

interface CountryRequestDoc {
  country: string;
  email?: string;
  source: string;
  requestedRegion?: string;
  createdAt: Date;
}

// Reuse the same 5/min IP rate limit as the waitlist endpoint.
function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  // In-memory store — fine for a single instance. On multiple instances
  // a Redis-backed store would be needed.
  const store = (global as unknown as Record<string, unknown>).countryRequestRateLimit
    ?? Object.assign(global, { countryRequestRateLimit: {} });

  const bucket = (store as Record<string, unknown>)[key] as
    | { hits: number; reset: number }
    | undefined;

  if (!bucket || now > bucket.reset) {
    Object.assign(store, { [key]: { hits: 1, reset: now + windowMs } });
    return { allowed: true, retryAfterSec: 0 };
  }

  bucket.hits += 1;
  if (bucket.hits > limit) {
    return { allowed: false, retryAfterSec: Math.ceil((bucket.reset - now) / 1000) };
  }
  return { allowed: true, retryAfterSec: 0 };
}

function getClientIp(req: NextApiRequest): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0] ??
    req.socket.remoteAddress ??
    'unknown'
  );
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const ip = getClientIp(req);
  const { allowed, retryAfterSec } = rateLimit(
    `country-request:${ip}`,
    3,
    60_000,
  );
  if (!allowed) {
    res.setHeader('Retry-After', String(retryAfterSec));
    return res.status(429).json({
      error: 'Too many requests — try again shortly.',
    });
  }

  const { country, email, source } = (req.body ?? {}) as {
    country?: string;
    email?: string;
    source?: string;
  };

  const cleanCountry = (country ?? '').toUpperCase().trim();
  if (!cleanCountry || cleanCountry.length > 2) {
    // Always return 200 even on validation so the client never breaks.
    return res.status(200).json({ success: false, error: 'Country code required.' });
  }

  if (
    email !== undefined &&
    (typeof email !== 'string' ||
      email.length > 254 ||
      (email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))
  ) {
    return res.status(200).json({ success: false, error: 'Invalid email.' });
  }

  const cleanSource = (source ?? 'unknown').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);

  try {
    // Establish the shared connection before writing — sibling write
    // endpoints (waitlist, analytics) all do this. Without it, a cold
    // process buffers Model.create for ~10s, throws, and the catch below
    // would silently report success while dropping the record.
    await connectDB();
    const mongoose = (await import('mongoose')).default;
    const Model =
      mongoose.models.CountryRequest ??
      mongoose.model(
        'CountryRequest',
        new mongoose.Schema<CountryRequestDoc>(
          {
            country: { type: String, required: true, uppercase: true, index: true },
            email: { type: String, default: undefined },
            source: { type: String, required: true },
            requestedRegion: { type: String },
          },
          { timestamps: true },
        ),
      );

    await Model.create({
      country: cleanCountry,
      email: email || undefined,
      source: cleanSource,
      requestedRegion: undefined, // TODO: resolve via regionForCountry() if needed
    });
  } catch {
    // Fail open — always 200 so the UX doesn't break.
  }

  return res.status(200).json({ success: true });
}
