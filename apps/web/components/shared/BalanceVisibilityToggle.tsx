/**
 * BalanceVisibilityToggle — the eye control in the app header.
 *
 * One control for the whole app (the shell owns surfaces, the header owns
 * app-wide affordances). aria-pressed reflects the hidden state; the
 * accessible name names the NEXT action, matching the app's other
 * single-purpose controls.
 */

import React from "react";
import { useBalanceVisibility } from "@/context/app/BalanceVisibilityContext";
import { haptics } from "@/lib/haptics";

export function BalanceVisibilityToggle() {
  const { hidden, toggle } = useBalanceVisibility();

  return (
    <button
      type="button"
      data-testid="balance-visibility-toggle"
      onClick={() => {
        haptics.tap();
        toggle();
      }}
      aria-pressed={hidden}
      aria-label={hidden ? "Show balances" : "Hide balances"}
      title={hidden ? "Show balances" : "Hide balances"}
      className={`min-h-tap min-w-tap flex items-center justify-center gap-1.5 rounded-lg border px-2.5 transition-colors ${
        hidden
          ? "border-amber-300 bg-amber-50 text-amber-600 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-400"
          : "border-gray-200 text-gray-500 hover:text-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      }`}
    >
      {hidden ? (
        // Eye-off: the state is visible at a glance so the user knows WHY
        // their numbers are dots.
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
          <path d="M10.73 5.08A10.4 10.4 0 0 1 12 5c7 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68" />
          <path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3 7 10 7a9.7 9.7 0 0 0 5.39-1.61" />
          <line x1="2" y1="2" x2="22" y2="22" />
        </svg>
      ) : (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
      {/* A visible label, not just `title`. The icon alone is undiscoverable,
          and `title` only appears on hover — which never happens on the touch
          devices this control matters most on. It names the NEXT action, the
          same convention the aria-label already used. */}
      <span aria-hidden="true" className="text-xs font-medium leading-none">
        {hidden ? "Show" : "Hide"}
      </span>
      <span className="sr-only">
        {hidden ? "Balances hidden" : "Balances visible"}
      </span>
    </button>
  );
}

export default BalanceVisibilityToggle;
