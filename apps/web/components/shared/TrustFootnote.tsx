/**
 * TrustFootnote — quiet trust note with progressive blur.
 *
 * The Skills-repo `progressive-blur` technique, scoped to what this app is
 * allowed: trust footnotes (data source, method) sit quiet at the bottom of
 * an instrument. Blur is not a hide — the first clause is always readable so
 * nothing is gated, and pointer (hover) or tap expands it to full clarity.
 * Pure CSS (`backdrop-filter` gradients + mask) — zero JS per frame, honors
 * the reduced-motion contract trivially (nothing moves, clarity toggles).
 *
 * One job: render the footnote. It never carries a number that belongs in
 * the object (design-language §6).
 */

import React, { useState } from "react";

interface TrustFootnoteProps {
  /** The full trust note — source, method, timestamps. */
  children: React.ReactNode;
  /** Lines visible before expansion. 1 keeps it a true one-liner. */
  lines?: number;
  className?: string;
}

export function TrustFootnote({
  children,
  lines = 1,
  className = "",
}: TrustFootnoteProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <button
      type="button"
      aria-expanded={expanded}
      onClick={() => setExpanded((v) => !v)}
      onMouseEnter={() => setExpanded(true)}
      onFocus={() => setExpanded(true)}
      onBlur={() => setExpanded(false)}
      onMouseLeave={() => setExpanded(false)}
      className={`block w-full text-left cursor-pointer group ${className}`.trim()}
    >
      <span
        className="relative block overflow-hidden"
        style={
          expanded
            ? undefined
            : {
                // Progressive blur: clarity fades downward. Top lines stay
                // readable; the tail dissolves instead of truncating.
                maskImage: `linear-gradient(to bottom, black 0%, black ${
                  lines * 1.15
                }em, transparent ${lines * 1.15 + 1.6}em)`,
                WebkitMaskImage: `linear-gradient(to bottom, black 0%, black ${
                  lines * 1.15
                }em, transparent ${lines * 1.15 + 1.6}em)`,
                maxHeight: `${lines * 1.15 + 0.9}em`,
              }
        }
      >
        <span
          className="block text-xs leading-snug text-gray-400 dark:text-gray-500 transition-[filter] duration-200 group-hover:[filter:none]"
          style={
            expanded
              ? undefined
              : {
                  filter: "blur(0.6px)",
                  // Content-visibility keeps the blurred tail cheap.
                  contentVisibility: "auto",
                }
          }
        >
          {children}
        </span>
      </span>
      {!expanded && (
        <span
          aria-hidden="true"
          className="block text-[10px] font-semibold uppercase tracking-wider text-gray-300 dark:text-gray-600 mt-0.5"
        >
          Details
        </span>
        )}
      </button>
  );
}

export default TrustFootnote;
