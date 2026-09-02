import React, { useEffect } from "react";
import type { MultichainPortfolio } from "@/hooks/use-multichain-balances";
import type { Region } from "@/hooks/use-user-region";
import { useWalletContext } from "@/components/wallet/WalletProvider";
import { useDemoMode } from "@/context/app/DemoModeContext";
import { DEMO_PORTFOLIO } from "../../lib/demo-data";
import { NotConnectedState } from "@/components/tabs/overview/NotConnectedState";
import { ConnectingState } from "@/components/tabs/overview/ConnectingState";
import { ConnectedOverview } from "@/components/tabs/overview/ConnectedOverview";
import OverviewSkeleton from "@/components/ui/skeletons/OverviewSkeleton";

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
    source?: "api" | "cache" | "fallback" | "unavailable";
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
  const { demoMode, disableDemoMode, enableDemoMode } = useDemoMode();

  const isDemo = demoMode.isActive;
  const hasHoldings = (portfolio?.totalValue ?? 0) > 0;
  // A fetch has completed for this address. `isLoading` starts false, so
  // treating "not loading" as "empty" auto-previewed connected wallets
  // before Celo/Arbitrum balances arrived. Stay on the wait until that
  // snapshot exists — do not time out into an empty Home (that hid real
  // coins when prices hung). A later refresh can keep isLoading true;
  // lastUpdated is enough to show the coins we already have.
  const balancesSettled = portfolio?.lastUpdated != null;

  // Demo is opt-in (unconnected "try sample data"). Never auto-enable it
  // for a connected wallet — empty connected wallets get the cold-start
  // (add funds), not a fake $1,000 portfolio. If they opted in and then
  // real holdings arrive, drop demo so it never hides their money.
  useEffect(() => {
    if (demoMode.isActive && hasHoldings) {
      disableDemoMode();
    }
  }, [demoMode.isActive, hasHoldings, disableDemoMode]);

  const activePortfolio = isDemo ? DEMO_PORTFOLIO : portfolio;

  if (address && !balancesSettled) {
    return <OverviewSkeleton />;
  }

  if (!address && !isConnecting && !isDemo) {
    return (
      <NotConnectedState
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
