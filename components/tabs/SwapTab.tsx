import React, { useState, useEffect, useRef, useMemo } from "react";
import SwapInterface from "../swap/SwapInterface";
import { useInflationData } from "../../hooks/use-inflation-data";
import type { Region } from "../../hooks/use-user-region";
import type { RegionalInflationData } from "../../hooks/use-inflation-data";
import RegionalIconography from "../regional/RegionalIconography";
import RealLifeScenario from "../demo/RealLifeScenario";
import { REGION_COLORS } from "../../constants/regions";
import { useSwap } from "../../hooks/use-swap";
import { useWalletContext } from "../wallet/WalletProvider";
import { useAppState } from "../../context/AppStateContext";
import WalletButton from "../wallet/WalletButton";
import { NETWORKS } from "../../config";
import { ChainDetectionService } from "../../services/swap/chain-detection.service";
import {
  TabHeader,
  CollapsibleSection,
  Card,
  ConnectWalletPrompt,
} from "../shared/TabComponents";

// Network-specific token configurations
const NETWORK_TOKENS: Record<
  number,
  Array<{ symbol: string; name: string; region: string }>
> = {
  [NETWORKS.CELO_MAINNET.chainId]: [
    { symbol: "CUSD", name: "Celo Dollar", region: "USA" },
    { symbol: "CEUR", name: "Celo Euro", region: "Europe" },
    { symbol: "CREAL", name: "Celo Brazilian Real", region: "LatAm" },
    { symbol: "CKES", name: "Celo Kenyan Shilling", region: "Africa" },
    { symbol: "CCOP", name: "Celo Colombian Peso", region: "LatAm" },
    { symbol: "PUSO", name: "Philippine Peso", region: "Asia" },
    { symbol: "CGHS", name: "Celo Ghana Cedi", region: "Africa" },
    { symbol: "CXOF", name: "CFA Franc", region: "Africa" },
    { symbol: "CGBP", name: "British Pound", region: "Europe" },
    { symbol: "CZAR", name: "South African Rand", region: "Africa" },
    { symbol: "CCAD", name: "Canadian Dollar", region: "USA" },
    { symbol: "CAUD", name: "Australian Dollar", region: "Asia" },
    { symbol: "CCHF", name: "Swiss Franc", region: "Europe" },
    { symbol: "CJPY", name: "Japanese Yen", region: "Asia" },
    { symbol: "CNGN", name: "Nigerian Naira", region: "Africa" },
  ],
  [NETWORKS.ALFAJORES.chainId]: [
    { symbol: "CUSD", name: "Celo Dollar", region: "USA" },
    { symbol: "CEUR", name: "Celo Euro", region: "Europe" },
    { symbol: "CREAL", name: "Celo Real", region: "LatAm" },
    { symbol: "CKES", name: "Celo Kenyan Shilling", region: "Africa" },
    { symbol: "CCOP", name: "Celo Colombian Peso", region: "LatAm" },
    { symbol: "PUSO", name: "Philippine Peso", region: "Asia" },
    { symbol: "CGHS", name: "Celo Ghana Cedi", region: "Africa" },
    { symbol: "CGBP", name: "British Pound", region: "Europe" },
    { symbol: "CZAR", name: "South African Rand", region: "Africa" },
    { symbol: "CCAD", name: "Canadian Dollar", region: "USA" },
    { symbol: "CAUD", name: "Australian Dollar", region: "Asia" },
  ],
  [NETWORKS.ARBITRUM_ONE.chainId]: [
    { symbol: "USDC", name: "USD Coin", region: "USA" },
    { symbol: "PAXG", name: "Paxos Gold", region: "Global" },
  ],
  [NETWORKS.ARC_TESTNET.chainId]: [
    { symbol: "USDC", name: "USD Coin", region: "USA" },
    { symbol: "EURC", name: "Euro Coin", region: "Europe" },
  ],
};

interface SwapTabProps {
  availableTokens: Array<{ symbol: string; name: string; region: string }>;
  userRegion: Region;
  selectedStrategy: string;
  inflationData: Record<string, RegionalInflationData>;
  refreshBalances?: () => Promise<void>;
  refreshChainId?: () => Promise<number | null>;
  isBalancesLoading?: boolean;
}

const getSwapUseCase = (fromRegion: Region, toRegion: Region): string => {
  if (fromRegion === toRegion) return "";

  const cases: Record<string, Record<string, string>> = {
    Africa: { USA: "Pay for online courses priced in USD", Europe: "Save for European travel", LatAm: "Purchase goods from LatAm", Asia: "Pay for Asian imports" },
    USA: { Africa: "Send remittances with lower fees", Europe: "Protect against USD inflation", LatAm: "Invest in emerging markets", Asia: "Pay for Asian services" },
    Europe: { Africa: "Support family in Africa", USA: "Pay for US-based services", LatAm: "Diversify regional savings", Asia: "Purchase goods from Asia" },
    LatAm: { Africa: "Diversify into African markets", USA: "Pay for US imports", Europe: "Save for European education", Asia: "Purchase Asian electronics" },
    Asia: { Africa: "Invest in African growth", USA: "Pay for US services", Europe: "Prepare for European travel", LatAm: "Diversify into LatAm" },
  };

  return cases[fromRegion]?.[toRegion] || "Diversify your stablecoin portfolio";
};

export default function SwapTab({
  availableTokens,
  userRegion,
  selectedStrategy,
  inflationData,
  refreshBalances,
  refreshChainId,
  isBalancesLoading,
}: SwapTabProps) {
  const { address, chainId: walletChainId } = useWalletContext();
  const { swapPrefill, clearSwapPrefill } = useAppState();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedScenario, setSelectedScenario] = useState<"remittance" | "education" | "business" | "travel" | "savings">("remittance");
  const [targetRegion, setTargetRegion] = useState<Region>("Africa");

  const {
    swap: performSwap,
    isLoading: isSwapLoading,
    error: swapError,
    txHash: swapTxHash,
    step: hookSwapStep,
  } = useSwap();

  const [swapStatus, setSwapStatus] = useState<string | null>(null);
  const [, setApprovalTxHash] = useState<string | null>(null);
  const [localSwapTxHash, setLocalSwapTxHash] = useState<string | null>(null);
  const [swapStep, setSwapStep] = useState<"idle" | "approving" | "swapping" | "completed" | "error" | "bridging">("idle");
  const [showAiRecommendation, setShowAiRecommendation] = useState(false);
  const [aiRecommendationReason, setAiRecommendationReason] = useState<string | null>(null);

  const swapInterfaceRef = useRef<{ refreshBalances: () => void; setTokens: (from: string, to: string, amount?: string) => void }>(null);

  const networkTokens = useMemo(() => {
    const currentChainId = walletChainId || NETWORKS.CELO_MAINNET.chainId;
    return NETWORK_TOKENS[currentChainId] || availableTokens;
  }, [walletChainId, availableTokens]);

  const filteredTokens = useMemo(() => {
    if (!searchQuery) return networkTokens;
    const query = searchQuery.toLowerCase();
    return networkTokens.filter(t => t.symbol.toLowerCase().includes(query) || t.name.toLowerCase().includes(query) || t.region.toLowerCase().includes(query));
  }, [networkTokens, searchQuery]);

  const isArbitrum = ChainDetectionService.isArbitrum(walletChainId);

  useEffect(() => {
    if (swapPrefill && swapInterfaceRef.current?.setTokens) {
      swapInterfaceRef.current.setTokens(swapPrefill.fromToken || 'CUSD', swapPrefill.toToken || 'CEUR', swapPrefill.amount);
      if (swapPrefill.reason) {
        setAiRecommendationReason(swapPrefill.reason);
        setShowAiRecommendation(true);
      }
      clearSwapPrefill();
    }
  }, [swapPrefill, clearSwapPrefill]);

  useEffect(() => {
    if (swapError) {
      setSwapStatus(`Error: ${swapError}`);
      setSwapStep("error");
    } else if (hookSwapStep === "completed") {
      setSwapStatus("Swap completed successfully!");
      setSwapStep("completed");
      if (refreshBalances) refreshBalances();
    } else if (swapTxHash) {
      setSwapStatus("Transaction submitted...");
    }
  }, [swapError, hookSwapStep, swapTxHash, refreshBalances]);

  const handleSwap = async (fromToken: string, toToken: string, amount: string, fromChainId?: number, toChainId?: number) => {
    setSwapStatus("Initiating swap...");
    setSwapStep("approving");
    try {
      if (!address) throw new Error("Wallet not connected");
      await performSwap({
        fromToken, toToken, amount, fromChainId, toChainId,
        onApprovalSubmitted: setApprovalTxHash,
        onSwapSubmitted: (hash) => { setLocalSwapTxHash(hash); setSwapStatus("Swap submitted..."); }
      });
      setSwapStatus("Swap completed successfully!");
      setSwapStep("completed");
    } catch (err: any) {
      setSwapStatus(`Error: ${err.message || "Unknown error"}`);
      setSwapStep("error");
    }
  };

  const handleRefresh = async () => {
    if (refreshChainId) await refreshChainId();
    if (refreshBalances) await refreshBalances();
  };

  const homeInflationRate = inflationData[userRegion]?.avgRate || 0;
  const targetInflationRate = inflationData[targetRegion]?.avgRate || 0;
  const inflationDifference = homeInflationRate - targetInflationRate;

  return (
    <div className="space-y-4">
      <Card>
        <TabHeader
          title="Action Hub"
          chainId={walletChainId}
          onRefresh={handleRefresh}
          isLoading={isBalancesLoading || isSwapLoading}
          onNetworkChange={handleRefresh}
        />

        <div className="mb-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="size-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <input
              type="text"
              placeholder="Search assets (e.g. 'cUSD', 'Gold')..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border-2 border-gray-100 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-900 text-sm font-bold focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        {!address ? (
          <ConnectWalletPrompt message="Connect your wallet to swap tokens." WalletButtonComponent={<WalletButton variant="inline" />} />
        ) : (
          <>
            {showAiRecommendation && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-3 mb-4 rounded-xl flex justify-between items-start">
                <p className="text-xs font-bold text-blue-800 dark:text-blue-200">🧠 AI: {aiRecommendationReason}</p>
                <button onClick={() => setShowAiRecommendation(false)} className="text-blue-400 font-bold">×</button>
              </div>
            )}

            <SwapInterface
              ref={swapInterfaceRef}
              availableTokens={filteredTokens}
              address={address}
              onSwap={handleSwap}
              preferredFromRegion={userRegion}
              preferredToRegion={targetRegion}
              title=""
              chainId={walletChainId}
              enableCrossChain={true}
            />

            {swapStatus && (
              <div className={`mt-3 p-3 rounded-xl text-xs font-bold ${swapStatus.includes("Error") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                {swapStatus}
              </div>
            )}
          </>
        )}
      </Card>

      {!isArbitrum && address && (
        <div className="space-y-4">
          <CollapsibleSection title={`Regional Hedge: ${userRegion} → ${targetRegion}`} icon={<span>🛡️</span>}>
            <div className="flex flex-wrap gap-2 mb-4">
              {Object.keys(inflationData).filter(r => r !== userRegion).map(r => (
                <button key={r} onClick={() => setTargetRegion(r as Region)} className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${targetRegion === r ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>{r}</button>
              ))}
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl flex justify-between items-center">
              <div className="text-center"><div className="text-[10px] font-black text-gray-400 lowercase">{userRegion}</div><div className="text-lg font-black">{homeInflationRate.toFixed(1)}%</div></div>
              <div className="text-gray-300">→</div>
              <div className="text-center"><div className="text-[10px] font-black text-gray-400 lowercase">{targetRegion}</div><div className="text-lg font-black">{targetInflationRate.toFixed(1)}%</div></div>
              {inflationDifference > 0 && <div className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-[10px] font-black">+{inflationDifference.toFixed(1)}% Yield</div>}
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Action Guidance" icon={<span>🧠</span>}>
            <RealLifeScenario region={userRegion} targetRegion={targetRegion} scenarioType={selectedScenario} inflationRate={homeInflationRate} targetInflationRate={targetInflationRate} amount={1000} monthlyAmount={100} />
            {getRecommendations(userRegion, inflationData, homeInflationRate)}
          </CollapsibleSection>
        </div>
      )}
    </div>
  );
}

function getRecommendations(userRegion: Region, inflationData: Record<string, RegionalInflationData>, homeInflationRate: number) {
  const recommendations: Record<string, Array<{ from: string, to: string, reason: string }>> = {
    Africa: [{ from: "cKES", to: "cEUR", reason: `Hedge: ${(inflationData["Europe"]?.avgRate || 0).toFixed(1)}% vs ${homeInflationRate.toFixed(1)}% inflation` }],
    LatAm: [{ from: "cREAL", to: "cUSD", reason: "Stable reserve exposure" }],
    Asia: [{ from: "PUSO", to: "cEUR", reason: "Diversify into Eurozone" }],
  };
  const recs = recommendations[userRegion] || [];
  if (recs.length === 0) return null;
  return (
    <div className="space-y-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Recommended Actions</p>
      {recs.map((r, i) => (
        <div key={i} className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <span className="text-xs font-bold">{r.from} → {r.to}</span>
          <span className="text-[10px] text-blue-500 font-medium">{r.reason}</span>
        </div>
      ))}
    </div>
  );
}
