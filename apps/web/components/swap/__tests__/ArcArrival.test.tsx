import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ArcArrivalBody, ArcArrivalPrompt } from "../ArcArrival";
import { arcArrivalRoute } from "@/lib/arc-arrival";
import type { ArcArrival } from "@/hooks/use-arc-arrival";

vi.mock("@/lib/haptics", () => ({ haptics: { tap: vi.fn(), confirm: vi.fn(), error: vi.fn() } }));

const HASH = `0x${"a".repeat(64)}`;

function fake(over: Partial<ArcArrival> = {}): ArcArrival {
  return {
    route: arcArrivalRoute("mainnet", "production"),
    balance: 12_400_000n,
    offered: true,
    phase: "idle",
    error: null,
    record: null,
    feeEntry: { finalityThreshold: 2000, minimumFee: 0, forwardFee: { low: 1, med: 50_000, high: 2 } },
    quoteState: "ready",
    feeFor: () => 60_000n,
    maxAmount: 12_290_000n,
    destinationGasMissing: null,
    prepare: vi.fn(),
    start: vi.fn(async () => {}),
    checkAgain: vi.fn(),
    finishManually: vi.fn(async () => {}),
    dismiss: vi.fn(),
    ...over,
  };
}

afterEach(() => cleanup());

describe("ArcArrivalPrompt", () => {
  it("names the real Arc balance and opens the inspector", () => {
    const onOpen = vi.fn();
    const arrival = fake();
    render(<ArcArrivalPrompt arrival={arrival} onOpen={onOpen} />);
    fireEvent.click(screen.getByTestId("arc-arrival-prompt"));
    expect(screen.getByTestId("arc-arrival-prompt")).toHaveTextContent("$12.40 USDC on Arc");
    expect(onOpen).toHaveBeenCalled();
    expect(arrival.prepare).toHaveBeenCalled();
  });
  it("renders nothing when not offered", () => {
    render(<ArcArrivalPrompt arrival={fake({ offered: false })} onOpen={vi.fn()} />);
    expect(screen.queryByTestId("arc-arrival-prompt")).toBeNull();
  });
});

describe("ArcArrivalBody", () => {
  it("ready: Max fills the affordable amount, fee line is the live quote, CTA starts", () => {
    const arrival = fake();
    render(<ArcArrivalBody arrival={arrival} onDone={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Max" }));
    expect(screen.getByLabelText("Amount (USDC)")).toHaveValue("12.29");
    expect(screen.getByText(/up to \$0\.06 · you receive at least \$12\.29/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Bring to Arbitrum" }));
    expect(arrival.start).toHaveBeenCalledWith("12.29");
  });

  it("ready: no quote → the CTA stays disabled and says why", () => {
    render(<ArcArrivalBody arrival={fake({ quoteState: "unavailable", maxAmount: null })} onDone={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Bring to Arbitrum" })).toBeDisabled();
    expect(screen.getByText(/delivery fee isn't available/)).toBeInTheDocument();
  });

  it("in flight: shows the burn link and offers the manual finish when stuck", () => {
    const arrival = fake({
      phase: "stuck",
      record: { env: "mainnet", burnTxHash: HASH, amount: "5000000", startedAt: Date.now() },
    });
    render(<ArcArrivalBody arrival={arrival} onDone={vi.fn()} />);
    expect(screen.getByRole("link", { name: /Burned on Arc/ })).toHaveAttribute(
      "href",
      expect.stringContaining(HASH),
    );
    fireEvent.click(screen.getByRole("button", { name: "Finish on Arbitrum" }));
    expect(arrival.finishManually).toHaveBeenCalled();
  });

  it("arrived: both explorer links, the gas note, and the protect hand-off", () => {
    const onProtect = vi.fn();
    render(
      <ArcArrivalBody
        arrival={fake({
          phase: "arrived",
          destinationGasMissing: true,
          record: {
            env: "mainnet",
            burnTxHash: HASH,
            forwardTxHash: `0x${"b".repeat(64)}`,
            amount: "5000000",
            startedAt: Date.now(),
          },
        })}
        onProtect={onProtect}
        onDone={vi.fn()}
      />,
    );
    expect(screen.getByText("$5.00 USDC")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Arbitrum/ })).toBeInTheDocument();
    expect(screen.getByText(/needs a little ETH/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Protect it/ }));
    expect(onProtect).toHaveBeenCalledWith("5");
  });
});
