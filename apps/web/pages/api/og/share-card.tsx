/**
 * Legacy share card — retired. The old version rendered scores,
 * percentiles and ratings straight from query params, which meant any
 * number in an embed was unverifiable. All params are now ignored; old
 * posted links still resolve to an honest neutral brand card.
 */
import { ImageResponse } from '@vercel/og';
import type { NextRequest } from 'next/server';

export const config = {
  runtime: 'edge',
};

export default function handler(_req: NextRequest) {
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
          backgroundColor: '#0b0b12',
        }}
      >
        <span
          style={{ color: 'white', fontSize: 64, fontWeight: 800, letterSpacing: -2 }}
        >
          DiversiFi
        </span>
        <span style={{ color: '#8b8b9a', fontSize: 28, marginTop: 12 }}>
          Savings, weighed in real currencies
        </span>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control':
          'public, s-maxage=86400, stale-while-revalidate=604800',
      },
    },
  );
}
