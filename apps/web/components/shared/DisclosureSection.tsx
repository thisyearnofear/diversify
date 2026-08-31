/**
 * DisclosureSection — Wave 9 progressive disclosure (Tier 2).
 *
 * The tabs had grown ~25 always-open sections each; users called it
 * "verbose and card heavy". The design language already prescribed the
 * fix (one expressive object per screen, everything else quiet, three
 * disclosure tiers max) — this component enforces it:
 *
 *   Tier 1 — the screen's one expressive object, always open (NOT this).
 *   Tier 2 — this: a one-line summary row (title + key fact + chevron).
 *            Children render ONLY when expanded, so closed sections cost
 *            neither vertical space nor network requests.
 *   Tier 3 — the full card content on expand (the existing child).
 *
 * Every expand fires a coarse `section_expand` funnel event — sections
 * nobody expands become deletion candidates, not furniture.
 *
 * Accessibility: the header is a real <button> (≥44px touch target),
 * aria-expanded/aria-controls wired, respects prefers-reduced-motion.
 */

import React, { useState, useCallback } from 'react';
import { trackFunnelEvent } from '@/lib/analytics';

interface DisclosureSectionProps {
  /** Stable id — also the analytics prop. Name the JOB, not the widget. */
  id: string;
  /** Section title — what job does this do for the user? */
  title: string;
  /** One-line summary shown collapsed — the key fact, not a teaser. */
  summary: string;
  /** Optional leading icon (emoji or glyph). */
  icon?: string;
  /** Default open (use sparingly — Tier 2 is closed by default). */
  defaultOpen?: boolean;
  /** Render as a row inside a shared parent card (no per-row chrome). */
  grouped?: boolean;
  /** Called on toggle with the resulting open state (after tracking). */
  onToggle?: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

export default function DisclosureSection({
  id,
  title,
  summary,
  icon,
  defaultOpen = false,
  grouped = false,
  onToggle,
  children,
  className = '',
}: DisclosureSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  // Track the FIRST expand only — repeat toggles are noise, not signal.
  const [tracked, setTracked] = useState(false);

  const handleToggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      if (next && !tracked) {
        trackFunnelEvent('section_expand', { section: id });
        setTracked(true);
      }
      onToggle?.(next);
      return next;
    });
  }, [id, onToggle, tracked]);

  const buttonClasses = grouped
    ? `w-full min-h-[44px] flex items-center gap-3 px-4 py-3 text-left rounded-xl
       transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/40
       focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
       focus-visible:outline-blue-400`
    : `w-full min-h-[44px] flex items-center gap-3 rounded-2xl px-4 py-3 text-left
       bg-white dark:bg-gray-800 border border-gray-200/70 dark:border-white/[0.06]
       shadow-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/70
       focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
       focus-visible:outline-blue-400`;

  return (
    <section className={className} aria-label={title}>
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        className={buttonClasses}
      >
        {icon && (
          <span aria-hidden="true" className="text-lg shrink-0">
            {icon}
          </span>
        )}
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-gray-900 dark:text-white truncate">
            {title}
          </span>
          <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">
            {summary}
          </span>
        </span>
        <span
          aria-hidden="true"
          className={`shrink-0 text-gray-400 transition-transform duration-200 motion-reduce:transition-none ${
            open ? 'rotate-180' : ''
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {open && (
        <div id={`${id}-panel`} className={grouped ? 'mt-1 px-4 pb-4' : 'mt-2'}>
          {children}
        </div>
      )}
    </section>
  );
}
