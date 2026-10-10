'use client';

/**
 * RiveNetPairCanvas — client-only Rive canvas for the FX-netting pair.
 * Imported exclusively via `next/dynamic` with `ssr: false` from
 * `RiveNetPair.tsx` so the WASM runtime never enters the initial bundle.
 *
 * The object is state-driven (design-language §5): `leftColor`/`rightColor`
 * are view-model binds set once by the host; setting `settled` is the only
 * act — the file transitions Linked → Settle → Sealed itself. Each state
 * writes a view-model trigger (`linked` / `sealed`) the host observes —
 * the confirm haptic lands on the exact frame, no deprecated event API.
 */

import React, { useEffect, useState } from 'react';
import {
  useRive,
  useViewModelInstanceBoolean,
  useViewModelInstanceColor,
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

interface RiveNetPairCanvasProps {
  /** Canvas width in px; the artboard is 240×140. */
  size: number;
  leftColor?: string;
  rightColor?: string;
  settled: boolean;
}

export default function RiveNetPairCanvas({ size, leftColor, rightColor, settled }: RiveNetPairCanvasProps) {
  const { rive, RiveComponent } = useRive({
    src: '/rive/net-pair.riv',
    autoplay: true,
    // Required: without it the runtime plays the first linear animation,
    // not the state machine — binds, transitions and events never run.
    stateMachine: 'NetPair',
    // onRiveReady fires before the state machine advances — the first
    // frame must already carry the real pair colors/settled state, not
    // the file's defaults (the property hooks only resolve after frame 1).
    onRiveReady: (r) => {
      const instance = r.defaultViewModel()?.instance() ?? null;
      if (instance) {
        if (leftColor) {
          const { r: cr, g, b } = hexToRgb(leftColor);
          instance.color('leftColor')?.rgb(cr, g, b);
        }
        if (rightColor) {
          const { r: cr, g, b } = hexToRgb(rightColor);
          instance.color('rightColor')?.rgb(cr, g, b);
        }
        const settledProp = instance.boolean('settled');
        if (settledProp) settledProp.value = settled;
        r.bindViewModelInstance(instance);
      }
      setVmi(instance);
    },
  });
  // Each mounted pair owns its data context — sharing the file's default
  // instance across two canvases crashes the lite WASM (see RiveCoinCanvas).
  const [vmi, setVmi] = useState<ViewModelInstance | null>(null);
  const { setRgb: setLeft } = useViewModelInstanceColor('leftColor', vmi);
  const { setRgb: setRight } = useViewModelInstanceColor('rightColor', vmi);
  const { setValue: setSettled } = useViewModelInstanceBoolean('settled', vmi);
  // The file writes `linked`/`sealed` on entering those states — the
  // frame-accurate confirm haptic (no deprecated state-change events).
  useViewModelInstanceTrigger('linked', vmi, { onTrigger: () => haptics.confirm() });
  useViewModelInstanceTrigger('sealed', vmi, { onTrigger: () => haptics.confirm() });

  useEffect(() => {
    if (leftColor) {
      const { r, g, b } = hexToRgb(leftColor);
      setLeft(r, g, b);
    }
  }, [leftColor, setLeft]);

  useEffect(() => {
    if (rightColor) {
      const { r, g, b } = hexToRgb(rightColor);
      setRight(r, g, b);
    }
  }, [rightColor, setRight]);

  useEffect(() => {
    if (settled) setSettled(true);
  }, [settled, setSettled]);

  return (
    <div
      style={{ width: size, height: Math.round(size * (140 / 240)) }}
      role="img"
      aria-label={settled ? 'Settled currency pair' : 'Matched currency pair'}
    >
      <RiveComponent style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
