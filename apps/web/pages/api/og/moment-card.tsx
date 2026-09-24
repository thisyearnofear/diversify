/**
 * Moment card — the shareable image for /moment/[code]. Its only input
 * is the fiat code; every number is derived server-side from the curated
 * currency dataset (see lib/moment-card.ts). Unknown codes fall back to
 * the neutral brand card — never a guess, never a user-supplied number.
 */
import { ImageResponse } from '@vercel/og';
import type { NextRequest } from 'next/server';
import { momentCardContent } from '@/lib/moment-card';

export const config = {
  runtime: 'edge',
};

const BG = '#0b0b12';
const QUIET = '#8b8b9a';

function BrandCard() {
  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: BG,
      }}
    >
      <span
        style={{ color: 'white', fontSize: 64, fontWeight: 800, letterSpacing: -2 }}
      >
        DiversiFi
      </span>
      <span style={{ color: QUIET, fontSize: 28, marginTop: 12 }}>
        Savings, weighed in real currencies
      </span>
    </div>
  );
}

function Coin({ label, size }: { label: string; size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#23232e',
        border: '2px solid #3a3a48',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.55,
      }}
    >
      {label}
    </div>
  );
}

export default function handler(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const content = momentCardContent(searchParams.get('code'));

  const headers = {
    'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
  };

  if (!content) {
    return new ImageResponse(<BrandCard />, {
      width: 1200,
      height: 630,
      headers,
    });
  }

  const { flag, benchmarkFlag, headline, event, asOf } = content;

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
          padding: '48px 64px',
        }}
      >
        {/* The Home stage — the local coin (flag) against the benchmark. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 28,
            marginBottom: 44,
          }}
        >
          <Coin label={flag} size={150} />
          <span style={{ color: '#3a3a48', fontSize: 44, fontWeight: 800 }}>
            →
          </span>
          <Coin label={benchmarkFlag} size={110} />
        </div>

        <div
          style={{
            display: 'flex',
            color: 'white',
            fontSize: 44,
            fontWeight: 800,
            textAlign: 'center',
            letterSpacing: -1,
            maxWidth: 1000,
            lineHeight: 1.15,
          }}
        >
          {headline}
        </div>
        {event && (
          <div
            style={{
              display: 'flex',
              color: '#b8b8c8',
              fontSize: 22,
              textAlign: 'center',
              marginTop: 16,
              maxWidth: 1000,
            }}
          >
            {event}
          </div>
        )}
        <div
          style={{
            display: 'flex',
            color: '#55555f',
            fontSize: 18,
            marginTop: 26,
          }}
        >
          Curated data to {asOf} · Not live FX · diversifi
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      emoji: 'twemoji',
      headers,
    },
  );
}
