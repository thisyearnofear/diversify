// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { UnconnectedStatusTier } from "../UnconnectedStatusTier";

vi.mock("../VerifiedEvidence", () => ({ VerifiedEvidence: () => <span>Verified</span> }));

afterEach(() => cleanup());

describe("UnconnectedStatusTier — trust + the tab's own hand-offs", () => {
  it("keeps VerifiedEvidence as the default trust line", () => {
    render(<UnconnectedStatusTier />);
    expect(screen.getByText("Verified")).toBeInTheDocument();
  });

  it("renders nothing in the trust slot when trust is null", () => {
    render(<UnconnectedStatusTier trust={null} />);
    expect(screen.queryByText("Verified")).not.toBeInTheDocument();
  });

  it("carries the tab's hand-off link", () => {
    const onHandoff = vi.fn();
    render(
      <UnconnectedStatusTier>
        <button type="button" onClick={onHandoff}>
          What FX timing costs your next payment →
        </button>
      </UnconnectedStatusTier>,
    );
    fireEvent.click(screen.getByRole("button", { name: /FX timing/ }));
    expect(onHandoff).toHaveBeenCalledTimes(1);
  });

  it("no longer repeats the app-wide sample-plan switch", () => {
    render(<UnconnectedStatusTier />);
    expect(
      screen.queryByRole("button", { name: "Explore a sample plan" }),
    ).not.toBeInTheDocument();
  });
});
