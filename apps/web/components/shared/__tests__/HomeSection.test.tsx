/**
 * Tests for HomeSection.
 *
 * Verifies the id+scroll-mt behavior (used by HomeNav) and the
 * collapsed/expanded rendering around the existing CollapsibleSection.
 */

// @vitest-environment jsdom

import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { HomeSection } from "../HomeSection";

afterEach(() => {
  cleanup();
});

// Mock TabComponents' CollapsibleSection so the test doesn't need the
// full app context. We render a controlled toggle so we can verify
// default-open and teaser (subtitle) behaviour precisely.
vi.mock("../TabComponents", () => ({
  CollapsibleSection: ({
    title,
    icon,
    defaultOpen,
    badge,
    subtitle,
    children,
  }: {
    title: string;
    icon?: React.ReactNode;
    defaultOpen?: boolean;
    badge?: React.ReactNode;
    subtitle?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <div data-testid="collapsible-section">
      <header>
        {icon}
        <span>{title}</span>
        {subtitle && <span data-testid="subtitle">{subtitle}</span>}
        {badge}
      </header>
      {defaultOpen && <div data-testid="collapsible-body">{children}</div>}
    </div>
  ),
}));

describe("HomeSection", () => {
  it("renders the id, title, and children when expanded", () => {
    render(
      <HomeSection id="market-intel" title="Guardian Pulse" icon="🌍" defaultOpen>
        <p>Live macro signals here.</p>
      </HomeSection>,
    );
    const section = document.getElementById("market-intel");
    expect(section).toBeInTheDocument();
    expect(section).toHaveAttribute("data-home-section", "market-intel");
    expect(section).toHaveClass("scroll-mt-20");
    expect(screen.getByText("Guardian Pulse")).toBeInTheDocument();
    expect(screen.getByText("Live macro signals here.")).toBeInTheDocument();
  });

  it("renders the teaser in the header (always visible, even when collapsed)", () => {
    render(
      <HomeSection
        id="smart-tips"
        title="Smart Tips"
        teaser="Personalised actions from your goal."
        defaultOpen={false}
      >
        <p>Hidden content.</p>
      </HomeSection>,
    );
    // Title appears in the header
    expect(screen.getByText("Smart Tips")).toBeInTheDocument();
    // Teaser is in the header subtitle slot, visible even when collapsed
    expect(screen.getByTestId("subtitle")).toHaveTextContent(
      "Personalised actions from your goal.",
    );
    // Body is collapsed by default
    expect(screen.queryByText("Hidden content.")).not.toBeInTheDocument();
  });

  it("renders the teaser in the header even when defaultOpen is true", () => {
    render(
      <HomeSection
        id="rewards"
        title="Rewards"
        teaser="Daily claim, streak, and perks."
        defaultOpen
      >
        <p>Visible content.</p>
      </HomeSection>,
    );
    // The teaser is always in the header — it doesn't move with the body.
    expect(screen.getByTestId("subtitle")).toHaveTextContent(
      "Daily claim, streak, and perks.",
    );
    expect(screen.getByText("Visible content.")).toBeInTheDocument();
  });

  it("renders the badge when provided", () => {
    render(
      <HomeSection
        id="smart-tips"
        title="Smart Tips"
        defaultOpen
        badge={<span data-testid="badge">3</span>}
      >
        <p>Body</p>
      </HomeSection>,
    );
    expect(screen.getByTestId("badge")).toBeInTheDocument();
  });
});
