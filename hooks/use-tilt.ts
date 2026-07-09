/**
 * useTilt — 3D pointer-tracking tilt for tactile card interactions.
 *
 * Returns a ref and event handlers. The card rotates up to maxTilt
 * degrees based on cursor position relative to card center. On
 * mouse leave, it springs back to neutral.
 *
 * Inspired by transitions.dev "3D tilt" pattern and Emil Kowalski's
 * animation skills (spring physics for natural return).
 *
 * Respects prefers-reduced-motion (returns no-op handlers).
 */

import { useRef, useCallback, useState } from 'react';

interface TiltStyle {
  transform: string;
  transition: string;
}

interface UseTiltReturn {
  ref: React.RefObject<HTMLDivElement | null>;
  style: TiltStyle;
  onMouseMove: (e: React.MouseEvent<HTMLElement>) => void;
  onMouseLeave: () => void;
}

const prefersReducedMotion = typeof window !== 'undefined'
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false;

export function useTilt(maxTilt: number = 4): UseTiltReturn {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<TiltStyle>({
    transform: 'perspective(800px) rotateX(0deg) rotateY(0deg)',
    transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
  });

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (prefersReducedMotion || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateY = ((x - centerX) / centerX) * maxTilt;
    const rotateX = -((y - centerY) / centerY) * maxTilt;

    setStyle({
      transform: `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`,
      transition: 'transform 0.08s ease-out',
    });
  }, [maxTilt]);

  const onMouseLeave = useCallback(() => {
    if (prefersReducedMotion) return;
    setStyle({
      transform: 'perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)',
      transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
    });
  }, []);

  return { ref, style, onMouseMove, onMouseLeave };
}
