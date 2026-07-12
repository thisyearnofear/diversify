/**
 * POST /api/waitlist/join — early-access interest capture.
 *
 * Unlike /api/analytics/event (fire-and-forget, always 204), this endpoint's
 * entire purpose is the write succeeding or the user being told it didn't —
 * so it reports real errors, closer to /api/agent/credits than the
 * analytics sink.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import connectDB from '../../../lib/mongodb';
import { WaitlistLead, WAITLIST_FEATURES, type WaitlistFeature } from '../../../models/WaitlistLead';
import { rateLimit, getClientIp } from '../../../lib/rate-limit';
import { GEOGRAPHIC_REGION_LIST } from '../../../config';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SOURCE_RE = /^[a-z0-9_]+$/i;

// A form submission is a rare, deliberate action, not an event stream —
// tighter than analytics' 60/min since this write carries PII.
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const { allowed, retryAfterSec } = rateLimit(`waitlist:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!allowed) {
    res.setHeader('Retry-After', String(retryAfterSec));
    return res.status(429).json({ error: 'Too many attempts — try again shortly.' });
  }

  const { email, feature, source, userRegion, consentAcknowledged } = req.body ?? {};

  if (typeof email !== 'string' || email.length > 254 || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (typeof feature !== 'string' || !WAITLIST_FEATURES.includes(feature as WaitlistFeature)) {
    return res.status(400).json({ error: 'Unknown waitlist.' });
  }
  if (typeof source !== 'string' || source.length === 0 || source.length > 64 || !SOURCE_RE.test(source)) {
    return res.status(400).json({ error: 'Invalid request.' });
  }
  if (consentAcknowledged !== true) {
    return res.status(400).json({ error: 'Please acknowledge how your email will be used.' });
  }

  // Best-effort context, not user-facing input — drop rather than reject.
  const cleanRegion =
    typeof userRegion === 'string' && GEOGRAPHIC_REGION_LIST.includes(userRegion as (typeof GEOGRAPHIC_REGION_LIST)[number])
      ? userRegion
      : undefined;

  try {
    await connectDB();
    // Atomic upsert, not create()+catch(11000): on a freshly-created
    // collection the unique index builds asynchronously in the background,
    // so two near-simultaneous creates can both slip past it before it's
    // ready. findOneAndUpdate's upsert is atomic per document regardless of
    // index-build timing, so (email, feature) can never end up duplicated.
    await WaitlistLead.findOneAndUpdate(
      { email: email.trim().toLowerCase(), feature },
      { $setOnInsert: { source, userRegion: cleanRegion, consentAcknowledged: true } },
      { upsert: true, setDefaultsOnInsert: true },
    );
  } catch {
    return res.status(503).json({ error: "Couldn't save your spot right now — please try again in a moment." });
  }

  return res.status(200).json({ success: true });
}
