import { describe, expect, it, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useFirstUseCue } from "../use-first-use-cue";

const KEY = "dfi:cue:test-affordance";

describe("useFirstUseCue", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows the cue on first use", () => {
    const { result } = renderHook(() => useFirstUseCue("test-affordance"));
    expect(result.current.show).toBe(true);
  });

  it("hides after markSeen and persists across mounts", () => {
    const { result, unmount } = renderHook(() => useFirstUseCue("test-affordance"));
    act(() => result.current.markSeen());
    expect(result.current.show).toBe(false);
    expect(localStorage.getItem(KEY)).toBe("1");
    unmount();

    const remount = renderHook(() => useFirstUseCue("test-affordance"));
    expect(remount.result.current.show).toBe(false);
  });

  it("is namespaced per key", () => {
    localStorage.setItem(KEY, "1");
    const { result } = renderHook(() => useFirstUseCue("other-affordance"));
    expect(result.current.show).toBe(true);
  });
});
