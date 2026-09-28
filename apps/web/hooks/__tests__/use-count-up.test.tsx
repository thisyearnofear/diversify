// @vitest-environment jsdom
/**
 * useCountUp — the count-up must tween from the previous displayed value
 * on a target change, never re-count from zero (a balance dropping
 * $200 → $50 must not pass through "$0").
 */
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { motion } from "framer-motion";
import { useCountUp } from "../use-count-up";

const reduced = { on: false };
vi.mock("framer-motion", async (importOriginal) => {
  const mod = await importOriginal<typeof import("framer-motion")>();
  return { ...mod, useReducedMotion: () => reduced.on };
});

function Probe({ target }: { target: number }) {
  const v = useCountUp(target, { format: (n) => Math.round(n).toString() });
  return <motion.span data-testid="v">{v}</motion.span>;
}

afterEach(() => {
  cleanup();
  reduced.on = false;
});

describe("useCountUp", () => {
  it("lands on the target", async () => {
    render(<Probe target={100} />);
    await waitFor(() => expect(screen.getByTestId("v")).toHaveTextContent("100"));
  });

  it("tweens from the previous value on change — never restarts at zero", async () => {
    const { rerender } = render(<Probe target={100} />);
    await waitFor(() => expect(screen.getByTestId("v")).toHaveTextContent("100"));

    rerender(<Probe target={200} />);
    // Immediately after the change the display still reads ≥100 — the
    // animation continues from the current value.
    const n = Number(screen.getByTestId("v").textContent);
    expect(n).toBeGreaterThanOrEqual(100);

    await waitFor(() => expect(screen.getByTestId("v")).toHaveTextContent("200"));
  });

  it("is instant under reduced motion", async () => {
    reduced.on = true;
    const { rerender } = render(<Probe target={100} />);
    await waitFor(() => expect(screen.getByTestId("v")).toHaveTextContent("100"));
    rerender(<Probe target={200} />);
    await waitFor(() => expect(screen.getByTestId("v")).toHaveTextContent("200"));
  });
});
