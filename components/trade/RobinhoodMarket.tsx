/**
 * RobinhoodMarket — Paper trading & live stock tracking on Robinhood Testnet.
 * Extracted from TradeTab following MODULAR principle.
 */
import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { motion, AnimatePresence } from "framer-motion";
import { getTokenDesign } from "../../constants/tokens";
import {
  RH_TESTNET_TOKENS,
  BROKER_ADDRESSES,
  NETWORKS,
} from "../../config";
import {
  ProviderFactoryService,
  TokenPriceService,
} from "@diversifi/shared";
import StockChart from "../trade/StockChart";
import TradeWidget from "../trade/TradeWidget";
import LiquidityWidget from "../trade/LiquidityWidget";
import { useStockStats } from "../../hooks/use-stock-stats";
import { useTokenHolders } from "../../hooks/use-token-holders";
import HoldersWidget from "../trade/HoldersWidget";
import TradeIntelligence, { type IntelligenceItem } from "../trade/TradeIntelligence";
import PortfolioRiskWidget from "../trade/PortfolioRiskWidget";
import { useWatchlist } from "../../hooks/use-watchlist";

const RH_CHAIN_ID = NETWORKS.RH_TESTNET.chainId;
const AMM_ADDRESS = BROKER_ADDRESSES.RH_TESTNET;
const WETH_ADDRESS = RH_TESTNET_TOKENS.WETH;

const FICTIONAL_STOCKS = ["ACME", "SPACELY", "WAYNE", "OSCORP", "STARK"] as const;
const REAL_STOCKS = ["NVDA", "GOOGL", "TSLA", "AAPL", "BTC", "ETH"] as const;
const STOCKS = [...FICTIONAL_STOCKS, ...REAL_STOCKS] as const;
export type Stock = (typeof STOCKS)[number];

const isFictionalStock = (stock: Stock): stock is typeof FICTIONAL_STOCKS[number] =>
  FICTIONAL_STOCKS.includes(stock as typeof FICTIONAL_STOCKS[number]);

const AMM_ABI = [
  "function quoteSwapETH(uint256 ethAmountIn, address tokenOut) view returns (uint256)",
  "function quoteSwapTokenForETH(uint256 tokenAmountIn, address tokenIn) view returns (uint256)",
  "function swapExactETHForTokens(uint256 amountOutMin, address tokenOut, address to, uint256 deadline) payable returns (uint256)",
  "function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address tokenIn, address to, uint256 deadline) returns (uint256)",
  "function getReserves(address tokenA, address tokenB) view returns (uint256, uint256)",
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address, address) view returns (uint256)",
  "function approve(address, uint256) returns (bool)",
];

const SLIPPAGE_PERCENT = 0.5;
export type TradeMode = "buy" | "sell";

interface RobinhoodMarketProps {
  address: string | null;
  isConnected: boolean;
  isOnRH: boolean;
  chainId: number | null;
  connect: () => void;
  switchNetwork: (chainId: number) => Promise<void>;
  isBeginner: boolean;
  isAdvanced: boolean;
  activeTab: "trade" | "earn" | "track";
  setActiveTab: (tab: "trade" | "earn" | "track") => void;
  // Shared state from parent
  liveRates: Record<Stock, string | null>;
  liveRateMetadata: Record<Stock, { isLive: boolean; source: string }>;
  basePrices: Record<"ETH" | "BTC", number>;
  baseAsset: "ETH" | "BTC";
  setBaseAsset: (asset: "ETH" | "BTC") => void;
  realStockPrice: number | null;
  synthForecast: { p10: number; p50: number; p90: number } | null;
  intelligenceItems: IntelligenceItem[];
  isLoadingIntelligence: boolean;
  showAdvancedInsights: boolean;
  setShowAdvancedInsights: (show: boolean) => void;
}

export default function RobinhoodMarket({
  address,
  isConnected,
  isOnRH,
  chainId,
  connect,
  switchNetwork,
  isBeginner,
  isAdvanced,
  activeTab,
  setActiveTab,
  liveRates,
  liveRateMetadata,
  basePrices,
  baseAsset,
  setBaseAsset,
  realStockPrice,
  synthForecast,
  intelligenceItems,
  isLoadingIntelligence,
  showAdvancedInsights,
  setShowAdvancedInsights,
}: RobinhoodMarketProps) {
  const [selected, setSelected] = useState<Stock>("NVDA");
  const [mode, setMode] = useState<TradeMode>("buy");
  const [inputAmount, setInputAmount] = useState("");
  const [quote, setQuote] = useState<string | null>(null);
  const [priceImpact, setPriceImpact] = useState<number | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ethBalance, setEthBalance] = useState<string | null>(null);
  const [stockBalances, setStockBalances] = useState<Record<Stock, string>>(
    Object.fromEntries(STOCKS.map((s) => [s, "0"])) as Record<Stock, string>
  );
  const [showAllRobinhood, setShowAllRobinhood] = useState(false);
  const [showAllFictional, setShowAllFictional] = useState(false);

  const { watchlist: robinhoodWatchlist, toggleWatchlist: toggleRobinhoodWatchlist, isInWatchlist: isInRobinhoodWatchlist } = useWatchlist();

  const design = getTokenDesign(selected);
  const stockAddress = isFictionalStock(selected) ? RH_TESTNET_TOKENS[selected] : undefined;
  const isRealStock = !isFictionalStock(selected);

  const { stats: stockStats, isLoading: isStatsLoading } = useStockStats(selected, liveRates[selected]);
  const volatilityValue = stockStats?.forecastVol ?? 0.3;
  const { holderData, isHoldersLoading } = useTokenHolders(selected);

  // --- Data Fetching ---
  const fetchBalances = useCallback(async () => {
    if (!address) return;
    try {
      const provider = isOnRH
        ? await ProviderFactoryService.getWeb3Provider()
        : ProviderFactoryService.getProvider(RH_CHAIN_ID);

      const bal = await provider.getBalance(address);
      setEthBalance(ethers.utils.formatEther(bal));

      const entries = await Promise.all(
        FICTIONAL_STOCKS.map(async (s) => {
          const token = new ethers.Contract(RH_TESTNET_TOKENS[s], ERC20_ABI, provider);
          const b = await token.balanceOf(address);
          return [s, ethers.utils.formatEther(b)] as const;
        })
      );
      const balances = Object.fromEntries(entries) as Record<Stock, string>;
      REAL_STOCKS.forEach((s) => { balances[s] = "0"; });
      setStockBalances(balances);
    } catch (e) {
      console.warn("[Robinhood] Balance fetch error:", e);
    }
  }, [address, isOnRH]);

  useEffect(() => {
    fetchBalances();
    const interval = setInterval(fetchBalances, 10000);
    return () => clearInterval(interval);
  }, [fetchBalances]);

  // --- Quoting ---
  useEffect(() => {
    if (!inputAmount || !isOnRH || parseFloat(inputAmount) <= 0 || !stockAddress) {
      setQuote(null);
      setPriceImpact(null);
      return;
    }
    const timeout = setTimeout(async () => {
      setIsQuoting(true);
      try {
        const provider = await ProviderFactoryService.getWeb3Provider();
        const amm = new ethers.Contract(AMM_ADDRESS, AMM_ABI, provider);
        const parsed = ethers.utils.parseEther(inputAmount);
        const out = mode === "buy"
          ? await amm.quoteSwapETH(parsed, stockAddress)
          : await amm.quoteSwapTokenForETH(parsed, stockAddress);
        setQuote(parseFloat(ethers.utils.formatEther(out)).toFixed(6));
        setError(null);
        try {
          const [reserveA, reserveB] = await amm.getReserves(WETH_ADDRESS, stockAddress);
          const relevantReserve = mode === "buy" ? reserveA : reserveB;
          if (!relevantReserve.isZero()) {
            setPriceImpact(parseFloat(parsed.mul(10000).div(relevantReserve).toString()) / 100);
          }
        } catch { setPriceImpact(null); }
      } catch {
        setQuote(null);
        setError("Could not get quote");
      } finally { setIsQuoting(false); }
    }, 400);
    return () => clearTimeout(timeout);
  }, [inputAmount, selected, mode, isOnRH, stockAddress]);

  // --- Swap Handler ---
  const handleSwap = async () => {
    if (!inputAmount || !address || !stockAddress) return;
    setIsSwapping(true);
    setError(null);
    setTxHash(null);
    try {
      const signer = await ProviderFactoryService.getSigner();
      const amm = new ethers.Contract(AMM_ADDRESS, AMM_ABI, signer);
      const deadline = Math.floor(Date.now() / 1000) + 300;
      const slippage = (100 - SLIPPAGE_PERCENT) / 100;
      let tx;
      if (mode === "buy") {
        const amountIn = ethers.utils.parseEther(inputAmount);
        const minOut = quote ? ethers.utils.parseEther((parseFloat(quote) * slippage).toFixed(18)) : 0;
        tx = await amm.swapExactETHForTokens(minOut, stockAddress, address, deadline, { value: amountIn });
      } else {
        const amountIn = ethers.utils.parseEther(inputAmount);
        const token = new ethers.Contract(stockAddress, ERC20_ABI, signer);
        const allowance = await token.allowance(address, AMM_ADDRESS);
        if (allowance.lt(amountIn)) {
          const approveTx = await token.approve(AMM_ADDRESS, ethers.constants.MaxUint256);
          await approveTx.wait();
        }
        const minOut = quote ? ethers.utils.parseEther((parseFloat(quote) * slippage).toFixed(18)) : 0;
        tx = await amm.swapExactTokensForETH(amountIn, minOut, stockAddress, address, deadline);
      }
      setTxHash(tx.hash);
      await tx.wait();
      fetchBalances();
    } catch (e: unknown) {
      const err = e as { reason?: string; message?: string };
      setError(err.reason || err.message || "Swap failed");
    } finally { setIsSwapping(false); }
  };

  const handleMax = () => {
    if (mode === "buy" && ethBalance) {
      const max = Math.max(0, parseFloat(ethBalance) - 0.001);
      setInputAmount(max > 0 ? max.toFixed(6) : "");
    } else if (mode === "sell") {
      setInputAmount(stockBalances[selected]);
    }
  };

  const hasBalance = mode === "buy"
    ? Boolean(ethBalance && parseFloat(ethBalance) > 0.001)
    : parseFloat(stockBalances[selected]) > 0;

  // --- Stock Item Renderer ---
  const renderStockItem = (stock: Stock) => {
    const d = getTokenDesign(stock);
    const rate = liveRates[stock];
    const isWatched = isInRobinhoodWatchlist(stock);
    const isSelected = selected === stock;
    const isFictional = isFictionalStock(stock);

    return (
      <div
        key={stock}
        onClick={() => {
          setSelected(stock);
          setInputAmount("");
          setQuote(null);
          setPriceImpact(null);
          setTxHash(null);
          setError(null);
        }}
        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
          isSelected
            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
            : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-gray-300'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{d.icon}</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">{stock}</span>
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter ${
                isFictional
                  ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
                  : 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
              }`}>
                {isFictional ? '🎮 SIM' : '📡 LIVE'}
              </span>
            </div>
            <div className="text-xs text-gray-500">{d.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {rate ? (
            <div className="text-right">
              <div className="text-sm font-bold">
                ${(basePrices[baseAsset] / parseFloat(rate.replace(/,/g, ""))).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-gray-400">{rate} {stock}/{baseAsset}</div>
            </div>
          ) : (
            <div className="text-sm text-gray-400">---</div>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); toggleRobinhoodWatchlist(stock); }}
            className={`p-1.5 rounded-full transition ${isWatched ? 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30' : 'text-gray-300 hover:text-gray-400'}`}
          >
            <svg className="w-4 h-4" fill={isWatched ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Environment Badge */}
      <div className="flex items-center justify-center gap-2">
        {activeTab === "trade" && FICTIONAL_STOCKS.includes(selected as typeof FICTIONAL_STOCKS[number]) ? (
          <>
            <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-bold">🎮 Simulation • No real money</span>
            <span className="text-xs text-gray-400">Paper trading sandbox with fictional assets</span>
          </>
        ) : (
          <>
            <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-xs font-bold">📡 Live-connected market data</span>
            <span className="text-xs text-gray-400">Market tracking and intelligence from integrated providers</span>
          </>
        )}
      </div>

      {/* Stock Category Tabs */}
      <div className="flex bg-gray-100 dark:bg-gray-800/60 rounded-xl p-1">
        <button onClick={() => { setActiveTab("trade"); setSelected("ACME"); }}
          className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
            activeTab === "trade" && FICTIONAL_STOCKS.includes(selected as typeof FICTIONAL_STOCKS[number])
              ? "bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400"
              : "text-gray-400 hover:text-gray-600"
          }`}>
          🎮 Paper Trade ({FICTIONAL_STOCKS.length})
        </button>
        <button onClick={() => { setActiveTab("earn"); setSelected("NVDA"); }}
          className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
            activeTab === "earn" || REAL_STOCKS.includes(selected as typeof REAL_STOCKS[number])
              ? "bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400"
              : "text-gray-400 hover:text-gray-600"
          }`}>
          📈 Live Track ({REAL_STOCKS.length})
        </button>
        {robinhoodWatchlist.length > 0 && (
          <button onClick={() => setActiveTab("track")}
            className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
              activeTab === "track"
                ? "bg-white dark:bg-gray-700 shadow-sm text-yellow-600 dark:text-yellow-400"
                : "text-gray-400 hover:text-gray-600"
            }`}>
            ⭐ Watchlist ({robinhoodWatchlist.length})
          </button>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-200 dark:border-blue-800">
        <p className="text-xs text-blue-800 dark:text-blue-300">
          {activeTab === "track" && robinhoodWatchlist.length > 0
            ? "⭐ Your starred stocks for quick access. Tap any stock to view details and trade."
            : activeTab === "earn" || REAL_STOCKS.includes(selected as typeof REAL_STOCKS[number])
              ? "📈 Trade real-world stocks mirrored on Robinhood Testnet. Prices track actual market movements."
              : "🎮 Trade fictional stocks on Robinhood Testnet. Practice risk-free with testnet ETH!"}
        </p>
      </div>

      {/* Watchlist */}
      {activeTab === "track" && robinhoodWatchlist.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">⭐ Starred Stocks</h4>
          {robinhoodWatchlist.map((stock) => renderStockItem(stock as Stock))}
        </div>
      )}

      {/* Fictional Stocks */}
      {(activeTab === "trade" || (activeTab !== "track" && FICTIONAL_STOCKS.includes(selected as typeof FICTIONAL_STOCKS[number]))) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest">🎮 Fictional Companies</h4>
            <span className="text-xs text-gray-400">
              {showAllFictional ? FICTIONAL_STOCKS.length : Math.min(3, FICTIONAL_STOCKS.length)} of {FICTIONAL_STOCKS.length}
            </span>
          </div>
          <div className="space-y-2">
            {(showAllFictional ? FICTIONAL_STOCKS : FICTIONAL_STOCKS.slice(0, 3)).map((stock) => renderStockItem(stock))}
          </div>
          {!showAllFictional && FICTIONAL_STOCKS.length > 3 && (
            <button onClick={() => setShowAllFictional(true)} className="w-full py-3 text-sm font-bold text-purple-600 bg-purple-50 dark:bg-purple-900/20 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-900/30 transition">
              Show All {FICTIONAL_STOCKS.length} Fictional Stocks
            </button>
          )}
        </div>
      )}

      {/* Real Stocks */}
      {(activeTab === "earn" || REAL_STOCKS.includes(selected as typeof REAL_STOCKS[number])) && activeTab !== "track" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest">📈 Real World Stocks</h4>
            <span className="text-xs text-gray-400">
              {showAllRobinhood ? REAL_STOCKS.length : Math.min(3, REAL_STOCKS.length)} of {REAL_STOCKS.length}
            </span>
          </div>
          <div className="space-y-2">
            {(showAllRobinhood ? REAL_STOCKS : REAL_STOCKS.slice(0, 3)).map((stock) => renderStockItem(stock))}
          </div>
          {!showAllRobinhood && REAL_STOCKS.length > 3 && (
            <button onClick={() => setShowAllRobinhood(true)} className="w-full py-3 text-sm font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/30 transition">
              Show All {REAL_STOCKS.length} Stocks
            </button>
          )}
        </div>
      )}

      {/* Chart + Stats */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 shadow-sm overflow-hidden">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{design.icon}</span>
              <h2 className="text-xl font-bold">{design.name}</h2>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 uppercase tracking-tighter">{selected}</span>
            </div>
            {!isBeginner && <p className="text-gray-500 dark:text-gray-400 text-xs max-w-sm leading-relaxed">{design.description}</p>}
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-2 mb-2">
              <span className="text-[10px] font-black text-gray-400 uppercase">Rate Base:</span>
              <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                {(["ETH", "BTC"] as const).map((asset) => (
                  <button key={asset} onClick={() => setBaseAsset(asset)}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all ${
                      baseAsset === asset ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}>{asset}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mb-1">
              {liveRateMetadata[selected] && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                  liveRateMetadata[selected].isLive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                }`}>{liveRateMetadata[selected].isLive ? 'Live' : 'Fallback'}</span>
              )}
              <div className="text-xl font-bold">
                {(() => {
                  if (isRealStock) {
                    if (!realStockPrice) return "---";
                    return `$${realStockPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
                  }
                  const rate = liveRates[selected];
                  if (!rate) return "---";
                  const tokensPerBase = parseFloat(rate.replace(/,/g, ""));
                  if (tokensPerBase === 0) return "---";
                  return `$${(basePrices[baseAsset] / tokensPerBase).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`;
                })()}
              </div>
            </div>
            {!isRealStock && (
              <span className="text-xs text-gray-400">
                ≈ {liveRates[selected] ? `${liveRates[selected]} ${selected}/${baseAsset}` : "---"}
              </span>
            )}
          </div>
        </div>

        <div className="h-[200px] w-full mb-4">
          <StockChart symbol={selected} height={200}
            currentPrice={(() => {
              if (isRealStock) return realStockPrice != null ? realStockPrice.toString() : null;
              const rate = liveRates[selected];
              if (!rate) return null;
              const tokensPerBase = parseFloat(rate.replace(/,/g, ""));
              if (tokensPerBase === 0) return null;
              return (basePrices[baseAsset] / tokensPerBase).toString();
            })()}
            volatility={volatilityValue}
            forecastPercentiles={synthForecast}
          />
        </div>

        {!isBeginner && (
          <div className="flex gap-2 border-t border-gray-50 dark:border-gray-800 pt-3 mt-4">
            {["1D", "1W", "1M", "ALL"].map((p) => (
              <button key={p} className={`text-xs font-bold px-3 py-1 rounded-lg transition ${p === "1D" ? "bg-blue-600 text-white shadow-sm" : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"}`}>{p}</button>
            ))}
          </div>
        )}
      </div>

      {/* Advanced Insights */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <button onClick={() => setShowAdvancedInsights(!showAdvancedInsights)}
          className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
          <span className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
            <span>📊</span> Advanced Insights
          </span>
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${showAdvancedInsights ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showAdvancedInsights && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="p-3 space-y-3 border-t border-gray-200 dark:border-gray-700">
            <TradeIntelligence items={intelligenceItems} selectedAsset={selected} isAdvanced={isAdvanced} isLoading={isLoadingIntelligence} />
            <PortfolioRiskWidget />
          </motion.div>
        )}
      </div>

      {/* Trade/Earn Tabs */}
      <div className="flex bg-gray-100 dark:bg-gray-800/60 rounded-xl p-1">
        <button onClick={() => setActiveTab("trade")}
          className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition ${activeTab === "trade" ? "bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400" : "text-gray-400 hover:text-gray-600"}`}>
          Paper Trade
        </button>
        <button onClick={() => setActiveTab("earn")}
          className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition ${activeTab === "earn" ? "bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400" : "text-gray-400 hover:text-gray-600"}`}>
          Live Forecast
        </button>
      </div>

      <div className={`rounded-xl border px-3 py-2 text-xs font-semibold ${activeTab === "trade" ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300" : "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300"}`}>
        {activeTab === "trade" ? "🎮 Simulation lane • Fictional stocks on Robinhood Testnet • No real money" : "📡 Live market intelligence • Real-world stock signals and Synth forecasts"}
      </div>

      {/* Trade Widget */}
      <AnimatePresence mode="wait">
        {activeTab === "trade" ? (
          <motion.div key="trade-widget" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}>
            {!isConnected ? (
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-6 text-center shadow-lg shadow-blue-500/20 text-white">
                <div className="text-3xl mb-3">📈</div>
                <h3 className="text-xl font-bold mb-2">Connect Wallet for Paper Trading</h3>
                <p className="text-blue-100 text-sm mb-6">Connect your wallet to use the simulation lane on Robinhood Testnet.</p>
                <button onClick={connect} className="w-full py-3 bg-white text-blue-600 font-bold rounded-xl hover:bg-blue-50 transition shadow-md">Connect Wallet</button>
              </div>
            ) : !isOnRH ? (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-6 text-center">
                <div className="text-3xl mb-3">🔗</div>
                <h3 className="text-xl font-bold text-amber-900 dark:text-amber-100 mb-2">Switch Network</h3>
                <p className="text-amber-800 dark:text-amber-300 text-sm mb-6">To trade {selected}, switch to Robinhood Chain Testnet.</p>
                <button onClick={() => switchNetwork(RH_CHAIN_ID)} className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition shadow-md shadow-amber-500/20">Switch to Robinhood</button>
              </div>
            ) : isRealStock ? (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl p-6 text-center">
                <div className="text-3xl mb-3">{design.icon}</div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{selected} - Live Forecast</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Probabilistic price predictions powered by Bittensor SN50</p>
                {synthForecast ? (
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                      <div className="text-xs text-gray-500">P10</div>
                      <div className="font-bold text-red-600">${synthForecast.p10.toLocaleString()}</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                      <div className="text-xs text-gray-500">Median</div>
                      <div className="font-bold text-blue-600">${synthForecast.p50.toLocaleString()}</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                      <div className="text-xs text-gray-500">P90</div>
                      <div className="font-bold text-green-600">${synthForecast.p90.toLocaleString()}</div>
                    </div>
                  </div>
                ) : <div className="text-sm text-gray-500">Loading Synth forecasts...</div>}
              </div>
            ) : (
              <TradeWidget selected={selected} design={design} mode={mode} setMode={setMode}
                inputAmount={inputAmount} setInputAmount={setInputAmount} quote={quote}
                priceImpact={priceImpact} isQuoting={isQuoting} isSwapping={isSwapping}
                hasBalance={hasBalance} ethBalance={ethBalance} stockBalance={stockBalances[selected]}
                handleMax={handleMax} handleSwap={handleSwap} txHash={txHash} error={error}
                slippagePercent={SLIPPAGE_PERCENT} explorerUrl={NETWORKS.RH_TESTNET.explorerUrl}
              />
            )}
          </motion.div>
        ) : (
          <motion.div key="earn-widget" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}>
            {!isConnected ? (
              <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl p-6 text-center shadow-lg shadow-purple-500/20 text-white">
                <div className="text-3xl mb-3">💎</div>
                <h3 className="text-xl font-bold mb-2">Connect to Earn</h3>
                <p className="text-purple-100 text-sm mb-6">Provide liquidity for fictional stocks and earn high yield.</p>
                <button onClick={connect} className="w-full py-3 bg-white text-purple-600 font-bold rounded-xl hover:bg-purple-50 transition shadow-md">Connect Wallet</button>
              </div>
            ) : !isOnRH ? (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-6 text-center">
                <div className="text-3xl mb-3">🔗</div>
                <h3 className="text-xl font-bold text-amber-900 dark:text-amber-100 mb-2">Switch Network</h3>
                <p className="text-amber-800 dark:text-amber-300 text-sm mb-6">Switch to Robinhood Chain Testnet.</p>
                <button onClick={() => switchNetwork(RH_CHAIN_ID)} className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition shadow-md shadow-amber-500/20">Switch to Robinhood</button>
              </div>
            ) : isRealStock ? (
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-100 dark:border-purple-800 rounded-2xl p-6 text-center">
                <div className="text-3xl mb-3">📈</div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Earn with {selected}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Liquidity provision coming soon for real asset tokens.</p>
              </div>
            ) : (
              <LiquidityWidget selected={selected} address={address} ethBalance={ethBalance}
                stockBalance={stockBalances[selected]} onSuccess={fetchBalances}
                explorerUrl={NETWORKS.RH_TESTNET.explorerUrl}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Advanced Stats */}
      {isAdvanced && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Key Statistics</h3>
            <div className="grid grid-cols-2 gap-3">
              {isStatsLoading || !stockStats ? (
                <div className="col-span-2 flex justify-center py-4">
                  <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                [
                  { label: "Market Cap", value: stockStats?.marketCapETH != null ? `${stockStats.marketCapETH.toFixed(2)} ETH` : "—" },
                  { label: "Holders", value: holderData?.holdersCount != null ? holderData.holdersCount.toLocaleString() : "—" },
                  { label: "Div Yield", value: stockStats?.divYieldMock != null && stockStats.divYieldMock > 0 ? `${stockStats.divYieldMock.toFixed(2)}%` : "—" },
                  { label: "24h Volume", value: stockStats?.volume24hETH != null ? `${stockStats.volume24hETH.toFixed(2)} ETH` : "—" },
                  { label: "Forecast Vol", value: stockStats?.forecastVol != null ? `${(stockStats.forecastVol * 100).toFixed(1)}%` : "—", isSynth: true },
                  { label: "Realized Vol", value: stockStats?.realizedVol != null ? `${(stockStats.realizedVol * 100).toFixed(1)}%` : "—", isSynth: true },
                ].map((stat: any, i) => (
                  <div key={i} className={`group bg-gray-50/50 dark:bg-gray-800/40 rounded-xl p-2.5 border border-gray-100/50 dark:border-gray-700/30 transition-all hover:shadow-sm ${stat.isSynth ? 'ring-1 ring-blue-500/10 hover:ring-blue-500/30' : ''}`}>
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="text-xs font-bold text-gray-400 uppercase tracking-tight">{stat.label}</div>
                      {stat.isSynth && <span className="text-[7px] font-black text-blue-500 uppercase tracking-tighter bg-blue-50 dark:bg-blue-900/30 px-1 rounded-sm">SN50</span>}
                    </div>
                    <div className="text-sm font-bold text-gray-900 dark:text-white">{stat.value}</div>
                  </div>
                ))
              )}
            </div>
          </div>
          <HoldersWidget holderData={holderData} isLoading={isHoldersLoading} explorerUrl={NETWORKS.RH_TESTNET.explorerUrl} />
        </div>
      )}

      {/* Positions */}
      {Object.values(stockBalances).some((b) => parseFloat(b) > 0) && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 ml-1">Your Positions</h3>
          <div className="grid grid-cols-1 gap-2">
            {STOCKS.filter((s) => parseFloat(stockBalances[s]) > 0).map((s) => {
              const d = getTokenDesign(s);
              return (
                <div key={s} className="flex items-center justify-between bg-white dark:bg-gray-900 rounded-xl px-3 py-2 border border-gray-100 dark:border-gray-800 overflow-hidden relative shadow-sm">
                  <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${d.gradient}`} />
                  <div className="flex items-center gap-3 ml-1">
                    <span className="text-xl">{d.icon}</span>
                    <div>
                      <div className="font-bold text-sm">{s}</div>
                      <div className="text-xs text-gray-400">{d.name}</div>
                    </div>
                  </div>
                  <span className="font-bold text-gray-900 dark:text-white">{parseFloat(stockBalances[s]).toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Faucet */}
      <div className="text-center pt-4 pb-2">
        <a href="https://faucet.testnet.chain.robinhood.com" target="_blank" rel="noopener noreferrer"
          className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase tracking-widest hover:underline">
          Need testnet ETH? Get some from the faucet →
        </a>
      </div>
    </div>
  );
}