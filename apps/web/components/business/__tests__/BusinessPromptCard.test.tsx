// @vitest-environment jsdom

import React, { act } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { BusinessPromptCard } from "../BusinessPromptCard";

const ALL_SIGNALS = {
  cyclical: true,
  corridor: true,
  largerBalance: true,
  hasSavedCycle: true,
};

describe("BusinessPromptCard", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });
  // RTL auto-cleanup is registered by `vitest.setup.ts` (it imports
  // '@testing-library/react' which installs the afterEach hook).

  it("renders title, copy, and the explore CTA when at least one signal fired", () => {
    render(
      <BusinessPromptCard
        confidence={0.5}
        signals={{ ...ALL_SIGNALS, hasSavedCycle: false }}
        onDismiss={vi.fn()}
        onExplore={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/Patterns in your recent activity/),
    ).toBeInTheDocument();
    expect(screen.getByText(/See FX drag report/)).toBeInTheDocument();
    expect(screen.getByText(/Not now/)).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0);
  });

  it("renders all four signal chips when every signal fired", () => {
    render(
      <BusinessPromptCard
        confidence={1}
        signals={ALL_SIGNALS}
        onDismiss={vi.fn()}
        onExplore={vi.fn()}
      />,
    );
    // chips + the per-signal evidence list inside the disclosure
    expect(screen.getByText(/Cyclical deposits/)).toBeInTheDocument();
    expect(screen.getByText(/Corridor-shaped/)).toBeInTheDocument();
    expect(screen.getByText(/Larger balances/)).toBeInTheDocument();
    expect(screen.getByText(/Saved payment cycle/)).toBeInTheDocument();
  });

  it("does not render signal chips when none fired", () => {
    render(
      <BusinessPromptCard
        confidence={0}
        signals={{
          cyclical: false,
          corridor: false,
          largerBalance: false,
          hasSavedCycle: false,
        }}
        onDismiss={vi.fn()}
        onExplore={vi.fn()}
      />,
    );
    expect(screen.queryByText(/Cyclical deposits/)).not.toBeInTheDocument();
  });

  it("calls onExplore when the explore CTA is clicked", () => {
    const onExplore = vi.fn();
    render(
      <BusinessPromptCard
        confidence={0.5}
        signals={ALL_SIGNALS}
        onDismiss={vi.fn()}
        onExplore={onExplore}
      />,
    );
    fireEvent.click(screen.getByText(/See FX drag report/));
    expect(onExplore).toHaveBeenCalledTimes(1);
  });

  it("calls onDismiss when 'Not now' is clicked", async () => {
    const onDismiss = vi.fn().mockResolvedValue(undefined);
    render(
      <BusinessPromptCard
        confidence={0.5}
        signals={ALL_SIGNALS}
        onDismiss={onDismiss}
        onExplore={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText(/Not now/));
    await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1));
  });

  it("disables dismiss while pending and restores after", async () => {
    let resolveDismiss: () => void = () => undefined;
    const onDismiss = vi.fn().mockImplementation(
      () => new Promise<void>((resolve) => { resolveDismiss = resolve; }),
    );
    render(
      <BusinessPromptCard
        confidence={0.5}
        signals={ALL_SIGNALS}
        onDismiss={onDismiss}
        onExplore={vi.fn()}
      />,
    );
    const dismissBtn = screen.getByText(/Not now/);
    fireEvent.click(dismissBtn);
    expect(dismissBtn).toBeDisabled();
    expect(dismissBtn.textContent).toMatch(/Saving/);
    await act(async () => {
      resolveDismiss();
    });
    await waitFor(() => expect(dismissBtn).not.toBeDisabled());
  });

  it("does NOT mount the disclosure until expanded", () => {
    render(
      <BusinessPromptCard
        confidence={0.5}
        signals={ALL_SIGNALS}
        onDismiss={vi.fn()}
        onExplore={vi.fn()}
      />,
    );
    // The disclosure trigger is the only place we put the "Why am I
    // seeing this?" button.
    expect(
      screen.getByText(/\+ Why am I seeing this\?/),
    ).toBeInTheDocument();
    // The disclosure is conditionally rendered (no AnimatePresence +
    // always-mounted trick), so before expansion the evidence text
    // does NOT exist in the DOM at all.
    expect(
      screen.queryByTestId("business-prompt-disclosure"),
    ).not.toBeInTheDocument();
  });

  it("expands disclosure on click and exposes the evidence text", async () => {
    render(
      <BusinessPromptCard
        confidence={0.5}
        signals={ALL_SIGNALS}
        onDismiss={vi.fn()}
        onExplore={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText(/\+ Why am I seeing this\?/));
    await waitFor(() =>
      expect(
        screen.getByTestId("business-prompt-disclosure"),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByText(/3\+ deposits and 2\+ withdrawals in the last 90 days/),
    ).toBeInTheDocument();
  });

  it("uses the strong-pattern copy at confidence ≥ 0.8", () => {
    render(
      <BusinessPromptCard
        confidence={0.85}
        signals={ALL_SIGNALS}
        onDismiss={vi.fn()}
        onExplore={vi.fn()}
      />,
    );
    expect(screen.getByTestId("confidence-copy").textContent).toMatch(
      /Strong pattern detected/,
    );
  });

  it("uses the moderate-pattern copy at confidence 0.5–0.79", () => {
    render(
      <BusinessPromptCard
        confidence={0.6}
        signals={ALL_SIGNALS}
        onDismiss={vi.fn()}
        onExplore={vi.fn()}
      />,
    );
    expect(screen.getByTestId("confidence-copy").textContent).toMatch(
      /Moderate pattern detected/,
    );
  });

  it("uses the generic pattern copy at confidence < 0.5", () => {
    render(
      <BusinessPromptCard
        confidence={0.2}
        signals={ALL_SIGNALS}
        onDismiss={vi.fn()}
        onExplore={vi.fn()}
      />,
    );
    expect(screen.getByTestId("confidence-copy").textContent).toMatch(
      /^Pattern detected\.$/,
    );
  });

  it("uses min-h-11 (44px) touch targets on CTAs", () => {
    const { container } = render(
      <BusinessPromptCard
        confidence={0.5}
        signals={ALL_SIGNALS}
        onDismiss={vi.fn()}
        onExplore={vi.fn()}
      />,
    );
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBeGreaterThanOrEqual(3);
    buttons.forEach((b) => {
      const cls = b.className;
      // min-h-11 = 44px per Tailwind.
      expect(cls).toMatch(/min-h-11/);
    });
  });
});
