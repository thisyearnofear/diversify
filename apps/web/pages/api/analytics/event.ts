/**
 * POST /api/analytics/event — first-party funnel event sink.
 *
 * Accepts { sessionId, event, props? } from lib/analytics.ts. Event names
 * are allowlisted (FUNNEL_EVENTS), props are string-only and capped, and
 * nothing identifying is stored (see models/FunnelEvent.ts). Fire-and-forget
 * on the client: this endpoint must never block or break the app, so any
 * failure (including no MONGODB_URI) returns 204 and stays silent.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import connectDB from '../../../lib/mongodb';
import { FunnelEvent, FUNNEL_EVENTS, type FunnelEventName } from '../../../models/FunnelEvent';
import { rateLimit, getClientIp } from '../../../lib/rate-limit';

const MAX_PROPS = 6;
const MAX_VALUE_LENGTH = 48;
// Unauthenticated write sink → per-IP throttle so it can't be used to flood
// Mongo. Silently drop (204) over the limit — analytics never surfaces errors.
const RATE_LIMIT = 60; // events
const RATE_WINDOW_MS = 60_000; // per minute

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  if (!rateLimit(`analytics:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS).allowed) {
    return res.status(204).end();
  }

  try {
    const { sessionId, event, props } = req.body ?? {};
    if (
      typeof sessionId !== 'string' ||
      sessionId.length === 0 ||
      sessionId.length > 64 ||
      !FUNNEL_EVENTS.includes(event as FunnelEventName)
    ) {
      return res.status(204).end();
    }

    const cleanProps: Record<string, string> = {};
    if (props && typeof props === 'object') {
      for (const [key, value] of Object.entries(props).slice(0, MAX_PROPS)) {
        if (typeof value === 'string') {
          cleanProps[key.slice(0, MAX_VALUE_LENGTH)] = value.slice(0, MAX_VALUE_LENGTH);
        }
      }
    }

    await connectDB();
    await FunnelEvent.create({ sessionId, event, props: cleanProps });
  } catch {
    // Analytics must never surface errors to the client.
  }
  return res.status(204).end();
}
