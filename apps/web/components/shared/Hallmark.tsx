/**
 * Hallmark — the struck mark for a fact anchored on-chain.
 *
 * An assay stamp in miniature: two concentric rings for the die's rim
 * (the outer pressed heavy, the inner shallow), a check for the assay
 * itself. It rides inline with the number it verifies — never chrome
 * in a corner, never a tooltip.
 *
 * The honesty rule is the whole point: only facts backed by an
 * on-chain record (a txHash, a ledger anchor) earn the mark. Sourced
 * beats, estimates and projections carry none — the ABSENCE is part of
 * the language; an unmarked number reads differently at a glance.
 *
 * Decorative by contract — `aria-hidden`; the DOM text beside it stays
 * authoritative and names what the mark means ("Settled on Celo · View
 * transaction", "Verify evidence").
 */

import React from 'react';

export function Hallmark({
  size = 11,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      data-testid="hallmark"
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className={`inline-block shrink-0 ${className}`}
    >
      <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
      <circle
        cx="6"
        cy="6"
        r="3.2"
        stroke="currentColor"
        strokeWidth="0.6"
        opacity="0.5"
      />
      <path
        d="M4 6.1l1.3 1.3L8 4.6"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
