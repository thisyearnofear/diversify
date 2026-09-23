/**
 * Pair card — the shareable image for /pair/[from]/[to]. Its only inputs
 * are the two symbols; every number is derived server-side from the
 * curated corridor dataset (see lib/pair-card.ts). Unknown symbols or a
 * corridor with nothing to say fall back to the neutral brand card —
 * never a guess, never a user-supplied number.
 */
import { ImageResponse } from '@vercel/og';
import type { NextRequest } from 'next/server';
import { pairCardContent } from '@/lib/pair-card';

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

function Coin({
  color,
  label,
  tilt,
}: {
  color: string;
  label: string;
  tilt: number;
}) {
  return (
    <div
      style={{
        width: 160,
        height: 160,
        borderRadius: 80,
        backgroundColor: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 88,
        transform: `rotate(${-tilt}deg)`,
      }}
    >
      {label}
    </div>
  );
}

export default function handler(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const content = pairCardContent(
    searchParams.get('from'),
    searchParams.get('to'),
  );

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

  const {
    from,
    to,
    fromFlag,
    toFlag,
    fromColor,
    toColor,
    tilt,
    headline,
    whatIf,
    asOf,
  } = content;

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
        {/* The beam — same object as the stage: two coins on a tilted
            rule over a fulcrum. */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: 44,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              transform: `rotate(${tilt}deg)`,
            }}
          >
            <Coin color={fromColor} label={fromFlag ?? from} tilt={tilt} />
            <div
              style={{
                width: 300,
                height: 6,
                borderRadius: 3,
                backgroundColor: '#3a3a48',
                marginLeft: -24,
                marginRight: -24,
              }}
            />
            <Coin color={toColor} label={toFlag ?? to} tilt={tilt} />
          </div>
          {/* Fulcrum */}
          <div
            style={{
              width: 44,
              height: 34,
              backgroundColor: '#55555f',
              borderRadius: 6,
              marginTop: 14,
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            color: 'white',
            fontSize: 46,
            fontWeight: 800,
            textAlign: 'center',
            letterSpacing: -1,
            maxWidth: 1000,
            lineHeight: 1.15,
          }}
        >
          {headline}
        </div>
        {whatIf && (
          <div
            style={{
              display: 'flex',
              color: QUIET,
              fontSize: 24,
              textAlign: 'center',
              marginTop: 18,
              maxWidth: 1000,
            }}
          >
            What if · {whatIf}
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
