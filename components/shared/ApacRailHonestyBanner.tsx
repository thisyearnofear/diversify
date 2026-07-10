import React from "react";
import { Card } from "./TabComponents";
import { APAC_RAIL_HONESTY_COPY } from "@/constants/apac-rail";

/** Compact honesty banner for APAC philosophies until the APAC rail ships. */
export function ApacRailHonestyBanner({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="text-xs text-sky-700 dark:text-sky-300 font-medium leading-relaxed px-1">
        {APAC_RAIL_HONESTY_COPY.body}
      </p>
    );
  }

  return (
    <Card padding="p-0" className="overflow-hidden border border-sky-200 dark:border-sky-900">
      <div className="bg-gradient-to-br from-sky-50 to-indigo-50 dark:from-sky-900/20 dark:to-indigo-900/20 p-4 flex items-start gap-3">
        <div className="text-xl shrink-0">⛩️</div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wide text-sky-600 dark:text-sky-400">
            {APAC_RAIL_HONESTY_COPY.title}
          </div>
          <p className="text-xs font-medium text-sky-900 dark:text-sky-100 mt-0.5 leading-relaxed">
            {APAC_RAIL_HONESTY_COPY.body}
          </p>
        </div>
      </div>
    </Card>
  );
}
