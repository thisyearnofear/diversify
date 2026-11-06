/**
 * WaysToHold — the access row under a country scorecard.
 *
 * Two honest sections:
 *   1. direct instruments — tokens that mirror THIS currency on rails
 *      we execute (routable only — a token that can't be swapped to is
 *      absent, not listed as decoration)
 *   2. the benchmarks — the dollar and gold instruments the scorecard
 *      already weighed this money against, labelled as benchmarks, never
 *      as a "recommended alternative"
 *
 * When nothing tracks the currency directly, a fake-door CTA measures
 * intent (convert_intent) before revealing the honest absence — that
 * click is the demand signal for adding a rail.
 */
import { useState } from 'react';
import { trackFunnelEvent } from '@/lib/analytics';
import type { HoldableAsset, WaysToHold as Ways } from '@/lib/holdable-assets';
import { RouteLink } from '@/components/shared/RouteLink';

interface Props {
  code: string;
  moneyName: string;
  ways: Ways;
}

const KIND_LABEL: Record<HoldableAsset['kind'], string> = {
  stable: 'pegged',
  gold: 'gold-backed',
  yield: 'yield-bearing',
};

function AssetRow({ asset, code }: { asset: HoldableAsset; code: string }) {
  return (
    <li className="flex items-center justify-between gap-3 border-t border-ink/5 py-3 first:border-t-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-mono text-sm font-bold text-ink/90">{asset.symbol}</span>
          <span className="text-xs text-ink/50">{asset.name}</span>
          <span className="text-[10px] uppercase tracking-wide text-ink/35">
            {KIND_LABEL[asset.kind]} · {asset.chainName}
          </span>
        </div>
        {asset.accessNote && (
          <p className="mt-1 text-xs leading-relaxed text-ink/45">{asset.accessNote}</p>
        )}
      </div>
      <RouteLink
        href={asset.href}
        onClick={() => trackFunnelEvent('convert_tapped', { code, asset: asset.symbol })}
        className="shrink-0 rounded-full border border-ink/15 px-4 py-2 text-xs font-bold text-ink/80 transition-colors hover:border-ink/40 hover:bg-ink/10"
      >
        Convert →
      </RouteLink>
    </li>
  );
}

export function WaysToHold({ code, moneyName, ways }: Props) {
  const [intentRevealed, setIntentRevealed] = useState(false);
  const { direct, benchmarks } = ways;

  return (
    <section aria-label={`Ways to hold ${moneyName}`} className="rounded-2xl border border-ink/10 bg-ink/[0.03] p-5">
      <h2 className="text-sm font-bold tracking-wide text-ink/90">Ways to hold it</h2>

      {direct.length > 0 ? (
        <ul className="mt-2">
          {direct.map((a) => (
            <AssetRow key={`${a.chainId}:${a.symbol}`} asset={a} code={code} />
          ))}
        </ul>
      ) : (
        <div className="mt-3">
          <p className="text-sm leading-relaxed text-ink/50">
            Nothing on DiversiFi&apos;s rails tracks {moneyName} directly yet.
          </p>
          {!intentRevealed && (
            <button
              type="button"
              onClick={() => {
                trackFunnelEvent('convert_intent', { code });
                setIntentRevealed(true);
              }}
              className="mt-3 min-h-11 rounded-full border border-ink/15 px-5 py-2 text-sm font-bold text-ink/85 transition-colors hover:border-ink/40 hover:bg-ink/10"
            >
              Get {code} exposure →
            </button>
          )}
        </div>
      )}

      {(direct.length > 0 || intentRevealed) && benchmarks.length > 0 && (
        <div className="mt-4 border-t border-ink/10 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/40">
            The benchmarks {moneyName} was weighed against
          </p>
          <ul className="mt-2">
            {benchmarks.map((a) => (
              <AssetRow key={`${a.chainId}:${a.symbol}`} asset={a} code={code} />
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-ink/30">
        Every instrument is what it says it is — notes name the issuer,
        backing and redemption reality. Converting runs through licensed
        venues in your own wallet; nothing here is a recommendation.
      </p>
    </section>
  );
}
