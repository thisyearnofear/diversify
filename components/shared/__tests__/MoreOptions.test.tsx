/**
 * Tests for MoreOptions.
 *
 * The component is a collapsed-by-default disclosure that renders the
 * region selector, optional "Two Chains" banner, and optional MiniPay
 * footnote. We verify:
 *   - the disclosure is collapsed by default
 *   - clicking the header toggles the panel
 *   - the region chips call setUserRegion on click
 *   - the component hides itself when there is nothing to show
 */

// @vitest-environment jsdom

import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MoreOptions } from "../MoreOptions";

vi.mock("framer-motion", () => {
  const MotionDiv = React.forwardRef((props: any, ref: any) =>
    React.createElement("div", { ...props, ref }),
  );
  MotionDiv.displayName = "MotionDiv";
  return {
    AnimatePresence: ({ children }: any) =>
      React.createElement("div", null, children),
    motion: { div: MotionDiv },
  };
});

vi.mock("../../regional/RegionalIconography", () => ({
  default: ({ region }: { region: string }) => (
    <span data-testid={`region-icon-${region}`} />
  ),
}));

const REGIONS = ["Africa", "LatAm", "Asia", "USA", "Europe"] as const;

afterEach(() => {
  cleanup();
});

describe("MoreOptions", () => {
  it("is collapsed by default", () => {
    render(
      <MoreOptions
        userRegion="Africa"
        setUserRegion={vi.fn()}
        regions={REGIONS}
        showTwoChainsBanner
      />,
    );
    const header = screen.getByRole("button", { name: /Settings & region/ });
    expect(header).toHaveAttribute("aria-expanded", "false");
    // Region chips not visible until expanded
    expect(screen.queryByText("LatAm")).not.toBeInTheDocument();
  });

  it("expands on click and shows region chips", () => {
    const setUserRegion = vi.fn();
    render(
      <MoreOptions
        userRegion="Africa"
        setUserRegion={setUserRegion}
        regions={REGIONS}
        showTwoChainsBanner
      />,
    );
    const header = screen.getByRole("button", { name: /Settings & region/ });
    fireEvent.click(header);
    expect(header).toHaveAttribute("aria-expanded", "true");
    // All region chips now visible
    REGIONS.forEach((r) => {
      expect(screen.getByText(r)).toBeInTheDocument();
    });
  });

  it("calls setUserRegion when a region chip is clicked", () => {
    const setUserRegion = vi.fn();
    render(
      <MoreOptions
        userRegion="Africa"
        setUserRegion={setUserRegion}
        regions={REGIONS}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Settings & region/ }));
    fireEvent.click(screen.getByText("LatAm"));
    expect(setUserRegion).toHaveBeenCalledWith("LatAm");
  });

  it("renders the Two Chains marketing line when enabled", () => {
    render(
      <MoreOptions
        userRegion="Africa"
        setUserRegion={vi.fn()}
        regions={REGIONS}
        showTwoChainsBanner
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Settings & region/ }));
    expect(
      screen.getByText(/Celo for regional diversity, Arbitrum for yield/),
    ).toBeInTheDocument();
  });

  it("hides the Two Chains line when disabled", () => {
    render(
      <MoreOptions
        userRegion="Africa"
        setUserRegion={vi.fn()}
        regions={REGIONS}
        showTwoChainsBanner={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Settings & region/ }));
    expect(
      screen.queryByText(/Celo for regional diversity, Arbitrum for yield/),
    ).not.toBeInTheDocument();
  });

  it("shows the MiniPay footnote when isMiniPay is true", () => {
    render(
      <MoreOptions
        userRegion="Africa"
        setUserRegion={vi.fn()}
        regions={REGIONS}
        isMiniPay
        showTwoChainsBanner={false}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Settings & region/ }));
    expect(screen.getByText(/You're using/)).toBeInTheDocument();
    expect(screen.getByText(/MiniPay/)).toBeInTheDocument();
  });

  it("renders nothing when no content would show", () => {
    const { container } = render(
      <MoreOptions
        userRegion="Africa"
        setUserRegion={vi.fn()}
        regions={[]}
        showTwoChainsBanner={false}
        isMiniPay={false}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("uses the id for in-page navigation", () => {
    const { container } = render(
      <MoreOptions
        id="custom-id"
        userRegion="Africa"
        setUserRegion={vi.fn()}
        regions={REGIONS}
      />,
    );
    const section = container.querySelector("#custom-id");
    expect(section).toBeInTheDocument();
    expect(section).toHaveAttribute("data-home-section", "custom-id");
  });
});
