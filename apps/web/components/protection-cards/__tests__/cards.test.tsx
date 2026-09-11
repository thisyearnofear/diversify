import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { BuenVivirCard } from "../cards";

describe("plan cards — allocation pills carry real splits", () => {
  it("Buen Vivir shows token + percent pills", () => {
    render(<BuenVivirCard />);
    expect(screen.getByText("cREAL 45")).toBeInTheDocument();
    expect(screen.getByText("COPm 35")).toBeInTheDocument();
    expect(screen.getByText("cUSD 20")).toBeInTheDocument();
  });
});
