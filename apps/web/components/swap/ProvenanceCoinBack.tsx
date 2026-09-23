import React from "react";
import type { TokenProvenance } from "@diversifi/shared/src/constants/token-provenance";

/**
 * The back of a coin — where the money comes from (flag + phrase) and
 * who holds the keys (issuer · keys). Shared by the token picker's
 * coin-back flip and the pair stage's coin flip; `compact` clamps it
 * into the stage's label strip (~3 lines) instead of the picker's row.
 */
export function ProvenanceCoinBack({
  provenance: p,
  compact = false,
}: {
  provenance: TokenProvenance;
  compact?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p
        className={
          compact
            ? "text-[11px] font-semibold leading-snug text-gray-900 dark:text-white line-clamp-2"
            : "text-sm font-bold text-gray-900 dark:text-gray-100 truncate"
        }
      >
        {p.origin.flag} {p.phrase}
      </p>
      <p
        className={
          compact
            ? "mt-0.5 text-[10px] leading-snug text-gray-500 dark:text-gray-400 line-clamp-3"
            : "text-xs text-gray-400 dark:text-gray-500 truncate"
        }
      >
        {p.issuer} · {p.keys}
      </p>
    </div>
  );
}
