// Dev-only runtime check for the Stamps doorways — not shipped.
// Views: sheet (moved/watching), the PairStage receipt's teach bloom,
// the receipt after teaching, the resting stage's corridor line beats
// with keepable ✦, and the sheet opened from a beat with a stamp seeded.
import React, { useState } from 'react';
import StampSheet, { type StampMode } from '../components/swap/StampSheet';
import PairStage, { type PairReceipt } from '../components/swap/PairStage';
import { DemoModeProvider } from '../context/app/DemoModeContext';
import { NavigationProvider } from '../context/app/NavigationContext';

type View =
  | 'sheet'
  | 'receipt-teach'
  | 'receipt-taught'
  | 'rest-beats'
  | 'rest-return'
  | 'beat-sheet';

const VIEWS: View[] = [
  'sheet',
  'receipt-teach',
  'receipt-taught',
  'rest-beats',
  'rest-return',
  'beat-sheet',
];

const RECEIPT: PairReceipt = {
  fromToken: 'NGNm',
  toToken: 'USDm',
  amountIn: '10',
  quotedOut: '6.4',
  txHash: null,
  chainId: 42220,
  settledAt: Date.now(),
};

// A fresh dated beat for the return-visit view — the snapshot below was
// taken before it existed, so the line leads with "Since 3d ago · …".
const RETURN_SIGNAL = {
  from: {
    dateLabel: 'Sep 28',
    text: 'CBN posted updated external reserves',
    timestamp: Date.now() - 86_400_000,
  },
  to: null,
};

function Stage({
  receipt,
  signals = null,
}: {
  receipt?: PairReceipt | null;
  signals?: { from: typeof RETURN_SIGNAL.from | null; to: null } | null;
}) {
  return (
    <PairStage
      fromToken="NGNm"
      toToken="USDm"
      fromItems={[]}
      toItems={[]}
      onFromChange={() => {}}
      onToChange={() => {}}
      onSwitch={() => {}}
      onWake={() => {}}
      signals={signals}
      ctaLabel="Move savings"
      receipt={receipt ?? null}
    />
  );
}

export default function StampsTest() {
  const [view, setView] = useState<View>('sheet');
  const [mode, setMode] = useState<StampMode>('moved');

  if (process.env.NODE_ENV === 'production') return null;
  if (typeof window !== 'undefined') {
    // The teach door shows once per device — the harness resets (or
    // pre-sets) the key per view so screenshots are deterministic.
    if (view === 'receipt-teach') {
      window.localStorage.removeItem('diversifi.stamps.taught');
    } else if (view === 'receipt-taught') {
      window.localStorage.setItem('diversifi.stamps.taught', '1');
    } else if (view === 'rest-return') {
      // A 3-day-old snapshot of this pair's beats — no signal key, no
      // imminent events — so the fresh signal becomes the lead beat.
      window.localStorage.setItem(
        'diversifi:last-visit:corridor:NGNm-USDm',
        JSON.stringify({
          value: {
            beatKeys: [
              'story',
              'coming-ng-2027-presidential',
              'coming-us-fomc-2026-10',
              'watch-NGNm',
            ],
            imminent: [],
          },
          at: Date.now() - 3 * 86_400_000,
        }),
      );
    }
  }

  return (
    <DemoModeProvider>
      <NavigationProvider>
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
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              justifyContent: 'center',
              maxWidth: 400,
            }}
          >
            {VIEWS.map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  padding: '5px 10px',
                  borderRadius: 8,
                  border: '1px solid #444',
                  background: view === v ? '#333' : 'transparent',
                  color: view === v ? '#eee' : '#888',
                  fontFamily: 'inherit',
                  fontSize: 11,
                }}
              >
                {v}
              </button>
            ))}
            {view === 'sheet' &&
              (['moved', 'watching'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 8,
                    border: '1px solid #557',
                    background: mode === m ? '#2a3a55' : 'transparent',
                    color: mode === m ? '#bcd' : '#789',
                    fontFamily: 'inherit',
                    fontSize: 11,
                  }}
                >
                  {m}
                </button>
              ))}
          </div>
          <div style={{ width: 390, position: 'relative' }}>
            {view === 'sheet' && (
              <StampSheet
                key={mode}
                fromToken="NGNm"
                toToken="USDm"
                mode={mode}
                entry="inspector"
                open
                onClose={() => {}}
              />
            )}
            {view === 'receipt-teach' && <Stage receipt={RECEIPT} />}
            {view === 'receipt-taught' && <Stage receipt={RECEIPT} />}
            {view === 'rest-beats' && <Stage />}
            {view === 'rest-return' && <Stage signals={RETURN_SIGNAL} />}
            {view === 'beat-sheet' && (
              <StampSheet
                fromToken="NGNm"
                toToken="USDm"
                mode="watching"
                entry="beat"
                initialStampIds={['coming-ng-2027-presidential']}
                open
                onClose={() => {}}
              />
            )}
          </div>
        </div>
      </NavigationProvider>
    </DemoModeProvider>
  );
}
