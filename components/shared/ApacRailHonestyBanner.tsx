import React from "react";
import { Card } from "./TabComponents";
import { getApacRailCopy, isApacRailLive, HASHKEY_EXPLORER_ADDRESS_URL } from "@/constants/apac-rail";

/**
 * Compact APAC rail banner for APAC philosophies. Shows honest "coming
 * soon" copy until the HashKey ledger is configured, then live-rail copy
 * with a verifiable explorer link.
 */
export function ApacRailHonestyBanner({ compact = false }: { compact?: boolean }) {
  const copy = getApacRailCopy();
  const live = isApacRailLive();

  if (compact) {
    return (
      <p className="text-xs text-sky-700 dark:text-sky-300 font-medium leading-relaxed px-1">
        {copy.body}
      </p>
    );
  }

  return (
    <Card padding="p-0" className="overflow-hidden border border-sky-200 dark:border-sky-900">
      <div className="bg-gradient-to-br from-sky-50 to-indigo-50 dark:from-sky-900/20 dark:to-indigo-900/20 p-4 flex items-start gap-3">
        <div className="text-xl shrink-0">⛩️</div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wide text-sky-600 dark:text-sky-400">
            {copy.title}
          </div>
          <p className="text-xs font-medium text-sky-900 dark:text-sky-100 mt-0.5 leading-relaxed">
            {copy.body}
          </p>
          {live && HASHKEY_EXPLORER_ADDRESS_URL && (
            <a
              href={HASHKEY_EXPLORER_ADDRESS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline mt-1"
            >
              View the ledger on HashKey explorer →
            </a>
          )}
        </div>
      </div>
    </Card>
  );
}
