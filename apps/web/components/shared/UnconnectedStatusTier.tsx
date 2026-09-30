/**
 * UnconnectedStatusTier — the shared status tier for unconnected instruments.
 *
 * Phase 2 of the unconnected-morphs work (design-language §5 rail 5): every
 * tab keeps its object walletless and puts trust + demo entry in the status
 * tier. Home (NotConnectedState) and Exchange (ExchangeTab) duplicated this
 * exact block; Shield and Agent now join them, and the duplication collapses
 * into one primitive.
 *
 * Quiet by contract: one VerifiedEvidence line (§7 chain-agnostic trust —
 * no hex, no chain names until tapped) + one demo text link. Not a demo
 * strip with headline copy — the object owns the first viewport.
 */

import React from "react";
import { VerifiedEvidence } from "./VerifiedEvidence";

interface UnconnectedStatusTierProps {
  /** Called when the visitor taps "Explore a sample plan". */
  onEnableDemo: () => void;
  /** Sample data is already on (another tab enabled it). Offering "Explore a
   *  sample plan" again would contradict the tab next door — say it's on and
   *  offer the way out instead. */
  demoActive?: boolean;
  onDisableDemo?: () => void;
  className?: string;
  /** Optional extra quiet links (e.g. the FX netting hand-off on Exchange).
   *  Rendered between the trust line and the demo link — keep them text-links,
   *  the tier stays quiet by contract. */
  children?: React.ReactNode;
  trust?: React.ReactNode;
}

export function UnconnectedStatusTier({
  onEnableDemo,
  demoActive = false,
  onDisableDemo,
  className = "",
  children,
  trust = <VerifiedEvidence />,
}: UnconnectedStatusTierProps) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-2 ${className}`.trim()}>
      {trust}
      {children}
      {demoActive && onDisableDemo ? (
        <button
          type="button"
          onClick={onDisableDemo}
          className="min-h-tap px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 shrink-0"
        >
          Sample data on · Exit
        </button>
      ) : (
        <button
          type="button"
          onClick={onEnableDemo}
          className="min-h-tap px-2 text-xs font-semibold text-blue-600 dark:text-blue-400 shrink-0"
        >
          Explore a sample plan
        </button>
      )}
    </div>
  );
}

export default UnconnectedStatusTier;
