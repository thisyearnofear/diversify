/**
 * useCountUp — Skills "number-details" technique, framer-native.
 *
 * Numbers carry their own meaning (design-language §6): money figures land
 * with a count-up instead of swapping text. Reduced motion renders the
 * final value immediately. Returns a MotionValue string — render it inside
 * <motion.span>{value}</motion.span>.
 *
 * const value = useCountUp(totalUsd);
 * return <motion.span className="tabular-nums">{value}</motion.span>;
 */

import { useEffect } from "react";
import {
  animate,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "framer-motion";

export function useCountUp(
  target: number,
  options: { duration?: number; format?: (n: number) => string } = {},
): MotionValue<string> {
  const { duration = 0.6, format = defaultFormat } = options;
  const reducedMotion = useReducedMotion();
  const mv = useMotionValue(reducedMotion ? target : 0);

  useEffect(() => {
    if (reducedMotion) {
      mv.set(target);
      return;
    }
    const controls = animate(mv, target, { duration, ease: "easeOut" });
    return () => controls.stop();
  }, [target, duration, reducedMotion, mv]);

  return useTransform(mv, (v) => format(v));
}

function defaultFormat(n: number): string {
  return Math.round(n).toLocaleString();
}
