import { afterEach, describe, expect, it, vi } from "vitest";
import {
  HANDOFF_TTL_MS,
  clearHandoff,
  peekHandoff,
  stashHandoff,
} from "../protagonist-anchor";

const coin = { from: { x: 10, y: 20, size: 32 }, symbol: "A", color: "#10b981" };

describe("onboarding → shell coin handoff", () => {
  afterEach(() => {
    clearHandoff();
    vi.useRealTimers();
  });

  it("is empty until onboarding stashes the chosen coin", () => {
    expect(peekHandoff()).toBeNull();
    stashHandoff(coin);
    expect(peekHandoff()).toMatchObject(coin);
  });

  it("survives a peek (StrictMode remount) and clears once launched", () => {
    stashHandoff(coin);
    peekHandoff();
    expect(peekHandoff()).not.toBeNull();
    clearHandoff();
    expect(peekHandoff()).toBeNull();
  });

  it("expires if the shell never picks it up", () => {
    vi.useFakeTimers();
    stashHandoff(coin);
    vi.advanceTimersByTime(HANDOFF_TTL_MS + 1);
    expect(peekHandoff()).toBeNull();
  });
});
