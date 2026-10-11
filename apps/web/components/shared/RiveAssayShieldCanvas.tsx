'use client';

/**
 * RiveAssayShieldCanvas — client-only Rive canvas for the assay shield.
 * Imported exclusively via `next/dynamic` with `ssr: false` from
 * `RiveAssayShield.tsx` so the WASM runtime never enters the initial
 * bundle.
 *
 * The foundry spike: `patina` weathers the living-metal leg (the host
 * maps real drift to 0–1), `gapStart` opens the ghost channel where the
 * wallet is behind plan, `struck` plays the hallmark punch once and the
 * mark stays, `monitoring` sets the mint's maker mark into the base.
 * All four are view-model binds — the file runs its own state machine.
 */

import React, { useEffect, useState } from 'react';
import {
  useRive,
  useViewModelInstanceBoolean,
  useViewModelInstanceNumber,
  useViewModelInstanceTrigger,
  RuntimeLoader,
  type ViewModelInstance,
} from '@rive-app/react-canvas-lite';
import { haptics } from '../../lib/haptics';

RuntimeLoader.setWasmUrl('/rive/rive.wasm');
RuntimeLoader.setWasmFallbackUrl('/rive/rive_fallback.wasm');

interface RiveAssayShieldCanvasProps {
  size: number;
  /** Verdigris over the living-metal leg, 0–1 (host maps real drift). */
  patina?: number;
  /** Where the ghost channel begins, 0–1 (1 - gap share). */
  gapStart?: number;
  /** Punch the hallmark into the rim — stays struck while true. */
  struck?: boolean;
  /** The mint's maker mark sits in the base plate while true. */
  monitoring?: boolean;
}

export default function RiveAssayShieldCanvas({
  size,
  patina = 0,
  gapStart = 0.858,
  struck = false,
  monitoring = false,
}: RiveAssayShieldCanvasProps) {
  const { rive, RiveComponent } = useRive({
    src: '/rive/assay-shield.riv',
    autoplay: true,
    stateMachine: 'AssayShield',
    // onRiveReady fires before the state machine advances — the first
    // frame must already carry the real state, not the file's defaults.
    onRiveReady: (r) => {
      const instance = r.defaultViewModel()?.instance() ?? null;
      if (instance) {
        const patinaProp = instance.number('patina');
        if (patinaProp) patinaProp.value = patina;
        const gapProp = instance.number('gapStart');
        if (gapProp) gapProp.value = gapStart;
        const struckProp = instance.boolean('struck');
        if (struckProp) struckProp.value = struck;
        const monitoringProp = instance.boolean('monitoring');
        if (monitoringProp) monitoringProp.value = monitoring;
        r.bindViewModelInstance(instance);
      }
      setVmi(instance);
    },
  });
  // Each mounted shield owns its data context — sharing the file's
  // default instance across two canvases crashes the lite WASM.
  const [vmi, setVmi] = useState<ViewModelInstance | null>(null);
  const { setValue: setPatina } = useViewModelInstanceNumber('patina', vmi);
  const { setValue: setGapStart } = useViewModelInstanceNumber('gapStart', vmi);
  const { setValue: setStruck } = useViewModelInstanceBoolean('struck', vmi);
  const { setValue: setMonitoring } = useViewModelInstanceBoolean('monitoring', vmi);

  useEffect(() => setPatina(patina), [patina, setPatina]);
  useEffect(() => setGapStart(gapStart), [gapStart, setGapStart]);
  useEffect(() => setStruck(struck), [struck, setStruck]);
  useEffect(() => setMonitoring(monitoring), [monitoring, setMonitoring]);

  // The strike is the commit ceremony — the haptic lands on the exact
  // frame the mark sets (the Marked state fires `struckDone` on entry),
  // not the prop flip.
  useViewModelInstanceTrigger('struckDone', vmi, { onTrigger: () => haptics.confirm() });

  return (
    <div style={{ width: size, height: size }} role="img" aria-label="Protection plan">
      <RiveComponent style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
