// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { UnconnectedStatusTier } from "../UnconnectedStatusTier";

vi.mock("../VerifiedEvidence", () => ({ VerifiedEvidence: () => <span>Verified</span> }));

afterEach(() => cleanup());

describe("UnconnectedStatusTier", () => {
  it("offers the sample when it's off", () => {
    const onEnableDemo = vi.fn();
    render(<UnconnectedStatusTier onEnableDemo={onEnableDemo} />);
    fireEvent.click(screen.getByRole("button", { name: "Explore a sample plan" }));
    expect(onEnableDemo).toHaveBeenCalledTimes(1);
  });

  it("never re-offers a sample that's already on — says so and offers the exit", () => {
    const onDisableDemo = vi.fn();
    render(<UnconnectedStatusTier onEnableDemo={vi.fn()} demoActive onDisableDemo={onDisableDemo} />);
    expect(screen.queryByRole("button", { name: "Explore a sample plan" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sample data on · Exit" }));
    expect(onDisableDemo).toHaveBeenCalledTimes(1);
  });
});

describe("UnconnectedStatusTier — trust override", () => {
  it("keeps VerifiedEvidence as the default trust line", () => {
    render(<UnconnectedStatusTier onEnableDemo={vi.fn()} />);
    expect(screen.getByText("Verified")).toBeInTheDocument();
  });

  it("renders nothing in the trust slot when trust is null", () => {
    render(<UnconnectedStatusTier onEnableDemo={vi.fn()} trust={null} />);
    expect(screen.queryByText("Verified")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Explore a sample plan" })).toBeInTheDocument();
  });
});
