import { ImageResponse } from '@vercel/og';
import type { NextRequest } from 'next/server';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // Get parameters from URL
  const regions = searchParams.get('regions') || '3';
  const diversification = searchParams.get('div') || 'B';
  const inflation = searchParams.get('inf') || 'A';
  const rwa = searchParams.get('rwa') || '17.5';
  const percentile = searchParams.get('percentile') || '75';

  // Calculate color based on score
  const getScoreColor = (rating: string) => {
    if (rating.startsWith('A')) return '#22c55e'; // green
    if (rating.startsWith('B')) return '#eab308'; // yellow
    if (rating.startsWith('C')) return '#f97316'; // orange
    return '#ef4444'; // red
  };

  const divColor = getScoreColor(diversification);
  const infColor = getScoreColor(inflation);

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
          backgroundColor: '#0f0a1e',
          backgroundImage: 'radial-gradient(ellipse at top, #1e1245 0%, #0f0a1e 50%), radial-gradient(ellipse at bottom right, #2a1f4e 0%, transparent 50%)',
        }}
      >
        {/* Top Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backgroundColor: 'rgba(139, 92, 246, 0.3)',
            borderRadius: '50px',
            padding: '12px 24px',
            marginBottom: '24px',
          }}
        >
          <span style={{ color: '#c4b5fd', fontSize: '18px', fontWeight: 600 }}>
            Top {percentile}% Protection Score
          </span>
        </div>

        {/* Logo & Branding */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '32px',
          }}
        >
          <div
            style={{
              width: '72px',
              height: '72px',
              backgroundColor: '#8b5cf6',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 20px 50px rgba(139, 92, 246, 0.4)',
            }}
          >
            <span style={{ color: 'white', fontSize: '42px', fontWeight: 900 }}>D</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: 'white', fontSize: '36px', fontWeight: 900, letterSpacing: '-1px' }}>
              DiversiFi
            </span>
            <span style={{ color: '#a78bfa', fontSize: '14px', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase' }}>
              Wealth Protection
            </span>
          </div>
        </div>

        {/* Main Headline */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: '40px',
          }}
        >
          <span style={{ color: 'white', fontSize: '48px', fontWeight: 800, textAlign: 'center' }}>
            Protected across {regions} regions
          </span>
        </div>

        {/* Score Cards Row */}
        <div
          style={{
            display: 'flex',
            gap: '20px',
            marginBottom: '40px',
          }}
        >
          {/* Diversification Score */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              backgroundColor: 'rgba(255,255,255,0.08)',
              borderRadius: '20px',
              padding: '28px 40px',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <span style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px', textTransform: 'uppercase' }}>
              Diversification
            </span>
            <span style={{ color: divColor, fontSize: '56px', fontWeight: 900 }}>
              {diversification}
            </span>
          </div>

          {/* Inflation Hedge Score */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              backgroundColor: 'rgba(255,255,255,0.08)',
              borderRadius: '20px',
              padding: '28px 40px',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <span style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px', textTransform: 'uppercase' }}>
              Inflation Hedge
            </span>
            <span style={{ color: infColor, fontSize: '56px', fontWeight: 900 }}>
              {inflation}
            </span>
          </div>

          {/* RWA Exposure */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              backgroundColor: 'rgba(255,255,255,0.08)',
              borderRadius: '20px',
              padding: '28px 40px',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <span style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 700, marginBottom: '8px', letterSpacing: '1px', textTransform: 'uppercase' }}>
              RWA Exposure
            </span>
            <span style={{ color: '#8b5cf6', fontSize: '56px', fontWeight: 900 }}>
              {rwa}%
            </span>
          </div>
        </div>

        {/* CTA Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            backgroundColor: '#8b5cf6',
            borderRadius: '16px',
            padding: '16px 32px',
            boxShadow: '0 10px 40px rgba(139, 92, 246, 0.4)',
          }}
        >
          <span style={{ color: 'white', fontSize: '20px', fontWeight: 700 }}>
            Check your protection score
          </span>
          <span style={{ fontSize: '24px' }}>→</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
