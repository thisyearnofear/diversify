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
      toChainId: 42220,
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

  // Updated: an unservable chainId used to be dropped, leaving the ticket on
  // the wallet's chain where the controller swaps in a different token. The
  // prefill now always names the chain the token actually lives on.
  it("replaces a chainId the swap rail cannot serve with the token's own rail", () => {
    const prefill = guardianProposalPrefill({
      targetToken: "EURm",
      contract: {
        action: { type: "open_swap_review", toToken: "EURm", chainId: 999999 },
      },
    });
    expect(prefill?.toChainId).toBe(42220);
  });

  it("carries the target chain for a PAXG proposal", () => {
    expect(
      guardianProposalPrefill({ action: "BUY", targetToken: "PAXG", tradeAmountUSD: 20 }),
    ).toMatchObject({ toToken: "PAXG", toChainId: 42161, amount: "20" });
    expect(
      guardianProposalPrefill({ targetToken: "PAXG", targetChainId: 42161 })?.toChainId,
    ).toBe(42161);
  });

  it("corrects a target chain that doesn't hold the token", () => {
    expect(
      guardianProposalPrefill({ targetToken: "PAXG", targetChainId: 42220 })?.toChainId,
    ).toBe(42161);
  });

  it("returns null for a token no executable rail holds", () => {
    expect(guardianProposalPrefill({ action: "BUY", targetToken: "GOLD" })).toBeNull();
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
