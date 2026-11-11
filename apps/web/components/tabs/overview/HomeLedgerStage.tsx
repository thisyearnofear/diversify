/**
 * HomeLedgerStage — the coin stage reading the ledger instead of the market.
 *
 * Home's motif is two coins and the number between them. Under Verify the
 * same geometry carries a different measure: the two tokens the Guardian
 * named most in the read window, and the window's count where the delta
 * sat. Nothing is invented — the counts are the feed's own, the fold is the
 * ledger's, and the line under the coins says in plain words that these are
 * decisions, not the visitor's holdings.
 *
 * It replaces the moment card in the same slot (design-language §5: modes
 * transform, never append), so the pills, the floor and the verdict panel
 * are Home's presenter's — this component only draws the object.
 */
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Coin } from "@/components/shared/FloatingCoins";
import { QUIET_GRAY } from "@/components/shared/palette";
import { metalMidFor } from "@/lib/foundry";
import { displayToken } from "@/lib/plan-legs";
import { LEDGER_OTHER_TOKEN, type LedgerLeg, type LedgerView } from "@/lib/shield-ledger-view";
import { formatRecordAge } from "@/constants/proof-feed";
import { reveal, springPop } from "@/lib/motion-tokens";
import { COIN_BASE_PX } from "./moment-stage";

interface Props {
  ledger: LedgerView;
  /** The moment card's accent, so the ledger stage is the same object in a
   *  different mood — not a differently-coloured card. */
  accent: string;
}

function glyphFor(leg: LedgerLeg): string {
  return leg.token === LEDGER_OTHER_TOKEN ? "•••" : displayToken(leg.token);
}

/** The stage strikes each coin from the foundry's metal table, and the
 *  legend dot is that same metal at its mid tone — the rows key to the
 *  coins rather than to a separate palette. */
function coinPaint(leg: LedgerLeg): { token?: string; swatch: string } {
  if (leg.token === LEDGER_OTHER_TOKEN) return { swatch: QUIET_GRAY };
  return { token: leg.token, swatch: metalMidFor(leg.token) };
}

export function HomeLedgerStage({ ledger, accent }: Props) {
  const reducedMotion = useReducedMotion();
  const [top, second] = ledger.legs;
  const flip = reducedMotion
    ? { duration: 0 }
    : { ...springPop, delayChildren: 0 };
  if (!top) return null;
  return (
    <div data-testid="home-ledger-stage" className="text-center">
      <motion.div
        className="mx-auto grid max-w-[560px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-5"
        initial={reducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={reducedMotion ? { duration: 0 } : reveal}
      >
        <motion.div
          data-testid="moment-local-coin"
          className="w-full justify-self-end text-right [&_svg]:max-w-full [&_svg]:h-auto"
          style={{ maxWidth: COIN_BASE_PX }}
          initial={reducedMotion ? false : { rotateY: 90, opacity: 0.3 }}
          animate={{ rotateY: 0, opacity: 1 }}
          transition={flip}
        >
          <Coin
            size={112}
            symbol={glyphFor(top)}
            token={coinPaint(top).token}
            color={coinPaint(top).swatch}
          />
        </motion.div>
        {/* The number that carries the meaning — the read window. Its whole
            is stated once, by the ledger panel under the stage, so the two
            never print the same total on the same screen. */}
        <div className="min-w-0">
          <div className="flex items-baseline justify-center gap-1.5">
            <div
              className="currency-reading tabular-nums font-black"
              style={{ color: `var(--reading-ink, ${accent})` }}
            >
              <motion.span key={ledger.windowCount}>{ledger.windowCount}</motion.span>
            </div>
          </div>
        </div>
        <motion.div
          data-testid="moment-benchmark-coin"
          className="w-full justify-self-start text-left [&_svg]:max-w-full [&_svg]:h-auto"
          style={{ maxWidth: COIN_BASE_PX }}
          initial={reducedMotion ? false : { rotateY: -90, opacity: 0.3 }}
          animate={{ rotateY: 0, opacity: 1 }}
          transition={flip}
        >
          {second ? (
            <Coin
              size={72}
              symbol={glyphFor(second)}
              token={coinPaint(second).token}
              color={coinPaint(second).swatch}
            />
          ) : null}
        </motion.div>
      </motion.div>

      <h2
        data-testid="home-reading"
        className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-ink"
      >
        The last {ledger.windowCount} decisions
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Coins are the tokens each decision named — not your holdings
      </p>
      {/* The rows are the legend the coins can't carry: every token the
          window named, its count, its share and its newest record — the
          same reading Shield's ring legend swaps to under Verify. */}
      <ul
        data-testid="home-ledger-rows"
        className="mx-auto mt-3 w-full max-w-[360px] space-y-1.5 text-left"
      >
        {ledger.legs.map((leg) => (
          <li
            key={leg.token}
            className="flex items-baseline justify-between gap-3 text-sm"
          >
            <span className="flex min-w-0 items-baseline gap-2">
              <span
                aria-hidden
                className="size-2.5 shrink-0 self-center rounded-full"
                style={{ background: coinPaint(leg).swatch }}
              />
              <span className="truncate font-semibold text-ink">
                {glyphFor(leg)}
                {leg.foldedTokens ? ` (${leg.foldedTokens})` : ""}
              </span>
            </span>
            <span className="shrink-0 tabular-nums text-ink-muted">
              {leg.count} · {leg.percent}%
              {formatRecordAge(leg.latest.timestamp)
                ? ` · ${formatRecordAge(leg.latest.timestamp)}`
                : ""}
            </span>
          </li>
        ))}
      </ul>
      {ledger.isStale && (
        <p
          data-testid="home-ledger-stale"
          className="mt-1.5 text-2xs font-semibold text-amber-600 dark:text-amber-400"
        >
          Showing the last read, not a fresh one
        </p>
      )}
    </div>
  );
}

export default HomeLedgerStage;
