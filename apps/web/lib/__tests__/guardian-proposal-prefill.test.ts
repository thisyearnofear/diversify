import { describe, expect, it } from "vitest";
import { guardianProposalPrefill } from "../guardian-proposal-prefill";

// The pending Guardian proposal is the one-tap approval surface: the CTA
// hands the pair, amount, and origin to the Exchange ticket — the user's
// own wallet signs. Nothing here executes anything.
describe("guardianProposalPrefill", () => {
  it("maps a targetToken proposal to a guardian-origin prefill", () => {
    expect(
      guardianProposalPrefill({
        action: "REBALANCE",
        targetToken: "KESm",
        tradeAmountUSD: 25,
        oneLiner: "Rotate to KESm ahead of the CPI print",
      }),
    ).toEqual({
      toToken: "KESm",
      amount: "25",
      reason: "Rotate to KESm ahead of the CPI print",
      origin: { source: "guardian" },
    });
  });

  it("prefers the typed open_swap_review contract over snapshot fields", () => {
    expect(
      guardianProposalPrefill({
        targetToken: "EURm",
        tradeAmountUSD: 10,
        contract: {
          action: {
            type: "open_swap_review",
            fromToken: "USDm",
            toToken: "EURm",
            chainId: 42220,
            amount: "40",
            reason: "contract reason",
          },
        },
      }),
    ).toEqual({
      fromToken: "USDm",
      toToken: "EURm",
      amount: "40",
      toChainId: 42220,
      reason: "contract reason",
      origin: { source: "guardian" },
    });
  });

  it("drops a chainId the swap rail cannot serve", () => {
    const prefill = guardianProposalPrefill({
      targetToken: "EURm",
      contract: {
        action: { type: "open_swap_review", toToken: "EURm", chainId: 999999 },
      },
    });
    expect(prefill?.toChainId).toBeUndefined();
  });

  it("returns null for HOLD, observation-only, and tokenless proposals", () => {
    expect(guardianProposalPrefill({ action: "HOLD", targetToken: "KESm" })).toBeNull();
    expect(
      guardianProposalPrefill({
        targetToken: "KESm",
        contract: { action: { type: "observation_only" } },
      }),
    ).toBeNull();
    expect(guardianProposalPrefill({ action: "REBALANCE" })).toBeNull();
  });
});
