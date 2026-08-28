import React from "react";
import { Card } from "./TabComponents";
import {
  getCaribbeanRailCopy,
  CELO_EXPLORER_ADDRESS_URL,
  CELO_LEDGER_SHORT_ADDRESS,
} from "@/constants/caribbean-rail";

export interface CaribbeanRailHonestyBannerProps {
  /** compact: inline text only; home: larger copy for Overview contextual slot */
  variant?: "default" | "compact" | "home";
}

/**
 * Caribbean rail banner for the Pan-Caribbean profile. Unlike the APAC rail,
 * the Caribbean rail has no separate pending chain — it settles savings on
 * Celo (USD-pegged stables), the always-on home rail. So there is no fake
 * "coming soon" state: the banner always explains *where* Pan-Caribbean
 * savings settle and links to the Celo ledger for verification.
 */
export function CaribbeanRailHonestyBanner({
  variant = "default",
}: CaribbeanRailHonestyBannerProps) {
  const copy = getCaribbeanRailCopy();
  const isHome = variant === "home";

  if (variant === "compact") {
    return (
      <p className="text-xs text-amber-700 dark:text-amber-300 font-medium leading-relaxed px-1">
        {copy.body}
      </p>
    );
  }

  const titleClass = "text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400";
  const bodyClass = isHome
    ? "text-sm font-medium text-amber-900 dark:text-amber-100 mt-0.5 leading-relaxed"
    : "text-xs font-medium text-amber-900 dark:text-amber-100 mt-0.5 leading-relaxed";
  const borderClass = isHome
    ? "border-2 border-amber-200 dark:border-amber-900"
    : "border border-amber-200 dark:border-amber-900";

  return (
    <Card padding="p-0" className={`overflow-hidden ${borderClass}`}>
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 p-4 flex items-start gap-3">
        <div className="text-xl shrink-0">🌴</div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className={titleClass}>{copy.title}</div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-[10px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
              <span className="size-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse" aria-hidden />
              Live on Celo
            </span>
          </div>
          <p className={bodyClass}>{copy.body}</p>
          {CELO_EXPLORER_ADDRESS_URL && (
            <a
              href={CELO_EXPLORER_ADDRESS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline mt-2"
            >
              Verify savings ledger{CELO_LEDGER_SHORT_ADDRESS ? ` (${CELO_LEDGER_SHORT_ADDRESS})` : ""} on Celo explorer →
            </a>
          )}
        </div>
      </div>
    </Card>
  );
}