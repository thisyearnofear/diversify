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
import {
  FOUNDRY_METAL_STOPS,
  FOUNDRY_VERDIGRIS,
  MEDALLION_MARK_D,
  MEDALLION_VIEW,
  medallionRadius,
  foundryMaterialFor,
  medallionReed,
  patinaFor,
  reliefFor,
} from '@/lib/foundry';
import { metalPaintId } from '@/components/shared/foundry-defs';

export const config = {
  runtime: 'edge',
};

const BG = '#0b0b12';
const QUIET = '#8b8b9a';

const MID = MEDALLION_VIEW / 2;
const R_OUTER = medallionRadius('outer');
const R_SEAM = medallionRadius('seam');
const R_CORE = medallionRadius('core');
const REED = medallionReed();

/**
 * StruckMedallion in the OG image, so a forwarded link previews the object
 * it forwards to rather than a pair of flat chips. Every number comes from
 * the same table the page reads — `MEDALLION_SHAPE`, `reliefFor`,
 * `patinaFor`, `medallionReed` — and the metals are painted from
 * `FOUNDRY_METAL_STOPS` under `metalPaintId`, so one metal definition drives
 * both carriers. Satori renders an inline `<linearGradient>` but drops one
 * returned by a component, which is why `FoundryDefs` itself can't cross
 * here; the engraving loses its `textPath` and sits beside the object
 * instead. Nothing else is invented.
 */
function Medallion({
  from,
  to,
  struck,
  size,
}: {
  from: string;
  to: string;
  struck: boolean;
  size: number;
}) {
  const ringMaterial = foundryMaterialFor(from);
  const coreMaterial = foundryMaterialFor(to);
  const ring = reliefFor(ringMaterial);
  const core = reliefFor(coreMaterial);
  const patina = patinaFor(from);
  const uid = 'og';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${MEDALLION_VIEW} ${MEDALLION_VIEW}`}>
      <defs>
        {[ringMaterial, coreMaterial].map((material) => (
          <linearGradient
            key={material}
            id={metalPaintId(uid, material)}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            {FOUNDRY_METAL_STOPS[material].map(({ offset, color }) => (
              <stop key={offset} offset={offset} stopColor={color} />
            ))}
          </linearGradient>
        ))}
      </defs>

      {/* The field, struck from the origin's metal. */}
      <circle cx={MID} cy={MID} r={R_OUTER} fill={`url(#${metalPaintId(uid, ringMaterial)})`} />
      {/* Weathering — a whisper across the band, deeper at the edge. */}
      {patina > 0 && (
        <circle
          cx={MID}
          cy={MID}
          r={(R_OUTER + R_SEAM) / 2}
          fill="none"
          stroke={FOUNDRY_VERDIGRIS}
          strokeWidth={R_OUTER - R_SEAM}
          opacity={patina * 0.3}
        />
      )}
      {patina > 0 && (
        <circle
          cx={MID}
          cy={MID}
          r={R_OUTER - 4}
          fill="none"
          stroke={FOUNDRY_VERDIGRIS}
          strokeWidth="7"
          opacity={patina * 0.42}
        />
      )}
      <circle
        cx={MID}
        cy={MID}
        r={R_OUTER}
        fill="none"
        stroke={ring.dark}
        strokeWidth="1.6"
        opacity="0.8"
      />

      {/* Reeding — grooves and crests, one half-period apart. */}
      <circle
        cx={MID}
        cy={MID}
        r={REED.radius}
        fill="none"
        stroke={ring.dark}
        strokeWidth={REED.strokeWidth}
        strokeDasharray={REED.dasharray}
        opacity="0.5"
      />
      <circle
        cx={MID}
        cy={MID}
        r={REED.radius}
        fill="none"
        stroke={ring.light}
        strokeWidth={REED.strokeWidth}
        strokeDasharray={REED.dasharray}
        strokeDashoffset={REED.crestOffset}
        opacity={0.34 * (1 - patina * 0.45)}
      />

      {/* The die seam, then the destination's core pressed into it. */}
      <circle
        cx={MID}
        cy={MID}
        r={R_SEAM}
        fill="none"
        stroke={ring.dark}
        strokeWidth="3"
        opacity="0.55"
      />
      <circle
        cx={MID}
        cy={MID}
        r={R_CORE}
        fill={`url(#${metalPaintId(uid, coreMaterial)})`}
        stroke={core.dark}
        strokeWidth="1.2"
        opacity="0.98"
      />
      <path
        d={`M ${MID},${R_CORE - 0.5} a ${R_CORE - 0.5},${R_CORE - 0.5} 0 0,0 0,${
          (R_CORE - 0.5) * 2
        }`}
        fill="none"
        stroke={ring.dark}
        strokeWidth="4"
        opacity="0.28"
      />
      <circle
        cx={MID}
        cy={MID}
        r={R_CORE - 4}
        fill="none"
        stroke={core.dark}
        strokeWidth="1"
        opacity="0.32"
      />
      <circle
        cx={MID}
        cy={MID}
        r={R_CORE - 7}
        fill="none"
        stroke={core.light}
        strokeWidth="0.9"
        opacity="0.42"
      />

      {struck ? (
        <g>
          <path
            d={MEDALLION_MARK_D}
            fill="none"
            stroke={ring.light}
            strokeWidth="5.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            transform="translate(-1.1,-1.4)"
            opacity="0.62"
          />
          <path
            d={MEDALLION_MARK_D}
            fill="none"
            stroke={ring.dark}
            strokeWidth="5.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            transform="translate(1,1.2)"
            opacity="0.4"
          />
          <path
            d={MEDALLION_MARK_D}
            fill="none"
            stroke={ring.ink}
            strokeWidth="3.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      ) : (
        <g>
          <path
            d={MEDALLION_MARK_D}
            fill="none"
            stroke={FOUNDRY_METAL_STOPS.ghost[1].color}
            strokeWidth="4.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.16"
          />
          <path
            d={MEDALLION_MARK_D}
            fill="none"
            stroke={FOUNDRY_METAL_STOPS.ghost[0].color}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeDasharray="3 4"
            opacity="0.5"
          />
        </g>
      )}
    </svg>
  );
}

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
        {/* The postcard's object — one coin, two metals — with the
          * engraving beside it (satori has no textPath) and the mode. */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 40 }}>
          <Medallion from={from} to={to} struck={mode === 'moved'} size={188} />
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              marginLeft: 40,
              alignItems: 'flex-start',
            }}
          >
            <span style={{ color: 'white', fontSize: 52, fontWeight: 800, letterSpacing: -1 }}>
              {`${fromFlag ?? from} ${from} → ${toFlag ?? to} ${to}`}
            </span>
            <span
              style={{
                color: QUIET,
                fontSize: 22,
                marginTop: 12,
                textTransform: 'uppercase',
                letterSpacing: 3,
              }}
            >
              {mode === 'moved' ? 'Moved' : 'Watching'}
            </span>
          </div>
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
