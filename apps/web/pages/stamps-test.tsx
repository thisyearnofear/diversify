// Dev-only runtime check for StampSheet — not shipped.
// Renders the sheet open for NGNm→USDm; toggle between moved/watching.
import React, { useState } from 'react';
import StampSheet, { type StampMode } from '../components/swap/StampSheet';
import { DemoModeProvider } from '../context/app/DemoModeContext';

export default function StampsTest() {
  const [mode, setMode] = useState<StampMode>('moved');

  if (process.env.NODE_ENV === 'production') return null;

  return (
    <DemoModeProvider>
      <div
        style={{
          background: '#1d1d1d',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          color: '#888',
          fontFamily: 'monospace',
        }}
      >
        <div style={{ display: 'flex', gap: 12 }}>
          {(['moved', 'watching'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: '1px solid #444',
                background: mode === m ? '#333' : 'transparent',
                color: mode === m ? '#eee' : '#888',
                fontFamily: 'inherit',
              }}
            >
              {m}
            </button>
          ))}
        </div>
        <div style={{ width: 390, position: 'relative' }}>
          <StampSheet
            key={mode}
            fromToken="NGNm"
            toToken="USDm"
            mode={mode}
            open
            onClose={() => {}}
          />
        </div>
      </div>
    </DemoModeProvider>
  );
}
