/**
 * Privy facade logout — the not-ready api must be real: it delegates through
 * ensureReady (which rejects when the host can't mount), clears the local
 * session hints so a stale token can't resurrect auth on next load, and still
 * reports the failure to the caller.
 */
// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePrivy, hasPrivySessionHint } from "../PrivyProvider";

beforeEach(() => {
  localStorage.clear();
});

describe("Privy not-ready logout", () => {
  it("rejects honestly and clears every local hint", async () => {
    localStorage.setItem("privy:token", "stale");
    localStorage.setItem("privy:refresh_token", "stale2");
    localStorage.setItem(
      "diversifi-wallet-preference",
      JSON.stringify({ type: "privy" }),
    );
    expect(hasPrivySessionHint()).toBe(true);

    const { result } = renderHook(() => usePrivy());
    await expect(result.current.logout()).rejects.toThrow(
      "Social login is not available right now",
    );

    expect(hasPrivySessionHint()).toBe(false);
    expect(localStorage.getItem("privy:token")).toBeNull();
    expect(localStorage.getItem("privy:refresh_token")).toBeNull();
    expect(localStorage.getItem("diversifi-wallet-preference")).toBeNull();
  });

  it("leaves a non-privy preference alone", async () => {
    localStorage.setItem(
      "diversifi-wallet-preference",
      JSON.stringify({ type: "external" }),
    );
    const { result } = renderHook(() => usePrivy());
    await expect(result.current.logout()).rejects.toThrow();
    expect(localStorage.getItem("diversifi-wallet-preference")).not.toBeNull();
  });
});
