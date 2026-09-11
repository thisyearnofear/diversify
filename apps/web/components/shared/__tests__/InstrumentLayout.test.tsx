import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { InstrumentShell } from "../InstrumentShell";
import { InspectorSheet } from "../InspectorSheet";

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
