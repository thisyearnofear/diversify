/**
 * GuardianBudgetBar — today's permission as a channel of metal.
 *
 * The object's `$X left of $Y today` is the L1 form of this fact; this is the
 * L2 depth — the proportion, which a one-line cannot carry. What Guardian has
 * spent is machined metal (a USD cap does not weather); what it still may
 * spend is the ghost inlay — the polished empty channel where metal should be,
 * the absence as the affordance.
 *
 * Each settled move leaves a hallmark where the metal stood when it landed.
 * Marks are drawn only when the day's executions reconcile to the spent
 * figure; a mark that cannot be attributed to a real settlement is not struck.
 *
 * While balances are hidden the channel is withheld. A bar at 92% discloses
 * the money relationship even with both figures as dots — and an empty one
 * would assert the opposite.
 */

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { metalGradientCss, proudShadowCss } from "@/lib/foundry";
import { springPop, springSoft } from "@/lib/motion-tokens";
import { haptics } from "@/lib/haptics";
import { useBalanceVisibility } from "@/context/app/BalanceVisibilityContext";
import type { GuardianExecution } from "@/hooks/use-session-key";

/** The channel never outlives what it can be attributed to. */
const MAX_MARKS = 12;

/**
 * Roughly how long `springSoft` takes the metal to arrive at a new proportion.
 * A hallmark is struck into metal, not into the empty channel, so a mark that
 * lands with this sheet open waits for the metal to reach it.
 */
const METAL_ARRIVAL_MS = 420;

/**
 * Cumulative metal position of each settled move. The spend is matched
 * against the longest run of executions that accounts for it exactly — no
 * calendar-day guesswork, since "today" belongs to the session ledger, not
 * to this browser's timezone. If no run reconciles, nothing is struck.
 */
export function hallmarksFor(
  executions: GuardianExecution[] | undefined,
  spentTodayUSD: number,
): number[] {
  const settled = (executions ?? [])
    .filter((e) => !e.status || e.status === "confirmed")
    .sort((a, b) => a.timestamp - b.timestamp);

  for (let start = 0; start < settled.length; start++) {
    const window = settled.slice(start);
    if (window.length > MAX_MARKS) continue;
    let cumulative = 0;
    const marks: number[] = [];
    for (const execution of window) {
      cumulative += execution.amountUSD;
      marks.push(cumulative);
    }
    if (Math.abs(cumulative - spentTodayUSD) < 0.01) return marks;
  }
  return [];
}

export function GuardianBudgetBar({
  spentTodayUSD,
  dailyLimitUSD,
  remainingTodayUSD,
  executions,
}: {
  spentTodayUSD: number;
  dailyLimitUSD: number;
  remainingTodayUSD: number;
  executions?: GuardianExecution[];
}) {
  const { formatMoney, hidden } = useBalanceVisibility();
  const reducedMotion = useReducedMotion();
  const transition = reducedMotion ? { duration: 0 } : springSoft;

  const fraction =
    dailyLimitUSD > 0 ? Math.min(1, Math.max(0, spentTodayUSD / dailyLimitUSD)) : 0;
  const marks = hallmarksFor(executions, spentTodayUSD);
  const [strike, setStrike] = React.useState(0);
  const [inFlight, setInFlight] = React.useState(false);
  const seenMarks = React.useRef<number | null>(null);

  // Opening the sheet shows an object that is already old. Only a mark that
  // appears while it is watched was struck in front of the user.
  React.useEffect(() => {
    if (hidden) return;
    if (seenMarks.current === null) {
      seenMarks.current = marks.length;
      return;
    }
    const landed = marks.length > seenMarks.current;
    seenMarks.current = marks.length;
    if (!landed) return;

    const punch = () => {
      setInFlight(false);
      setStrike(marks.length);
      haptics.confirm();
    };
    if (reducedMotion) {
      punch();
      return;
    }
    setInFlight(true);
    const arrival = setTimeout(punch, METAL_ARRIVAL_MS);
    return () => clearTimeout(arrival);
  }, [marks.length, hidden, reducedMotion]);

  return (
    <div className="space-y-2" data-testid="guardian-budget-bar">
      <p className="text-sm text-ink">
        <span className="font-bold tabular-nums">{formatMoney(remainingTodayUSD)}</span>
        <span className="text-ink-muted"> left today</span>
      </p>

      {!hidden && (
        <div
          data-testid="guardian-budget-track"
          role="progressbar"
          aria-label="Daily limit used"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(fraction * 100)}
          className="relative h-2.5 overflow-hidden rounded-full bg-surface-sunken"
          style={{
            boxShadow:
              "inset 0 2px 4px rgba(15,23,42,0.4), inset 0 -1px 0 rgba(15,23,42,0.12)",
          }}
        >
          {/* The channel: a polished empty trough where metal should be.
              In light mode the trough is nearly the card's white, so the
              metal's own value carries the proportion; the sheen stays just
              visible. Measured: ghost at 0.6 sat 24 points from the metal's
              mid-tone and the bar stopped reading. */}
          <div
            aria-hidden="true"
            data-testid="guardian-budget-channel"
            className="absolute inset-0 opacity-[0.15] dark:opacity-30"
            style={{
              backgroundImage: metalGradientCss("ghost"),
            }}
          />
          <motion.div
            data-testid="guardian-budget-metal"
            className="absolute inset-y-0 left-0 w-full"
            style={{
              originX: 0,
              backgroundImage: metalGradientCss("machined"),
              filter: proudShadowCss(),
              boxShadow: "inset 0 -1px 0 rgba(15,23,42,0.28)",
            }}
            initial={false}
            animate={{ scaleX: fraction }}
            transition={transition}
          />
          {(inFlight ? marks.slice(0, -1) : marks).map((mark, index) => {
            const struck = index + 1 === strike;
            // A notch, not a hairline: a dark groove with a bright lip, 2 CSS
            // px wide so it still lands on a 1x desktop display.
            const notch = {
              left: `${(mark / dailyLimitUSD) * 100}%`,
              backgroundImage: struck
                ? "linear-gradient(to right, rgba(15,23,42,0.62), rgba(255,255,255,0.78))"
                : "linear-gradient(to right, rgba(15,23,42,0.46), rgba(255,255,255,0.58))",
            };
            // A mark that landed while the sheet was open is punched in;
            // everything older was already struck and simply reads as metal.
            return struck ? (
              <motion.span
                key={`${mark}-${index}`}
                data-testid="guardian-budget-mark"
                aria-hidden="true"
                className="absolute inset-y-0 w-[2px] origin-center"
                style={notch}
                initial={reducedMotion ? false : { scaleY: 0, opacity: 0 }}
                animate={{ scaleY: 1, opacity: 1 }}
                transition={reducedMotion ? { duration: 0 } : springPop}
              />
            ) : (
              <span
                key={`${mark}-${index}`}
                data-testid="guardian-budget-mark"
                aria-hidden="true"
                className="absolute inset-y-0 w-[2px]"
                style={notch}
              />
            );
          })}
        </div>
      )}

      <p className="text-2xs text-ink-subtle tabular-nums">
        {formatMoney(spentTodayUSD)} used of {formatMoney(dailyLimitUSD)}/day
      </p>
    </div>
  );
}
