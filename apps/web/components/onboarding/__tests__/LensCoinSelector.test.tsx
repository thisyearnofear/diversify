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

const motionSpy = vi.hoisted(() => ({
  recorded: [] as { tag: string; props: Record<string, unknown> }[],
}));
vi.mock("framer-motion", async (importOriginal) => {
  const mod = await importOriginal<typeof import("framer-motion")>();
  const ReactMod = await import("react");
  const cache = new Map<string, unknown>();
  const wrap = (Comp: unknown, tag: string) => {
    if (!cache.has(tag)) {
      cache.set(
        tag,
        ReactMod.forwardRef((props: Record<string, unknown>, ref: unknown) => {
          motionSpy.recorded.push({ tag, props });
          return ReactMod.createElement(
            Comp as never,
            { ...props, ref } as never,
            props.children as never,
          );
        }),
      );
    }
    return cache.get(tag);
  };
  return {
    ...mod,
    motion: new Proxy(mod.motion, {
      get: (target: typeof mod.motion, tag: string | symbol) =>
        wrap((target as unknown as Record<string | symbol, unknown>)[tag], String(tag)),
    }),
  };
});

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

describe("LensCoinSelector — alive=false (acting rail)", () => {
  it("renders the same selection state statically — no pulse, no turntable", () => {
    motionSpy.recorded = [];
    const { container } = render(
      <LensCoinSelector
        lenses={lenses}
        selected="two"
        onSelect={vi.fn()}
        alive={false}
      />,
    );
    const selected = screen.getByRole("radio", { name: "Two Lens" });
    expect(selected).toHaveAttribute("aria-checked", "true");
    expect(container.querySelector(".lens-coin-active")).not.toBeNull();
    expect(container.querySelector(".lens-coin-pulse")).toBeNull();
    expect(container.querySelector(".coin-shine, .coin-shine-once")).toBeNull();

    const selectedBtn = screen.getByRole("radio", { name: "Two Lens" });
    const rec = motionSpy.recorded.find((r) => r.props["aria-label"] === "Two Lens");
    expect(rec?.tag).toBe("button");
    expect(rec?.props.whileHover).toBeUndefined();
    expect(rec?.props.whileTap).toEqual({ scale: 0.97 });
    const coinSpanRec = motionSpy.recorded
      .filter((r) => r.tag === "span")
      .find((r) => String(r.props.className ?? "").includes("lens-coin-active"));
    expect(coinSpanRec?.props.initial).toBe(false);
    const animate = coinSpanRec?.props.animate as Record<string, unknown>;
    expect(Array.isArray(animate.rotateY)).toBe(false);
    expect(Array.isArray(animate.y)).toBe(false);
    expect(animate.scale).toBe(1.15);
    void selectedBtn;
  });

  it("keeps turntable/hover motion when alive (default)", () => {
    motionSpy.recorded = [];
    render(<LensCoinSelector lenses={lenses} selected="two" onSelect={vi.fn()} />);
    const rec = motionSpy.recorded.find((r) => r.props["aria-label"] === "One Lens");
    expect(rec?.props.whileHover).toEqual({ scale: 1.1, y: -3 });
    expect(rec?.props.whileTap).toEqual({ scale: 0.97 });
    const activeCoin = motionSpy.recorded
      .filter((r) => r.tag === "span")
      .find((r) => String(r.props.className ?? "").includes("lens-coin-pulse"));
    expect(activeCoin).toBeTruthy();
    expect(Array.isArray((activeCoin!.props.animate as { rotateY: unknown }).rotateY)).toBe(true);
  });

  it("still selects on tap", () => {
    const onSelect = vi.fn();
    render(
      <LensCoinSelector
        lenses={lenses}
        selected={null}
        onSelect={onSelect}
        alive={false}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "Three Lens" }));
    expect(onSelect).toHaveBeenCalledWith("three");
  });
});
