// Dev-only runtime check for the Rive objects — not shipped.
// Exercises: mint coin (default + bound accent), net pair (linked + sealed),
// protection seal, guardian sentinel (posture cycle), verified seal,
// assay shield (patina / ghost channel / strike / maker's mark).
//
// Boards are paged, not stacked: the canvas-lite WASM renderer draws
// nothing for instances beyond ~7 live at once (later-initialized
// canvases just stay blank). Mount one board at a time.
import React, { useState } from 'react';
import { useHoldToCommit } from '../hooks/use-hold-to-commit';
import RiveCoin from '../components/shared/RiveCoin';
import RiveNetPair from '../components/shared/RiveNetPair';
import RiveProtectionSeal from '../components/shared/RiveProtectionSeal';
import RiveGuardian, { type GuardianPosture } from '../components/shared/RiveGuardian';
import RiveVerifiedSeal from '../components/shared/RiveVerifiedSeal';
import RiveAssayShield from '../components/shared/RiveAssayShield';

const POSTURES: GuardianPosture[] = ['watching', 'acting', 'alert', 'resting'];
type Board = 'objects' | 'marks';

export default function RiveTest() {
  const [board, setBoard] = useState<Board>('marks');
  const [settled, setSettled] = useState(false);
  const [replayKey, setReplayKey] = useState(0);
  const [postureIdx, setPostureIdx] = useState(0);
  const [holds, setHolds] = useState(0);
  const [assayAge, setAssayAge] = useState(0); // 0 fresh → 1 fully weathered
  const [assayStruck, setAssayStruck] = useState(false);
  const [assayMonitoring, setAssayMonitoring] = useState(false);
  const posture = POSTURES[postureIdx];
  const hold = useHoldToCommit({ onCommit: () => setHolds((n) => n + 1) });

  if (process.env.NODE_ENV === 'production') return null;

  return (
    <div
      style={{
        background: '#1d1d1d',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 40,
        color: '#888',
        fontFamily: 'monospace',
      }}
    >
      <div style={{ display: 'flex', gap: 12 }}>
        {(['objects', 'marks'] as const).map((b) => (
          <button
            key={b}
            onClick={() => setBoard(b)}
            style={{
              padding: '6px 14px',
              color: board === b ? '#e5e7eb' : '#888',
              borderBottom: board === b ? '1px solid #e5e7eb' : '1px solid transparent',
            }}
          >
            {b}
          </button>
        ))}
      </div>

      {board === 'objects' && (
        <>
          <div style={{ display: 'flex', gap: 48, alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <RiveCoin size={200} key={`a${replayKey}`} />
              <div>claim — default emerald</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <RiveCoin size={200} color="#f59e0b" symbol="PAXG" key={`b${replayKey}`} />
              <div>swap — bound PAXG gold</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 48, alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <RiveNetPair size={240} leftColor="#0ea5e9" rightColor="#f97316" settled={settled} key={`p${replayKey}`} />
              <div>net pair — {settled ? 'sealed' : 'linked'}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <RiveProtectionSeal size={120} color="#a855f7" armed={settled} key={`s${replayKey}`} />
              <div>protection seal — {settled ? 'armed' : 'idle'}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                {...hold.bind}
                style={{ padding: 12, touchAction: 'none', userSelect: 'none', cursor: 'pointer' }}
              >
                <RiveProtectionSeal size={120} color="#a855f7" armed={false} holdProgress={hold.progress} />
              </button>
              <div>hold-to-authorize — {holds} commits {hold.holding ? '· holding' : ''}</div>
            </div>
          </div>
        </>
      )}

      {board === 'marks' && (
        <>
          <div style={{ display: 'flex', gap: 48, alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <RiveGuardian size={120} posture={posture} />
              <div>sentinel — {posture}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <RiveVerifiedSeal size={120} verified={settled} key={`v${replayKey}`} />
              <div>verified seal — {settled ? 'sealed' : 'pending'}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 48, alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <RiveAssayShield
                size={160}
                patina={assayAge}
                gapStart={0.858}
                struck={assayStruck}
                monitoring={assayMonitoring}
              />
              <div>
                assay shield — copper patina {(assayAge * 100).toFixed(0)}%
                {assayStruck ? ' · struck' : ''}
                {assayMonitoring ? ' · monitored' : ''}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'center' }}>
                <button onClick={() => setAssayAge((a) => Math.min(1, a + 0.25))} style={{ padding: '4px 10px' }}>
                  weather
                </button>
                <button onClick={() => setAssayStruck(true)} style={{ padding: '4px 10px' }}>
                  strike
                </button>
                <button onClick={() => setAssayMonitoring((m) => !m)} style={{ padding: '4px 10px' }}>
                  monitor
                </button>
                <button
                  onClick={() => { setAssayAge(0); setAssayStruck(false); setAssayMonitoring(false); }}
                  style={{ padding: '4px 10px' }}
                >
                  remint
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={() => setReplayKey((k) => k + 1)} style={{ padding: '8px 16px' }}>
          replay
        </button>
        <button onClick={() => setSettled((s) => !s)} style={{ padding: '8px 16px' }}>
          toggle settled
        </button>
        <button
          onClick={() => setPostureIdx((i) => (i + 1) % POSTURES.length)}
          style={{ padding: '8px 16px' }}
        >
          cycle posture
        </button>
      </div>
    </div>
  );
}
