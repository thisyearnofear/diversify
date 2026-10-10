/**
 * PendingFundRail — the "your money landed" half of adaptive funding.
 *
 * Swap's insufficient-balance CTA pauses the intent into
 * `lib/pending-fund`; this rail watches refreshed balances and offers to
 * finish the move — user-confirmed, never silent. A pending record says
 * only that the user opened the widget, so the waiting copy never claims
 * a buy happened. The arrived state is a small seal moment — the coin,
 * the spring pop, the named move — the same grammar as a PairReceipt,
 * because the asset landing IS the moment. Lives beside ClaimRail in the
 * status tier (§5 rail).
 */

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useNavigation } from "@/context/app/NavigationContext";
import { TokenIcon } from "../shared/TokenIcon";
import { springPop } from "@/lib/motion-tokens";
import {
  readPendingFund,
  clearPendingFund,
  pendingFundArrived,
  type PendingFund,
} from "@/lib/pending-fund";
import { trackFunnelEvent } from "@/lib/analytics";

export function PendingFundRail({
  tokens,
}: {
  tokens: { symbol: string; chainId: number; formattedBalance: string }[];
}) {
  const navigation = useNavigation();
  const reducedMotion = useReducedMotion();
  // Read client-side only — SSR renders nothing and the mount read avoids
  // a hydration mismatch.
  const [pending, setPending] = React.useState<PendingFund | null>(null);

  // Re-read on mount, when balances refresh, and when the tab refocuses —
  // the record is written same-tab on Exchange, so there is no storage
  // event to subscribe to.
  React.useEffect(() => {
    const reread = () => setPending(readPendingFund());
    reread();
    window.addEventListener("focus", reread);
    document.addEventListener("visibilitychange", reread);
    return () => {
      window.removeEventListener("focus", reread);
      document.removeEventListener("visibilitychange", reread);
    };
  }, []);

  const arrived = React.useMemo(
    () => (pending ? pendingFundArrived(pending, tokens) : false),
    [pending, tokens],
  );

  if (!pending) return null;

  // The move's own name when the handoff carried one — "finish your
  // Savers plan move" reads warmer than "finish the move" and proves the
  // resume kept the intent's context.
  const moveLabel = pending.resume.origin?.label;

  if (arrived) {
    return (
      <motion.div
        key={`${pending.asset}-${pending.createdAt}`}
        initial={reducedMotion ? false : { scale: 0.86, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={springPop}
      >
        <button
          type="button"
          data-testid="pending-fund-rail"
          onClick={() => {
            clearPendingFund();
            setPending(null);
            trackFunnelEvent("fund_resumed", {
              asset: pending.asset,
              chainId: String(pending.chainId),
            });
            navigation.navigateToSwap({ ...pending.resume });
          }}
          className="min-h-tap flex items-center gap-1.5 text-left text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-200 transition-colors"
        >
          <TokenIcon symbol={pending.asset} size={14} />
          <span>
            {pending.asset} landed —{" "}
            <span className="font-black">
              finish {moveLabel ? `your ${moveLabel} move` : "the move"} →
            </span>
          </span>
        </button>
      </motion.div>
    );
  }

  return (
    <div data-testid="pending-fund-rail" className="flex items-center gap-2 text-xs">
      <span className="text-gray-500 dark:text-gray-400">
        Waiting for {pending.asset} — your move resumes when it lands.
      </span>
      <button
        type="button"
        aria-label="Dismiss funding reminder"
        onClick={() => {
          clearPendingFund();
          setPending(null);
        }}
        className="min-h-tap text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
      >
        ×
      </button>
    </div>
  );
}
