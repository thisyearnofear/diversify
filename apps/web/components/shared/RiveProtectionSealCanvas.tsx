'use client';

/**
 * RiveProtectionSealCanvas — client-only Rive canvas for the armed seal.
 * Imported exclusively via `next/dynamic` with `ssr: false` from
 * `RiveProtectionSeal.tsx` so the WASM runtime never enters the initial
 * bundle.
 *
 * `accent` and `armed` are view-model binds; the file runs
 * Idle → Stamp → Armed itself and writes the `ready` trigger on entry —
 * the confirm haptic lands on the exact frame the seal sets.
 */

import React, { useEffect, useState } from 'react';
import {
  useRive,
  useViewModelInstanceBoolean,
  useViewModelInstanceColor,
  useViewModelInstanceNumber,
  useViewModelInstanceTrigger,
  RuntimeLoader,
  type ViewModelInstance,
} from '@rive-app/react-canvas-lite';
import { haptics } from '../../lib/haptics';
import { hexToRgb } from '../../lib/rive-color';

RuntimeLoader.setWasmUrl('/rive/rive.wasm');
// Fallback build for older WASM engines — self-hosted too, or a primary
// failure would silently fetch it from jsdelivr.
RuntimeLoader.setWasmFallbackUrl('/rive/rive_fallback.wasm');

interface RiveProtectionSealCanvasProps {
  size: number;
  /** Seal accent (hex). Defaults to the file's emerald. */
  color?: string;
  /** True once the allocation is saved, not a monitoring or execution grant. */
  armed: boolean;
  /** Press-and-hold fill 0–1 — the outer intent arc. Unrelated to `armed`. */
  holdProgress?: number;
}

export default function RiveProtectionSealCanvas({ size, color, armed, holdProgress = 0 }: RiveProtectionSealCanvasProps) {
  const { rive, RiveComponent } = useRive({
    src: '/rive/protection-seal.riv',
    autoplay: true,
    // Required: without it the runtime plays the first linear animation,
    // not the state machine — binds and transitions never run.
    stateMachine: 'Seal',
    // onRiveReady fires before the state machine advances — the first
    // frame must already carry the real accent/armed state, not the
    // file's defaults (the property hooks only resolve after frame 1).
    onRiveReady: (r) => {
      const instance = r.defaultViewModel()?.instance() ?? null;
      if (instance) {
        if (color) {
          const { r: cr, g, b } = hexToRgb(color);
          instance.color('accent')?.rgb(cr, g, b);
        }
        const armedProp = instance.boolean('armed');
        if (armedProp) armedProp.value = armed;
        const holdProp = instance.number('hold');
        if (holdProp) holdProp.value = holdProgress;
        r.bindViewModelInstance(instance);
      }
      setVmi(instance);
    },
  });
  // Each mounted seal owns its data context — sharing the file's default
  // instance across two canvases crashes the lite WASM.
  const [vmi, setVmi] = useState<ViewModelInstance | null>(null);
  const { setRgb } = useViewModelInstanceColor('accent', vmi);
  const { setValue: setArmed } = useViewModelInstanceBoolean('armed', vmi);
  const { setValue: setHold } = useViewModelInstanceNumber('hold', vmi);
  useViewModelInstanceTrigger('ready', vmi, { onTrigger: () => haptics.confirm() });

  useEffect(() => {
    if (!color) return;
    const { r, g, b } = hexToRgb(color);
    setRgb(r, g, b);
  }, [color, setRgb]);

  useEffect(() => {
    setArmed(armed);
  }, [armed, setArmed]);

  useEffect(() => {
    setHold(holdProgress);
  }, [holdProgress, setHold]);

  return (
    <div style={{ width: size, height: size }} role="img" aria-label={armed ? 'Plan saved' : 'Plan preview'}>
      <RiveComponent style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
