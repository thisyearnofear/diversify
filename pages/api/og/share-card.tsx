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
  const inflation = searchParams.get('inf') || 'A+';
  const rwa = searchParams.get('rwa') || '17.5';

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
          backgroundColor: '#0f172a',
          backgroundImage: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '40px',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              backgroundColor: '#2563eb',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 10px 40px rgba(37, 99, 235, 0.4)',
            }}
          >
            <span style={{ color: 'white', fontSize: '36px', fontWeight: 900 }}>D</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: 'white', fontSize: '32px', fontWeight: 900, letterSpacing: '-1px' }}>
              DiversiFi
            </span>
            <span style={{ color: '#94a3b8', fontSize: '16px', fontWeight: 600, letterSpacing: '2px' }}>
              PROTECTION ACTIVE
            </span>
          </div>
        </div>

        {/* Shield Icon */}
        <div
          style={{
            fontSize: '64px',
            marginBottom: '24px',
          }}
        >
          🛡️
        </div>

        {/* Main Message */}
        <div
          style={{
            color: 'white',
            fontSize: '28px',
            fontWeight: 700,
            textAlign: 'center',
            marginBottom: '40px',
          }}
        >
          Savings protected across {regions} regions
        </div>

        {/* Score Cards */}
        <div
          style={{
            display: 'flex',
            gap: '24px',
            marginBottom: '40px',
          }}
        >
          {/* Diversification */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: '16px',
              padding: '24px 32px',
            }}
          >
            <span style={{ color: '#94a3b8', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
              DIVERSIFICATION
            </span>
            <span style={{ color: '#22c55e', fontSize: '48px', fontWeight: 900 }}>
              {diversification}
            </span>
          </div>

          {/* Inflation Hedge */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: '16px',
              padding: '24px 32px',
            }}
          >
            <span style={{ color: '#94a3b8', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
              INFLATION HEDGE
            </span>
            <span style={{ color: '#22c55e', fontSize: '48px', fontWeight: 900 }}>
              {inflation}
            </span>
          </div>

          {/* RWA Exposure */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: '16px',
              padding: '24px 32px',
            }}
          >
            <span style={{ color: '#94a3b8', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
              RWA EXPOSURE
            </span>
            <span style={{ color: '#3b82f6', fontSize: '48px', fontWeight: 900 }}>
              {rwa}%
            </span>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: '#64748b',
            fontSize: '18px',
          }}
        >
          <span>Building resilience against currency debasement</span>
          <span style={{ fontSize: '24px' }}>📈</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
