import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import React from "react";

const mockTrack = vi.fn();
vi.mock("@/lib/analytics", () => ({
  trackFunnelEvent: (...args: unknown[]) => mockTrack(...args),
}));

import { useLensOffered } from "../use-lens-offered";

function Probe({
  offered,
  lens = "concentration",
}: {
  offered: boolean;
  lens?: string;
}) {
  useLensOffered("home", lens, offered);
  return null;
}

describe("useLensOffered", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });
  afterEach(() => cleanup());

  it("fires lens_offered once when offered flips true", () => {
    const { rerender } = render(<Probe offered={false} />);
    expect(mockTrack).not.toHaveBeenCalled();
    rerender(<Probe offered={true} />);
    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith("lens_offered", {
      tab: "home",
      lens: "concentration",
    });
  });

  it("does not re-fire on re-render or re-offer within the session", () => {
    const { rerender } = render(<Probe offered={true} />);
    rerender(<Probe offered={true} />);
    rerender(<Probe offered={false} />);
    rerender(<Probe offered={true} />);
    expect(mockTrack).toHaveBeenCalledTimes(1);
  });

  it("remembers across mounts via sessionStorage", () => {
    const first = render(<Probe offered={true} />);
    first.unmount();
    render(<Probe offered={true} />);
    expect(mockTrack).toHaveBeenCalledTimes(1);
  });

  it("never fires while offered is false", () => {
    render(<Probe offered={false} />);
    expect(mockTrack).not.toHaveBeenCalled();
  });

  it("falls back to an in-memory set when sessionStorage throws", () => {
    const spy = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("denied");
      });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    // A lens not yet offered this page-life — the in-memory set is the
    // durable record alongside sessionStorage.
    const { rerender } = render(<Probe offered={true} lens="fallback-lens" />);
    rerender(<Probe offered={true} lens="fallback-lens" />);
    expect(mockTrack).toHaveBeenCalledTimes(1);
    spy.mockRestore();
    vi.restoreAllMocks();
  });
});
