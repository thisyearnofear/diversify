'use client';

/**
 * RiveVerifiedSealCanvas — client-only Rive canvas for the verified-evidence seal.
 * Imported exclusively via `next/dynamic` with `ssr: false` from
 * `RiveVerifiedSeal.tsx` so the WASM runtime never enters the initial bundle.
 *
 * The object is one-shot (design-language §5): setting `verified` is the
 * only act — the file runs Pending → Stamp → Sealed itself and writes
 * the `sealed` trigger on the exact landing frame for the host's
 * confirm haptic. The accent is a view-model bind (`accent` plus
 * `accentLight`/`accentDark` derived with `shadeHex`).
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
import { hexToRgb, shadeHex } from '../../lib/rive-color';

RuntimeLoader.setWasmUrl('/rive/rive.wasm');
// Fallback build for older WASM engines — self-hosted too, or a primary
// failure would silently fetch it from jsdelivr.
RuntimeLoader.setWasmFallbackUrl('/rive/rive_fallback.wasm');

interface RiveVerifiedSealCanvasProps {
  size: number;
  verified: boolean;
  accent: string;
}

export default function RiveVerifiedSealCanvas({ size, verified, accent }: RiveVerifiedSealCanvasProps) {
  const { rive, RiveComponent } = useRive({
    src: '/rive/verified-seal.riv',
    autoplay: true,
    // Required: without it the runtime plays the first linear animation,
    // not the state machine — binds, transitions and events never run.
    stateMachine: 'VerifiedSeal',
  });
  const viewModel = useViewModel(rive, { useDefault: true });
  // useNew: each mounted seal owns its data context (see RiveCoinCanvas).
  const vmi = useViewModelInstance(viewModel, { useNew: true, rive });
  const { setValue: setVerified } = useViewModelInstanceBoolean('verified', vmi);
  const { setRgb: setAccent } = useViewModelInstanceColor('accent', vmi);
  const { setRgb: setAccentLight } = useViewModelInstanceColor('accentLight', vmi);
  const { setRgb: setAccentDark } = useViewModelInstanceColor('accentDark', vmi);
  // The file writes `sealed` on entering Sealed — the frame-accurate
  // confirm haptic (no deprecated state-change events).
  useViewModelInstanceTrigger('sealed', vmi, { onTrigger: () => haptics.confirm() });

  useEffect(() => {
    const mid = hexToRgb(accent);
    const light = shadeHex(accent, 0.28);
    const dark = shadeHex(accent, -0.32);
    setAccent(mid.r, mid.g, mid.b);
    setAccentLight(light.r, light.g, light.b);
    setAccentDark(dark.r, dark.g, dark.b);
  }, [accent, setAccent, setAccentLight, setAccentDark]);

  useEffect(() => {
    if (verified) setVerified(true);
  }, [verified, setVerified]);

  return (
    <div
      style={{ width: size, height: size }}
      role="img"
      aria-label={verified ? 'Verified on-chain' : 'Verification pending'}
    >
      <RiveComponent style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
