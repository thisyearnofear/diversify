/**
 * ClaimRail — the persistent daily-G$ affordance, living in Home's status
 * tier (design-language §5 rail 4: contextual affordances ride the rail,
 * not the object).
 *
 * One line that morphs with the claim state machine:
 *   claimable    → "🪙 Daily G$ ready — Claim Daily G$ →"  (the payday;
 *                   the only state that earns the emerald accent)
 *   needs verify → "Verify once to unlock daily G$ →"
 *   claimed      → quiet "✓ Today's G$ claimed"
 *   in-flight    → "Claiming your daily G$…"
 *   else         → nothing — absence is honest
 *
 * Self-contained: reads StreakRewards + ClaimFlow contexts defensively and
 * renders nothing outside their providers. The success celebration is the
 * provider-mounted ClaimFlowOverlay, so a claim from here lands the same
 * moment as a claim from anywhere else.
 */

import React from "react";
import { useStreakRewards } from "@/hooks/use-streak-rewards";
import { useClaimFlowContext } from "@/hooks/claim-flow-context";
import { STREAK_CONFIG } from "@diversifi/shared/src/modules/rewards/streak/types";

export function ClaimRail({
  setupMode = "inline",
}: {
  setupMode?: "inline" | "entry";
}) {
  const [entryOpen, setEntryOpen] = React.useState(false);
  let streak: ReturnType<typeof useStreakRewards> | null = null;
  let flow: ReturnType<typeof useClaimFlowContext> | null = null;
  try {
    streak = useStreakRewards();
    flow = useClaimFlowContext();
  } catch {
    return null; // outside the providers (isolated tests, SSR shells)
  }

  if (streak.isLoading) return null;

  // In-flight and error states — transient, owned by the shared flow.
  if (flow.claimStatus === "claiming") {
    return (
      <p data-testid="claim-rail" className="text-xs text-gray-500 dark:text-gray-400">
        Claiming your daily G$…
      </p>
    );
  }
  if (flow.claimStatus === "error" && flow.claimError) {
    return (
      <p data-testid="claim-rail" className="text-xs text-red-600 dark:text-red-400">
        {flow.claimError}{" "}
        <a
          href={STREAK_CONFIG.G_CLAIM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="underline font-medium"
        >
          Claim on GoodDollar →
        </a>
      </p>
    );
  }

  // The payday — the one state that earns the warm accent.
  if (streak.canClaim) {
    return (
      <button
        type="button"
        data-testid="claim-rail"
        onClick={() => void flow.handleClaim()}
        className="min-h-tap text-left text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-200 transition-colors"
      >
        🪙 Daily G$ ready ({streak.estimatedReward}) — <span className="font-black">Claim Daily G$ →</span>
      </button>
    );
  }

  // Not face-verified — the one-time gate before claiming. Any wallet can
  // verify, streak or not.
  if (!streak.isWhitelisted) {
    if (flow.verifyStatus === "awaiting") {
      return (
        <p data-testid="claim-rail" className="text-xs text-gray-500 dark:text-gray-400">
          {setupMode === "entry"
            ? "GoodDollar identity verification in progress — we check automatically when you return."
            : "Verification in progress — we check automatically when you return."}
        </p>
      );
    }
    if (setupMode === "entry") {
      if (!entryOpen) {
        return (
          <button
            type="button"
            data-testid="claim-rail"
            onClick={() => setEntryOpen(true)}
            className="min-h-tap text-left text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            GoodDollar daily income →
          </button>
        );
      }
      return (
        <div data-testid="claim-rail" className="text-xs">
          <p className="text-gray-500 dark:text-gray-400">
            GoodDollar uses a one-time identity check before daily G$ claims.
          </p>
          <div className="mt-1 flex items-center gap-3">
            <button
              type="button"
              onClick={() => void flow.handleVerify()}
              disabled={flow.verifyStatus === "opening"}
              className="min-h-tap text-left font-semibold text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-60"
            >
              {flow.verifyStatus === "opening"
                ? "Opening verification…"
                : "Verify identity with GoodDollar"}
            </button>
            <button
              type="button"
              onClick={() => setEntryOpen(false)}
              className="min-h-tap font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Back
            </button>
          </div>
        </div>
      );
    }
    return (
      <button
        type="button"
        data-testid="claim-rail"
        onClick={() => void flow.handleVerify()}
        disabled={flow.verifyStatus === "opening"}
        className="min-h-tap text-left text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-60"
      >
        {flow.verifyStatus === "opening"
          ? "Opening verification…"
          : "Verify once to unlock daily G$ →"}
      </button>
    );
  }

  // Claimed today (the chain says so) — quiet confirmation, no action.
  if (streak.isWhitelisted && streak.alreadyClaimedOnChain) {
    return (
      <p data-testid="claim-rail" className="text-xs text-gray-500 dark:text-gray-400">
        ✓ Today&apos;s G$ claimed
      </p>
    );
  }

  return null;
}
