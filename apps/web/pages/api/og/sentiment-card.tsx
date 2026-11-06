/**
 * Sentiment card — the shareable image for the public confidence readout.
 *
 * Node runtime (the only data-backed OG route): tallies come from
 * SentimentVote via the same aggregation as GET /api/sentiment. Counts are
 * always disclosed; a percentage only renders at >=10 votes per row —
 * below that the card says "too few to read" rather than inventing a share.
 * No votes at all → a quiet invite card, never an empty chart.
 */
import { ImageResponse } from '@vercel/og';
import type { NextRequest } from 'next/server';
import connectDB from '../../../lib/mongodb';
import { SentimentVote } from '../../../models/SentimentVote';
import { CURRENCY_BY_CODE } from '@/constants/currency-risk';
import { moneyNameFor } from '@/lib/corridor-context';

export const config = {
  runtime: 'nodejs',
};

const BG = '#0b0b12';
const QUIET = '#8b8b9a';
const MIN_READABLE_VOTES = 10;
const MAX_ROWS = 4;

const LEAD_LABEL: Record<string, string> = {
  confident: 'confident',
  neutral: 'neutral',
  worried: 'worried',
};

interface BoardRow {
  code: string;
  tally: { confident: number; neutral: number; worried: number };
  total: number;
}

async function boardRows(): Promise<BoardRow[]> {
  const grouped = await SentimentVote.aggregate<{ _id: string; sentiments: string[] }>([
    { $group: { _id: '$code', sentiments: { $push: '$sentiment' } } },
  ]);
  return grouped
    .map((r) => {
      const tally = { confident: 0, neutral: 0, worried: 0 };
      for (const s of r.sentiments ?? []) {
        if (s in tally) tally[s as keyof typeof tally] += 1;
      }
      const total = tally.confident + tally.neutral + tally.worried;
      return { code: r._id, tally, total };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total || a.code.localeCompare(b.code))
    .slice(0, MAX_ROWS);
}

function leadOf(row: BoardRow): [string, number] {
  return (Object.entries(row.tally) as Array<[string, number]>).reduce((a, b) =>
    b[1] > a[1] ? b : a,
  );
}

export default async function handler(req: NextRequest) {
  const headers = {
    // Tallies drift as votes land — an hour is fresh enough for a share
    // image without hammering the aggregation.
    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
  };

  let rows: BoardRow[] = [];
  try {
    await connectDB();
    rows = await boardRows();
  } catch {
    rows = [];
  }

  const asOf = new Date().toISOString().slice(0, 10);

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: BG,
          padding: '56px 72px',
        }}
      >
        <div
          style={{
            display: 'flex',
            color: QUIET,
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: 3,
            textTransform: 'uppercase',
          }}
        >
          How visitors feel
        </div>
        {rows.length === 0 ? (
          <div
            style={{
              display: 'flex',
              color: 'white',
              fontSize: 44,
              fontWeight: 800,
              textAlign: 'center',
              marginTop: 28,
              letterSpacing: -1,
            }}
          >
            No votes yet — cast yours on any scorecard
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              marginTop: 36,
              width: '100%',
            }}
          >
            {rows.map((row) => {
              const entry = CURRENCY_BY_CODE[row.code];
              const [lead, leadCount] = leadOf(row);
              const readable = row.total >= MIN_READABLE_VOTES;
              const pct = readable ? Math.round((leadCount / row.total) * 100) : null;
              return (
                <div
                  key={row.code}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 20,
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    paddingBottom: 16,
                  }}
                >
                  <span style={{ fontSize: 44 }}>{entry?.flag ?? ''}</span>
                  <span style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <span style={{ color: 'white', fontSize: 34, fontWeight: 800 }}>
                      {moneyNameFor(row.code)}
                    </span>
                    <span style={{ color: QUIET, fontSize: 22, marginTop: 4 }}>
                      {readable
                        ? `${pct}% ${LEAD_LABEL[lead] ?? lead} · ${row.total} votes`
                        : `${row.total} ${row.total === 1 ? 'vote' : 'votes'} — too few to read`}
                    </span>
                  </span>
                  <span style={{ color: '#55555f', fontSize: 24, fontWeight: 700 }}>
                    {row.code}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <div
          style={{
            display: 'flex',
            color: '#55555f',
            fontSize: 20,
            marginTop: 34,
          }}
        >
          Vibes, not a market · as of {asOf} · diversifi
        </div>
      </div>
    ),
    { width: 1200, height: 630, emoji: 'twemoji', headers },
  );
}
