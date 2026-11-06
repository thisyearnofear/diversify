/**
 * /api/sentiment — the nation confidence poll.
 *
 * GET  /api/sentiment?code=NGN[&session=<id>]
 *   → { code, tally: {confident, neutral, worried}, total, yourVote }
 * GET  /api/sentiment
 *   → { asOf, rows: [{ code, tally, total }] } — the public readout:
 *     every currency with votes, totals disclosed, no session id.
 * POST /api/sentiment  { sessionId, code, sentiment }
 *   → upserts the session's vote for that currency, returns the same
 *     shape with yourVote set.
 *
 * Validation is dataset-allowlisted: a vote for a currency the scorecard
 * can't cover is rejected, not counted (a tally we can't contextualise
 * is a number we shouldn't show). Everything is anonymous — the session
 * id is a random UUID the browser mints; no wallet, no identity, votes
 * TTL after 180 days.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import connectDB from '../../lib/mongodb';
import { SentimentVote } from '../../models/SentimentVote';
import { rateLimit, getClientIp } from '../../lib/rate-limit';
import {
  validVoteCode,
  validSentiment,
  validSessionId,
  tallyFromRows,
  type SentimentResult,
} from '../../lib/sentiment';

const GET_LIMIT = 60;
const POST_LIMIT = 20;
const WINDOW_MS = 60_000;

async function resultFor(
  code: string,
  sessionId: string | null,
): Promise<SentimentResult> {
  const rows = await SentimentVote.aggregate<{ _id: string; count: number }>([
    { $match: { code } },
    { $group: { _id: '$sentiment', count: { $sum: 1 } } },
  ]);
  const tally = tallyFromRows(rows);
  const yourVote = sessionId
    ? ((await SentimentVote.findOne({ sessionId, code })
        .select('sentiment')
        .lean())?.sentiment ?? null)
    : null;
  return {
    code,
    tally,
    total: tally.confident + tally.neutral + tally.worried,
    yourVote,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    if (!rateLimit(`sentiment:get:${getClientIp(req)}`, GET_LIMIT, WINDOW_MS).allowed) {
      return res.status(429).json({ error: 'Too many requests.' });
    }
    // Aggregate read — the public confidence board. No session id, no
    // per-vote detail: tallies and totals only, dated.
    if (req.query.code === undefined) {
      try {
        await connectDB();
        const rows = await SentimentVote.aggregate<{
          _id: string;
          sentiments: string[];
        }>([
          { $group: { _id: '$code', sentiments: { $push: '$sentiment' } } },
        ]);
        const board = rows
          .map((r) => {
            const tally = { confident: 0, neutral: 0, worried: 0 };
            for (const s of r.sentiments ?? []) {
              if (s in tally) tally[s as keyof typeof tally] += 1;
            }
            const total = tally.confident + tally.neutral + tally.worried;
            return { code: r._id, tally, total };
          })
          .filter((r) => r.total > 0)
          .sort((a, b) => b.total - a.total || a.code.localeCompare(b.code));
        return res.status(200).json({ asOf: new Date().toISOString(), rows: board });
      } catch {
        return res.status(503).json({ error: 'Unavailable right now.' });
      }
    }
    const code = validVoteCode(req.query.code);
    if (!code) return res.status(400).json({ error: 'Unknown currency.' });
    try {
      await connectDB();
      return res.status(200).json(await resultFor(code, validSessionId(req.query.session)));
    } catch {
      return res.status(503).json({ error: 'Unavailable right now.' });
    }
  }

  if (req.method === 'POST') {
    if (!rateLimit(`sentiment:post:${getClientIp(req)}`, POST_LIMIT, WINDOW_MS).allowed) {
      res.setHeader('Retry-After', '60');
      return res.status(429).json({ error: 'Too many attempts — try again shortly.' });
    }
    const code = validVoteCode(req.body?.code);
    const sentiment = validSentiment(req.body?.sentiment);
    const sessionId = validSessionId(req.body?.sessionId);
    if (!code || !sentiment || !sessionId) {
      return res.status(400).json({ error: 'Invalid vote.' });
    }
    try {
      await connectDB();
      // Atomic upsert: re-voting changes the pick, never stacks. Same
      // reasoning as WaitlistLead — findOneAndUpdate upsert is atomic
      // regardless of index-build timing.
      await SentimentVote.findOneAndUpdate(
        { sessionId, code },
        { $set: { sentiment } },
        { upsert: true, setDefaultsOnInsert: true },
      );
      return res.status(200).json(await resultFor(code, sessionId));
    } catch {
      return res.status(503).json({ error: "Couldn't record your vote — try again." });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).end();
}
