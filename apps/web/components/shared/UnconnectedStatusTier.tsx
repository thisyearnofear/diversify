/**
 * UnconnectedStatusTier — the shared status tier for unconnected instruments.
 *
 * Quiet by contract: at most one VerifiedEvidence line (§7 chain-agnostic
 * trust — no hex, no chain names until tapped) plus the tab's own hand-offs.
 * Tabs whose object hosts the verifier (Guardian's board, Exchange's pair
 * stage) pass trust={null} — woven beats orphaned (§7).
 *
 * The demo entry left this row: it repeated on four tabs and split the foot
 * into corners. It is one app-wide control now, in the header next to Hide.
 */

import React from "react";
import { VerifiedEvidence } from "./VerifiedEvidence";

interface UnconnectedStatusTierProps {
  className?: string;
  /** The tab's own quiet hand-offs (e.g. the FX netting link). Keep them
   *  text-links — the tier stays quiet by contract. */
  children?: React.ReactNode;
  trust?: React.ReactNode;
}

export function UnconnectedStatusTier({
  className = "",
  children,
  trust = <VerifiedEvidence />,
}: UnconnectedStatusTierProps) {
  return (
    <div className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-2 ${className}`.trim()}>
      {trust}
      {children}
    </div>
  );
}

export default UnconnectedStatusTier;
