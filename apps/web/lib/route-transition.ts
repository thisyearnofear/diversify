/**
 * route-transition — the seam between linked surfaces.
 *
 * Every in-app surface that opens from a link is a separate route, and a
 * route change in the pages router is a hard cut: the new document paints
 * with nothing carrying over. The View Transitions API lets the browser
 * snapshot the old page, run the navigation, and crossfade the two, which
 * is exactly the seam we want and costs nothing when unsupported.
 *
 * Rules:
 *  - Unsupported browser, reduced motion, or a metered/slow device → plain
 *    `router.push`. This is a visual nicety; it never gates navigation.
 *  - One transition at a time. A second tap while one is in flight is just
 *    a push (capturing a second snapshot mid-fade is what produces jumps).
 *  - The push happens *inside* the update callback, and we return its
 *    promise: the browser waits for the new route to commit before it
 *    reveals the new snapshot. Timing lives in `styles/globals.css`
 *    (dfi-route-*) and mirrors `duration.fast` / `duration.base` in
 *    `lib/motion-tokens.ts`.
 */

import { useCallback } from "react";
import { useRouter } from "next/router";
import { useMotionBudget } from "@/hooks/use-motion-budget";

/** Marks the document while a route transition is capturing/running. */
const IN_FLIGHT_ATTR = "data-dfi-route-transition";

interface ViewTransitionLike {
  finished: Promise<void>;
}

/** Optional on purpose: jsdom and older browsers simply don't have it. */
interface ViewTransitionCapable {
  startViewTransition?: (callback: () => void | Promise<unknown>) => ViewTransitionLike;
}

function viewTransitionDocument(
  doc: Document | undefined,
): (Document & ViewTransitionCapable) | undefined {
  return doc as unknown as Document & ViewTransitionCapable;
}

/** Exported for tests: does this document support the API at all? */
export function canTransitionRoutes(
  doc: Document | undefined = typeof document === "undefined" ? undefined : document,
): boolean {
  return typeof viewTransitionDocument(doc)?.startViewTransition === "function";
}

export interface PushLike {
  push: (href: string) => Promise<boolean> | void;
}

/**
 * Push a route inside a view transition when the environment allows one.
 * Always navigates — the transition is decoration around the push.
 */
export function pushWithRouteTransition(
  router: PushLike,
  href: string,
  { skip = false }: { skip?: boolean } = {},
): void {
  const doc = viewTransitionDocument(
    typeof document === "undefined" ? undefined : document,
  );

  if (skip || !doc?.startViewTransition) {
    void router.push(href);
    return;
  }
  const root = doc.documentElement;
  if (root.hasAttribute(IN_FLIGHT_ATTR)) {
    void router.push(href);
    return;
  }

  root.setAttribute(IN_FLIGHT_ATTR, "");
  const done = () => root.removeAttribute(IN_FLIGHT_ATTR);
  try {
    const transition = doc.startViewTransition(() => {
      const navigation = router.push(href);
      return navigation instanceof Promise ? navigation : undefined;
    });
    // `finished` rejects when the transition is skipped or interrupted —
    // the attribute must clear either way or every later tap degrades.
    transition.finished.then(done, done);
  } catch {
    done();
    void router.push(href);
  }
}

/**
 * `navigate(href)` — a route push that crossfades when this device should
 * see motion. Components use this instead of `router.push` directly; the
 * reduced-motion and device-cost decisions stay in one place.
 */
export function useRouteTransition() {
  const router = useRouter();
  const budget = useMotionBudget();
  const navigate = useCallback(
    (href: string) => pushWithRouteTransition(router, href, { skip: !budget.motion }),
    [router, budget.motion],
  );
  return { navigate };
}
