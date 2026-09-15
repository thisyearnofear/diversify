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

import React, { useEffect } from 'react';
import {
  useRive,
  useViewModel,
  useViewModelInstance,
  useViewModelInstanceBoolean,
  useViewModelInstanceColor,
  useViewModelInstanceTrigger,
  RuntimeLoader,
} from '@rive-app/react-canvas-lite';
import { haptics } from '../../lib/haptics';
import { hexToRgb } from '../../lib/rive-color';

RuntimeLoader.setWasmUrl('/rive/rive.wasm');

interface RiveProtectionSealCanvasProps {
  size: number;
  /** Seal accent (hex). Defaults to the file's emerald. */
  color?: string;
  /** True once the protection plan is committed. */
  armed: boolean;
}

export default function RiveProtectionSealCanvas({ size, color, armed }: RiveProtectionSealCanvasProps) {
  const { rive, RiveComponent } = useRive({
    src: '/rive/protection-seal.riv',
    autoplay: true,
    // Required: without it the runtime plays the first linear animation,
    // not the state machine — binds and transitions never run.
    stateMachine: 'Seal',
  });
  const viewModel = useViewModel(rive, { useDefault: true });
  // useNew: each mounted seal owns its data context (see RiveCoinCanvas).
  const vmi = useViewModelInstance(viewModel, { useNew: true, rive });
  const { setRgb } = useViewModelInstanceColor('accent', vmi);
  const { setValue: setArmed } = useViewModelInstanceBoolean('armed', vmi);
  useViewModelInstanceTrigger('ready', vmi, { onTrigger: () => haptics.confirm() });

  useEffect(() => {
    if (!color) return;
    const { r, g, b } = hexToRgb(color);
    setRgb(r, g, b);
  }, [color, setRgb]);

  useEffect(() => {
    setArmed(armed);
  }, [armed, setArmed]);

  return (
    <div style={{ width: size, height: size }} role="img" aria-label={armed ? 'Protection armed' : 'Protection not armed'}>
      <RiveComponent style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
