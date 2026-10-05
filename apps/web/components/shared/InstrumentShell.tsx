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

import React, {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { springSoft } from "@/lib/motion-tokens";
import { DataFreshnessIndicator } from "./DataFreshnessIndicator";

const InstrumentInspectionContext = createContext(false);

export function useInstrumentInspection(): boolean {
  return useContext(InstrumentInspectionContext);
}

type InspectorPlacement = "side" | "fold";

const InstrumentInspectorPlacementContext = createContext<InspectorPlacement>("fold");

export function useInstrumentInspectorPlacement(): InspectorPlacement {
  return useContext(InstrumentInspectorPlacementContext);
}

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

export interface ShellIdentity {
  /** The chosen philosophy's pattern — the default for every shell. */
  pattern: { className: string; color: string } | null;
  /** The chosen philosophy's accent — the shell's top edge. */
  accent: string | null;
}

/**
 * The world the user chose in onboarding, carried into every instrument.
 * AppShell provides it from the selected philosophy; a shell's own
 * `pattern` prop still wins (`null` opts out).
 */
export const ShellIdentityContext = React.createContext<ShellIdentity>({
  pattern: null,
  accent: null,
});

interface InstrumentShellProps {
  /** The manipulable object — ring, dial, ticket, picker. */
  object: React.ReactNode;
  /** Selection-bound inspector. Render `InspectorSheet`; closed when idle. */
  inspector?: React.ReactNode;
  inspectorOpen?: boolean;
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
  pattern: patternProp,
  inspectorOpen = false,
  className = "",
}: InstrumentShellProps) {
  const reducedMotion = useReducedMotion();
  const identity = React.useContext(ShellIdentityContext);
  const pattern = patternProp === undefined ? identity.pattern : patternProp;
  const layoutGroupId = React.useId();
  const shellRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<InspectorPlacement>("fold");

  useLayoutEffect(() => {
    const el = shellRef.current;
    if (typeof window === "undefined" || !el) return;
    const mql =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(min-width: 1024px)")
        : null;
    const measure = () => {
      const cs = window.getComputedStyle(el);
      const contentWidth = Math.max(
        0,
        el.getBoundingClientRect().width -
          (parseFloat(cs.paddingLeft) || 0) -
          (parseFloat(cs.paddingRight) || 0) -
          (parseFloat(cs.borderLeftWidth) || 0) -
          (parseFloat(cs.borderRightWidth) || 0),
      );
      const next: InspectorPlacement =
        contentWidth >= 720 && (mql?.matches ?? false) ? "side" : "fold";
      setPlacement((prev) => (prev === next ? prev : next));
    };
    measure();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(measure);
      ro.observe(el);
    } else {
      window.addEventListener("resize", measure);
    }
    mql?.addEventListener?.("change", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
      mql?.removeEventListener?.("change", measure);
    };
  }, []);

  const layoutProps = {
    layout: reducedMotion ? false : ("position" as const),
    transition: {
      layout: reducedMotion ? { duration: 0 } : springSoft,
    },
  };

  return (
    <InstrumentInspectionContext.Provider value={inspectorOpen}>
      <InstrumentInspectorPlacementContext.Provider value={placement}>
        <div
          ref={shellRef}
          className={`instrument-shell relative ${SURFACE} ${className}`.trim()}
          data-inspector-open={inspectorOpen ? "true" : "false"}
          style={identity.accent ? { borderTopColor: identity.accent, borderTopWidth: 3 } : undefined}
        >
          {pattern ? (
            <div
              className={`shields-pattern-layer rounded-2xl ${pattern.className}`}
              style={{ color: pattern.color }}
              aria-hidden="true"
            />
          ) : null}
          {/* Positioned so the content always paints above the pattern layer. */}
          <LayoutGroup id={layoutGroupId}>
            <div
              className="instrument-workbench relative"
              data-inspector-open={inspectorOpen ? "true" : "false"}
            >
              <motion.div {...layoutProps} className="instrument-object min-h-0">{object}</motion.div>
              {inspector ? (
                <motion.div {...layoutProps} className="instrument-inspector">{inspector}</motion.div>
              ) : null}
              <motion.div {...layoutProps} className="instrument-status mt-auto">
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
              </motion.div>
            </div>
          </LayoutGroup>
        </div>
      </InstrumentInspectorPlacementContext.Provider>
    </InstrumentInspectionContext.Provider>
  );
}

export default InstrumentShell;
