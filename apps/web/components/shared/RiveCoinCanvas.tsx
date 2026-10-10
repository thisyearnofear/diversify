'use client';

/**
 * RiveCoinCanvas — client-only Rive canvas for the claim coin.
 * Imported exclusively via `next/dynamic` with `ssr: false` from
 * `RiveCoin.tsx` so the WASM runtime never enters the initial bundle.
 * WASM is self-hosted from /public/rive (see design-language §5).
 *
 * The coin's accent is a view-model bind: the host passes one hex and the
 * face gradient's three stops are derived from it, so the same .riv mints
 * in any token color. The file writes the `landed` view-model trigger on
 * entering its rest state — the confirm haptic lands on the settle frame.
 */

import React, { useEffect, useState } from 'react';
import {
  useRive,
  useViewModelInstanceColor,
  useViewModelInstanceTrigger,
  RuntimeLoader,
  type ViewModelInstance,
} from '@rive-app/react-canvas-lite';
import { haptics } from '../../lib/haptics';
import { hexToRgb, shadeHex } from '../../lib/rive-color';

RuntimeLoader.setWasmUrl('/rive/rive.wasm');
// Fallback build for older WASM engines — self-hosted too, or a primary
// failure would silently fetch it from jsdelivr.
RuntimeLoader.setWasmFallbackUrl('/rive/rive_fallback.wasm');

interface RiveCoinCanvasProps {
  size: number;
  /** Base accent (hex). Defaults to the file's emerald ramp. */
  color?: string;
}

export default function RiveCoinCanvas({ size, color }: RiveCoinCanvasProps) {
  const { rive, RiveComponent } = useRive({
    src: '/rive/claim-coin.riv',
    autoplay: true,
    // Required: without it the runtime plays the first linear animation,
    // not the state machine — binds and the Rest signal never run.
    stateMachine: 'State Machine 1',
    // onRiveReady fires before the state machine advances — the first
    // frame must already carry the real accent ramp, not the file's
    // default (the property hooks only resolve after frame 1).
    onRiveReady: (r) => {
      const instance = r.defaultViewModel()?.instance() ?? null;
      if (instance) {
        if (color) {
          const light = shadeHex(color, 0.35);
          const mid = hexToRgb(color);
          const dark = shadeHex(color, -0.3);
          instance.color('accentLight')?.rgb(light.r, light.g, light.b);
          instance.color('accent')?.rgb(mid.r, mid.g, mid.b);
          instance.color('accentDark')?.rgb(dark.r, dark.g, dark.b);
        }
        r.bindViewModelInstance(instance);
      }
      setVmi(instance);
    },
  });
  // Every mounted coin gets its own instance — sharing the file's default
  // instance across two coins made trigger callbacks collide and crashed
  // the lite WASM ("null function").
  const [vmi, setVmi] = useState<ViewModelInstance | null>(null);
  const { setRgb: setLight } = useViewModelInstanceColor('accentLight', vmi);
  const { setRgb: setMid } = useViewModelInstanceColor('accent', vmi);
  const { setRgb: setDark } = useViewModelInstanceColor('accentDark', vmi);
  useViewModelInstanceTrigger('landed', vmi, { onTrigger: () => haptics.confirm() });

  useEffect(() => {
    if (!color) return;
    const light = shadeHex(color, 0.35);
    const mid = hexToRgb(color);
    const dark = shadeHex(color, -0.3);
    setLight(light.r, light.g, light.b);
    setMid(mid.r, mid.g, mid.b);
    setDark(dark.r, dark.g, dark.b);
  }, [color, setLight, setMid, setDark]);

  return (
    <div style={{ width: size, height: size }} role="img" aria-label="Minted coin">
      <RiveComponent style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
