/**
 * useDismissibleLayer — sheets, pickers and drawers close the way the
 * platform says they should:
 *
 * - Escape closes the TOPMOST open layer only (nested sheets unwind one at a
 *   time instead of all at once).
 * - The browser/Android back gesture closes the topmost layer instead of
 *   leaving the tab. Opening a layer pushes one same-URL history entry;
 *   closing it any other way (×, scrim, drag) pops that entry again so
 *   history never accumulates phantom steps.
 *
 * History is shared with the Next.js pages router, which also listens to
 * popstate. We register `Router.beforePopState` so a back press that
 * belongs to a layer is consumed here and never reaches the router. Outside
 * a Next router (unit tests), a plain popstate listener is used instead.
 */
import { useEffect, useRef } from "react";
import Router from "next/router";

interface Layer {
  id: number;
  close: () => void;
  hasEntry: boolean;
}

const MARKER = "__diversifiLayer";
const stack: Layer[] = [];
/** Pops we triggered ourselves (UI close) that must be swallowed silently. */
let pendingSelfPops = 0;
let nextId = 1;
let installed = false;

function handlePop(state: unknown): boolean {
  // Returns true when the pop was ours (consumed), false to let it through.
  if (pendingSelfPops > 0) {
    pendingSelfPops -= 1;
    return true;
  }
  const top = stack[stack.length - 1];
  if (top && top.hasEntry) {
    top.hasEntry = false;
    stack.pop();
    top.close();
    return true;
  }
  // Forward into a stale layer entry (the layer is gone) — a no-op step.
  if (state && typeof state === "object" && MARKER in (state as object)) return true;
  return false;
}

function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  try {
    Router.beforePopState((state) => !handlePop(state));
  } catch {
    // No Next router instance (tests / isolated render): listen directly.
    window.addEventListener("popstate", (e) => {
      handlePop(e.state);
    });
  }
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || e.defaultPrevented) return;
    const top = stack[stack.length - 1];
    if (!top) return;
    e.preventDefault();
    top.close();
  });
}

export function useDismissibleLayer(
  open: boolean,
  onClose: () => void,
  { history = true }: { history?: boolean } = {},
): void {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    install();

    const layer: Layer = {
      id: nextId++,
      close: () => closeRef.current(),
      hasEntry: false,
    };
    if (history) {
      try {
        const base =
          window.history.state && typeof window.history.state === "object"
            ? window.history.state
            : {};
        window.history.pushState({ ...base, [MARKER]: layer.id }, "", window.location.href);
        layer.hasEntry = true;
      } catch {
        // History unavailable (sandboxed iframe) — Escape still works.
      }
    }
    stack.push(layer);

    return () => {
      const idx = stack.indexOf(layer);
      if (idx !== -1) stack.splice(idx, 1);
      // Closed by UI (not by back): remove the entry we pushed — but only if
      // we're still standing on it. If the layer unmounted because the app
      // navigated (router.push), going back would undo that navigation.
      if (layer.hasEntry) {
        layer.hasEntry = false;
        const state = window.history.state as Record<string, unknown> | null;
        if (state && state[MARKER] === layer.id) {
          pendingSelfPops += 1;
          window.history.back();
        }
      }
    };
  }, [open, history]);
}
