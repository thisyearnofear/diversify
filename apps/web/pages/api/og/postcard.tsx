/**
 * Postcard OG — the shareable image for /postcard/[from]/[to]. Inputs are
 * the two symbols, comma-joined stamp ids and the mode; every fact is
 * resolved server-side via resolveStamps — the URL never carries a
 * number. Invalid input renders the neutral brand card.
 */
import { ImageResponse } from '@vercel/og';
import type { NextRequest } from 'next/server';
import { canonicalPairSymbol } from '@/lib/pair-card';
import { resolveStamps, type Stamp } from '@/lib/stamps';
import { corridorSideFor } from '@/lib/corridor-context';
import { tokenColor } from '@/components/shared/palette';
import { stampRotation } from '@/components/shared/StampSeal';

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
      <span style={{ color: 'white', fontSize: 64, fontWeight: 800, letterSpacing: -2 }}>
        DiversiFi
      </span>
      <span style={{ color: QUIET, fontSize: 28, marginTop: 12 }}>
        Savings, weighed in real currencies — stamped with cited facts.
      </span>
    </div>
  );
}

/** A seal for the OG image: colored ring, glyph + value centred, then
 *  the fact line as the primary caption and source · date beneath —
 *  small caption lines instead of SVG textPath (unsupported by satori).
 *  Fixed 260px column so long lines wrap without touching neighbours. */
function Seal({ stamp, color }: { stamp: Stamp; color: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        transform: `rotate(${stampRotation(stamp.id)}deg)`,
        width: 260,
      }}
    >
      <div
        style={{
          width: 150,
          height: 150,
          borderRadius: 75,
          border: `5px solid ${color}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#14141d',
        }}
      >
        <span style={{ fontSize: 40 }}>{stamp.glyph}</span>
        <span style={{ color: 'white', fontSize: 34, fontWeight: 800, marginTop: 4 }}>
          {stamp.value}
        </span>
      </div>
      <span
        style={{
          color: '#c9c9d6',
          fontSize: 20,
          fontWeight: 600,
          marginTop: 12,
          textAlign: 'center',
          lineHeight: 1.3,
        }}
      >
        {stamp.line}
      </span>
      <span
        style={{
          color: QUIET,
          fontSize: 14,
          marginTop: 8,
          textTransform: 'uppercase',
          letterSpacing: 1.5,
          textAlign: 'center',
        }}
      >
        {`${stamp.source} · ${stamp.dateLabel}`}
      </span>
    </div>
  );
}

export default async function handler(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = canonicalPairSymbol(searchParams.get('from'));
  const to = canonicalPairSymbol(searchParams.get('to'));
  const mode = searchParams.get('m') === 'watching' ? 'watching' : 'moved';
  const ids = (searchParams.get('s') ?? '').split(',').filter(Boolean);
  const stamps = from && to ? resolveStamps(from, to, ids) : [];

  const headers = {
    'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
  };

  if (!from || !to || stamps.length === 0) {
    return new ImageResponse(<BrandCard />, { width: 1200, height: 630, headers });
  }

  const fromFlag = corridorSideFor(from)?.flag;
  const toFlag = corridorSideFor(to)?.flag;

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
        {/* The postcard: from coin → to coin, mode caption, seals. */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 40 }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: tokenColor(from),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 44,
            }}
          >
            {fromFlag ?? from}
          </div>
          <span style={{ color: QUIET, fontSize: 36, margin: '0 18px' }}>→</span>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: tokenColor(to),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 44,
            }}
          >
            {toFlag ?? to}
          </div>
          <span
            style={{
              color: QUIET,
              fontSize: 20,
              marginLeft: 18,
              textTransform: 'uppercase',
              letterSpacing: 2,
            }}
          >
            {mode === 'moved' ? 'Moved' : 'Watching'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 36 }}>
          {stamps.map((s) => (
            <Seal
              key={s.id}
              stamp={s}
              color={tokenColor(s.side === 'from' ? from : to)}
            />
          ))}
        </div>

        <div style={{ display: 'flex', color: '#55555f', fontSize: 18, marginTop: 40 }}>
          Facts cited by DiversiFi · dated · not advice
        </div>
      </div>
    ),
    { width: 1200, height: 630, emoji: 'twemoji', headers },
  );
}
