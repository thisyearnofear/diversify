import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// The one legibility control: Quiet/Informed row + origin disclosure.
const visibilityMock = vi.hoisted(() => ({
  current: {
    visibility: "informed" as "quiet" | "informed",
    origin: "persona" as "persona" | "user" | "agent",
    setVisibility: vi.fn(),
  },
}));

vi.mock("@/context/app/GuardianVisibilityContext", () => ({
  useGuardianVisibility: () => visibilityMock.current,
}));
const stableWallet = vi.hoisted(() => ({ address: "0xabc", chainId: 42220 }));
vi.mock("@/components/wallet/WalletProvider", () => ({
  useWalletContext: () => stableWallet,
}));
vi.mock("@privy-io/react-auth", () => ({
  usePrivy: () => ({ user: null }),
}));
const stableVoice = vi.hoisted(() => ({
  isEnabled: false,
  enable: vi.fn(),
  disable: vi.fn(),
}));
vi.mock("@/components/ui/VoiceButton", () => ({
  useVoiceEnabled: () => stableVoice,
  default: () => null,
}));
const stableToast = vi.hoisted(() => ({ showToast: vi.fn() }));
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => stableToast,
}));
vi.mock("@/components/shared/GuardianMascot", () => ({
  GuardianMascot: () => <div data-testid="guardian-mascot" />,
}));

import AutomationSettings from "../AutomationSettings";

describe("AutomationSettings — Guardian updates row", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    visibilityMock.current = {
      visibility: "informed",
      origin: "persona",
      setVisibility: vi.fn(),
    };
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })));
  });

  it("renders the segmented control with the current mode pressed and a user change attributed", async () => {
    render(<AutomationSettings />);
    const quiet = await screen.findByRole("button", { name: /^quiet/i });
    const informed = screen.getByRole("button", { name: /^informed/i });

    expect(informed).toHaveAttribute("aria-pressed", "true");
    expect(quiet).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(quiet);
    expect(visibilityMock.current.setVisibility).toHaveBeenCalledWith("quiet", "user");
  });

  it("discloses an agent-applied change so it stays legible and reversible", async () => {
    visibilityMock.current = {
      visibility: "quiet",
      origin: "agent",
      setVisibility: vi.fn(),
    };
    render(<AutomationSettings />);
    await screen.findByRole("button", { name: /^quiet/i });
    expect(
      screen.getByText(/Set by Guardian from a conversation/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/You can also just tell Guardian/),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("guardian-mascot")).toBeInTheDocument());
  });
});
