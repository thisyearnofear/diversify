import React from "react";
import type { MultichainPortfolio } from "@/hooks/use-multichain-balances";
import type { Region } from "@/hooks/use-user-region";
import { useWalletContext } from "../wallet/WalletProvider";
import { useInflationData } from "@/hooks/use-inflation-data";
import { useDemoMode } from "../../context/app/DemoModeContext";
import { DEMO_PORTFOLIO } from "../../lib/demo-data";
import { NotConnectedState } from "./overview/NotConnectedState";
import { ConnectingState } from "./overview/ConnectingState";
import { ConnectedOverview } from "./overview/ConnectedOverview";

interface OverviewTabProps {
  portfolio: MultichainPortfolio;
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
  const activePortfolio = isDemo ? DEMO_PORTFOLIO : portfolio;

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
      activePortfolio={activePortfolio}
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
