/**
 * RouteSchematic — the Exchange inspector's real object.
 *
 * Replaces the static "review the route" paragraph: the selected pair drawn
 * as a schematic path that draws itself in on open (Maxima's interactive
 * masked-reveal lesson, framer-native via pathLength). One reveal, never a
 * loop; reduced motion renders the path fully drawn.
 *
 * Honest by construction: this is a pair schematic (from → settlement rail →
 * to), not a live LI.FI route preview — the caption says so.
 */

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { TokenIcon } from "@/components/shared/TokenIcon";
import { drawIn } from "@/lib/motion-tokens";

interface RouteSchematicProps {
  fromToken: string;
  toToken: string;
  /** Settlement rail caption, e.g. "Celo · cUSD rails". */
  caption?: string;
}

export function RouteSchematic({ fromToken, toToken, caption }: RouteSchematicProps) {
  const reducedMotion = useReducedMotion();
  const sameToken = fromToken === toToken;

  return (
    <div data-testid="route-schematic" className="mt-1">
      <div className="flex items-center gap-2">
        <span className="flex shrink-0 items-center gap-1.5">
          <TokenIcon symbol={fromToken} size={24} />
          <span className="text-xs font-bold text-gray-900 dark:text-white">{fromToken}</span>
        </span>

        <svg
          className="flex-1 h-8 min-w-0"
          viewBox="0 0 100 24"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {/* Gentle arc — the "route". pathLength draw-in, one shot. */}
          <motion.path
            d="M 2 12 C 30 2, 70 22, 98 12"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            className="text-blue-500 dark:text-blue-400"
            initial={reducedMotion ? false : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={reducedMotion ? { duration: 0 } : drawIn}
          />
          {/* Direction chevron at the destination end */}
          <motion.path
            d="M 94 7 L 98 12 L 94 17"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-blue-500 dark:text-blue-400"
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ ...(reducedMotion ? { duration: 0 } : drawIn), delay: reducedMotion ? 0 : 0.35 }}
          />
        </svg>

        <span className="flex shrink-0 items-center gap-1.5">
          <TokenIcon symbol={toToken} size={24} />
          <span className="text-xs font-bold text-gray-900 dark:text-white">{toToken}</span>
        </span>
      </div>

      <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
        {sameToken
          ? `Send-only route: ${fromToken} leaves your wallet on the source chain's settlement rail.`
          : `Schematic route ${fromToken} → ${toToken}. The executable quote (hops, fees, slippage floor) is finalized in the ticket below before you confirm.`}
        {caption ? <> Settlement: {caption}.</> : null}
      </p>
    </div>
  );
}

export default RouteSchematic;
