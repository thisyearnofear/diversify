import type { ReactNode } from "react";
import Head from "next/head";
import WalletButton from "../wallet/WalletButton";
import ThemeToggle from "./ThemeToggle";
import { useAppState } from "../../context/AppStateContext";

interface LayoutProps {
  children: ReactNode;
  title?: string;
  isInMiniPay?: boolean;
}

export default function Layout({
  children,
  title = "DiversiFi - Stablecoin Portfolio Diversification",
  isInMiniPay = false,
}: LayoutProps) {
  const { experienceMode, setExperienceMode } = useAppState();

  const getModeLabel = () => {
    if (experienceMode === "beginner") return "Simple";
    if (experienceMode === "intermediate") return "Standard";
    return "Advanced";
  };

  const getModeEmoji = () => {
    if (experienceMode === "beginner") return "🌱";
    if (experienceMode === "intermediate") return "🚀";
    return "⚡";
  };

  const cycleMode = () => {
    if (experienceMode === "beginner") setExperienceMode("intermediate");
    else if (experienceMode === "intermediate") setExperienceMode("advanced");
    else setExperienceMode("beginner");
  };

  const isBeginner = experienceMode === "beginner";

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors duration-300">
      <Head>
        <title>{title}</title>
        <meta
          name="description"
          content="Visualize and manage your stablecoin portfolio diversification"
        />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1"
        />
      </Head>

      <header className="bg-white dark:bg-gray-800 shadow transition-colors duration-300">
        <div className="max-w-7xl mx-auto p-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white transition-colors duration-300">
              {isBeginner ? "💰 Protect Your Money" : "DiversiFi"}
              {isInMiniPay && (
                <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded ml-2">
                  MiniPay
                </span>
              )}
            </h1>
            <div className="flex items-center space-x-2">
              {/* Mode switcher - Refined for discovery */}
              <div className="flex flex-col items-end">
                <button
                  onClick={cycleMode}
                  className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-full transition-all flex items-center gap-1.5 ${!isBeginner
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95"
                    : "bg-white dark:bg-gray-800 text-gray-400 border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-500"
                    }`}
                >
                  <span className="text-xs">{getModeEmoji()}</span>
                  <span>{getModeLabel()} Mode</span>
                  {!isBeginner && (
                    <svg className="size-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </button>
                {isBeginner && (
                  <span className="text-[8px] font-bold text-blue-500 mt-1 animate-pulse uppercase tracking-tighter">
                    Unlock Features →
                  </span>
                )}
              </div>
              <ThemeToggle />
              <WalletButton />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 sm:px-6 lg:px-8">{children}</main>

      {!isBeginner && (
        <footer className="bg-white dark:bg-gray-800 shadow-inner mt-auto transition-colors duration-300">
          <div className="max-w-7xl mx-auto p-4 sm:px-6 lg:px-8">
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 transition-colors duration-300">
              &copy; {new Date().getFullYear()} DiversiFi - Powered by Celo and
              Mento
            </p>
          </div>
        </footer>
      )}
    </div>
  );
}
