import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import {
  InstrumentShell,
  useInstrumentInspection,
  useInstrumentInspectorPlacement,
} from "../InstrumentShell";
import { InspectorSheet, shouldDismissDrag } from "../InspectorSheet";

const motionMock = vi.hoisted(() => ({
  reduced: false,
  recorded: [] as { tag: string; props: Record<string, unknown> }[],
  layoutGroupIds: [] as (string | undefined)[],
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
          motionMock.recorded.push({ tag, props });
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
    useReducedMotion: () => motionMock.reduced,
    motion: new Proxy(mod.motion, {
      get: (target: typeof mod.motion, tag: string | symbol) =>
        wrap((target as unknown as Record<string | symbol, unknown>)[tag], String(tag)),
    }),
    LayoutGroup: (props: { id?: string; children?: React.ReactNode }) => {
      motionMock.layoutGroupIds.push(props.id);
      return ReactMod.createElement(mod.LayoutGroup, props);
    },
  };
});

function InspectionProbe() {
  const inspecting = useInstrumentInspection();
  return <span data-testid="inspecting">{String(inspecting)}</span>;
}

function PlacementProbe() {
  const placement = useInstrumentInspectorPlacement();
  return <span data-testid="placement">{placement}</span>;
}

class ROStub {
  static instances: ROStub[] = [];
  cb: () => void;
  constructor(cb: () => void) {
    this.cb = cb;
    ROStub.instances.push(this);
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

function mockViewport({
  desktop,
  width,
  padding = 0,
  border = 0,
}: {
  desktop: boolean;
  width: number;
  padding?: number;
  border?: number;
}) {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    width,
    height: 100,
    top: 0,
    left: 0,
    right: width,
    bottom: 100,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
  const realGetComputedStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((el: Element) => {
    const real = realGetComputedStyle(el);
    if ((el as HTMLElement).classList?.contains("instrument-shell")) {
      return {
        ...real,
        paddingLeft: `${padding}px`,
        paddingRight: `${padding}px`,
        borderLeftWidth: `${border}px`,
        borderRightWidth: `${border}px`,
      } as CSSStyleDeclaration;
    }
    return real;
  });
  const mediaListeners: (() => void)[] = [];
  const mql = {
    matches: desktop,
    media: "(min-width: 1024px)",
    addEventListener: (_: string, cb: () => void) => {
      mediaListeners.push(cb);
    },
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  };
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation(() => mql),
  });
  return {
    mql,
    fireMediaChange: () => mediaListeners.forEach((cb) => cb()),
  };
}

describe("InstrumentShell", () => {
  it("renders the object and optional status, not a feature list", () => {
    render(
      <InstrumentShell
        object={<div data-testid="object">ring</div>}
        status={<p data-testid="status">Guardian on</p>}
      />,
    );
    expect(screen.getByTestId("object")).toBeInTheDocument();
    expect(screen.getByTestId("status")).toBeInTheDocument();
    expect(screen.queryByTestId("inspector-sheet")).not.toBeInTheDocument();
  });

  it("owns the one surface — the same solid card for every tab and morph (design-language §1)", () => {
    const { container } = render(
      <InstrumentShell object={<div data-testid="object">ring</div>} />,
    );
    const shell = container.firstElementChild as HTMLElement;
    expect(shell.className).toContain("rounded-2xl");
    expect(shell.className).toContain("bg-white");
    expect(shell.className).toContain("border-gray-200");
    expect(shell.className).toContain("shadow-sm");
    expect(shell.className).toContain("dark:bg-gray-900");
  });

  it("uses the shared workbench classes for every resting instrument", () => {
    const { container } = render(
      <InstrumentShell object={<div data-testid="object">ring</div>} />,
    );
    const shell = container.firstElementChild as HTMLElement;
    expect(shell.className).toContain("instrument-shell");
    const workbench = shell.querySelector(".instrument-workbench") as HTMLElement;
    expect(workbench).not.toBeNull();
    expect(workbench.getAttribute("data-inspector-open")).toBe("false");
    expect(shell.querySelector(".instrument-object")).not.toBeNull();
    expect(shell.querySelector(".instrument-status")).not.toBeNull();
  });

  it("reserves no inspector slot while closed — and opens the workbench state on inspection", () => {
    const { container, rerender } = render(
      <InstrumentShell
        object={<div data-testid="object">ring</div>}
        inspector={<InspectorSheet selectedId={null} onClose={() => {}} title="PAXG"><p>detail</p></InspectorSheet>}
      />,
    );
    let shell = container.firstElementChild as HTMLElement;
    expect(screen.queryByTestId("inspector-sheet")).not.toBeInTheDocument();
    expect(
      (shell.querySelector(".instrument-workbench") as HTMLElement).getAttribute("data-inspector-open"),
    ).toBe("false");

    rerender(
      <InstrumentShell
        inspectorOpen
        object={<div data-testid="object">ring</div>}
        inspector={<InspectorSheet selectedId="PAXG" onClose={() => {}} title="PAXG"><p>detail</p></InspectorSheet>}
      />,
    );
    shell = container.firstElementChild as HTMLElement;
    expect(
      (shell.querySelector(".instrument-workbench") as HTMLElement).getAttribute("data-inspector-open"),
    ).toBe("true");
    expect(shell.querySelector(".instrument-inspector")).not.toBeNull();
  });

  it("exposes the inspection state to nested object components via context", () => {
    const { rerender } = render(
      <InstrumentShell object={<InspectionProbe />} />,
    );
    expect(screen.getByTestId("inspecting")).toHaveTextContent("false");

    rerender(<InstrumentShell inspectorOpen object={<InspectionProbe />} />);
    expect(screen.getByTestId("inspecting")).toHaveTextContent("true");
  });

  it("tints the surface with the archetype pattern INSIDE the card, content above it (design-language §1/§4)", () => {
    const { container } = render(
      <InstrumentShell
        object={<div data-testid="object">ring</div>}
        pattern={{ className: "shields-pattern--pan_caribbean", color: "#0ea5e9" }}
      />,
    );
    const shell = container.firstElementChild as HTMLElement;
    // The pattern layer is a child of the card itself — painting it as a
    // sibling under the opaque card (the old bug) made it invisible.
    const layer = shell.querySelector(".shields-pattern-layer") as HTMLElement;
    expect(layer).not.toBeNull();
    expect(layer.className).toContain("shields-pattern--pan_caribbean");
    expect(layer.style.color).toBe("rgb(14, 165, 233)");
    expect(layer.getAttribute("aria-hidden")).toBe("true");
    // Content wrapper comes after the layer and is positioned above it.
    const content = shell.lastElementChild as HTMLElement;
    expect(content.className).toContain("relative");
    expect(content.contains(screen.getByTestId("object"))).toBe(true);
  });

  it("renders no pattern layer when no archetype is selected", () => {
    const { container } = render(
      <InstrumentShell object={<div data-testid="object">ring</div>} />,
    );
    expect(container.querySelector(".shields-pattern-layer")).toBeNull();
  });
});

describe("InspectorSheet", () => {
  it("stays closed when selectedId is null", () => {
    render(
      <InspectorSheet selectedId={null} onClose={vi.fn()} title="Slice">
        <p>detail</p>
      </InspectorSheet>,
    );
    expect(screen.queryByTestId("inspector-sheet")).not.toBeInTheDocument();
    expect(screen.queryByText("detail")).not.toBeInTheDocument();
  });

  it("opens from a selection and closes via the button", () => {
    const onClose = vi.fn();
    render(
      <InspectorSheet selectedId="PAXG" onClose={onClose} title="PAXG">
        <p>Close the gold gap</p>
      </InspectorSheet>,
    );
    expect(screen.getByTestId("inspector-sheet")).toHaveAttribute(
      "data-selected-id",
      "PAXG",
    );
    expect(screen.getByText("Close the gold gap")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Close inspector"));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("InstrumentShell — inspector placement", () => {
  beforeEach(() => {
    ROStub.instances = [];
    Object.defineProperty(window, "ResizeObserver", {
      writable: true,
      configurable: true,
      value: ROStub,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (window as { matchMedia?: unknown }).matchMedia;
    delete (window as { ResizeObserver?: unknown }).ResizeObserver;
  });

  it("places the inspector beside the object when border-box 754 leaves 720 content", () => {
    mockViewport({ desktop: true, width: 754, padding: 16, border: 1 });
    render(<InstrumentShell object={<PlacementProbe />} inspectorOpen inspector={<span />} />);
    expect(screen.getByTestId("placement")).toHaveTextContent("side");
    expect(ROStub.instances).toHaveLength(1);
  });

  it("folds on desktop when border-box 753 leaves 719 content", () => {
    mockViewport({ desktop: true, width: 753, padding: 16, border: 1 });
    render(<InstrumentShell object={<PlacementProbe />} inspectorOpen inspector={<span />} />);
    expect(screen.getByTestId("placement")).toHaveTextContent("fold");
  });

  it("folds off-desktop even when the shell is wide", () => {
    mockViewport({ desktop: false, width: 900, padding: 16, border: 1 });
    render(<InstrumentShell object={<PlacementProbe />} inspectorOpen inspector={<span />} />);
    expect(screen.getByTestId("placement")).toHaveTextContent("fold");
  });

  it("responds to ResizeObserver and media-query changes", () => {
    const viewport = mockViewport({ desktop: true, width: 900 });
    render(<InstrumentShell object={<PlacementProbe />} inspectorOpen inspector={<span />} />);
    expect(screen.getByTestId("placement")).toHaveTextContent("side");

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 600, height: 100, top: 0, left: 0, right: 600, bottom: 100, x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect);
    act(() => ROStub.instances[0].cb());
    expect(screen.getByTestId("placement")).toHaveTextContent("fold");

    viewport.mql.matches = false;
    act(() => viewport.fireMediaChange());
    expect(screen.getByTestId("placement")).toHaveTextContent("fold");
  });

  it("falls back to the window resize listener when ResizeObserver is unavailable", () => {
    delete (window as { ResizeObserver?: unknown }).ResizeObserver;
    const viewport = mockViewport({ desktop: true, width: 900 });
    void viewport;
    render(<InstrumentShell object={<PlacementProbe />} inspectorOpen inspector={<span />} />);
    expect(screen.getByTestId("placement")).toHaveTextContent("side");
    expect(ROStub.instances).toHaveLength(0);

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 600, height: 100, top: 0, left: 0, right: 600, bottom: 100, x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect);
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(screen.getByTestId("placement")).toHaveTextContent("fold");
  });

  it("defaults to fold outside a shell", () => {
    render(<PlacementProbe />);
    expect(screen.getByTestId("placement")).toHaveTextContent("fold");
  });
});

describe("InspectorSheet — focus restoration", () => {
  beforeEach(() => {
    motionMock.reduced = true;
  });

  afterEach(() => {
    motionMock.reduced = false;
  });

  function Harness() {
    const [sel, setSel] = React.useState<string | null>(null);
    return (
      <>
        <button data-testid="trigger" onClick={() => setSel("PAXG")}>
          Open
        </button>
        <button data-testid="elsewhere">Elsewhere</button>
        <InspectorSheet selectedId={sel} onClose={() => setSel(null)} title="PAXG">
          <p>detail</p>
        </InspectorSheet>
      </>
    );
  }

  it("never steals focus into the region on open", async () => {
    render(<Harness />);
    const trigger = screen.getByTestId("trigger");
    trigger.focus();
    fireEvent.click(trigger);
    expect(await screen.findByTestId("inspector-sheet")).toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it("restores the initiating control after close via the button", async () => {
    render(<Harness />);
    const trigger = screen.getByTestId("trigger");
    trigger.focus();
    fireEvent.click(trigger);
    const close = await screen.findByLabelText("Close inspector");
    close.focus();
    fireEvent.click(close);
    await waitFor(() =>
      expect(screen.queryByTestId("inspector-sheet")).not.toBeInTheDocument(),
      { timeout: 3000 },
    );
    await waitFor(() => expect(document.activeElement).toBe(trigger), { timeout: 3000 });
  });

  it("restores the initiating control after Escape", async () => {
    render(<Harness />);
    const trigger = screen.getByTestId("trigger");
    trigger.focus();
    fireEvent.click(trigger);
    const close = await screen.findByLabelText("Close inspector");
    close.focus();
    fireEvent.keyDown(document.body, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByTestId("inspector-sheet")).not.toBeInTheDocument(),
      { timeout: 3000 },
    );
    await waitFor(() => expect(document.activeElement).toBe(trigger), { timeout: 3000 });
  });

  it("dismisses on a downward drag release (shared close path restores focus)", async () => {
    expect(shouldDismissDrag({ offset: { x: 0, y: 100 }, velocity: { x: 0, y: 0 } })).toBe(true);
    expect(shouldDismissDrag({ offset: { x: 0, y: 20 }, velocity: { x: 0, y: 600 } })).toBe(true);
    expect(shouldDismissDrag({ offset: { x: 0, y: 20 }, velocity: { x: 0, y: 100 } })).toBe(false);

    render(<Harness />);
    const trigger = screen.getByTestId("trigger");
    trigger.focus();
    fireEvent.click(trigger);
    const close = await screen.findByLabelText("Close inspector");
    close.focus();
    fireEvent.click(close);
    await waitFor(() => expect(document.activeElement).toBe(trigger), { timeout: 3000 });
  });

  it("does not recapture or restore on a selection change", async () => {
    function SelectionHarness() {
      const [sel, setSel] = React.useState<string | null>(null);
      return (
        <>
          <button data-testid="trigger" onClick={() => setSel("A")}>Open</button>
          <button data-testid="elsewhere" onClick={() => setSel("B")}>Switch</button>
          <InspectorSheet selectedId={sel} onClose={() => setSel(null)} title="Detail">
            <p>detail</p>
          </InspectorSheet>
        </>
      );
    }
    render(<SelectionHarness />);
    const trigger = screen.getByTestId("trigger");
    trigger.focus();
    fireEvent.click(trigger);
    expect(await screen.findByTestId("inspector-sheet")).toHaveAttribute("data-selected-id", "A");

    const elsewhere = screen.getByTestId("elsewhere");
    elsewhere.focus();
    fireEvent.click(elsewhere);
    await waitFor(() =>
      expect(screen.getByTestId("inspector-sheet")).toHaveAttribute("data-selected-id", "B"),
      { timeout: 3000 },
    );
    expect(document.activeElement).toBe(elsewhere);
  });

  it("does not restore when the sheet reopened before the exit finished", async () => {
    function ReopenHarness() {
      const [sel, setSel] = React.useState<string | null>(null);
      return (
        <>
          <button data-testid="trigger" onClick={() => setSel("PAXG")}>Open</button>
          <button data-testid="swap" onClick={() => setSel((s) => (s ? null : "GLD"))}>Swap</button>
          <InspectorSheet selectedId={sel} onClose={() => setSel(null)} title="Detail">
            <p>detail</p>
          </InspectorSheet>
        </>
      );
    }
    render(<ReopenHarness />);
    const trigger = screen.getByTestId("trigger");
    const swap = screen.getByTestId("swap");
    trigger.focus();
    fireEvent.click(trigger);
    const close = await screen.findByLabelText("Close inspector");
    close.focus();
    fireEvent.click(close);
    swap.focus();
    fireEvent.click(swap);
    await waitFor(() =>
      expect(screen.getByTestId("inspector-sheet")).toHaveAttribute("data-selected-id", "GLD"),
      { timeout: 3000 },
    );
    expect(document.activeElement).toBe(swap);
  });

  it("captures a trigger hidden by the inspector-open style at the open boundary", async () => {
    function HiddenHarness() {
      const [sel, setSel] = React.useState<string | null>(null);
      const [hidden, setHidden] = React.useState(false);
      return (
        <>
          <button
            data-testid="trigger"
            style={hidden ? { display: "none" } : undefined}
            onClick={(e) => {
              setHidden(true);
              e.currentTarget.blur();
              setSel("PAXG");
            }}
          >
            Open
          </button>
          <InspectorSheet
            selectedId={sel}
            onClose={() => {
              setHidden(false);
              setSel(null);
            }}
            title="PAXG"
          >
            <p>detail</p>
          </InspectorSheet>
        </>
      );
    }
    render(<HiddenHarness />);
    const trigger = screen.getByTestId("trigger");
    trigger.focus();
    fireEvent.click(trigger);
    const close = await screen.findByLabelText("Close inspector");
    close.focus();
    fireEvent.click(close);
    await waitFor(
      () => expect(document.activeElement).toBe(trigger),
      { timeout: 3000 },
    );
  });

  it("does not restore while the trigger remains hidden", async () => {
    function StillHiddenHarness() {
      const [sel, setSel] = React.useState<string | null>(null);
      const [hidden, setHidden] = React.useState(false);
      return (
        <>
          <button
            data-testid="trigger"
            style={hidden ? { display: "none" } : undefined}
            onClick={(e) => {
              setHidden(true);
              e.currentTarget.blur();
              setSel("PAXG");
            }}
          >
            Open
          </button>
          <InspectorSheet selectedId={sel} onClose={() => setSel(null)} title="PAXG">
            <p>detail</p>
          </InspectorSheet>
        </>
      );
    }
    render(<StillHiddenHarness />);
    const trigger = screen.getByTestId("trigger");
    trigger.focus();
    fireEvent.click(trigger);
    const close = await screen.findByLabelText("Close inspector");
    close.focus();
    fireEvent.click(close);
    await waitFor(
      () => expect(screen.queryByTestId("inspector-sheet")).not.toBeInTheDocument(),
      { timeout: 3000 },
    );
    expect(document.activeElement).not.toBe(trigger);
  });

  it("never steals when focus moved elsewhere during the exit", async () => {
    motionMock.reduced = false;
    render(<Harness />);
    const trigger = screen.getByTestId("trigger");
    trigger.focus();
    fireEvent.click(trigger);
    const close = await screen.findByLabelText("Close inspector");
    close.focus();
    fireEvent.click(close);
    const elsewhere = screen.getByTestId("elsewhere");
    elsewhere.focus();
    await waitFor(
      () => expect(screen.queryByTestId("inspector-sheet")).not.toBeInTheDocument(),
      { timeout: 3000 },
    );
    expect(document.activeElement).toBe(elsewhere);
  });

  it("an initially-open mount captures no trigger and steals no focus", () => {
    render(
      <InspectorSheet selectedId="PAXG" onClose={() => {}} title="PAXG">
        <p>detail</p>
      </InspectorSheet>,
    );
    expect(screen.getByTestId("inspector-sheet")).toBeInTheDocument();
    expect(document.activeElement).toBe(document.body);
  });

  it("skips restoration when the trigger is disconnected or hidden", async () => {
    function RemovedHarness() {
      const [sel, setSel] = React.useState<string | null>(null);
      const [gone, setGone] = React.useState(false);
      return (
        <>
          {!gone && (
            <button data-testid="trigger" onClick={() => setSel("PAXG")}>Open</button>
          )}
          <button data-testid="remove" onClick={() => setGone(true)}>Remove</button>
          <InspectorSheet selectedId={sel} onClose={() => setSel(null)} title="PAXG">
            <p>detail</p>
          </InspectorSheet>
        </>
      );
    }
    render(<RemovedHarness />);
    const trigger = screen.getByTestId("trigger");
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByTestId("remove"));
    const close = await screen.findByLabelText("Close inspector");
    close.focus();
    fireEvent.click(close);
    await waitFor(() =>
      expect(screen.queryByTestId("inspector-sheet")).not.toBeInTheDocument(),
      { timeout: 3000 },
    );
    expect(document.activeElement).not.toBe(trigger);
  });
});

describe("InstrumentShell — motion choreography props", () => {
  beforeEach(() => {
    ROStub.instances = [];
    motionMock.recorded = [];
    motionMock.layoutGroupIds = [];
    Object.defineProperty(window, "ResizeObserver", {
      writable: true,
      configurable: true,
      value: ROStub,
    });
  });

  afterEach(() => {
    motionMock.reduced = false;
    vi.restoreAllMocks();
    delete (window as { matchMedia?: unknown }).matchMedia;
    delete (window as { ResizeObserver?: unknown }).ResizeObserver;
  });

  const sectionProps = () =>
    motionMock.recorded
      .filter((r) => r.tag === "section" && r.props["data-testid"] === "inspector-sheet")
      .at(-1)?.props;

  it("object/inspector/status wrappers use position-only layout with the shared settle", () => {
    mockViewport({ desktop: true, width: 754, padding: 16, border: 1 });
    render(
      <InstrumentShell
        object={<span />}
        inspector={<span />}
        inspectorOpen
        status={<span />}
      />,
    );
    for (const cls of ["instrument-object", "instrument-inspector", "instrument-status"]) {
      const rec = motionMock.recorded
        .filter((r) => r.tag === "div" && String(r.props.className ?? "").includes(cls))
        .at(-1);
      expect(rec, cls).toBeTruthy();
      expect(rec!.props.layout).toBe("position");
      expect(rec!.props.transition).toMatchObject({
        layout: expect.objectContaining({ type: "spring" }),
      });
    }
  });

  it("disables layout motion under reduced motion", () => {
    motionMock.reduced = true;
    mockViewport({ desktop: true, width: 754, padding: 16, border: 1 });
    render(
      <InstrumentShell object={<span />} inspector={<span />} inspectorOpen status={<span />} />,
    );
    const rec = motionMock.recorded
      .filter(
        (r) => r.tag === "div" && String(r.props.className ?? "").includes("instrument-object"),
      )
      .at(-1);
    expect(rec!.props.layout).toBe(false);
    expect(rec!.props.transition).toMatchObject({ layout: { duration: 0 } });
  });

  it("gives each shell its own LayoutGroup id", () => {
    mockViewport({ desktop: true, width: 900 });
    render(
      <>
        <InstrumentShell object={<span />} />
        <InstrumentShell object={<span />} />
      </>,
    );
    expect(motionMock.layoutGroupIds.length).toBeGreaterThanOrEqual(2);
    const [a, b] = motionMock.layoutGroupIds;
    expect(a).toBeTruthy();
    expect(a).not.toBe(b);
  });

  it("slides the sheet in from the side on a wide desktop shell", () => {
    mockViewport({ desktop: true, width: 900 });
    render(
      <InstrumentShell
        object={<span />}
        inspectorOpen
        inspector={
          <InspectorSheet selectedId="PAXG" onClose={() => {}} title="PAXG">
            <p>detail</p>
          </InspectorSheet>
        }
      />,
    );
    const p = sectionProps();
    expect(p).toBeTruthy();
    expect(p!.initial).toEqual({ x: 12, rotateX: 0, opacity: 0, height: "auto" });
    expect(p!.animate).toEqual({ x: 0, rotateX: 0, opacity: 1, height: "auto" });
    expect(p!.exit).toEqual({ x: 12, rotateX: 0, opacity: 0, height: "auto" });
  });

  it("keeps the origami fold on a fold placement", () => {
    mockViewport({ desktop: false, width: 400 });
    render(
      <InstrumentShell
        object={<span />}
        inspectorOpen
        inspector={
          <InspectorSheet selectedId="PAXG" onClose={() => {}} title="PAXG">
            <p>detail</p>
          </InspectorSheet>
        }
      />,
    );
    const p = sectionProps();
    expect(p!.initial).toEqual({ x: 0, rotateX: -88, opacity: 0, height: 0 });
    expect(p!.animate).toEqual({ x: 0, rotateX: 0, opacity: 1, height: "auto" });
    expect(p!.exit).toEqual({ x: 0, rotateX: -88, opacity: 0, height: 0 });
  });

  it("normalizes the same mounted sheet across a fold→side→fold resize", () => {
    const resize = (width: number) => {
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
        width, height: 100, top: 0, left: 0, right: width, bottom: 100, x: 0, y: 0,
        toJSON: () => ({}),
      } as DOMRect);
      act(() => ROStub.instances[0].cb());
    };
    mockViewport({ desktop: true, width: 400 });
    render(
      <InstrumentShell
        object={<span />}
        inspectorOpen
        inspector={
          <InspectorSheet selectedId="PAXG" onClose={() => {}} title="PAXG">
            <p>detail</p>
          </InspectorSheet>
        }
      />,
    );
    const sheetEl = screen.getByTestId("inspector-sheet");
    expect(sectionProps()!.animate).toEqual({
      x: 0, rotateX: 0, opacity: 1, height: "auto",
    });

    resize(900);
    expect(screen.getByTestId("inspector-sheet")).toBe(sheetEl);
    const side = sectionProps()!;
    expect(side.animate).toEqual({ x: 0, rotateX: 0, opacity: 1, height: "auto" });
    expect(side.initial).toMatchObject({ x: 12, rotateX: 0 });

    resize(400);
    expect(screen.getByTestId("inspector-sheet")).toBe(sheetEl);
    const fold = sectionProps()!;
    expect(fold.animate).toEqual({ x: 0, rotateX: 0, opacity: 1, height: "auto" });
    expect(fold.exit).toEqual({ x: 0, rotateX: -88, opacity: 0, height: 0 });
  });

  it("normalizes to zeroed end-state values when motion becomes reduced", () => {
    mockViewport({ desktop: true, width: 900 });
    const tree = () => (
      <InstrumentShell
        object={<span />}
        inspectorOpen
        inspector={
          <InspectorSheet selectedId="PAXG" onClose={() => {}} title="PAXG">
            <p>detail</p>
          </InspectorSheet>
        }
      />
    );
    const { rerender } = render(tree());
    const sheetEl = screen.getByTestId("inspector-sheet");
    expect(sectionProps()!.animate).toEqual({
      x: 0, rotateX: 0, opacity: 1, height: "auto",
    });

    motionMock.reduced = true;
    rerender(tree());
    expect(screen.getByTestId("inspector-sheet")).toBe(sheetEl);
    const p = sectionProps()!;
    expect(p.initial).toEqual({ x: 0, rotateX: 0, opacity: 1, height: "auto" });
    expect(p.animate).toEqual({ x: 0, rotateX: 0, opacity: 1, height: "auto" });
    expect(p.exit).toEqual({ x: 0, rotateX: 0, opacity: 0, height: "auto" });
    expect(p.transition).toEqual({ duration: 0 });
  });

  it("pins reduced-motion side states to zeroed transforms with instant duration", () => {
    motionMock.reduced = true;
    mockViewport({ desktop: true, width: 900 });
    render(
      <InstrumentShell
        object={<span />}
        inspectorOpen
        inspector={
          <InspectorSheet selectedId="PAXG" onClose={() => {}} title="PAXG">
            <p>detail</p>
          </InspectorSheet>
        }
      />,
    );
    const p = sectionProps();
    expect(p!.initial).toEqual({ x: 0, rotateX: 0, opacity: 1, height: "auto" });
    expect(p!.animate).toEqual({ x: 0, rotateX: 0, opacity: 1, height: "auto" });
    expect(p!.exit).toEqual({ x: 0, rotateX: 0, opacity: 0, height: "auto" });
    expect(p!.transition).toEqual({ duration: 0 });
  });
});
