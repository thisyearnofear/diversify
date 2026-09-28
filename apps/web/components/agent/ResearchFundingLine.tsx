/**
 * ResearchFundingLine — the one place the Arc rail is named to the user.
 *
 * Guardian pays for premium research (x402) from a USDC balance on Arc.
 * That's been true and working, just invisible. This is an L2 fact: it
 * lives inside the Limits & controls inspector, one row + one line, and
 * renders nothing until there's a real balance or a real draw — never a
 * fabricated "$0.000".
 */
import React from "react";
import { useResearchAccount } from "@/hooks/use-research-account";

export function ResearchFundingLine() {
  const account = useResearchAccount();
  const balance = Number.parseFloat(account.arcWalletBalance ?? "");
  const hasBalance = Number.isFinite(balance) && balance > 0;
  const hasDraws = account.researchPayments.length > 0;
  if (!hasBalance && !hasDraws) return null;

  return (
    <div
      className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-1"
      data-testid="research-funding-line"
    >
      <div className="flex justify-between items-center text-sm">
        <span className="text-ink-muted">Research balance</span>
        <span className="font-bold tabular-nums">
          {hasBalance ? `$${balance.toFixed(2)}` : "Empty"}
        </span>
      </div>
      <p className="text-xs text-ink-muted">
        Guardian pays for premium research in USDC on Arc
        {account.spentToday > 0
          ? ` — $${account.spentToday.toFixed(3)} spent today.`
          : ". Nothing spent today."}
      </p>
    </div>
  );
}

export default ResearchFundingLine;
