/**
 * AppHeader — The top header bar for the DiversiFi app.
 * Contains: logo, mode toggle, voice button, wallet button.
 */
import { useState } from "react";
import type { UserExperienceMode } from "@/context/app/types";
import VoiceButton from "@/components/ui/VoiceButton";
import WalletButton from "@/components/wallet/WalletButton";
import FarcasterWalletButton from "@/components/wallet/FarcasterWalletButton";
import { ChainPill } from "./ChainPill";
import { GuardianMascot } from "@/components/shared/GuardianMascot";
import { StreakNavBadge } from "@/components/shared/StreakNavBadge";

const MODE_ICON: Record<UserExperienceMode, string> = {
  beginner: "🌱",
  intermediate: "🚀",
  advanced: "⚡",
};

const MODE_LABEL: Record<UserExperienceMode, string> = {
  beginner: "Simple",
  intermediate: "Standard",
  advanced: "Advanced",
};

function nextExperienceMode(mode: UserExperienceMode): UserExperienceMode {
  if (mode === "beginner") return "intermediate";
  if (mode === "intermediate") return "advanced";
  return "beginner";
}

const MODE_TIP_BODY: Record<"intermediate" | "advanced", string> = {
  intermediate: "Unlocks power analytics, voice shortcuts, batch ops",
  advanced: "Hides advanced panels for a focused view",
};

interface AppHeaderProps {
  experienceMode: UserExperienceMode;
  setExperienceMode: (mode: UserExperienceMode) => void;
  address?: string | null;
  isWhitelisted: boolean;
  isFarcaster: boolean;
  handleTranscription: (text: string) => void;
}

export default function AppHeader({
  experienceMode, setExperienceMode, address, isWhitelisted, isFarcaster, handleTranscription,
}: AppHeaderProps) {
  const [activeHint, setActiveHint] = useState<"mode" | "voice" | null>(null);
  const [showModeTip, setShowModeTip] = useState(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem("seenModeTip");
  });
  const dismissModeTip = () => {
    setShowModeTip(false);
    if (typeof window !== "undefined") localStorage.setItem("seenModeTip", "1");
  };

  const isBeginner = experienceMode === "beginner";

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
          {/* Keep the mark alone on very narrow screens; show the compact
              wordmark once there is room beside the wallet controls. */}
          <h1 className="hidden min-[400px]:inline text-xs sm:text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">
            DiversiFi
          </h1>
          {/* Compact streak signal beside the wordmark — replaces the former full-bleed card at top of Home */}
          <div className="hidden min-[400px]:inline-flex">
            <StreakNavBadge variant="header" />
          </div>
          {address && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <div
                className={`w-2 h-2 rounded-full ring-2 ring-white dark:ring-gray-900 ${isWhitelisted ? "bg-emerald-500" : "bg-amber-500"} animate-pulse`}
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
          <StreakNavBadge variant="header" />
        </div>
        {!isBeginner && (
        <>
        {/* Mode toggle — one tooltip, calm affordance */}
        <div
          className="relative hidden sm:block"
          onMouseEnter={() => setActiveHint("mode")}
          onMouseLeave={() => setActiveHint(null)}
        >
          <button
            onClick={() => {
              setExperienceMode(nextExperienceMode(experienceMode));
              setActiveHint(null);
              dismissModeTip();
            }}
            className="flex flex-col items-center gap-0.5"
            aria-label={`Switch to ${MODE_LABEL[nextExperienceMode(experienceMode)]} mode`}
          >
            <span className="w-10 h-8 text-sm rounded-xl flex items-center justify-center bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md">
              {MODE_ICON[experienceMode]}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 leading-none">
              {MODE_LABEL[experienceMode]}
            </span>
          </button>
          {(activeHint === "mode" || showModeTip) && (
            <div className="absolute right-0 top-full mt-1.5 w-52 bg-gray-900 dark:bg-gray-700 text-white rounded-xl px-3 py-2.5 shadow-xl z-50">
              <button
                onClick={() => { setActiveHint(null); dismissModeTip(); }}
                className="absolute top-1.5 right-2 w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors text-xs leading-none"
                aria-label="Dismiss"
              >
                ✕
              </button>
              <div className="text-xs font-bold text-white mb-0.5 pr-5">
                Tap → {MODE_LABEL[nextExperienceMode(experienceMode)]} {MODE_ICON[nextExperienceMode(experienceMode)]}
              </div>
              <div className="text-xs text-gray-300 leading-relaxed">
                {MODE_TIP_BODY[experienceMode]}
              </div>
              <div className="absolute -top-1.5 right-3 w-3 h-3 bg-gray-900 dark:bg-gray-700 rotate-45 rounded-sm" />
            </div>
          )}
        </div>
        </>
        )}

        {!isBeginner && (
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

        {isFarcaster ? <FarcasterWalletButton /> : <WalletButton />}
      </div>
    </div>
  );
}
