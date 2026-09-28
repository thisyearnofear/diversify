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
 * observation-only, no target token, or a token no executable rail holds).
 * The prefill always names the destination chain: a requested chain that
 * can't serve the token falls back to the token's own rail, so the ticket
 * never swaps in a different asset on the wallet's current chain.
 */

import type { SwapPrefill } from "../context/app/types";
import { resolveTargetChainId } from "./target-chain";

function destinationChain(token: string, requested?: number): number | null {
  return (
    (requested != null ? resolveTargetChainId(token, requested) : null) ??
    resolveTargetChainId(token)
  );
}

export function guardianProposalPrefill(rec: {
  action?: string;
  targetToken?: string;
  targetChainId?: number;
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
    if (!action.toToken) return null;
    const toChainId = destinationChain(action.toToken, action.chainId);
    if (toChainId == null) return null;
    return {
      fromToken: action.fromToken,
      toToken: action.toToken,
      amount: action.amount ?? (rec.tradeAmountUSD ? String(rec.tradeAmountUSD) : undefined),
      toChainId,
      reason: action.reason ?? reason,
      origin,
    };
  }
  if (action?.type === "observation_only") return null;
  if (!rec.targetToken) return null;
  const toChainId = destinationChain(rec.targetToken, rec.targetChainId);
  if (toChainId == null) return null;
  return {
    toToken: rec.targetToken,
    toChainId,
    amount: rec.tradeAmountUSD ? String(rec.tradeAmountUSD) : undefined,
    reason,
    origin,
  };
}
