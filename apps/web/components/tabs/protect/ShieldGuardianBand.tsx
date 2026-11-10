/**
 * ShieldGuardianBand — the Guardian's state *for this plan*, read from the
 * plan rather than from a row under it (design-language §5: one reading slot,
 * one band).
 *
 * The tier used to spend three lines on this: a badge, a sentence, and a
 * "Set up Guardian" link in the action hue, all competing with the ring. Here
 * the band answers one question — is the Guardian watching this plan yet? —
 * and carries the single action that follows. Anything deeper (the decision
 * journal, the limits) is the Guardian tab's own object, reached by the one
 * hand-off, never duplicated on Shield.
 *
 * A band with nothing to say withdraws its pill (§5: no empty slot), so this
 * only mounts when `guardianState` says there is a real state or offer.
 */

import React from "react";
import StatusBadge from "../../shared/StatusBadge";

interface Props {
  monitoring: boolean;
  /** Omitted on the sample morph, which never names a plan of the user's. */
  planName?: string;
  /** The focused slice's held-vs-target reading, carried into the hand-off so
   *  Guardian opens on the user's context instead of a generic status page. */
  activityContext?: { summary: string; prompt: string };
  /** Hands off to the Guardian's own object with the user's context. */
  onOpenActivity: () => void;
  onSetUp: () => void;
  /** Walletless: there is no plan of theirs to watch, so the band offers the
   *  Guardian's example decision instead of a setup it cannot run. */
  sample?: boolean;
  /** Whether this plan's targets are the ones the Guardian measures. The
   *  one place that says so, so the band never claims a review it hasn't. */
  sync?: { synced: boolean; syncing: boolean; onSync: () => void } | null;
}

export function ShieldGuardianBand({
  monitoring,
  planName,
  activityContext,
  onOpenActivity,
  onSetUp,
  sample = false,
  sync,
}: Props) {
  if (monitoring) {
    return (
      <div
        data-testid="shield-guardian-band"
        className="flex flex-col items-center gap-1.5 text-center"
      >
        <button
          type="button"
          data-testid="guardian-activity"
          aria-label="Guardian monitoring this plan — view activity"
          onClick={onOpenActivity}
          className="min-h-tap"
        >
          <StatusBadge label="Guardian monitoring" tone="ready" compact />
        </button>
        <p className="text-2xs text-ink-muted">
          Every move it makes is recorded, explainable and yours to approve.
        </p>
        {sync &&
          (sync.synced ? (
            <p
              data-testid="shield-plan-synced"
              className="text-3xs font-medium text-gray-400 dark:text-gray-500"
            >
              Targets synced for measured review
            </p>
          ) : (
            <span className="inline-flex items-center gap-2" data-testid="shield-plan-unsynced">
              <span className="text-3xs font-medium text-gray-500 dark:text-gray-400">
                {sync.syncing ? "Syncing…" : "On this device"}
              </span>
              {!sync.syncing && (
                <button
                  type="button"
                  onClick={sync.onSync}
                  className="min-h-tap text-3xs font-semibold text-blue-600 dark:text-blue-400"
                >
                  Sync targets for measured review
                </button>
              )}
            </span>
          ))}
      </div>
    );
  }

  return (
    <div
      data-testid="shield-guardian-band"
      className="flex flex-col items-center gap-1.5 text-center"
    >
      <p className="text-sm font-semibold text-ink">
        {sample
          ? "The Guardian watches a plan you have set."
          : `The Guardian is not watching your ${planName} plan yet.`}
      </p>
      <button
        type="button"
        data-testid={sample ? "guardian-plan-link" : "guardian-setup"}
        onClick={onSetUp}
        className="min-h-tap px-2 text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
      >
        {sample ? "See an example decision" : "Set up Guardian"}
      </button>
      <p className="text-2xs text-ink-muted">
        You set the rules. It proposes within them — nothing moves without you.
      </p>
    </div>
  );
}

export default ShieldGuardianBand;
