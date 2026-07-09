/**
 * ShimmerText — masked gradient sweep across text.
 *
 * Creates a subtle shimmering effect where a light highlight
 * sweeps across the text. Used for CTAs and key headlines to
 * draw the eye without being distracting.
 *
 * Inspired by transitions.dev "shimmer text" pattern.
 */

import React from 'react';

interface ShimmerTextProps {
  children: React.ReactNode;
  className?: string;
  /** Speed of the sweep in seconds (default: 3s) */
  speed?: number;
}

export function ShimmerText({ children, className = '', speed = 3 }: ShimmerTextProps) {
  return (
    <span
      className={`relative inline-block ${className}`}
      style={{
        background: 'linear-gradient(90deg, currentColor 0%, currentColor 40%, rgba(255,255,255,0.9) 50%, currentColor 60%, currentColor 100%)',
        backgroundSize: '200% auto',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        animation: `shimmer-sweep ${speed}s linear infinite`,
      }}
    >
      {children}
      <style>{`
        @keyframes shimmer-sweep {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @media (prefers-reduced-motion: reduce) {
          .shimmer-text { animation: none; }
        }
      `}</style>
    </span>
  );
}
