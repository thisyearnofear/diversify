import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { LensCoinSelector } from "../LensCoinSelector";

// Mutable drag flag — a click that ends a FlickScrollRow drag is not a
// choice. The hook is mocked with a STABLE shared ref: LensCoinButton is
// memoized, so a fresh ref per render would never reach it — the real
// hook also keeps one ref identity across renders.
const dragState = vi.hoisted(() => ({ ref: { current: false } }));
vi.mock("@/hooks/use-drag-to-scroll", () => ({
  useDragToScroll: () => ({
    containerRef: { current: null },
    containerProps: {},
    didDragRef: dragState.ref,
  }),
}));

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

vi.mock("@/lib/haptics", () => ({
  haptics: { tap: vi.fn(), confirm: vi.fn(), selection: vi.fn() },
}));

const lenses = [
  { id: "one", label: "One Lens", glyph: "◐", accent: "#123456" },
  { id: "two", label: "Two Lens", glyph: "◑", accent: "#234567" },
  { id: "three", label: "Three Lens", glyph: "◒", accent: "#345678" },
];

afterEach(() => {
  dragState.ref.current = false;
  cleanup();
});

describe("LensCoinSelector — scrollable row", () => {
  it("wraps the row in a FlickScrollRow when scrollable", () => {
    render(
      <LensCoinSelector
        lenses={lenses}
        selected={null}
        onSelect={vi.fn()}
        scrollable
      />,
    );
    const flick = screen.getByTestId("flick-row");
    expect(flick).toBeInTheDocument();
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    // Start-aligned, not centred — the overflow is the point.
    expect(screen.getByRole("radiogroup").className).toContain("justify-start");
  });

  it("keeps the centred, unwrapped row by default", () => {
    render(
      <LensCoinSelector lenses={lenses} selected={null} onSelect={vi.fn()} />,
    );
    expect(screen.queryByTestId("flick-row")).not.toBeInTheDocument();
    expect(screen.getByRole("radiogroup").className).toContain("justify-center");
  });

  it("a tap selects the coin — a drag release does not", () => {
    const onSelect = vi.fn();
    render(
      <LensCoinSelector
        lenses={lenses}
        selected={null}
        onSelect={onSelect}
        scrollable
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "Two Lens" }));
    expect(onSelect).toHaveBeenCalledWith("two");
    onSelect.mockClear();

    // A click that ends a drag is not a choice — the ref flips at
    // click-time, same as a real pointer drag.
    dragState.ref.current = true;
    fireEvent.click(screen.getByRole("radio", { name: "Three Lens" }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("reports the tapped coin's centre via onTapPoint", () => {
    const onTapPoint = vi.fn();
    render(
      <LensCoinSelector
        lenses={lenses}
        selected={null}
        onSelect={vi.fn()}
        scrollable
        onTapPoint={onTapPoint}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "One Lens" }));
    expect(onTapPoint).toHaveBeenCalledWith(expect.any(Number), expect.any(Number));
  });
});
