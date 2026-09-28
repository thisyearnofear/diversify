/**
 * Header variant collapses to icon-only when idle (2026-09-28 nav
 * decluttering) and expands to the day count on tap/hover/focus. Claimable
 * and the rail variant always show the full pill.
 */
// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { StreakNavBadge } from "../StreakNavBadge";
import { useStreakRewards } from "@/hooks/use-streak-rewards";

vi.mock("@/hooks/use-streak-rewards", () => ({ useStreakRewards: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function mockStreak(overrides: Partial<ReturnType<typeof useStreakRewards>> = {}) {
  vi.mocked(useStreakRewards).mockReturnValue({
    streak: { daysActive: 3 },
    canClaim: false,
    isLoading: false,
    ...overrides,
  } as unknown as ReturnType<typeof useStreakRewards>);
}

describe("StreakNavBadge — header idle collapse", () => {
  it("is icon-only when idle, hiding the day count from sighted users (the sr-only label still carries it for a11y)", () => {
    mockStreak();
    render(<StreakNavBadge variant="header" />);
    const badge = screen.getByTestId("streak-nav-badge");
    const srOnly = badge.querySelector(".sr-only");
    expect(srOnly).not.toBeNull();
    srOnly!.remove();
    expect(badge).not.toHaveTextContent("3");
    expect(badge.querySelector("[aria-hidden]")).toHaveTextContent("🔥");
  });

  it("expands to the day count on focus, collapses again on blur", () => {
    mockStreak();
    render(<StreakNavBadge variant="header" />);
    const badge = screen.getByTestId("streak-nav-badge");
    const withoutSrOnly = () => {
      const clone = badge.cloneNode(true) as HTMLElement;
      clone.querySelector(".sr-only")?.remove();
      return clone.textContent ?? "";
    };
    fireEvent.focus(badge);
    expect(withoutSrOnly()).toContain("3");
    fireEvent.blur(badge);
    expect(withoutSrOnly()).not.toContain("3");
  });

  it("stays fully expanded (never collapses) when a claim is ready", () => {
    mockStreak({ canClaim: true });
    const onClaim = vi.fn();
    render(<StreakNavBadge variant="header" onClaim={onClaim} />);
    const badge = screen.getByTestId("streak-nav-badge");
    expect(badge).toHaveTextContent("Claim");
    fireEvent.click(badge);
    expect(onClaim).toHaveBeenCalled();
  });

  it("the rail variant is always fully expanded", () => {
    mockStreak();
    render(<StreakNavBadge variant="rail" />);
    expect(screen.getByTestId("streak-nav-badge-rail")).toHaveTextContent("3");
  });

  it("renders nothing with zero streak and no claim (newcomers)", () => {
    mockStreak({ streak: { daysActive: 0 } as never, canClaim: false });
    render(<StreakNavBadge variant="header" />);
    expect(screen.queryByTestId("streak-nav-badge")).not.toBeInTheDocument();
  });
});
