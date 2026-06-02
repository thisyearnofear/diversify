/**
 * AppHeader — The top header bar for the DiversiFi app.
 * Contains: logo, mode toggle, voice button, wallet button.
 */
import { useState } from "react";
import type { UserExperienceMode } from "@/context/app/types";
import VoiceButton from "@/components/ui/VoiceButton";
import WalletButton from "@/components/wallet/WalletButton";
import FarcasterWalletButton from "@/components/wallet/FarcasterWalletButton";

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
    return !localStorage.getItem("seenModeTip") && !!localStorage.getItem("inlineOnboardingDismissed");
  });
  const dismissModeTip = () => {
    setShowModeTip(false);
    if (typeof window !== "undefined") localStorage.setItem("seenModeTip", "1");
  };

  return (
    <div className="flex items-center justify-between mb-2 py-1">
      {/* Left: Logo */}
      <div className="flex items-center gap-2 sm:gap-2">
        <div className="w-7 h-7 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 flex-shrink-0">
          <span className="text-white text-sm font-black">D</span>
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          {/* Brand name hidden on mobile (the 'D' logo + status dot already
              convey the brand + state). The full word reappears at the
              'sm' breakpoint (≥640px) where there's room alongside the
              right-side controls. */}
          <h1 className="hidden sm:inline text-sm font-black text-gray-900 dark:text-white uppercase tracking-tighter">
            DiversiFi
          </h1>
          {address && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <div
                className={`w-1.5 h-1.5 rounded-full ${isWhitelisted ? "bg-emerald-500" : "bg-amber-500"} animate-pulse`}
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
        {/* Mode toggle — one tooltip, calm affordance */}
        <div
          className="relative"
          onMouseEnter={() => setActiveHint("mode")}
          onMouseLeave={() => setActiveHint(null)}
        >
          <button
            onClick={() => {
              const next =
                experienceMode === "beginner"
                  ? "intermediate"
                  : experienceMode === "intermediate"
                    ? "advanced"
                    : "beginner";
              setExperienceMode(next);
              setActiveHint(null);
              dismissModeTip();
            }}
            className="flex flex-col items-center gap-0.5"
            aria-label={
              experienceMode === "beginner"
                ? "Switch to Standard mode"
                : experienceMode === "intermediate"
                  ? "Switch to Advanced mode"
                  : "Switch to Simple mode"
            }
          >
            <span className="w-10 h-8 text-sm rounded-xl flex items-center justify-center bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md">
              {experienceMode === "beginner" ? "🌱" : experienceMode === "intermediate" ? "🚀" : "⚡"}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 leading-none">
              {experienceMode === "beginner" ? "Simple" : experienceMode === "intermediate" ? "Standard" : "Advanced"}
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
                Tap → {experienceMode === "beginner" ? "Standard 🚀" : experienceMode === "intermediate" ? "Advanced ⚡" : "Simple 🌱"}
              </div>
              <div className="text-xs text-gray-300 leading-relaxed">
                {experienceMode === "beginner"
                  ? "Unlocks token search, inflation comparison, AI chat"
                  : experienceMode === "intermediate"
                    ? "Unlocks power analytics, voice shortcuts, batch ops"
                    : "Hides advanced panels for a focused view"}
              </div>
              <div className="absolute -top-1.5 right-3 w-3 h-3 bg-gray-900 dark:bg-gray-700 rotate-45 rounded-sm" />
            </div>
          )}
        </div>

        {/* Voice assistant */}
        <VoiceButton
          size="sm"
          variant="default"
          externalSuggestionsOpen={activeHint === "voice"}
          onSuggestionsChange={(open) => setActiveHint(open ? "voice" : null)}
          onTranscription={handleTranscription}
        />

        {isFarcaster ? <FarcasterWalletButton /> : <WalletButton />}
      </div>
    </div>
  );
}
