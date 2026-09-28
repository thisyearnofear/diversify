// @vitest-environment jsdom
/**
 * The small rules behind the "feel" pass: sheet dismiss thresholds,
 * query retry policy, and haptics routing to a native host.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { shouldDismissDrag } from "@/components/shared/InspectorSheet";
import { retryDelayMs, shouldRetryQuery } from "@/lib/query-client";
import { haptic, registerHapticHost } from "@/lib/haptics";

describe("shouldDismissDrag", () => {
  it("dismisses on distance or on a downward flick, not on a slow short drag", () => {
    expect(shouldDismissDrag({ offset: { x: 0, y: 90 }, velocity: { x: 0, y: 0 } })).toBe(true);
    expect(shouldDismissDrag({ offset: { x: 0, y: 20 }, velocity: { x: 0, y: 900 } })).toBe(true);
    expect(shouldDismissDrag({ offset: { x: 0, y: 30 }, velocity: { x: 0, y: 100 } })).toBe(false);
    // Flicking UP never dismisses.
    expect(shouldDismissDrag({ offset: { x: 0, y: -10 }, velocity: { x: 0, y: 900 } })).toBe(false);
  });
});

describe("query retry policy", () => {
  it("never retries 4xx, retries others at most twice", () => {
    expect(shouldRetryQuery(0, { status: 404 })).toBe(false);
    expect(shouldRetryQuery(0, { response: { status: 422 } })).toBe(false);
    expect(shouldRetryQuery(0, { status: 503 })).toBe(true);
    expect(shouldRetryQuery(1, new Error("network"))).toBe(true);
    expect(shouldRetryQuery(2, new Error("network"))).toBe(false);
  });

  it("backs off exponentially, capped at 8s", () => {
    expect(retryDelayMs(0)).toBe(1000);
    expect(retryDelayMs(2)).toBe(4000);
    expect(retryDelayMs(10)).toBe(8000);
  });
});

describe("haptics host routing", () => {
  afterEach(() => registerHapticHost(null));

  it("maps patterns onto the native host instead of navigator.vibrate", () => {
    const host = {
      impactOccurred: vi.fn(),
      notificationOccurred: vi.fn(),
      selectionChanged: vi.fn(),
    };
    const vibrate = vi.fn();
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
    registerHapticHost(host);

    haptic("light");
    haptic("medium");
    haptic("success");
    haptic("error");

    expect(host.selectionChanged).toHaveBeenCalledTimes(1);
    expect(host.impactOccurred).toHaveBeenCalledWith("medium");
    expect(host.notificationOccurred).toHaveBeenCalledWith("success");
    expect(host.notificationOccurred).toHaveBeenCalledWith("error");
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("falls back to vibrate with no host", () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
    haptic("success");
    expect(vibrate).toHaveBeenCalledWith([10, 50, 10]);
  });
});
