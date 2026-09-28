/**
 * AppHeader — The top header bar for the DiversiFi app.
 * Contains: logo, mode toggle, voice button, wallet button.
 */
import { useRef, useState } from "react";
import type { UserExperienceMode } from "@/context/app/types";
import type { TabId } from "@/constants/tabs";
import VoiceButton from "@/components/ui/VoiceButton";
import WalletButton from "@/components/wallet/WalletButton";
import FarcasterWalletButton from "@/components/wallet/FarcasterWalletButton";
import { ChainPill } from "./ChainPill";
import { GuardianMascot } from "@/components/shared/GuardianMascot";
import { StreakNavBadge } from "@/components/shared/StreakNavBadge";
import { useClaimFlowContext } from "@/hooks/claim-flow-context";

const MODES: readonly UserExperienceMode[] = ["simple", "full"];
const MODE_LABEL: Record<UserExperienceMode, string> = {
  simple: "Simple",
  full: "Full",
};

interface AppHeaderProps {
  experienceMode: UserExperienceMode;
  setExperienceMode: (mode: UserExperienceMode) => void;
  address?: string | null;
  isWhitelisted: boolean;
  isFarcaster: boolean;
  isMiniPay?: boolean;
  activeTab?: TabId;
  handleTranscription: (text: string) => void;
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
  experienceMode, setExperienceMode, address, isWhitelisted, isFarcaster, isMiniPay = false, activeTab, handleTranscription,
}: AppHeaderProps) {
  const [activeHint, setActiveHint] = useState<"voice" | null>(null);
  const modeGroupRef = useRef<HTMLDivElement>(null);

  // Mode control — the same segmented radiogroup the plan floor uses:
  // a gray track, white selected pill, arrow keys wrap.
  const focusModeOption = (index: number) => {
    modeGroupRef.current
      ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
      [index]?.focus();
  };
  const chooseMode = (index: number) => {
    setExperienceMode(MODES[index]);
    focusModeOption(index);
  };
  const onModeKeyDown = (e: React.KeyboardEvent) => {
    const index = MODES.indexOf(experienceMode);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      chooseMode((index + 1) % MODES.length);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      chooseMode((index + MODES.length - 1) % MODES.length);
    } else if (e.key === "Home") {
      e.preventDefault();
      chooseMode(0);
    } else if (e.key === "End") {
      e.preventDefault();
      chooseMode(MODES.length - 1);
    }
  };

  // The streak badge's claim affordance rides the shared claim flow —
  // "Claim ready" in the header is a working action, not just a signal.
  let handleClaim: (() => void) | undefined;
  try {
    const flow = useClaimFlowContext();
    handleClaim = () => void flow.handleClaim();
  } catch {
    handleClaim = undefined;
  }

  const isFull = experienceMode === "full";

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
            <div className="flex items-center gap-1 flex-shrink-0">
              <div
                className={`w-2 h-2 rounded-full ring-2 ring-white dark:ring-gray-900 ${isWhitelisted ? "bg-emerald-500" : "bg-amber-500"}`}
              />
              {isWhitelisted && (
                <span className="hidden sm:inline-flex items-center text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-full uppercase tracking-widest border border-emerald-100 dark:border-emerald-800">
                  Verified
                </span>
              )}
            </div>
          )}
        </div>
      </div>

        {/* Right: Controls */}
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Compact streak on narrow screens — header's hidden wordmark leaves room; show badge here instead */}
        <div className="min-[400px]:hidden">
          <StreakNavBadge variant="header" onClaim={handleClaim} />
        </div>
        {/* Mode toggle — Simple | Full radiogroup, both modes */}
        <div
          ref={modeGroupRef}
          role="radiogroup"
          aria-label="Experience mode"
          className="hidden sm:grid grid-cols-2 gap-1 rounded-full bg-gray-100 dark:bg-gray-800 p-1"
          onKeyDown={onModeKeyDown}
        >
          {MODES.map((mode) => {
            const isSelected = experienceMode === mode;
            return (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={isSelected}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => setExperienceMode(mode)}
                className={`min-h-tap px-3 rounded-full text-xs font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 ${
                  isSelected
                    ? "bg-white dark:bg-gray-900 shadow-sm text-gray-900 dark:text-white"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                {MODE_LABEL[mode]}
              </button>
            );
          })}
        </div>

        {isFull && (
        <div className="hidden sm:block">
        <VoiceButton
          size="sm"
          variant="default"
          externalSuggestionsOpen={activeHint === "voice"}
          onSuggestionsChange={(open) => setActiveHint(open ? "voice" : null)}
          onTranscription={handleTranscription}
        />
        </div>
        )}

        <div className="hidden sm:block">
          <ChainPill />
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
