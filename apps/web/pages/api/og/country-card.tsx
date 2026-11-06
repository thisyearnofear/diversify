/**
 * Country card — the shareable image for /country/[code]. Its only input
 * is the currency code; the kept-cents number is derived server-side from
 * the curated dataset. Unknown codes fall back to the neutral brand card.
 */
import { ImageResponse } from '@vercel/og';
import type { NextRequest } from 'next/server';
import { currencyInstrumentFor } from '@/lib/currency-instrument';
import { geoCountryFromHeaders } from '@/lib/geo';
import { featureDenied } from '@diversifi/shared/src/config/jurisdictions';

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
        Every country&apos;s money, weighed
      </span>
    </div>
  );
}

export default function handler(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const instrument = currencyInstrumentFor(searchParams.get('code'));

  const headers = {
    'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
  };

  if (!instrument) {
    return new ImageResponse(<BrandCard />, { width: 1200, height: 630, headers });
  }

  const thesisDenied = featureDenied('thesis', geoCountryFromHeaders(req.headers));
  const usd = instrument.rings.find((r) => r.benchmark === 'USD');
  const retained = Math.round(usd?.retained['5yr'] ?? 0);

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
        <div style={{ display: 'flex', fontSize: 110 }}>{instrument.flag}</div>
        {!thesisDenied && instrument.epithet && (
          <div
            style={{
              display: 'flex',
              color: '#8f8fa8',
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: 'uppercase',
              marginTop: 18,
            }}
          >
            {instrument.epithet}
          </div>
        )}
        <div
          style={{
            display: 'flex',
            color: 'white',
            fontSize: 46,
            fontWeight: 800,
            textAlign: 'center',
            letterSpacing: -1,
            marginTop: 14,
          }}
        >
          {instrument.countryName}
        </div>
        <div
          style={{
            display: 'flex',
            color: 'white',
            fontSize: 110,
            fontWeight: 800,
            letterSpacing: -3,
            marginTop: 8,
          }}
        >
          ~{retained}¢
        </div>
        <div style={{ display: 'flex', color: QUIET, fontSize: 26, marginTop: 6, textAlign: 'center' }}>
          kept of a 5-years-ago dollar&apos;s worth of {instrument.name}
        </div>
        <div style={{ display: 'flex', color: '#55555f', fontSize: 18, marginTop: 30 }}>
          Curated data to {instrument.asOfLabel} · Not live FX · diversifi
        </div>
      </div>
    ),
    { width: 1200, height: 630, emoji: 'twemoji', headers },
  );
}
