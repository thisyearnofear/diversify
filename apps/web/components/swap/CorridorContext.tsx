/**
 * CorridorContext — the two currencies behind a swap pair, where their
 * money comes from, and what they mean to each other.
 *
 * CorridorLine sits under the ticket as a quiet status line (tappable →
 * the pair inspector): the provenance sentence ("from Kenya's floating
 * shilling to allocated gold") on top, the corridor track underneath.
 * CorridorDetail is the inspector body: each side's provenance (origin,
 * backing, keys, dated sources) plus its 5y track when a corridor exists.
 * Both render nothing when the pair has no story to tell — absence is
 * honest.
 */
import React from 'react';
import { corridorFor, type CorridorSide } from '@/lib/corridor-context';
import { provenanceFor, type TokenProvenance } from '@diversifi/shared/src/constants/token-provenance';

export function CorridorLine({
  fromToken,
  toToken,
  onInspect,
}: {
  fromToken: string;
  toToken: string;
  onInspect?: () => void;
}) {
  const corridor = corridorFor(fromToken, toToken);
  const a = provenanceFor(fromToken);
  const b = provenanceFor(toToken);
  const story = a && b && a.symbol !== b.symbol ? `From ${a.phrase} to ${b.phrase}` : null;
  if (!story && !corridor) return null;

  const arrow = onInspect ? (
    <span className="font-semibold text-blue-600 dark:text-blue-400">→</span>
  ) : null;
  const body = (
    <>
      {story && (
        <span className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
          {story} {!corridor && arrow}
        </span>
      )}
      {corridor && (
        <span className={`block text-[11px] text-gray-500 dark:text-gray-400${story ? ' mt-0.5' : ''}`}>
          {corridor.line} {arrow}
        </span>
      )}
    </>
  );

  if (!onInspect) {
    return (
      <p data-testid="corridor-line" className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
        {body}
      </p>
    );
  }
  return (
    <button
      type="button"
      data-testid="corridor-line"
      onClick={onInspect}
      className="mt-1 text-left text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 min-h-[32px] transition-colors"
    >
      {body}
    </button>
  );
}

function SideTrack({ side }: { side: CorridorSide }) {
  if (!side.entry) {
    return (
      <div>
        <p className="text-xs font-semibold text-gray-900 dark:text-white">
          {side.flag} {side.name}
        </p>
        <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
          The benchmark everything here is measured against.
        </p>
      </div>
    );
  }
  const e = side.entry;
  const latest = e.riskEvents[e.riskEvents.length - 1];
  const isAnchor = e.depreciation.vsUSD['5yr'] === 0;
  return (
    <div>
      <p className="text-xs font-semibold text-gray-900 dark:text-white">
        {side.flag} {e.countryName} — {e.code}
      </p>
      <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
        {isAnchor
          ? `The anchor — still ${e.depreciation.vsXAU['5yr']}% vs gold (5y)`
          : `${e.depreciation.vsUSD['5yr']}% vs USD · ${e.depreciation.vsXAU['5yr']}% vs gold (5y)`}
      </p>
      {latest && (
        <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">
          {latest.year}: {latest.event} — {latest.impact}
        </p>
      )}
      {e.goodsAnchor && (
        <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
          Risk is priced in {e.goodsAnchor.unit} locally.
        </p>
      )}
    </div>
  );
}

/** Which provenance line a philosophy leads with. The facts are the same
 *  for everyone; the persona reorders them (§5 rail 4). Islamic finance
 *  reads backing first (interest-bearing or not), Buen Vivir reads keys
 *  first (who governs), everything else reads origin first. */
export type ProvenanceLead = 'origin' | 'backing' | 'keys';

export function leadForStrategy(strategy: string | null | undefined): ProvenanceLead {
  if (strategy === 'islamic') return 'backing';
  if (strategy === 'buen_vivir') return 'keys';
  return 'origin';
}

function ProvenanceSide({
  provenance,
  lead = 'origin',
}: {
  provenance: TokenProvenance;
  lead?: ProvenanceLead;
}) {
  const p = provenance;
  const rows: { key: ProvenanceLead; label: string; text: string }[] = [
    { key: 'origin', label: 'Origin', text: `${p.origin.authority} — ${p.origin.regime}` },
    { key: 'backing', label: 'Backing', text: p.backing },
    { key: 'keys', label: 'Keys', text: p.keys },
  ];
  rows.sort((a, b) => (a.key === lead ? -1 : b.key === lead ? 1 : 0));
  return (
    <div>
      <p className="text-xs font-semibold text-gray-900 dark:text-white">
        {p.origin.flag} {p.symbol} · {p.issuer}
      </p>
      {rows.map((row) => (
        <p key={row.key} className="mt-1 text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">
          <span className="font-semibold text-gray-900 dark:text-white">{row.label}</span> {row.text}
        </p>
      ))}
      {p.moment && (
        <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
          {p.moment.year}: {p.moment.text}
        </p>
      )}
      <p className="mt-1 text-[10px] text-gray-400">
        Checked {p.asOf} · {p.sources.map((s, i) => (
          <React.Fragment key={s.url}>
            {i > 0 && ' · '}
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline">
              {s.label}
            </a>
          </React.Fragment>
        ))}
      </p>
    </div>
  );
}

export function CorridorDetail({
  fromToken,
  toToken,
  lead = 'origin',
}: {
  fromToken: string;
  toToken: string;
  lead?: ProvenanceLead;
}) {
  const corridor = corridorFor(fromToken, toToken);
  const a = provenanceFor(fromToken);
  const b = provenanceFor(toToken);
  const story = a && b && a.symbol !== b.symbol;
  if (!corridor && !story) return null;
  return (
    <div data-testid="corridor-detail" className="mt-4 border-t border-gray-100 dark:border-gray-800 pt-3 space-y-3">
      {corridor && (
        <>
          <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
            {corridor.line}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <SideTrack side={corridor.from} />
            <SideTrack side={corridor.to} />
          </div>
        </>
      )}
      {(a || b) && (
        <div data-testid="provenance-detail" className="grid grid-cols-2 gap-3">
          <div>{a && <ProvenanceSide provenance={a} lead={lead} />}</div>
          <div>{b && <ProvenanceSide provenance={b} lead={lead} />}</div>
        </div>
      )}
    </div>
  );
}
