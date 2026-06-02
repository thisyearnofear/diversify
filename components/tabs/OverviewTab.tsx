import React, { useEffect, useRef } from "react";
import type { MultichainPortfolio } from "@/hooks/use-multichain-balances";
import type { Region } from "@/hooks/use-user-region";
import { useWalletContext } from "../wallet/WalletProvider";
import { useInflationData } from "@/hooks/use-inflation-data";
import { useDemoMode } from "../../context/app/DemoModeContext";
import { DEMO_PORTFOLIO } from "../../lib/demo-data";
import { NotConnectedState } from "./overview/NotConnectedState";
import { ConnectingState } from "./overview/ConnectingState";
import { ConnectedOverview } from "./overview/ConnectedOverview";
import OverviewSkeleton from "../ui/skeletons/OverviewSkeleton";

interface OverviewTabProps {
  portfolio: MultichainPortfolio;
  isLoading?: boolean;
  isRegionLoading: boolean;
  userRegion: Region;
  setUserRegion: (region: Region) => void;
  REGIONS: readonly Region[];
  setActiveTab: (tab: import("@/constants/tabs").TabId) => void;
  refreshBalances?: () => Promise<void>;
  refreshChainId?: () => Promise<number | null>;
  currencyPerformanceData?: {
    dates: string[];
    currencies: {
      symbol: string;
      name: string;
      region: Region;
      values: number[];
      percentChange: number;
    }[];
    baseCurrency: string;
    source?: "api" | "cache" | "fallback";
  };
}

export default function OverviewTab({
  portfolio,
  isLoading,
  userRegion,
  setUserRegion,
  REGIONS,
  setActiveTab,
  refreshBalances,
  refreshChainId,
  currencyPerformanceData,
}: OverviewTabProps) {
  const { address, isConnecting, chainId } = useWalletContext();
  const { inflationData } = useInflationData();
  const { demoMode, disableDemoMode, enableDemoMode } = useDemoMode();

  const isDemo = demoMode.isActive;
  const hasHoldings = (portfolio?.totalValue ?? 0) > 0;

  // Cold start: when a wallet is connected but has no holdings on supported chains,
  // auto-enable demo mode so the user immediately sees what protection looks like.
  // They can exit via the "Exit Demo" button in the demo banner.
  const autoEnabledRef = useRef(false);
  useEffect(() => {
    if (
      address &&
      !isConnecting &&
      !hasHoldings &&
      !demoMode.isActive &&
      !autoEnabledRef.current
    ) {
      autoEnabledRef.current = true;
      enableDemoMode();
    }
  }, [address, isConnecting, hasHoldings, demoMode.isActive, enableDemoMode]);

  // If user explicitly disabled demo, don't auto-re-enable in this session.
  useEffect(() => {
    if (!demoMode.isActive) {
      autoEnabledRef.current = false;
    }
  }, [demoMode.isActive]);

  const activePortfolio = isDemo || (!hasHoldings && address && !isConnecting) ? DEMO_PORTFOLIO : portfolio;

  if (isLoading && address) {
    return <OverviewSkeleton />;
  }

  if (!address && !isConnecting && !isDemo) {
    return (
      <NotConnectedState
        userRegion={userRegion}
        regionalInflation={inflationData[userRegion]?.avgRate || 15.4}
        onEnableDemo={enableDemoMode}
      />
    );
  }

  if (isConnecting) {
    return <ConnectingState />;
  }

  return (
    <ConnectedOverview
      portfolio={portfolio}
      activePortfolio={activePortfolio as any}
      address={address || ""}
      chainId={chainId}
      isDemo={isDemo}
      userRegion={userRegion}
      setUserRegion={setUserRegion}
      REGIONS={REGIONS}
      setActiveTab={setActiveTab}
      refreshBalances={refreshBalances}
      refreshChainId={refreshChainId}
      onDisableDemo={disableDemoMode}
      onEnableDemo={enableDemoMode}
      currencyPerformanceData={currencyPerformanceData}
    />
  );
}
