/**
 * NavigationContext — Wave 18 Home → Shield compare deep link.
 *
 * `navigateToCompare()` is a one-call/one-artefact hand-off like
 * `navigateToSwap`: it switches the dock to Shield and raises a transient
 * `compareRequested` flag the Shield surface consumes exactly once
 * (same lifecycle as `focusedCycleId`). These tests pin:
 *  1. the tab switch + flag raise + swap-prefill clearing,
 *  2. `consumeCompareRequest` clearing the flag,
 *  3. the flag NOT being persisted to localStorage.
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

describe("NavigationContext — compare deep link", () => {
  it("navigateToCompare switches to Shield and raises the transient flag", () => {
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
    expect(seen!.compareRequested).toBe(true);
    // A compare hand-off is not a swap — any queued prefill is dropped.
    expect(seen!.swapPrefill).toBeNull();
  });

  it("consumeCompareRequest clears the flag once", () => {
    render(
      <NavigationProvider>
        <Probe />
      </NavigationProvider>,
    );

    act(() => {
      seen!.navigateToCompare();
    });
    expect(seen!.compareRequested).toBe(true);

    act(() => {
      seen!.consumeCompareRequest();
    });
    expect(seen!.compareRequested).toBe(false);
    // The tab stays — consuming the hint is not navigation.
    expect(seen!.activeTab).toBe("protect");
  });

  it("does not persist compareRequested — a reload cannot resurrect compare mode", () => {
    render(
      <NavigationProvider>
        <Probe />
      </NavigationProvider>,
    );

    act(() => {
      seen!.navigateToCompare();
    });

    for (const [key, value] of Object.entries(window.localStorage)) {
      expect(value, `localStorage["${key}"]`).not.toContain("compareRequested");
      expect(key).not.toBe("compareRequested");
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
