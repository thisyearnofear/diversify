import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";

const mockSetFinancialStrategy = vi.fn();
const mockRecordActivity = vi.fn(() => Promise.resolve());
let mockStrategy: string | null = null;

vi.mock("@/context/app/StrategyContext", () => ({
  useStrategy: () => ({
    financialStrategy: mockStrategy,
    setFinancialStrategy: mockSetFinancialStrategy,
  }),
}));

vi.mock("@/hooks/use-streak-rewards", () => ({
  useStreakRewards: () => ({ recordActivity: mockRecordActivity }),
}));

vi.mock("@/components/wallet/WalletProvider", () => ({
  useWalletContext: () => ({ address: "0xabc", chainId: 42220 }),
}));

vi.mock("@/components/tabs/protect/ProtectionAmbient", () => ({
  useAmbientOrigin: () => ({ reportTapOrigin: vi.fn() }),
}));

vi.mock("@/components/protection-cards/tokens", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/protection-cards/tokens")>();
  return {
    ...actual,
    ARCHETYPE_ORDER: ["africapitalism"],
  };
});

vi.mock("@/components/protection-cards/cards", () => ({
  CARD_REGISTRY: {
    africapitalism: () => React.createElement("div", { "data-testid": "africa-card" }),
  },
}));

import { ProtectionPlanGallery } from "../ProtectionPlanGallery";

describe("ProtectionPlanGallery — inspect vs commit", () => {
  beforeEach(() => {
    mockStrategy = null;
    mockSetFinancialStrategy.mockReset();
    mockRecordActivity.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("commits immediately when onInspect is omitted", () => {
    render(<ProtectionPlanGallery mobile />);
    fireEvent.click(screen.getByRole("button", { name: /Select Africapitalism/i }));
    expect(mockSetFinancialStrategy).toHaveBeenCalledWith("africapitalism");
    expect(mockRecordActivity).toHaveBeenCalled();
  });

  it("inspects without committing when onInspect is set", () => {
    const onInspect = vi.fn();
    render(<ProtectionPlanGallery mobile onInspect={onInspect} />);
    fireEvent.click(screen.getByRole("button", { name: /Inspect Africapitalism/i }));
    expect(onInspect).toHaveBeenCalledWith("africapitalism");
    expect(mockSetFinancialStrategy).not.toHaveBeenCalled();
    expect(mockRecordActivity).not.toHaveBeenCalled();
  });
});
