/**
 * ShieldVerifyBand — the two lines the ring can't say about itself.
 *
 * Opening Verify re-slices the marquee ring into the public ledger: one arc
 * per token the Guardian decided about, sized by how often it was named; the
 * hole counts the whole ledger; the rows read the decisions. What's left for
 * the slot under the object is the measure the arcs are honest about, and the
 * two doors deeper — check a receipt, read the plumbing (§7: verdict → check
 * → hex, and the hex never enters the first viewport).
 *
 * On the compact picker the ring has no legend rows to turn into decisions,
 * so the arcs name themselves in one line here — the reading stays two lines
 * and the stage never grows a panel beneath the object.
 *
 * When the feed can't be read the ring keeps the plan and this says so in
 * plain terms: nothing is implied by an arc that has no record behind it.
 */
import React from 'react';
import { VerifiedEvidencePanel } from '@/components/shared/VerifiedEvidence';
import { displayToken } from '@/lib/plan-legs';
import { LEDGER_OTHER_TOKEN, type LedgerView } from '@/lib/shield-ledger-view';

export function ShieldVerifyBand({
  view,
  compact = false,
}: {
  view: LedgerView;
  /** The ring is the compact picker, so its arcs have no rows beside them. */
  compact?: boolean;
}) {
  if (view.state !== 'ready') {
    // The feed couldn't be read, or it holds nothing legible: the verifier
    // speaks for itself — the same panel the status rail uses, staged.
    return (
      <div data-testid="shield-verifier" className="mx-auto w-full max-w-[420px]">
        <VerifiedEvidencePanel presentation="stage" />
      </div>
    );
  }
  return (
    <div
      data-testid="shield-verifier"
      className="mx-auto mt-2 w-full max-w-[420px] space-y-1 text-center"
    >
      {compact ? (
        <p className="text-2xs text-ink-muted">
          {view.legs.map((leg) =>
            leg.token === LEDGER_OTHER_TOKEN
              ? `Other ${leg.count}`
              : `${displayToken(leg.token)} ${leg.count}`
          ).join(' · ')}{' '}
          — {view.windowCount} most recent decisions
        </p>
      ) : (
        <p className="text-2xs text-ink-muted">
          Arcs are the {view.windowCount} most recent decisions, split by the
          token each one named
        </p>
      )}
      <VerifiedEvidencePanel presentation="doors" />
    </div>
  );
}

export default ShieldVerifyBand;
