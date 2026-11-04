/**
 * useMotionBudget — how much motion this device should be asked to render.
 *
 * Reduced motion is the only *correctness* switch. The rest are cost
 * switches: DiversiFi's motion grammar (springs, tweens, count-ups) is
 * meaning — a number that changes has to travel — so it survives a slow
 * phone. A velocity-driven blur filter does not: it is the one effect here
 * that allocates a compositing surface per frame, so it is the first thing
 * to go on a low-end CPU or a metered connection.
 *
 * Two answers only:
 *  - `motion`       — springs and reveals are allowed.
 *  - `velocityBlur` — the costly effect (the disc's smear) is allowed.
 *
 * The environment is read once, on mount, and never watched: a device does
 * not get faster mid-visit, and a media query that flips mid-visit is
 * exactly the moment not to start a filter.
 */

import { useMemo, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

export interface MotionBudget {
  /** Springs, tweens and reveals — the app's motion grammar. */
  motion: boolean;
  /** Velocity-driven blur (the disc's smear). Costliest effect; off first. */
  velocityBlur: boolean;
}

/** A device that gets the full choreography: desktop, or a recent phone. */
export const FULL_MOTION: MotionBudget = { motion: true, velocityBlur: true };

/** Reduced motion: every animated thing lands in its final state. */
export const NO_MOTION: MotionBudget = { motion: false, velocityBlur: false };

interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

export interface MotionEnv {
  reducedMotion?: boolean | null;
  /** navigator.hardwareConcurrency — absent on some browsers. */
  cores?: number;
  /** navigator.deviceMemory, in GB — Chromium only. */
  deviceMemoryGB?: number;
  saveData?: boolean;
  /** connection.effectiveType — 'slow-2g' | '2g' | '3g' | '4g'. */
  effectiveType?: string;
}

/** Pure, so the rule can be tested without a browser. */
export function motionBudgetFor(env: MotionEnv): MotionBudget {
  if (env.reducedMotion) return NO_MOTION;

  const metered =
    env.saveData === true ||
    env.effectiveType === 'slow-2g' ||
    env.effectiveType === '2g' ||
    env.effectiveType === '3g';
  const lowEnd =
    (typeof env.cores === 'number' && env.cores > 0 && env.cores <= 4) ||
    (typeof env.deviceMemoryGB === 'number' && env.deviceMemoryGB > 0 && env.deviceMemoryGB <= 4);

  if (metered || lowEnd) return { motion: true, velocityBlur: false };
  return FULL_MOTION;
}

function readEnv(): MotionEnv {
  if (typeof navigator === 'undefined') return {};
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: NetworkInformation;
  };
  return {
    cores: nav.hardwareConcurrency,
    deviceMemoryGB: nav.deviceMemory,
    saveData: nav.connection?.saveData,
    effectiveType: nav.connection?.effectiveType,
  };
}

export function useMotionBudget(): MotionBudget {
  const reducedMotion = useReducedMotion();
  const [env] = useState(readEnv);
  return useMemo(() => motionBudgetFor({ reducedMotion, ...env }), [reducedMotion, env]);
}
