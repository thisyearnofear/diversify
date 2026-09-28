/**
 * Target-chain resolution — which executable rail a recommended token
 * actually lives on.
 *
 * A token only counts as "on" a chain when that chain can execute swaps
 * and its token map lists a real address for the token (aliases like
 * cEUR/EURm collapse via canonicalToken). With no requested chain the
 * first mainnet rail that holds the token wins, in capability-table order
 * (Celo before Arbitrum).
 */
import { ChainDetectionService } from "@diversifi/shared/src/services/swap/chain-detection.service";
import type { GuardianRecommendationContract } from "@diversifi/shared/src/types/guardian-protection";
import { isKnownCeloToken } from "@diversifi/shared/src/config/celo-tokens";
import { isTestnetChain } from "@/config";
import { canonicalToken, isLegFillable } from "./plan-legs";

export function isTokenOnExecutableChain(token: string, chainId: number): boolean {
  return ChainDetectionService.isSupported(chainId) && isLegFillable(token, chainId);
}

export function resolveTargetChainId(
  token: string | null | undefined,
  requestedChainId?: number | null,
): number | null {
  if (!token) return null;
  if (requestedChainId != null) {
    return isTokenOnExecutableChain(token, requestedChainId) ? requestedChainId : null;
  }
  return (
    ChainDetectionService.getSupportedChainIds()
      .filter((id) => !isTestnetChain(id))
      .find((id) => isLegFillable(token, id)) ?? null
  );
}

function parseChainId(value: unknown): number | undefined {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isInteger(n) && n > 0 ? n : undefined;
}

export interface ChainAwareAdvice {
  action?: string;
  targetToken?: string;
  token?: string;
  targetChainId?: unknown;
  contract?: GuardianRecommendationContract;
}

/**
 * Server-side check on advisor output: the (targetToken, targetChainId)
 * pair must name a token on an executable rail. A missing chain is filled
 * from the token's rail; an impossible pair (unknown chain, token not on
 * that chain, token on no rail) becomes observation-only so nothing
 * downstream turns it into a swap.
 */
export function withValidatedTargetChain<T extends ChainAwareAdvice>(
  advice: T,
): Omit<T, "targetChainId"> & {
  targetChainId?: number;
  contract?: GuardianRecommendationContract;
} {
  const { targetChainId: rawChainId, ...rest } = advice;
  const token = advice.targetToken ?? advice.token;
  if (!token || advice.action === "HOLD") return rest;
  const chainId = resolveTargetChainId(token, parseChainId(rawChainId) ?? null);
  if (chainId != null) return { ...rest, targetChainId: chainId };
  return {
    ...rest,
    contract: {
      ...advice.contract,
      lifecycleState: "observed",
      action: { type: "observation_only" },
    },
  };
}

/**
 * The Celo executor's symbol for a target, or null when the target isn't
 * on the Celo rail (no token, a non-Celo chain, or a token Celo doesn't
 * list). Server-side Guardian execution only signs on Celo.
 */
export function celoExecutionTarget(
  token: string | null | undefined,
  chainId?: number | null,
): string | null {
  if (!token) return null;
  if (chainId != null && !ChainDetectionService.isCelo(chainId)) return null;
  if (isKnownCeloToken(token)) return token;
  const canonical = canonicalToken(token);
  return isKnownCeloToken(canonical) ? canonical : null;
}
