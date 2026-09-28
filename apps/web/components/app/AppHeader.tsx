/**
 * ChainPill was removed 2026-09-28 (nav decluttering) — it duplicated the
 * wallet button's own ChainSelector (Celo/Arbitrum/Arc-testnet/Robinhood/
 * Celo-Sepolia), which is the more complete control. One switcher, not two.
 */
import type { TabId } from "@/constants/tabs";
import WalletButton from "@/components/wallet/WalletButton";
import FarcasterWalletButton from "@/components/wallet/FarcasterWalletButton";
import { GuardianMascot } from "@/components/shared/GuardianMascot";
import { StreakNavBadge } from "@/components/shared/StreakNavBadge";
import { useClaimFlowContext } from "@/hooks/claim-flow-context";

interface AppHeaderProps {
  address?: string | null;
  isWhitelisted: boolean;
  isFarcaster: boolean;
  isMiniPay?: boolean;
  activeTab?: TabId;
}

// Tabs whose unconnected object already carries a connect CTA (§5: one
// connect affordance per tab). Exchange's resting pair stage has none,
// so the header button stays there.
const TABS_WITH_OWN_CONNECT: ReadonlySet<TabId> = new Set([
  "overview",
  "protect",
  "agent",
]);

export default function AppHeader({
  address, isWhitelisted, isFarcaster, isMiniPay = false, activeTab,
}: AppHeaderProps) {
  // The streak badge's claim affordance rides the shared claim flow —
  // "Claim ready" in the header is a working action, not just a signal.
  let handleClaim: (() => void) | undefined;
  try {
    const flow = useClaimFlowContext();
    handleClaim = () => void flow.handleClaim();
  } catch {
    handleClaim = undefined;
  }

  return (
    <div className="flex items-center justify-between gap-3 mb-3 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      {/* Left: Logo */}
      <div className="flex items-center gap-2 sm:gap-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden bg-slate-900 dark:bg-slate-900 shadow-sm flex-shrink-0 group/logo"
          title="Portable Guardian · portable across wallets — AgenticID #1 on 0G (0x6815…33D60, 0G Storage root)"
          aria-label="Portable Guardian · AgenticID #1 on 0G"
        >
          <GuardianMascot size={32} mood="neutral" />
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          {/* The wordmark always shows: below 400px the header was a lone
              mascot in an empty white bar, which read as a broken load. */}
          <h1 className="inline truncate min-w-0 text-xs sm:text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">
            DiversiFi
          </h1>
          {/* Compact streak signal beside the wordmark — replaces the former full-bleed card at top of Home */}
          <div className="hidden min-[400px]:inline-flex">
            <StreakNavBadge variant="header" onClaim={handleClaim} />
          </div>
          {address && (
            <div
              className={`w-2 h-2 rounded-full flex-shrink-0 ring-2 ring-white dark:ring-gray-900 ${isWhitelisted ? "bg-emerald-500" : "bg-amber-500"}`}
              title={isWhitelisted ? "Verified" : undefined}
              aria-label={isWhitelisted ? "Verified" : undefined}
            />
          )}
        </div>
      </div>

        {/* Right: Controls */}
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Compact streak on narrow screens — header's hidden wordmark leaves room; show badge here instead */}
        <div className="min-[400px]:hidden">
          <StreakNavBadge variant="header" onClaim={handleClaim} />
        </div>

        {isFarcaster ? (
          <FarcasterWalletButton />
        ) : (
          // Below sm the tab's in-object CTA is the single connect
          // affordance — the header chip survives on desktop, when
          // connected (account menu), in MiniPay, and on tabs with no
          // in-object connect (Exchange pair stage).
          <div
            className={
              !address && !isMiniPay && activeTab != null && TABS_WITH_OWN_CONNECT.has(activeTab)
                ? "hidden sm:block"
                : undefined
            }
          >
            <WalletButton />
          </div>
        )}
      </div>
    </div>
  );
}

