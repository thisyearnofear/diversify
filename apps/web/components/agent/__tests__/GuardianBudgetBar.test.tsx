// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";

const visibility = vi.hoisted(() => ({ hidden: false }));
vi.mock("@/context/app/BalanceVisibilityContext", () => ({
  useBalanceVisibility: () => ({
    hidden: visibility.hidden,
    formatMoney: (value: number) =>
      visibility.hidden ? "••••" : `$${value.toLocaleString("en-US")}`,
  }),
}));

import { GuardianBudgetBar, hallmarksFor } from "../GuardianBudgetBar";

const NOW = new Date("2026-11-04T09:00:00Z").getTime();
const move = (amountUSD: number, hoursAgo: number, status = "confirmed") => ({
  txHash: `0x${amountUSD}`,
  action: "rebalance",
  tokenIn: "USDC",
  tokenOut: "NGNm",
  amountUSD,
  timestamp: NOW - hoursAgo * 3_600_000,
  status,
});

describe("hallmarksFor", () => {
  it("places each settled move where the metal stood when it landed", () => {
    expect(hallmarksFor([move(75, 2), move(100, 1)], 175)).toEqual([75, 175]);
  });

  it("strikes nothing when the moves do not account for the spend", () => {
    expect(hallmarksFor([move(90, 1)], 250)).toEqual([]);
  });

  it("reads the run that produced today's spend, not the whole history", () => {
    const older = move(500, 200);
    expect(hallmarksFor([older, move(75, 2), move(100, 1)], 175)).toEqual([75, 175]);
  });

  it("ignores moves that did not settle", () => {
    expect(hallmarksFor([move(75, 2, "failed"), move(100, 1)], 100)).toEqual([100]);
  });

  it("spends nothing on a fresh day", () => {
    expect(hallmarksFor([move(75, 2)], 0)).toEqual([]);
  });
});

const renderBar = (spentTodayUSD: number, dailyLimitUSD = 500) =>
  render(
    <GuardianBudgetBar
      spentTodayUSD={spentTodayUSD}
      dailyLimitUSD={dailyLimitUSD}
      remainingTodayUSD={Math.max(0, dailyLimitUSD - spentTodayUSD)}
    />,
  );

describe("GuardianBudgetBar", () => {
  it("states the three figures the limit rows used to carry", () => {
    visibility.hidden = false;
    renderBar(150, 500);
    expect(screen.getByText("$350")).toBeInTheDocument();
    expect(screen.getByText(/left today$/)).toBeInTheDocument();
    expect(screen.getByText("$150 used of $500/day")).toBeInTheDocument();
  });

  it("reports the used share to assistive tech", () => {
    visibility.hidden = false;
    renderBar(150, 500);
    const track = screen.getByRole("progressbar", { name: "Daily limit used" });
    expect(track).toHaveAttribute("aria-valuenow", "30");
    expect(track).toHaveAttribute("aria-valuemax", "100");
  });

  it("clamps spend that has overrun the limit", () => {
    visibility.hidden = false;
    renderBar(700, 500);
    expect(
      screen.getByRole("progressbar", { name: "Daily limit used" }),
    ).toHaveAttribute("aria-valuenow", "100");
  });

  it("withholds the proportion while balances are hidden", () => {
    visibility.hidden = true;
    renderBar(460, 500);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("guardian-budget-track")).not.toBeInTheDocument();
    expect(screen.getAllByText("••••").length).toBeGreaterThan(0);
    visibility.hidden = false;
  });

  it("strikes a hallmark only once the metal has reached it", () => {
    vi.useFakeTimers();
    visibility.hidden = false;
    const one = [move(75, 2)];
    const two = [move(75, 2), move(100, 1)];
    const { rerender } = render(
      <GuardianBudgetBar
        spentTodayUSD={75}
        dailyLimitUSD={500}
        remainingTodayUSD={425}
        executions={one}
      />,
    );
    expect(screen.queryAllByTestId("guardian-budget-mark")).toHaveLength(1);

    rerender(
      <GuardianBudgetBar
        spentTodayUSD={175}
        dailyLimitUSD={500}
        remainingTodayUSD={325}
        executions={two}
      />,
    );
    expect(screen.queryAllByTestId("guardian-budget-mark")).toHaveLength(1);

    act(() => vi.advanceTimersByTime(500));
    expect(screen.queryAllByTestId("guardian-budget-mark")).toHaveLength(2);
    vi.useRealTimers();
  });
});
