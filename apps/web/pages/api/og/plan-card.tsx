/**
 * Plan card — the shareable image for /plan/[philosophy]. Its only
 * input is the philosophy id; the name, creed, and target ring are
 * derived server-side (see lib/plan-card.ts). Unknown ids fall back to
 * the neutral brand card — a plan card never invents an allocation.
 */
import { ImageResponse } from '@vercel/og';
import type { NextRequest } from 'next/server';
import { planCardContent } from '@/lib/plan-card';

export const config = {
  runtime: 'edge',
};

const BG = '#0b0b12';
const QUIET = '#8b8b9a';
const SEGMENT_COLORS = ['#34d399', '#60a5fa', '#fbbf24', '#f472b6', '#a78bfa'];

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

/** The Shield ring — conic segments of the plan's target ideals; the
 *  remainder is the rest of the plan. */
function TargetRing({ targets }: { targets: { region: string; ideal: number }[] }) {
  const R = 90;
  const C = 2 * Math.PI * R;
  const size = 240;
  let acc = 0;
  const segments = targets.map((t, i) => {
    const frac = Math.max(0, Math.min(100, t.ideal)) / 100;
    const seg = { offset: acc, frac, color: SEGMENT_COLORS[i % SEGMENT_COLORS.length] };
    acc += frac;
    return seg;
  });
  const rest = Math.max(0, 1 - acc);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* remainder — the rest of the plan */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={R}
        fill="none"
        stroke="#23232e"
        strokeWidth={28}
      />
      {segments.map((s, i) => (
        <circle
          key={i}
          cx={size / 2}
          cy={size / 2}
          r={R}
          fill="none"
          stroke={s.color}
          strokeWidth={28}
          strokeDasharray={`${s.frac * C} ${C}`}
          strokeDashoffset={-s.offset * C}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      ))}
      <text
        x={size / 2}
        y={size / 2 - 8}
        textAnchor="middle"
        fill="#b8b8c8"
        fontSize={20}
        fontWeight={700}
      >
        {Math.round(rest * 100)}%
      </text>
      <text
        x={size / 2}
        y={size / 2 + 16}
        textAnchor="middle"
        fill="#55555f"
        fontSize={13}
      >
        rest of plan
      </text>
    </svg>
  );
}

export default function handler(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const content = planCardContent(searchParams.get('philosophy'));

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

  const { name, nativeName, tagline, icon, targets } = content;
  const targetLine = targets.map((t) => `${t.ideal}% ${t.region}`).join(' · ');

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          backgroundColor: BG,
          padding: '48px 64px',
          gap: 72,
        }}
      >
        <TargetRing targets={targets} />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div
            style={{
              display: 'flex',
              color: 'white',
              fontSize: 52,
              fontWeight: 800,
              letterSpacing: -1,
            }}
          >
            {icon} {name}
          </div>
          {nativeName && (
            <div style={{ display: 'flex', color: QUIET, fontSize: 24, marginTop: 6 }}>
              {nativeName}
            </div>
          )}
          <div
            style={{
              display: 'flex',
              color: '#b8b8c8',
              fontSize: 30,
              fontStyle: 'italic',
              marginTop: 24,
            }}
          >
            “{tagline}”
          </div>
          <div style={{ display: 'flex', color: 'white', fontSize: 26, marginTop: 28 }}>
            {targetLine}
          </div>
          <div style={{ display: 'flex', color: '#55555f', fontSize: 18, marginTop: 34 }}>
            Plan targets, not holdings · diversifi
          </div>
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
