import React from "react";
import { Card } from "./TabComponents";
import {
  getApacRailCopy,
  isApacRailLive,
  HASHKEY_EXPLORER_ADDRESS_URL,
  HASHKEY_LEDGER_SHORT_ADDRESS,
} from "@/constants/apac-rail";

export interface ApacRailHonestyBannerProps {
  /** compact: inline text only; home: larger copy for Overview contextual slot */
  variant?: "default" | "compact" | "home";
}

/**
 * APAC rail banner for Confucian / Gotong Royong + Asia profiles.
 * Honest "coming soon" until HashKey is configured; live copy + verified
 * chip + explorer link once NEXT_PUBLIC_HASHKEY_LEDGER_CONTRACT is set.
 */
export function ApacRailHonestyBanner({ variant = "default" }: ApacRailHonestyBannerProps) {
  const copy = getApacRailCopy();
  const live = isApacRailLive();
  const isHome = variant === "home";

  if (variant === "compact") {
    return (
      <p className="text-xs text-sky-700 dark:text-sky-300 font-medium leading-relaxed px-1">
        {copy.body}
      </p>
    );
  }

  const titleClass = isHome
    ? "text-[10px] font-bold uppercase tracking-wide text-sky-600 dark:text-sky-400"
    : "text-[10px] font-bold uppercase tracking-wide text-sky-600 dark:text-sky-400";
  const bodyClass = isHome
    ? "text-sm font-medium text-sky-900 dark:text-sky-100 mt-0.5 leading-relaxed"
    : "text-xs font-medium text-sky-900 dark:text-sky-100 mt-0.5 leading-relaxed";
  const borderClass = isHome
    ? "border-2 border-sky-200 dark:border-sky-900"
    : "border border-sky-200 dark:border-sky-900";

  return (
    <Card padding="p-0" className={`overflow-hidden ${borderClass}`}>
      <div className="bg-gradient-to-br from-sky-50 to-indigo-50 dark:from-sky-900/20 dark:to-indigo-900/20 p-4 flex items-start gap-3">
        <div className="text-xl shrink-0">{live ? "✅" : "⛩️"}</div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className={titleClass}>{copy.title}</div>
            {live && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-[10px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
                <span className="size-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse" aria-hidden />
                Live on mainnet
              </span>
            )}
          </div>
          <p className={bodyClass}>{copy.body}</p>
          {live && HASHKEY_EXPLORER_ADDRESS_URL && (
            <a
              href={HASHKEY_EXPLORER_ADDRESS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline mt-2"
            >
              Verify savings ledger{HASHKEY_LEDGER_SHORT_ADDRESS ? ` (${HASHKEY_LEDGER_SHORT_ADDRESS})` : ""} on HashKey explorer →
            </a>
          )}
        </div>
      </div>
    </Card>
  );
}
