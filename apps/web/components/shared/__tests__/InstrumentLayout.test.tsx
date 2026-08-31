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
