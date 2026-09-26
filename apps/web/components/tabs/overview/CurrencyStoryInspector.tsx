/**
 * CurrencyStoryInspector — the Home coin's L2: the currency's dated
 * risk-event trail, a share line for its card, and the Ask Guardian
 * hand-off. Opens when the moment's local coin is tapped; closing it
 * flips the coin face-up again. Derived data only — same trail grammar
 * as the corridor inspector, newest first.
 */
import React, { useState } from 'react';
import { InspectorSheet } from '../../shared/InspectorSheet';
import { useAdvisor } from '@/hooks/use-advisor';
import {
  CURRENCY_BY_CODE,
  riskEventAge,
  riskTrailCheckedAt,
} from '@/constants/currency-risk';
import { momentCardContent } from '@/lib/moment-card';
import { trackFunnelEvent } from '@/lib/analytics';

/** The currency's story is public knowledge — shareable via a card whose
 *  numbers are derived from the code alone. */
function MomentShareLine({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/moment/${code}`;
  const share = async () => {
    trackFunnelEvent('share_open', { source: 'moment_card' });
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: `The story of ${code}`, url });
        return;
      } catch {
        return; // dismissed sheet — nothing to copy
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — quiet no-op
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      className="mt-2 min-h-11 px-1 text-[11px] font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
    >
      {copied ? 'Link copied' : "Share this currency's story ↗"}
    </button>
  );
}

/** Sheet body — mounts only while the sheet is open, so the advisor
 *  hook never fires (or requires a provider) for a resting coin. */
function CurrencyStoryBody({
  code,
  onClose,
}: {
  code: string;
  onClose: () => void;
}) {
  const { askAdvisor } = useAdvisor();
  const entry = CURRENCY_BY_CODE[code] ?? null;
  const content = momentCardContent(code);
  const trail = entry ? [...entry.riskEvents].sort((a, b) => b.year - a.year) : [];
  if (!entry) return null;
  return (
    <div className="space-y-2 text-left">
      {/* The dated trail — what geopolitics has already done to this
          currency, newest first. Curated events, not a feed. */}
      {trail.length > 0 && (
        <div className="space-y-0.5">
          {trail.map((ev, i) => (
            <p
              key={`${ev.year}-${i}`}
              className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed"
            >
              {ev.year} ({riskEventAge(ev.year)}): {ev.event} — {ev.impact}
            </p>
          ))}
          {/* Freshness is disclosed, not implied — same provenance
              grammar as the corridor trail. */}
          <p className="text-[10px] text-gray-400 dark:text-gray-500">
            Checked {riskTrailCheckedAt(entry)} · curated, not a feed
          </p>
        </div>
      )}
      {content && <MomentShareLine code={entry.code} />}
      <button
        type="button"
        onClick={() => {
          onClose();
          askAdvisor(
            `Tell me the story of the ${entry.code} (${entry.countryName}): what has happened to this currency — devaluations, pegs, central-bank events — and what does its history mean for someone saving in it?`,
          );
        }}
        className="mt-2 min-h-11 px-1 text-[11px] font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        Ask Guardian about the {entry.code} →
      </button>
    </div>
  );
}

export function CurrencyStoryInspector({
  code,
  onClose,
}: {
  /** Selected currency code — null closes the sheet. */
  code: string | null;
  onClose: () => void;
}) {
  const entry = code ? CURRENCY_BY_CODE[code] ?? null : null;

  return (
    <InspectorSheet
      selectedId={entry?.code ?? null}
      onClose={onClose}
      title={entry ? `${entry.flag} ${entry.countryName} — ${entry.code}` : 'Currency'}
    >
      {entry && <CurrencyStoryBody code={entry.code} onClose={onClose} />}
    </InspectorSheet>
  );
}
