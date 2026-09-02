// @vitest-environment jsdom
/**
 * TrustFootnote — progressive-blur trust note.
 *
 * The blur/mask are style-only (visual), so the DOM contract under test:
 * content is always present in the tree (never a hide), the control starts
 * collapsed with the "Details" affordance, and click/tap expands it with
 * correct aria-expanded. Hover expands too, leave collapses.
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { TrustFootnote } from "../TrustFootnote";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("TrustFootnote", () => {
  it("renders the full content in the DOM even when collapsed (never a hide)", () => {
    render(
      <TrustFootnote>
        as of 2026-08-24 · World Bank inflation series · curated, not advice
      </TrustFootnote>,
    );
    // Content text is present even though visually blurred/masked.
    expect(screen.getByText(/as of 2026-08-24/)).toBeInTheDocument();
    expect(screen.getByText(/not advice/)).toBeInTheDocument();
  });

  it("starts collapsed with the Details affordance and aria-expanded=false", () => {
    render(<TrustFootnote>Source: vaults.fyi · method: weighted APY</TrustFootnote>);
    const control = screen.getByRole("button", { expanded: false });
    expect(control).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Details")).toBeInTheDocument();
  });

  it("expands on click and collapses back", () => {
    render(<TrustFootnote>Source: vaults.fyi</TrustFootnote>);
    const control = screen.getByRole("button");

    fireEvent.click(control);
    expect(control).toHaveAttribute("aria-expanded", "true");
    // Details affordance disappears once fully expanded.
    expect(screen.queryByText("Details")).not.toBeInTheDocument();

    fireEvent.click(control);
    expect(control).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Details")).toBeInTheDocument();
  });

  it("expands on hover and collapses on leave", () => {
    render(<TrustFootnote>Source: CoinGecko</TrustFootnote>);
    const control = screen.getByRole("button");

    fireEvent.mouseEnter(control);
    expect(control).toHaveAttribute("aria-expanded", "true");

    fireEvent.mouseLeave(control);
    expect(control).toHaveAttribute("aria-expanded", "false");
  });

  it("is keyboard-reachable: focus expands, blur collapses", () => {
    render(<TrustFootnote>Source: Celo RPC</TrustFootnote>);
    const control = screen.getByRole("button");

    fireEvent.focus(control);
    expect(control).toHaveAttribute("aria-expanded", "true");

    fireEvent.blur(control);
    expect(control).toHaveAttribute("aria-expanded", "false");
  });
});
