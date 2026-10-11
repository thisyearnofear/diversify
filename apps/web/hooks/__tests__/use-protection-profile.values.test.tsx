import { describe, expect, it, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";

import {
  ProtectionProfileProvider,
  useProtectionProfile,
  loadPhilosophy,
  loadValuesPhilosophy,
  savePhilosophy,
} from "../use-protection-profile";
import { getPersistedStrategy } from "../useFinancialStrategies";

const KEY = "diversifi-protection-profile-v2";

function seed(config: Record<string, unknown>) {
  localStorage.setItem(KEY, JSON.stringify(config));
}

const VALID_CUSTOM_PLAN = {
  from: "buen_vivir",
  rules: {},
  slices: [
    { exposure: "BRL", target: 50 },
    { exposure: "USD", target: 50 },
  ],
};

afterEach(() => localStorage.clear());

describe("valuesPhilosophy — storage load migration", () => {
  it("an active named plan wins and seeds values", () => {
    seed({ philosophy: "africapitalism", valuesPhilosophy: "islamic" });
    expect(loadPhilosophy()).toBe("africapitalism");
    expect(loadValuesPhilosophy()).toBe("africapitalism");
  });

  it("an active custom plan preserves a valid stored values philosophy", () => {
    seed({ philosophy: "custom", valuesPhilosophy: "gotong_royong" });
    expect(loadPhilosophy()).toBe("custom");
    expect(loadValuesPhilosophy()).toBe("gotong_royong");
  });

  it("an active custom plan infers values from a valid named origin", () => {
    seed({ philosophy: "custom", customPlan: VALID_CUSTOM_PLAN });
    expect(loadValuesPhilosophy()).toBe("buen_vivir");
  });

  it("an islamic origin infers only when the plan keeps excludeYield", () => {
    seed({
      philosophy: "custom",
      customPlan: { ...VALID_CUSTOM_PLAN, from: "islamic", rules: { excludeYield: true } },
    });
    expect(loadValuesPhilosophy()).toBe("islamic");

    seed({
      philosophy: "custom",
      customPlan: { ...VALID_CUSTOM_PLAN, from: "islamic" },
    });
    expect(loadValuesPhilosophy()).toBeNull();
  });

  it("a stored islamic values fails closed without an excludeYield custom plan", () => {
    seed({
      philosophy: "custom",
      valuesPhilosophy: "islamic",
      customPlan: { ...VALID_CUSTOM_PLAN, from: "islamic" },
    });
    expect(loadValuesPhilosophy()).toBeNull();

    seed({
      philosophy: "custom",
      valuesPhilosophy: "islamic",
      customPlan: { ...VALID_CUSTOM_PLAN, rules: { excludeYield: true } },
    });
    expect(loadValuesPhilosophy()).toBe("islamic");
  });

  it("a stored islamic values with no custom plan fails closed", () => {
    seed({ philosophy: "custom", valuesPhilosophy: "islamic" });
    expect(loadValuesPhilosophy()).toBeNull();

    seed({ philosophy: "islamic" });
    expect(loadValuesPhilosophy()).toBe("islamic");
  });

  it("custom without a valid origin gets no invented values", () => {
    seed({ philosophy: "custom" });
    expect(loadValuesPhilosophy()).toBeNull();

    seed({ philosophy: "custom", valuesPhilosophy: "inflation_protection" });
    expect(loadValuesPhilosophy()).toBeNull();

    seed({
      philosophy: "custom",
      customPlan: { ...VALID_CUSTOM_PLAN, from: "inflation_protection" },
    });
    expect(loadValuesPhilosophy()).toBeNull();
  });
});

describe("valuesPhilosophy — savePhilosophy mirrors the setter", () => {
  it("named → custom keeps values; named → named replaces; null clears", () => {
    savePhilosophy("buen_vivir");
    expect(loadValuesPhilosophy()).toBe("buen_vivir");

    savePhilosophy("custom");
    expect(loadPhilosophy()).toBe("custom");
    expect(loadValuesPhilosophy()).toBe("buen_vivir");

    savePhilosophy("confucian");
    expect(loadValuesPhilosophy()).toBe("confucian");

    savePhilosophy(null);
    expect(loadPhilosophy()).toBeNull();
    expect(loadValuesPhilosophy()).toBeNull();
  });

  it("islamic values survive named → custom only with a compatible committed vector", () => {
    savePhilosophy("islamic");
    savePhilosophy("custom");
    expect(loadPhilosophy()).toBe("custom");
    expect(loadValuesPhilosophy()).toBeNull();

    seed({
      philosophy: "custom",
      valuesPhilosophy: "islamic",
      customPlan: { ...VALID_CUSTOM_PLAN, from: "islamic", rules: { excludeYield: true } },
    });
    savePhilosophy("custom");
    expect(loadValuesPhilosophy()).toBe("islamic");
  });
});

describe("getPersistedStrategy — named values only", () => {
  it("returns null for a standalone custom plan", () => {
    seed({ philosophy: "custom", customPlan: VALID_CUSTOM_PLAN });
    expect(getPersistedStrategy()).toBe("buen_vivir");

    seed({ philosophy: "custom" });
    expect(getPersistedStrategy()).toBeNull();
  });

  it("returns the named active plan", () => {
    seed({ philosophy: "pan_caribbean" });
    expect(getPersistedStrategy()).toBe("pan_caribbean");
  });
});

function Probe() {
  const { config, setPhilosophy } = useProtectionProfile();
  return (
    <div>
      <span data-testid="plan">{config.philosophy ?? "none"}</span>
      <span data-testid="values">{config.valuesPhilosophy ?? "none"}</span>
      <button type="button" onClick={() => setPhilosophy("custom")}>
        custom
      </button>
      <button type="button" onClick={() => setPhilosophy("buen_vivir")}>
        named
      </button>
      <button type="button" onClick={() => setPhilosophy(null)}>
        clear
      </button>
    </div>
  );
}

function App() {
  return (
    <ProtectionProfileProvider>
      <Probe />
    </ProtectionProfileProvider>
  );
}

describe("valuesPhilosophy — provider setPhilosophy", () => {
  it("named → custom → named round trip keeps durable values", async () => {
    render(<App />);
    await screen.findByTestId("values");

    await act(async () => {
      screen.getByRole("button", { name: "named" }).click();
    });
    expect(screen.getByTestId("plan")).toHaveTextContent("buen_vivir");
    expect(screen.getByTestId("values")).toHaveTextContent("buen_vivir");

    await act(async () => {
      screen.getByRole("button", { name: "custom" }).click();
    });
    expect(screen.getByTestId("plan")).toHaveTextContent("custom");
    expect(screen.getByTestId("values")).toHaveTextContent("buen_vivir");

    await act(async () => {
      screen.getByRole("button", { name: "clear" }).click();
    });
    expect(screen.getByTestId("plan")).toHaveTextContent("none");
    expect(screen.getByTestId("values")).toHaveTextContent("none");
  });
});
