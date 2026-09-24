/**
 * ShieldStatusTier — the Shield tab's StatusTier element. Pure
 * presentation extracted from ProtectionTab: the previewing quiet tier,
 * the trust badge row, and the transition priority (sleeve back >
 * compare row > floor prompt > status row) with the RWA sleeve rail.
 */
import React from "react";
import type { GuardianTierState } from "@diversifi/shared/src/services/vault/guardian-tier-state";
import type { PlanLeg } from "@/components/protection-cards/plan-preview";
import type { strongerFloorOffer } from "@/lib/shield-lens";
import type { useNavigation } from "@/context/app/NavigationContext";
import type { usePlanBalancePreview } from "@/hooks/use-plan-balance-preview";
import { trackFunnelEvent } from "@/lib/analytics";
import { haptics } from "@/lib/haptics";
import { StatusTier } from "../../shared/StatusTier";
import { VerifiedEvidence } from "../../shared/VerifiedEvidence";
import StatusBadge from "../../shared/StatusBadge";
import { SLEEVE_ID } from "./ProtectionPlanRing";
import type { ShieldShape } from "./shield-shape";

export interface ShieldStatusTierProps {
  isPreviewing: boolean;
  guardianState: GuardianTierState;
  shape: ShieldShape;
  sleeveOpen: boolean;
  comparing: boolean;
  focusedToken: string | null;
  selectedHeld: number;
  selectedAlloc: PlanLeg | null;
  planName: string;
  planRingVisible: boolean;
  sleeveHostSymbol: string | null;
  address: string | null;
  isDemo: boolean;
  biggestGap: unknown;
  alignmentScore: number | null;
  floorOffer: NonNullable<ReturnType<typeof strongerFloorOffer>> | null;
  showFloorPrompt: boolean;
  balanceSelect: ReturnType<typeof usePlanBalancePreview>["select"];
  exitCompare: () => void;
  navigateToGuardian: ReturnType<typeof useNavigation>["navigateToGuardian"];
  setFocusedToken: (v: string | null) => void;
  setShowMobileWizard: (v: boolean) => void;
}

export function ShieldStatusTier({
  isPreviewing,
  guardianState,
  shape,
  sleeveOpen,
  comparing,
  focusedToken,
  selectedHeld,
  selectedAlloc,
  planName,
  planRingVisible,
  sleeveHostSymbol,
  address,
  isDemo,
  biggestGap,
  alignmentScore,
  floorOffer,
  showFloorPrompt,
  balanceSelect,
  exitCompare,
  navigateToGuardian,
  setFocusedToken,
  setShowMobileWizard,
}: ShieldStatusTierProps) {
  // The compare/quiet/monitoring row is empty in the gap+biggestGap case
  // (the CTA beneath the ring names the job) — don't burn the slot on it.
  const statusRowEmpty =
    !comparing &&
    guardianState !== "monitoring" &&
    shape === "gap" &&
    !focusedToken &&
    Boolean(biggestGap);

  return isPreviewing ? (
    <StatusTier trust={<VerifiedEvidence />} />
  ) : (
    <StatusTier
      trust={
        <div className="flex flex-wrap items-center gap-2">
          {guardianState === "monitoring" ? (
            <StatusBadge label="Guardian monitoring" tone="ready" compact />
          ) : shape === "fund" ? (
            <StatusBadge label="Wallet needs funds" tone="warning" compact />
          ) : shape === "gap" ? (
            <StatusBadge label="Plan needs review" tone="info" compact />
          ) : (
            <StatusBadge label="Choose a plan" tone="neutral" compact />
          )}
          <VerifiedEvidence className="ml-auto" />
        </div>
      }
      transition={
        sleeveOpen ? (
          <button
            type="button"
            data-testid="rwa-sleeve-back"
            onClick={() => setFocusedToken(null)}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400"
          >
            ← Back to plan
          </button>
        ) : showFloorPrompt && floorOffer ? (
          <button
            type="button"
            data-testid="shield-floor-prompt"
            onClick={() => {
              balanceSelect(floorOffer.next);
              haptics.tap();
              if (!isDemo) {
                trackFunnelEvent("lens_open", { tab: "protect", lens: "floor" });
              }
            }}
            className="min-h-[44px] text-xs font-semibold text-blue-600 dark:text-blue-400"
          >
            Your wallet keeps {floorOffer.heldFloor}% in dollars — try a stronger floor →
          </button>
        ) : statusRowEmpty ? undefined : (
          <div className="flex items-center justify-between gap-3 text-xs text-gray-600 dark:text-gray-300">
          {comparing ? (
        <p data-testid="shield-compare-status">
          Comparing philosophies against your wallet ·{" "}
          <button
            type="button"
            onClick={exitCompare}
            className="font-semibold text-blue-600 dark:text-blue-400"
          >
            Keep {planName}
          </button>
        </p>
      ) : shape === "quiet" ? (
        <p data-testid="shield-quiet">Plan aligned. Guardian is monitoring.</p>
      ) : guardianState === "monitoring" ? (
        <p>Guardian is monitoring this plan.</p>
      ) : shape === "gap" && !focusedToken && biggestGap ? (
        // The biggest-gap CTA beneath the ring names the job — no
        // duplicate sentence here.
        null
      ) : (
        <p>
          {shape === "gap"
            ? "Tap a slice to close the gap."
            : shape === "fund"
              ? "Fund this plan to start protection."
              : "Choose your protection philosophy."}
        </p>
      )}
      {!comparing && address && guardianState === "monitoring" && (
        <button
          type="button"
          onClick={() => {
            // Carry the focused slice (or plan) so Guardian opens with
            // the user's context, not a generic status page.
            navigateToGuardian(
              focusedToken
                ? {
                    summary: `${focusedToken} — ${selectedHeld.toFixed(0)}% held${selectedAlloc ? ` vs ${selectedAlloc.percent}% target` : ""}`,
                    prompt: `Guardian, what's the status on my ${focusedToken} holding (${selectedHeld.toFixed(0)}% held${selectedAlloc ? ` vs ${selectedAlloc.percent}% target` : ""}) for my ${planName} plan?`,
                  }
                : undefined,
            );
          }}
          className="min-h-[44px] px-3 font-semibold text-blue-600 dark:text-blue-400 shrink-0"
        >
          Guardian activity
        </button>
      )}
      {!comparing && address && guardianState !== "monitoring" &&
        !(shape === "gap" && !focusedToken && biggestGap) &&
        (shape === "quiet" || (alignmentScore != null && alignmentScore >= 80)) && (
        <button
          type="button"
          onClick={() => setShowMobileWizard(true)}
          className="min-h-[44px] px-3 font-semibold text-blue-600 dark:text-blue-400 shrink-0"
        >
          Set up Guardian
        </button>
      )}
          </div>
        )
      }
      rail={
        // RWA sleeve rail — the status/transition grammar (§5 rail 4). Plans
        // with an RWA leg reach the sleeve through the hatched wedge; every
        // other persona reaches it here. Never while the sleeve is open —
        // its exit lives in the transition slot.
        !sleeveOpen &&
        !comparing &&
        planRingVisible &&
        !sleeveHostSymbol &&
        !focusedToken ? (
          <button
            type="button"
            data-testid="rwa-sleeve-entry"
            onClick={() => setFocusedToken(SLEEVE_ID)}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400"
          >
            RWA vaults: preview a yield sleeve →
          </button>
        ) : undefined
      }
    />
  );
}
