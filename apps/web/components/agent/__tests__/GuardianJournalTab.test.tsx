// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";

import { GuardianJournalTab, type GuardianProofEvent } from "../GuardianJournalTab";

vi.mock("@/lib/haptics", () => ({ haptics: { tap: vi.fn() } }));

const DAY = 86_400_000;
const NOW = Date.parse("2026-11-10T12:00:00");

const events: GuardianProofEvent[] = [
  {
    id: "e1",
    source: "vault",
    title: "Proposed a move",
    subtitle: "usdc to usdt",
    timestamp: NOW,
    status: "confirmed",
    txHash: "0xaa",
    explorerUrl: "https://explorer/0xaa",
  },
  {
    id: "e2",
    source: "wdk",
    title: "Anchored a decision",
    subtitle: "reasoning sealed",
    timestamp: NOW - 70 * DAY,
    status: "confirmed",
    txHash: "0xbb",
  },
];

function renderTab() {
  const anchorByTxHash = new Map([
    [
      "0xaa",
      { status: "anchored", id: 12, evidenceUploaded: true },
    ],
    [
      "0xbb",
      { status: "pending" },
    ],
  ]);
  return render(
    <GuardianJournalTab
      events={events}
      anchorByTxHash={anchorByTxHash as never}
      hasValidPermission
      isLowOnFunds={false}
      isRunningLoop={false}
      onPreview={() => {}}
    />,
  );
}

describe("GuardianJournalTab — decision calendar", () => {
  it("renders a month grid and auto-selects the latest marked day", () => {
    renderTab();
    expect(screen.getByTestId("journal-calendar")).toBeInTheDocument();
    // The latest event's day is selected on arrival and its card shows.
    const day = screen.getByTestId("journal-day-2026-11-10");
    expect(day).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("journal-day-events")).toHaveTextContent(
      "Proposed a move",
    );
    // Honest anchor chip: anchored WITH evidence renders the 0G ledger chip.
    expect(screen.getByTestId("anchor-chip")).toHaveTextContent("0G #12");
    expect(
      screen.queryByTestId("anchor-chip-pending"),
    ).not.toBeInTheDocument();
  });

  it("tapping another marked day swaps the cards and keeps chip honesty", async () => {
    renderTab();
    // e2 lands in September — walk there, then pick its day.
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    fireEvent.click(screen.getByTestId("journal-day-2026-09-01"));
    // mode="wait" — the November card exits before the September card mounts.
    await waitFor(() =>
      expect(screen.getByTestId("journal-day-events")).toHaveTextContent(
        "Anchored a decision",
      ),
    );
    expect(screen.getByTestId("anchor-chip-pending")).toHaveTextContent(
      "0G pending",
    );
  });

  it("unmarked days are inert", () => {
    renderTab();
    const quiet = screen.getByTestId("journal-day-2026-11-02");
    expect(quiet).toBeDisabled();
  });

  it("navigates months and reports an empty one honestly", async () => {
    renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByText(/October 2026/)).toBeInTheDocument();
    expect(screen.getByText("no marks this month")).toBeInTheDocument();
    // The November card is mid-exit (mode="wait"); an empty month must
    // not keep showing it.
    await waitFor(() =>
      expect(screen.queryByTestId("journal-day-events")).not.toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByText(/November 2026/)).toBeInTheDocument();
  });

  it("keeps the watching empty state when nothing happened yet", () => {
    render(
      <GuardianJournalTab
        events={[]}
        anchorByTxHash={new Map()}
        hasValidPermission
        isLowOnFunds={false}
        isRunningLoop={false}
        onPreview={() => {}}
      />,
    );
    expect(screen.getByText("Guardian is watching. No moves yet.")).toBeInTheDocument();
    expect(screen.queryByTestId("journal-calendar")).not.toBeInTheDocument();
  });
});
