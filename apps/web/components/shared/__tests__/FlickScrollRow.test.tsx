import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";

import FlickScrollRow, { useDidDrag } from "../FlickScrollRow";

describe("FlickScrollRow — the sanctioned horizontal row", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the track with proximity snap + hidden scrollbar and slotted children", () => {
    render(
      <FlickScrollRow className="gap-2">
        <span>alpha</span>
        <span>beta</span>
      </FlickScrollRow>,
    );
    const track = screen.getByTestId("flick-row-track");
    expect(track.className).toContain("snap-proximity");
    expect(track.className).toContain("scrollbar-hide");
    expect(track.className).toContain("gap-2");
    expect(track).toHaveTextContent("alpha");
    expect(track).toHaveTextContent("beta");
  });

  it("chevrons can be disabled; fades match the requested surface", () => {
    render(
      <FlickScrollRow fade="slate" chevrons={false} className="gap-1">
        <span>x</span>
      </FlickScrollRow>,
    );
    expect(screen.queryByTestId("flick-row-prev")).not.toBeInTheDocument();
    expect(screen.queryByTestId("flick-row-next")).not.toBeInTheDocument();
    const left = screen.getByTestId("flick-row-fade-left");
    expect(left.className).toContain("from-slate-900/90");
  });

  it("useDidDrag outside a row returns a never-dragged ref (children stay usable standalone)", () => {
    // Array collector: TS control-flow analysis narrows a closure-assigned
    // `let` to its initializer (null), so property access on it is `never`.
    const refs: Array<React.MutableRefObject<boolean>> = [];
    function Probe() {
      refs.push(useDidDrag());
      return null;
    }
    render(<Probe />);
    expect(refs[0]).toBeDefined();
    expect(refs[0].current).toBe(false);
    refs[0].current = true; // must be writable — it backs the drag guard
    expect(refs[0].current).toBe(true);
  });

  it("pointer drag on the track does not throw and sets the drag guard", () => {
    // Array collector (see the standalone-ref test above for why).
    const refs: Array<React.MutableRefObject<boolean>> = [];
    function Row() {
      return (
        <FlickScrollRow className="gap-2">
          <GuardProbe setRef={(r) => refs.push(r)} />
        </FlickScrollRow>
      );
    }
    function GuardProbe({ setRef }: { setRef: (r: React.MutableRefObject<boolean>) => void }) {
      setRef(useDidDrag());
      return <button type="button">chip</button>;
    }
    render(<Row />);
    const track = screen.getByTestId("flick-row-track");
    fireEvent.pointerDown(track, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 100 });
    fireEvent.pointerMove(track, { pointerId: 1, pointerType: "mouse", clientX: 60 });
    fireEvent.pointerUp(track, { pointerId: 1, pointerType: "mouse", clientX: 60 });
    expect(refs[0]?.current).toBe(true);
  });
});
