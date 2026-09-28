import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { BuenVivirCard } from "../cards";

describe("plan cards — allocation pills carry real splits", () => {
  it("Buen Vivir shows exposure + percent pills", () => {
    render(<BuenVivirCard />);
    expect(screen.getByText("Real 45")).toBeInTheDocument();
    expect(screen.getByText("Colombian peso 35")).toBeInTheDocument();
    expect(screen.getByText("Dollar 20")).toBeInTheDocument();
  });
});
