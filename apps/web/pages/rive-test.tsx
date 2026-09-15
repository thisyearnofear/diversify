// Dev-only runtime check for the Rive objects — not shipped.
// Exercises: mint coin (default + bound accent), net pair (linked + sealed),
// protection seal, guardian sentinel (posture cycle), verified seal.
import React, { useState } from 'react';
import RiveCoin from '../components/shared/RiveCoin';
import RiveNetPair from '../components/shared/RiveNetPair';
import RiveProtectionSeal from '../components/shared/RiveProtectionSeal';
import RiveGuardian, { type GuardianPosture } from '../components/shared/RiveGuardian';
import RiveVerifiedSeal from '../components/shared/RiveVerifiedSeal';

const POSTURES: GuardianPosture[] = ['watching', 'acting', 'alert', 'resting'];

export default function RiveTest() {
  const [settled, setSettled] = useState(false);
  const [replayKey, setReplayKey] = useState(0);
  const [postureIdx, setPostureIdx] = useState(0);
  const posture = POSTURES[postureIdx];

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
      </div>

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
