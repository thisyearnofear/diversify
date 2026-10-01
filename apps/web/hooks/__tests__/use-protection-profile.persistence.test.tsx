import { describe, expect, it, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";

import {
  ProtectionProfileProvider,
  useProtectionProfile,
} from "../use-protection-profile";

const KEY = "diversifi-protection-profile-v2";

const SEEDED = {
  philosophy: "islamic",
  riskTolerance: "Conservative",
  userGoal: "inflation_protection",
  timeHorizon: "1 year",
};

function Probe() {
  const { config, setPhilosophy } = useProtectionProfile();
  return (
    <div>
      <span data-testid="philosophy">{config.philosophy ?? "none"}</span>
      <span data-testid="risk">{config.riskTolerance ?? "none"}</span>
      <button type="button" onClick={() => setPhilosophy("global")}>
        Set global
      </button>
    </div>
  );
}

function App() {
  return (
    <React.StrictMode>
      <ProtectionProfileProvider>
        <Probe />
      </ProtectionProfileProvider>
    </React.StrictMode>
  );
}

afterEach(() => localStorage.clear());

describe("protection profile — hydration persistence", () => {
  it("StrictMode mount never overwrites the seeded profile with defaults", async () => {
    localStorage.setItem(KEY, JSON.stringify(SEEDED));
    render(<App />);

    await screen.findByText("islamic");
    expect(screen.getByTestId("risk")).toHaveTextContent("Conservative");

    const stored = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    expect(stored.philosophy).toBe("islamic");
    expect(stored.riskTolerance).toBe("Conservative");
    expect(stored.userGoal).toBe("inflation_protection");
    expect(stored.timeHorizon).toBe("1 year");
  });

  it("an explicit setter commits and survives unmount/remount", async () => {
    localStorage.setItem(KEY, JSON.stringify(SEEDED));
    const first = render(<App />);
    await screen.findByText("islamic");

    await act(async () => {
      screen.getByRole("button", { name: "Set global" }).click();
    });
    expect(screen.getByTestId("philosophy")).toHaveTextContent("global");
    expect(JSON.parse(localStorage.getItem(KEY) ?? "{}").philosophy).toBe("global");

    first.unmount();
    render(<App />);
    await screen.findByText("global");
    expect(JSON.parse(localStorage.getItem(KEY) ?? "{}").philosophy).toBe("global");
  });
});
