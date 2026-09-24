/**
 * guardianProposalPrefill — map a pending Guardian proposal to the swap
 * prefill the Exchange ticket consumes.
 *
 * One-tap approval IS the default execution path: nothing moves until the
 * user signs in their own wallet, so the proposal hands off the pair,
 * amount, and an `origin: guardian` marker (the PairReceipt's "Back to
 * Guardian" line keys off it).
 *
 * Returns null for proposals that aren't a user-signable move (HOLD,
 * observation-only, or no target token). A `chainId` the swap rail can't
 * serve is dropped — the ticket's own chain flow handles switching.
 */

import type { SwapPrefill } from "../context/app/types";
import { ChainDetectionService } from "@diversifi/shared/src/services/swap/chain-detection.service";

export function guardianProposalPrefill(rec: {
  action?: string;
  targetToken?: string;
  oneLiner?: string;
  reasoning?: string;
  tradeAmountUSD?: number;
  contract?: {
    action?: {
      type: string;
      fromToken?: string;
      toToken?: string;
      chainId?: number;
      amount?: string;
      reason?: string;
    };
  };
}): SwapPrefill | null {
  if (rec.action === "HOLD") return null;
  const reason = rec.oneLiner ?? rec.reasoning;
  const origin = { source: "guardian" as const };
  const action = rec.contract?.action;
  if (action?.type === "open_swap_review") {
    return {
      fromToken: action.fromToken,
      toToken: action.toToken,
      amount: action.amount ?? (rec.tradeAmountUSD ? String(rec.tradeAmountUSD) : undefined),
      toChainId:
        action.chainId && ChainDetectionService.isSupported(action.chainId)
          ? action.chainId
          : undefined,
      reason: action.reason ?? reason,
      origin,
    };
  }
  if (action?.type === "observation_only") return null;
  if (!rec.targetToken) return null;
  return {
    toToken: rec.targetToken,
    amount: rec.tradeAmountUSD ? String(rec.tradeAmountUSD) : undefined,
    reason,
    origin,
  };
}
