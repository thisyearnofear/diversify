import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWalletContext } from "../wallet/WalletProvider";
import { NETWORKS } from "../../config";
import { useExperience } from "../../context/app/ExperienceContext";

import EmergingMarketsTracker from "../trade/EmergingMarketsTracker";
import CommodityTrading from "../swap/CommodityTrading";
import RobinhoodMarket from "../trade/RobinhoodMarket";
import { EMERGING_MARKETS_CONFIG } from "../../config/emerging-markets";
import { useMultichainBalances } from "../../hooks/use-multichain-balances";
import { useNavigation } from "../../context/app/NavigationContext";
import DiversificationHealthCard from "../trade/DiversificationHealthCard";
import type { RebalancingOpportunity } from "@diversifi/shared";
import { useAIOracle } from "../../hooks/use-ai-oracle";

// Market type for switching between Robinhood, Emerging Markets, and Commodities
type MarketType = "robinhood" | "emerging-markets" | "commodities";

export default function TradeTab() {
  const { address, chainId, switchNetwork, isConnected, connect } =
    useWalletContext();
  const { experienceMode } = useExperience();
  const { navigateToSwap } = useNavigation();

  const isBeginner = experienceMode === "beginner";
  const isAdvanced = experienceMode === "advanced";

  // Portfolio analysis for diversification health
  const {
    diversificationScore,
    diversificationRating,
    totalValue,
    regionalExposure,
    missingRegions,
    rebalancingOpportunities,
    diversificationTips,
    isLoading: isPortfolioLoading,
  } = useMultichainBalances(address);

  // Handle diversification action - navigate to swap with prefill
  const handleDiversificationAction = (opp: RebalancingOpportunity) => {
    navigateToSwap({
      fromToken: opp.fromToken,
      toToken: opp.toToken,
      amount: opp.suggestedAmount.toFixed(2),
      reason: `Diversification: Reduce ${opp.fromRegion} exposure, add ${opp.toRegion} (${opp.inflationDelta.toFixed(1)}% inflation reduction)`,
    });
  };

  const [activeMarket, setActiveMarket] = useState<MarketType>("emerging-markets");
  const [robinhoodSubTab, setRobinhoodSubTab] = useState<"trade" | "earn" | "track">("trade");

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Market Selector */}
      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
        <button
          onClick={() => setActiveMarket("robinhood")}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 ${
            activeMarket === "robinhood"
              ? "bg-white dark:bg-gray-700 shadow-sm text-blue-600"
              : "text-gray-500 hover:text-gray-600"
          }`}
        >
          <span>⚡</span>
          <div className="flex flex-col items-center leading-tight">
            <span className="hidden sm:inline">Paper Trade</span>
            <span className="sm:hidden">Paper</span>
            {!isConnected && (
              <span className="text-xs uppercase tracking-tighter text-blue-400 font-black">
                Preview
              </span>
            )}
          </div>
        </button>
        <button
          onClick={() => setActiveMarket("emerging-markets")}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 ${
            activeMarket === "emerging-markets"
              ? "bg-white dark:bg-gray-700 shadow-sm text-green-600"
              : "text-gray-500 hover:text-gray-600"
          }`}
        >
          <span>🌍</span>
          <div className="flex flex-col items-center leading-tight">
            <span className="hidden sm:inline">Live Track</span>
            <span className="sm:hidden">Live</span>
            {!isConnected && (
              <span className="text-xs uppercase tracking-tighter text-green-400 font-black">
                Live Track
              </span>
            )}
          </div>
        </button>
        <button
          onClick={() => setActiveMarket("commodities")}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 ${
            activeMarket === "commodities"
              ? "bg-white dark:bg-gray-700 shadow-sm text-amber-600"
              : "text-gray-500 hover:text-gray-600"
          }`}
        >
          <span>🥇</span>
          <div className="flex flex-col items-center leading-tight">
            <span className="hidden sm:inline">Live Commodities</span>
            <span className="sm:hidden">Commodities</span>
            {!isConnected && (
              <span className="text-xs uppercase tracking-tighter text-amber-400 font-black">
                Live
              </span>
            )}
          </div>
        </button>
      </div>

      {/* Diversification Health Card */}
      {isConnected && (
        <DiversificationHealthCard
          analysis={
            isPortfolioLoading
              ? null
              : ({
                  diversificationScore,
                  diversificationRating,
                  totalValue,
                  regionalExposure,
                  missingRegions,
                  rebalancingOpportunities,
                  diversificationTips,
                  tokenCount: regionalExposure?.length || 0,
                  regionCount: regionalExposure?.length || 0,
                  tokens: [],
                  weightedInflationRisk: 0,
                  concentrationRisk: "LOW",
                  goalScores: { hedge: 0, diversify: diversificationScore, rwa: 0 },
                  totalAnnualYield: 0,
                  totalInflationCost: 0,
                  netAnnualGain: 0,
                  avgYieldRate: 0,
                  netRate: 0,
                  isNetPositive: true,
                  overExposedRegions: [],
                  underExposedRegions: [],
                  goalAnalysis: {
                    userGoal: "exploring",
                    title: "Portfolio Analysis",
                    description: "Analyzing your holdings to find diversification opportunities.",
                    recommendations: rebalancingOpportunities || [],
                  },
                  targetAllocations: {
                    inflation_protection: [],
                    geographic_diversification: [],
                    rwa_access: [],
                    exploring: [],
                  },
                  hyperliquidExposure: {
                    totalValue: 0,
                    percentage: 0,
                    positions: [],
                  },
                  projections: {
                    currentPath: { value1Year: 0, value3Year: 0, purchasingPowerLost: 0 },
                    optimizedPath: { value1Year: 0, value3Year: 0, purchasingPowerPreserved: 0 },
                  },
                } as any)
          }
          isLoading={isPortfolioLoading}
          onTakeAction={handleDiversificationAction}
        />
      )}

      {/* Market Sections */}
      <AnimatePresence mode="wait">
        {/* Emerging Markets */}
        {activeMarket === "emerging-markets" && (
          <motion.div
            key="emerging-markets"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <EmergingMarketsTracker
              onSelectStock={(symbol) => {
                console.log("Selected stock:", symbol);
              }}
            />
          </motion.div>
        )}

        {/* Commodities */}
        {activeMarket === "commodities" && (
          <motion.div
            key="commodities"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl border border-amber-200 dark:border-amber-800">
              <p className="text-xs text-amber-800 dark:text-amber-300">
                🥇 Trade commodity perpetuals on Hyperliquid. Synthetic 1x exposure to GOLD, SILVER, OIL &
                COPPER — collateralized in USDC. No wallet network switch required.
              </p>
            </div>
            <CommodityTrading
              address={address}
              chainId={NETWORKS.HYPERLIQUID.chainId}
              onTrade={async (action, symbol, amount) => {
                console.log(`[Commodities] ${action} ${symbol} for $${amount}`);
              }}
            />
          </motion.div>
        )}

        {/* Robinhood — composed from extracted RobinhoodMarket */}
        {activeMarket === "robinhood" && (
          <motion.div
            key="robinhood"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <RobinhoodMarket
              address={address}
              isConnected={isConnected}
              isOnRH={chainId === NETWORKS.RH_TESTNET.chainId}
              chainId={chainId}
              connect={connect}
              switchNetwork={switchNetwork}
              isBeginner={isBeginner}
              isAdvanced={isAdvanced}
              activeTab={robinhoodSubTab}
              setActiveTab={setRobinhoodSubTab}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}