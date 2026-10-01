/**
 * ShieldStatusTier — the Shield tab's StatusTier element. Pure
 * presentation extracted from ProtectionTab: the previewing quiet tier,
 * the trust badge row, and the transition priority (sleeve back >
 * status row). The rail slot offers the payment-cycle entry for business
 * personas; the connected plan's balance and tokenized assets live by the ring.
 */
import React from "react";
import type { GuardianTierState } from "@diversifi/shared/src/services/vault/guardian-tier-state";
import type { PlanLeg } from "@/components/protection-cards/plan-preview";
import type { useNavigation } from "@/context/app/NavigationContext";
import { StatusTier } from "../../shared/StatusTier";
import { VerifiedEvidence } from "../../shared/VerifiedEvidence";
import StatusBadge from "../../shared/StatusBadge";
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
  address: string | null;
  biggestGap: unknown;
  alignmentScore: number | null;
  exitCompare: () => void;
  navigateToGuardian: ReturnType<typeof useNavigation>["navigateToGuardian"];
  setFocusedToken: (v: string | null) => void;
  /** Hands off to the Guardian tab — the one place a daily limit is set. */
  onSetUpGuardian: () => void;
  /** Business morph: the rail offers the payment-cycle entry, not RWA. */
  businessMorph: boolean;
  /** The cycle inspector is open — the rail steps aside while it is. */
  cycleOpen: boolean;
  /** Opens the payment-cycle inspector in next-payment mode. */
  onOpenCycle: () => void;
  /** Quiet memory — alignment drift since the last visit. Lived here
   *  (transition tier) rather than stacked into the ring hole. */
  sinceHint?: string;
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
  address,
  biggestGap,
  alignmentScore,
  exitCompare,
  navigateToGuardian,
  setFocusedToken,
  onSetUpGuardian,
  businessMorph,
  cycleOpen,
  onOpenCycle,
  sinceHint,
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
        ) : statusRowEmpty && !sinceHint ? undefined : (
          <>
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
          className="min-h-tap px-3 font-semibold text-blue-600 dark:text-blue-400 shrink-0"
        >
          Guardian activity
        </button>
      )}
      {!comparing && address && guardianState !== "monitoring" &&
        !(shape === "gap" && !focusedToken && biggestGap) &&
        (shape === "quiet" || (alignmentScore != null && alignmentScore >= 80)) && (
        <button
          type="button"
          onClick={() => onSetUpGuardian()}
          className="min-h-tap px-3 font-semibold text-blue-600 dark:text-blue-400 shrink-0"
        >
          Set up Guardian
        </button>
      )}
          </div>
            {sinceHint && !comparing && (
              <p
                data-testid="shield-since-last-visit"
                className="mt-1 text-3xs font-medium text-gray-400 dark:text-gray-500 tabular-nums"
              >
                {sinceHint}
              </p>
            )}
          </>
        )
      }
      rail={
        // Business personas keep the plan-independent payment-cycle rail;
        // the connected plan's tokenized-asset action sits by its ring.
        businessMorph &&
        !sleeveOpen &&
        !comparing &&
        !focusedToken &&
        !cycleOpen ? (
          <button
            type="button"
            data-testid="cycle-entry"
            onClick={onOpenCycle}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400"
          >
            What FX timing costs your next payment →
          </button>
        ) : undefined
      }
    />
  );
}
