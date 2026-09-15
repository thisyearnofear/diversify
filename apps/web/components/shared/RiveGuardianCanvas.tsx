'use client';

/**
 * RiveGuardianCanvas — client-only Rive canvas for the sentinel.
 * Imported exclusively via `next/dynamic` with `ssr: false` from
 * `RiveGuardian.tsx` so the WASM runtime never enters the initial bundle.
 *
 * The object is posture-driven (design-language §5): the host writes the
 * `state` view-model string and the file morphs to the matching hold
 * pose itself — every move is a one-shot blend, no ambient loop.
 * Entering alert writes the `alerted` trigger the host observes for a
 * warning haptic on the exact frame.
 */

import React, { useEffect } from 'react';
import {
  useRive,
  useViewModel,
  useViewModelInstance,
  useViewModelInstanceString,
  useViewModelInstanceTrigger,
  RuntimeLoader,
} from '@rive-app/react-canvas-lite';
import { haptics } from '../../lib/haptics';
import { GuardianPosture, POSTURE_LABEL } from './RiveGuardian';

RuntimeLoader.setWasmUrl('/rive/rive.wasm');
// Fallback build for older WASM engines — self-hosted too, or a primary
// failure would silently fetch it from jsdelivr.
RuntimeLoader.setWasmFallbackUrl('/rive/rive_fallback.wasm');

interface RiveGuardianCanvasProps {
  size: number;
  posture: GuardianPosture;
}

export default function RiveGuardianCanvas({ size, posture }: RiveGuardianCanvasProps) {
  const { rive, RiveComponent } = useRive({
    src: '/rive/guardian.riv',
    autoplay: true,
    // Required: without it the runtime plays the first linear animation,
    // not the state machine — binds, transitions and events never run.
    stateMachine: 'Guardian',
  });
  const viewModel = useViewModel(rive, { useDefault: true });
  // useNew: each mounted sentinel owns its data context (see RiveCoinCanvas).
  const vmi = useViewModelInstance(viewModel, { useNew: true, rive });
  const { setValue: setState } = useViewModelInstanceString('state', vmi);
  // The file writes `alerted` on entering the alert pose — frame-accurate.
  useViewModelInstanceTrigger('alerted', vmi, { onTrigger: () => haptics.warning() });

  useEffect(() => {
    setState(posture);
  }, [posture, setState]);

  return (
    <div
      style={{ width: size, height: size }}
      role="img"
      aria-label={POSTURE_LABEL[posture]}
    >
      <RiveComponent style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
