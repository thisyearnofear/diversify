import type { ReactNode } from "react";
import Head from "next/head";
import WalletButton from "../wallet/WalletButton";
import ThemeToggle from "./ThemeToggle";

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
            <div className="flex items-center space-x-4">
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
