/**
 * Tab chunk loaders + preloading.
 *
 * Each dock tab is its own chunk (next/dynamic, ssr:false). Calling a
 * loader early just fetches and evaluates the chunk; next/dynamic reuses
 * the resolved module when the tab actually mounts, so there is no
 * InstrumentWait beat on a preloaded tab.
 *
 * - `preloadNeighbourTabs` — on idle, warm the tabs either side of the
 *   active one in dock order (the likely next swipe/tap).
 * - `preloadTab` — on pointer-down/hover of a dock item (intent signal).
 */
import type { TabId } from "@/constants/tabs";

export const TAB_LOADERS = {
  overview: () => import("@/components/tabs/OverviewTab"),
  protect: () => import("@/components/tabs/ProtectionTab"),
  exchange: () => import("@/components/tabs/ExchangeTab"),
  agent: () => import("@/components/tabs/AgentTab"),
} satisfies Record<TabId, () => Promise<unknown>>;

const requested = new Set<TabId>();

export function preloadTab(id: TabId): void {
  if (process.env.NODE_ENV === "test") return;
  if (requested.has(id)) return;
  requested.add(id);
  TAB_LOADERS[id]().catch(() => {
    // A failed warm-up is harmless — the real mount retries and shows its
    // own error boundary. Forget it so the next intent can try again.
    requested.delete(id);
  });
}

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

/** Returns a cleanup that cancels a not-yet-run preload. */
export function preloadNeighbourTabs(
  activeTab: TabId,
  tabOrder: readonly TabId[],
): () => void {
  if (typeof window === "undefined") return () => {};
  // Suites mount the router with mocked tabs — never pull real chunks there.
  if (process.env.NODE_ENV === "test") return () => {};
  // Data-saver users opted out of speculative downloads.
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } })
    .connection;
  if (conn?.saveData) return () => {};

  const idx = tabOrder.indexOf(activeTab);
  if (idx === -1) return () => {};
  const neighbours = [tabOrder[idx - 1], tabOrder[idx + 1]].filter(
    (t): t is TabId => Boolean(t) && !requested.has(t as TabId),
  );
  if (neighbours.length === 0) return () => {};

  const run = () => neighbours.forEach(preloadTab);
  const w = window as IdleWindow;
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(run, { timeout: 3000 });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(run, 1200);
  return () => window.clearTimeout(id);
}
