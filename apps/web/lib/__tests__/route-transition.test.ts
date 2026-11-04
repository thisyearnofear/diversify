/**
 * @vitest-environment jsdom
 *
 * The route seam is decoration around a push: it must never be the reason a
 * navigation doesn't happen, and a browser without the API (or a user who
 * asked for less motion) must get a plain push. These pin both.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { canTransitionRoutes, pushWithRouteTransition } from "../route-transition";

const ATTR = "data-dfi-route-transition";

function fakeDocumentWith(startViewTransition?: (cb: () => unknown) => { finished: Promise<void> }) {
  return { startViewTransition } as unknown as Document;
}

afterEach(() => {
  delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
  document.documentElement.removeAttribute(ATTR);
});

describe("canTransitionRoutes", () => {
  it("is false without the API and true with it", () => {
    expect(canTransitionRoutes(fakeDocumentWith())).toBe(false);
    expect(
      canTransitionRoutes(fakeDocumentWith(() => ({ finished: Promise.resolve() }))),
    ).toBe(true);
  });
});

describe("pushWithRouteTransition", () => {
  it("falls back to a plain push when the browser has no View Transitions", () => {
    const router = { push: vi.fn(() => Promise.resolve(true)) };
    pushWithRouteTransition(router, "/currency/NGN");
    expect(router.push).toHaveBeenCalledWith("/currency/NGN");
  });

  it("skips the transition when motion is not allowed, and still navigates", () => {
    const startViewTransition = vi.fn(() => ({ finished: Promise.resolve() }));
    (document as unknown as { startViewTransition?: unknown }).startViewTransition =
      startViewTransition;
    const router = { push: vi.fn(() => Promise.resolve(true)) };

    pushWithRouteTransition(router, "/currency/NGN", { skip: true });

    expect(startViewTransition).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith("/currency/NGN");
  });

  it("pushes inside the update callback and clears the in-flight marker", async () => {
    let release!: () => void;
    const finished = new Promise<void>((resolve) => {
      release = resolve;
    });
    const startViewTransition = vi.fn((cb: () => unknown) => {
      cb();
      return { finished };
    });
    (document as unknown as { startViewTransition?: unknown }).startViewTransition =
      startViewTransition;
    const router = { push: vi.fn(() => Promise.resolve(true)) };

    pushWithRouteTransition(router, "/currency/NGN");

    expect(startViewTransition).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/currency/NGN");
    expect(document.documentElement.hasAttribute(ATTR)).toBe(true);

    release();
    await finished;
    await Promise.resolve();
    expect(document.documentElement.hasAttribute(ATTR)).toBe(false);
  });

  it("does not start a second transition while one is in flight", () => {
    const startViewTransition = vi.fn((cb: () => unknown) => {
      cb();
      return {
        finished: new Promise<void>(() => {
          /* never settles — the first transition is still running */
        }),
      };
    });
    (document as unknown as { startViewTransition?: unknown }).startViewTransition =
      startViewTransition;
    const router = { push: vi.fn(() => Promise.resolve(true)) };

    pushWithRouteTransition(router, "/currency/NGN");
    pushWithRouteTransition(router, "/currency/KES");

    expect(startViewTransition).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenNthCalledWith(2, "/currency/KES");
  });
});
