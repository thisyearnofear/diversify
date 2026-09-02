/**
 * InstrumentShell — tab layout for the object + inspector + status line.
 *
 * Tabs are instruments, not card stacks. This shell is the only permitted
 * vertical structure: the object (first viewport), an optional inspector
 * bound to selection, and a quiet status/transition line. Do not pass a
 * list of feature modules as children.
 *
 * `portfolio` is the DRY freshness slot: pass the multichain portfolio and
 * the shell renders the shared DataFreshnessIndicator once, identically
 * positioned across tabs — no per-tab copy-paste of the same five props.
 */

import React from "react";
import { DataFreshnessIndicator } from "./DataFreshnessIndicator";

/** Minimal shape the freshness slot needs — satisfied by MultichainPortfolio. */
export interface FreshnessInfo {
  lastUpdated: number | null;
  isStale?: boolean;
  hasEstimates?: boolean;
  isLoading?: boolean;
  errors?: string[] | null;
}

interface InstrumentShellProps {
  /** The manipulable object — ring, dial, ticket, picker. */
  object: React.ReactNode;
  /** Selection-bound inspector. Render `InspectorSheet`; closed when idle. */
  inspector?: React.ReactNode;
  /** Quiet status / trust / transition — one line, not a product. */
  status?: React.ReactNode;
  /** Portfolio — when present, the shared freshness indicator renders above status. */
  portfolio?: FreshnessInfo | null;
  /** Refresh handler for the freshness indicator. */
  onRefresh?: () => Promise<void> | void;
  className?: string;
}

export function InstrumentShell({
  object,
  inspector,
  status,
  portfolio,
  onRefresh,
  className = "",
}: InstrumentShellProps) {
  return (
    <div className={`relative ${className}`.trim()}>
      <div className="min-h-0">{object}</div>
      {inspector}
      {portfolio ? (
        <div className="mt-3">
          <DataFreshnessIndicator
            lastUpdated={portfolio.lastUpdated}
            isStale={portfolio.isStale}
            hasEstimates={portfolio.hasEstimates}
            isLoading={portfolio.isLoading}
            error={portfolio.errors?.[0] ?? null}
            onRefresh={onRefresh}
          />
        </div>
      ) : null}
      {status ? <div className="mt-3">{status}</div> : null}
    </div>
  );
}

export default InstrumentShell;
