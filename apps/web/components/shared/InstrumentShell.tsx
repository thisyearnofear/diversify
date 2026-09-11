/**
 * InstrumentShell — tab layout for the object + inspector + status line.
 *
 * Tabs are instruments, not card stacks. This shell is the only permitted
 * vertical structure: the object (first viewport), an optional inspector
 * bound to selection, and a quiet status/transition line. Do not pass a
 * list of feature modules as children.
 *
 * The shell OWNS the surface (§1 "surfaces are solid"): one solid card —
 * rounded-2xl, quiet border, shadow-sm — shared by every tab and every
 * connection morph, so no tab can drift into its own backing treatment.
 * Objects must not bring their own card chrome (the swap ticket and the
 * moment card render bare inside the shell). The InspectorSheet keeps its
 * own subtle border as the fold-down inset inside this surface.
 *
 * `portfolio` is the DRY freshness slot: pass the multichain portfolio and
 * the shell renders the shared DataFreshnessIndicator once, identically
 * positioned across tabs — no per-tab copy-paste of the same five props.
 */

import React from "react";
import { DataFreshnessIndicator } from "./DataFreshnessIndicator";

/** The one instrument surface — every tab, every morph, same card. */
const SURFACE =
  "rounded-2xl border border-gray-200 bg-white px-4 py-5 shadow-sm dark:border-gray-800 dark:bg-gray-900";

/** Minimal shape the freshness slot needs — satisfied by MultichainPortfolio. */
export interface FreshnessInfo {
  lastUpdated: number | null;
  isStale?: boolean;
  hasEstimates?: boolean;
  /** Static demo/sample data — the freshness slot renders a neutral
   *  "Sample data" badge instead of any freshness claim. */
  isDemo?: boolean;
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
  /** Archetype pattern tint. Rendered INSIDE the card — above its solid
   *  background, below the content — so the 3% archetype texture is felt
   *  on the surface itself (before this slot existed, Shield painted the
   *  pattern as a sibling UNDER the opaque card: invisible). */
  pattern?: { className: string; color: string } | null;
  className?: string;
}

export function InstrumentShell({
  object,
  inspector,
  status,
  portfolio,
  onRefresh,
  pattern = null,
  className = "",
}: InstrumentShellProps) {
  return (
    <div className={`relative ${SURFACE} ${className}`.trim()}>
      {pattern ? (
        <div
          className={`shields-pattern-layer rounded-2xl ${pattern.className}`}
          style={{ color: pattern.color }}
          aria-hidden="true"
        />
      ) : null}
      {/* Positioned so the content always paints above the pattern layer. */}
      <div className="relative">
        <div className="min-h-0">{object}</div>
        {inspector}
        {portfolio ? (
          <div className="mt-3">
            <DataFreshnessIndicator
              lastUpdated={portfolio.lastUpdated}
              isStale={portfolio.isStale}
              hasEstimates={portfolio.hasEstimates}
              isDemo={portfolio.isDemo}
              isLoading={portfolio.isLoading}
              error={portfolio.errors?.[0] ?? null}
              onRefresh={onRefresh}
            />
          </div>
        ) : null}
        {status ? <div className="mt-3">{status}</div> : null}
      </div>
    </div>
  );
}

export default InstrumentShell;
