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
  className?: string;
}

export function UnconnectedStatusTier({
  onEnableDemo,
  className = "",
}: UnconnectedStatusTierProps) {
  return (
    <div className={`flex items-center justify-between gap-3 ${className}`.trim()}>
      <VerifiedEvidence />
      <button
        type="button"
        onClick={onEnableDemo}
        className="min-h-[44px] px-2 text-xs font-semibold text-blue-600 dark:text-blue-400 shrink-0"
      >
        Explore a sample plan
      </button>
    </div>
  );
}

export default UnconnectedStatusTier;
