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
  const { experienceMode, setExperienceMode, userActivity } = useAppState();

  const getModeLabel = () => {
    if (experienceMode === "beginner") return "Simple";
    if (experienceMode === "intermediate") return "Standard";
    return "Advanced";
  };

  const cycleMode = () => {
    if (experienceMode === "beginner") setExperienceMode("intermediate");
    else if (experienceMode === "intermediate") setExperienceMode("advanced");
    else setExperienceMode("beginner");
  };

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
              DiversiFi
              {isInMiniPay && (
                <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded ml-2">
                  MiniPay
                </span>
              )}
            </h1>
            <div className="flex items-center space-x-2">
              <button
                onClick={cycleMode}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-1.5"
                title={`Current mode: ${getModeLabel()}. Click to change. (${userActivity.swapCount} swaps completed)`}
              >
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                <span>{getModeLabel()}</span>
              </button>
              <ThemeToggle />
              <WalletButton />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 sm:px-6 lg:px-8">{children}</main>

      <footer className="bg-white dark:bg-gray-800 shadow-inner mt-auto transition-colors duration-300">
        <div className="max-w-7xl mx-auto p-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 transition-colors duration-300">
            &copy; {new Date().getFullYear()} DiversiFi - Powered by Celo and
            Mento
          </p>
        </div>
      </footer>
    </div>
  );
}
