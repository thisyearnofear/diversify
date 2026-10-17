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
  planSync?: { synced: boolean; syncing: boolean; onSync: () => void } | null;
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
  planSync,
}: ShieldStatusTierProps) {
  // One resting row: badge · state text · [Set up Guardian] · sinceHint ·
  // verified. A second row only exists while a mode needs it — the
  // sleeve's back door or the compare exit. In the gap+biggestGap case
  // the CTA beneath the ring names the job, so no text rides here.
  const restingText =
    sleeveOpen || comparing
      ? null
      : shape === "quiet"
        ? "Plan aligned."
        : shape === "gap"
          ? !focusedToken && biggestGap
            ? null
            : "Tap a slice to close the gap."
          : shape === "fund"
            ? "Add funds to start. Nothing moves without your approval."
            : "Pick a plan to see what it would hold.";

  const showSetup =
    !comparing &&
    Boolean(address) &&
    guardianState !== "monitoring" &&
    !(shape === "gap" && !focusedToken && biggestGap) &&
    (shape === "quiet" || (alignmentScore != null && alignmentScore >= 80));

  return isPreviewing ? (
    <StatusTier trust={<VerifiedEvidence />} />
  ) : (
    <StatusTier
      trust={
        <div className="flex flex-wrap items-center gap-2">
          {guardianState === "monitoring" ? (
            // The badge IS the activity door — no separate link, no
            // monitoring sentence beneath it.
            address ? (
              <button
                type="button"
                data-testid="guardian-activity"
                aria-label="Guardian monitoring — view activity"
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
                className="min-h-tap"
              >
                <StatusBadge label="Guardian monitoring" tone="ready" compact />
              </button>
            ) : (
              <StatusBadge label="Guardian monitoring" tone="ready" compact />
            )
          ) : shape === "fund" ? (
            <StatusBadge label="Wallet needs funds" tone="warning" compact />
          ) : shape === "gap" ? (
            <StatusBadge label="Plan needs review" tone="info" compact />
          ) : (
            <StatusBadge label="Choose a plan" tone="neutral" compact />
          )}
          {restingText && (
            <p
              data-testid={shape === "quiet" ? "shield-quiet" : undefined}
              className="text-xs text-gray-600 dark:text-gray-300"
            >
              {restingText}
            </p>
          )}
          {showSetup && (
            <button
              type="button"
              onClick={() => onSetUpGuardian()}
              className="min-h-tap px-1 font-semibold text-blue-600 dark:text-blue-400 shrink-0"
            >
              Set up Guardian
            </button>
          )}
          {!comparing && sinceHint && (
            <span
              data-testid="shield-since-last-visit"
              className="ml-auto shrink-0 text-3xs font-medium text-gray-400 dark:text-gray-500 tabular-nums"
            >
              {sinceHint}
            </span>
          )}
          <VerifiedEvidence
            className={!comparing && sinceHint ? undefined : "ml-auto"}
          />
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
        ) : comparing ? (
          <p data-testid="shield-compare-status" className="text-xs text-gray-600 dark:text-gray-300">
            Comparing philosophies against your wallet ·{" "}
            <button
              type="button"
              onClick={exitCompare}
              className="font-semibold text-blue-600 dark:text-blue-400"
            >
              Keep {planName}
            </button>
          </p>
        ) : undefined
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
        ) : planSync && !sleeveOpen && !comparing && !focusedToken && !cycleOpen ? (
          planSync.synced ? (
            <p
              data-testid="shield-plan-synced"
              className="text-2xs font-medium text-gray-400 dark:text-gray-500"
            >
              Targets synced for measured review
            </p>
          ) : (
            <span className="inline-flex items-center gap-2" data-testid="shield-plan-unsynced">
              <span className="text-2xs font-medium text-gray-500 dark:text-gray-400">
                {planSync.syncing ? "Syncing…" : "On this device"}
              </span>
              {!planSync.syncing && (
                <button
                  type="button"
                  onClick={planSync.onSync}
                  className="text-2xs font-semibold text-blue-600 dark:text-blue-400"
                >
                  Sync targets for measured review
                </button>
              )}
            </span>
          )
        ) : undefined
      }
    />
  );
}
