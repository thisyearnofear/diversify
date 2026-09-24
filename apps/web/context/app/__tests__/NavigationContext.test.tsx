/**
 * NavigationContext — cross-tab hand-offs ride one intent carrier.
 *
 * `navigateToCompare()`/`navigateToNetting()` are one-call/one-artefact
 * hand-offs like `navigateToSwap`: they switch the dock and leave a
 * `pendingIntent` with `lens` the target surface consumes exactly once.
 * `lastSettlement` is the same transient shape for the Home seal. These
 * tests pin the tab switch, the intent payload, prefill clearing,
 * consume-once semantics, and that none of it is persisted.
 */

// @vitest-environment jsdom

import React from "react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";

import { NavigationProvider, useNavigation } from "../NavigationContext";
import type { NavigationState } from "../types";

let seen: (ReturnType<typeof useNavigation> & NavigationState) | null = null;

function Probe() {
  const nav = useNavigation();
  React.useEffect(() => {
    seen = nav;
  });
  return null;
}

beforeEach(() => {
  seen = null;
  window.localStorage.clear();
  window.history.replaceState({}, "", "/");
});

describe("NavigationContext — lens deep links", () => {
  it("navigateToCompare switches to Shield with a compare-lens intent", () => {
    render(
      <NavigationProvider>
        <Probe />
      </NavigationProvider>,
    );

    act(() => {
      seen!.navigateToSwap({
        fromToken: "cUSD",
        toToken: "cEUR",
        reason: "test",
      });
    });
    expect(seen!.activeTab).toBe("exchange");

    act(() => {
      seen!.navigateToCompare();
    });

    expect(seen!.activeTab).toBe("protect");
    expect(seen!.pendingIntent).toEqual({
      tab: "protect",
      intent: { source: "home", lens: "compare" },
    });
    // A compare hand-off is not a swap — any queued prefill is dropped.
    expect(seen!.swapPrefill).toBeNull();
  });

  it("navigateToNetting switches to Exchange with a netting-lens intent", () => {
    render(
      <NavigationProvider>
        <Probe />
      </NavigationProvider>,
    );

    act(() => {
      seen!.navigateToNetting("guardian");
    });

    expect(seen!.activeTab).toBe("exchange");
    expect(seen!.pendingIntent).toEqual({
      tab: "exchange",
      intent: { source: "guardian", lens: "netting" },
    });
    expect(seen!.swapPrefill).toBeNull();
  });

  it("does not persist the lens — a reload cannot resurrect the mode", () => {
    render(
      <NavigationProvider>
        <Probe />
      </NavigationProvider>,
    );

    act(() => {
      seen!.navigateToCompare();
      seen!.navigateToNetting();
    });

    for (const [key, value] of Object.entries(window.localStorage)) {
      expect(value, `localStorage["${key}"]`).not.toContain("lens");
      expect(value, `localStorage["${key}"]`).not.toContain("compare");
      expect(value, `localStorage["${key}"]`).not.toContain("netting");
    }
  });
});

describe("NavigationContext — lastSettlement", () => {
  it("recordSettlement stores it and consumeSettlement clears it once", () => {
    render(
      <NavigationProvider>
        <Probe />
      </NavigationProvider>,
    );

    act(() => {
      seen!.recordSettlement({ toToken: "KESm", settledAt: 1234 });
    });
    expect(seen!.lastSettlement).toEqual({ toToken: "KESm", settledAt: 1234 });

    act(() => {
      seen!.consumeSettlement();
    });
    expect(seen!.lastSettlement).toBeNull();
  });

  it("never persists the settlement — a reload cannot resurrect the seal", () => {
    render(
      <NavigationProvider>
        <Probe />
      </NavigationProvider>,
    );

    act(() => {
      seen!.recordSettlement({ toToken: "KESm", settledAt: 1234 });
    });

    for (const [key, value] of Object.entries(window.localStorage)) {
      expect(value, `localStorage["${key}"]`).not.toContain("lastSettlement");
      expect(value, `localStorage["${key}"]`).not.toContain("KESm");
      expect(key).not.toBe("lastSettlement");
    }
  });
});

describe("NavigationContext — navigateWithIntent", () => {
  it("switches the tab, stamps visitedTabs, and carries the intent", () => {
    render(
      <NavigationProvider>
        <Probe />
      </NavigationProvider>,
    );

    act(() => {
      seen!.navigateToSwap({
        fromToken: "cUSD",
        toToken: "cEUR",
        reason: "test",
      });
    });
    act(() => {
      seen!.navigateWithIntent("protect", { source: "home", region: "Africa" });
    });

    expect(seen!.activeTab).toBe("protect");
    expect(seen!.visitedTabs).toContain("protect");
    expect(seen!.pendingIntent).toEqual({
      tab: "protect",
      intent: { source: "home", region: "Africa" },
    });
    // An intent hand-off is not a swap — any queued prefill is dropped.
    expect(seen!.swapPrefill).toBeNull();
  });

  it("consumeIntent clears the pending hand-off once", () => {
    render(
      <NavigationProvider>
        <Probe />
      </NavigationProvider>,
    );

    act(() => {
      seen!.navigateWithIntent("protect", { source: "home", region: "Africa" });
    });
    expect(seen!.pendingIntent).not.toBeNull();

    act(() => {
      seen!.consumeIntent();
    });
    expect(seen!.pendingIntent).toBeNull();
    expect(seen!.activeTab).toBe("protect");
  });

  it("never persists the intent — a reload cannot resurrect it", () => {
    render(
      <NavigationProvider>
        <Probe />
      </NavigationProvider>,
    );

    act(() => {
      seen!.navigateWithIntent("protect", { source: "home", region: "Africa" });
    });

    for (const [key, value] of Object.entries(window.localStorage)) {
      expect(value, `localStorage["${key}"]`).not.toContain("pendingIntent");
      expect(value, `localStorage["${key}"]`).not.toContain("Africa");
      expect(key).not.toBe("pendingIntent");
    }
  });
});

describe("NavigationContext — ?tab= doorway", () => {
  afterEach(() => {
    cleanup();
    window.history.replaceState({}, "", "/");
  });

  it("?tab= wins over the saved tab on mount — the /rwa-vaults doorway contract", () => {
    window.localStorage.setItem("activeTab", "exchange");
    window.history.replaceState({}, "", "/?tab=protect&sleeve=rwa&serv=1");

    render(
      <NavigationProvider>
        <Probe />
      </NavigationProvider>,
    );

    expect(seen!.activeTab).toBe("protect");
  });

  it("?tab=exchange lands on Exchange — the shared-pair doorway", () => {
    window.localStorage.setItem("activeTab", "protect");
    window.history.replaceState({}, "", "/?tab=exchange&from=NGNm&to=USDm");

    render(
      <NavigationProvider>
        <Probe />
      </NavigationProvider>,
    );

    expect(seen!.activeTab).toBe("exchange");
  });

  it("an unknown ?tab= falls back to the saved tab", () => {
    window.localStorage.setItem("activeTab", "exchange");
    window.history.replaceState({}, "", "/?tab=bogus");

    render(
      <NavigationProvider>
        <Probe />
      </NavigationProvider>,
    );

    expect(seen!.activeTab).toBe("exchange");
  });
});
