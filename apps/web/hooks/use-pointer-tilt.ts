/**
 * usePointerTilt — Sylva's pointer-responsive scene, damped, framer-native.
 *
 * The one expressive pointer interaction allowed on an instrument object:
 * the object leans toward the cursor (max ±MAX_TILT_DEG) through a spring,
 * so it *notices* you without chasing raw input. Dead under reduced motion
 * and when `enabled` is false. Springs settle to zero on leave — a
 * transition confirmation, never a loop.
 *
 * const tilt = usePointerTilt(true);
 * <motion.div {...tilt.props} style={{ ...tilt.style, transformPerspective: 900 }}>
 */

import { useCallback } from "react";
import {
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { springSoft } from "@/lib/motion-tokens";

const MAX_TILT_DEG = 7;

export function usePointerTilt(enabled: boolean) {
  const reducedMotion = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springConfig = { ...springSoft };
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [MAX_TILT_DEG, -MAX_TILT_DEG]), springConfig);
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-MAX_TILT_DEG, MAX_TILT_DEG]), springConfig);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (reducedMotion || !enabled) return;
      if (e.pointerType === "touch") return;
      const rect = e.currentTarget.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      x.set((e.clientX - rect.left) / rect.width - 0.5);
      y.set((e.clientY - rect.top) / rect.height - 0.5);
    },
    [reducedMotion, enabled, x, y],
  );

  const onPointerLeave = useCallback(() => {
    x.set(0);
    y.set(0);
  }, [x, y]);

  const style = { rotateX, rotateY } as const;
  const props = { onPointerMove, onPointerLeave } as const;

  return { style, props };
}
