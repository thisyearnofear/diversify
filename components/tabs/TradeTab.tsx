import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { motion, AnimatePresence } from "framer-motion";
import { useWalletContext } from "../wallet/WalletProvider";
import { NETWORKS, RH_TESTNET_TOKENS, BROKER_ADDRESSES } from "../../config";
import { getTokenDesign } from "../../constants/tokens";
import { ProviderFactoryService } from "../../services/swap/provider-factory.service";
import { useExperience } from "../../context/app/ExperienceContext";

// Modular Components
import StockChart from "../trade/StockChart";
import StockTicker from "../trade/StockTicker";
import TradeWidget from "../trade/TradeWidget";
import LiquidityWidget from "../trade/LiquidityWidget";
import { useStockStats } from "../../hooks/use-stock-stats";
import { useTokenHolders } from "../../hooks/use-token-holders";
import HoldersWidget from "../trade/HoldersWidget";
import TradeIntelligence, { type IntelligenceItem } from "../trade/TradeIntelligence";
import EmergingMarketsTracker from "../trade/EmergingMarketsTracker";

import { SynthDataService } from "../../services/synth-data-service";
import { marketPulseService } from "../../utils/market-pulse-service";
import {
  EMERGING_MARKETS_CONFIG,
  FICTIONAL_EMERGING_MARKET_COMPANIES,
  REAL_EMERGING_MARKET_STOCKS,
  REGION_METADATA,
  getFictionalCompany,
  type FictionalCompany,
} from "../../config/emerging-markets";
import { SwapOrchestratorService } from "../../services/swap/swap-orchestrator.service";

const RH_CHAIN_ID = NETWORKS.RH_TESTNET.chainId;
const AMM_ADDRESS = BROKER_ADDRESSES.RH_TESTNET;
const WETH_ADDRESS = RH_TESTNET_TOKENS.WETH;

const FICTIONAL_STOCKS = ["ACME", "SPACELY", "WAYNE", "OSCORP", "STARK"] as const;
const REAL_STOCKS = ["NVDA", "GOOGL", "TSLA", "AAPL", "BTC", "ETH"] as const;
const STOCKS = [...FICTIONAL_STOCKS, ...REAL_STOCKS] as const;
type Stock = (typeof STOCKS)[number];

const isFictionalStock = (stock: Stock): stock is typeof FICTIONAL_STOCKS[number] => {
  return FICTIONAL_STOCKS.includes(stock as typeof FICTIONAL_STOCKS[number]);
};

// Market type for switching between Robinhood and Emerging Markets
type MarketType = "robinhood" | "emerging-markets";

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
type TradeMode = "buy" | "sell";

export default function TradeTab() {
  const { address, chainId, switchNetwork, isConnected, connect } =
    useWalletContext();
  const { experienceMode } = useExperience();

  const isBeginner = experienceMode === "beginner";
  const isAdvanced = experienceMode === "advanced";

  // --- State ---
  const [activeMarket, setActiveMarket] = useState<MarketType>("robinhood");
  const [activeTab, setActiveTab] = useState<"trade" | "earn" | "track">("trade");
  const [selected, setSelected] = useState<Stock>("ACME");
  const [selectedEmergingCompany, setSelectedEmergingCompany] = useState<FictionalCompany>(FICTIONAL_EMERGING_MARKET_COMPANIES[0]);
  const [mode, setMode] = useState<TradeMode>("buy");
  const [inputAmount, setInputAmount] = useState("");
  const [quote, setQuote] = useState<string | null>(null);
  const [priceImpact, setPriceImpact] = useState<number | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ethBalance, setEthBalance] = useState<string | null>(null);
  const [stockBalances, setStockBalances] = useState<Record<Stock, string>>({
    ACME: "0",
    SPACELY: "0",
    WAYNE: "0",
    OSCORP: "0",
    STARK: "0",
    NVDA: "0",
    GOOGL: "0",
    TSLA: "0",
    AAPL: "0",
    BTC: "0",
    ETH: "0",
  });
  const [liveRates, setLiveRates] = useState<Record<Stock, string | null>>({
    ACME: null,
    SPACELY: null,
    WAYNE: null,
    OSCORP: null,
    STARK: null,
    NVDA: null,
    GOOGL: null,
    TSLA: null,
    AAPL: null,
    BTC: null,
    ETH: null,
  });

  const [intelligenceItems, setIntelligenceItems] = useState<IntelligenceItem[]>([]);
  const [synthForecast, setSynthForecast] = useState<{ p10: number; p50: number; p90: number } | null>(null);

  const isOnRH = chainId === RH_CHAIN_ID;
  const design = getTokenDesign(selected);
  const stockAddress = isFictionalStock(selected) ? RH_TESTNET_TOKENS[selected] : undefined;
  const isRealStock = !isFictionalStock(selected);

  const { stats: stockStats, isLoading: isStatsLoading } = useStockStats(
    selected,
    liveRates[selected],
  );

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
          const token = new ethers.Contract(
            RH_TESTNET_TOKENS[s],
            ERC20_ABI,
            provider,
          );
          const b = await token.balanceOf(address);
          return [s, ethers.utils.formatEther(b)] as const;
        }),
      );
      const balances: Record<Stock, string> = Object.fromEntries(entries) as Record<Stock, string>;
      REAL_STOCKS.forEach(s => { balances[s] = "0"; });
      setStockBalances(balances);
    } catch (e) {
      console.warn("[Trade] Balance fetch error:", e);
    }
  }, [address, isOnRH]);

  const fetchRates = useCallback(async () => {
    if (!isOnRH) return;
    try {
      const provider = await ProviderFactoryService.getWeb3Provider();
      const amm = new ethers.Contract(AMM_ADDRESS, AMM_ABI, provider);
      const refETH = ethers.utils.parseEther("0.001");

      const res = await Promise.all(
        FICTIONAL_STOCKS.map(async (s) => {
          try {
            const stockAddr = RH_TESTNET_TOKENS[s];
            const [out, [rETH, rStock]] = await Promise.all([
              amm.quoteSwapETH(refETH, stockAddr),
              amm.getReserves(WETH_ADDRESS, stockAddr),
            ]);

            const perMilliETH = parseFloat(ethers.utils.formatEther(out));
            const rate = (perMilliETH * 1000).toLocaleString("en-US", {
              maximumFractionDigits: 0,
            });

            return {
              symbol: s,
              rate,
              reserves: {
                eth: ethers.utils.formatEther(rETH),
                stock: ethers.utils.formatEther(rStock),
              },
            };
          } catch {
            return { symbol: s, rate: null, reserves: null };
          }
        }),
      );

      const rates: Record<Stock, string | null> = {
        ACME: null,
        SPACELY: null,
        WAYNE: null,
        OSCORP: null,
        STARK: null,
        NVDA: null,
        GOOGL: null,
        TSLA: null,
        AAPL: null,
        BTC: null,
        ETH: null,
      };
      const resMap: Record<Stock, { eth: string; stock: string } | null> = {
        ACME: null,
        SPACELY: null,
        WAYNE: null,
        OSCORP: null,
        STARK: null,
        NVDA: null,
        GOOGL: null,
        TSLA: null,
        AAPL: null,
        BTC: null,
        ETH: null,
      };

      res.forEach((item) => {
        rates[item.symbol as Stock] = item.rate;
        resMap[item.symbol as Stock] = item.reserves;
      });

      setLiveRates(rates);
    } catch (e) {
      console.error("[Trade] Rate fetch error:", e);
    }
  }, [isOnRH]);

  useEffect(() => {
    fetchBalances();
    const interval = setInterval(fetchBalances, 10000);
    return () => clearInterval(interval);
  }, [fetchBalances]);

  useEffect(() => {
    fetchRates();
    const interval = setInterval(fetchRates, 30000);
    return () => clearInterval(interval);
  }, [fetchRates]);

  // Fetch Synth Data for intelligence feed
  useEffect(() => {
    const fetchSynthIntelligence = async () => {
      const asset = SynthDataService.mapStockToSynthAsset(selected);
      const data = await SynthDataService.getPredictions(asset);
      if (data) {
        const forecast24h = data["24H"];
        const forecastVol = forecast24h ? (forecast24h.average_volatility * 100).toFixed(2) : "0";
        const realizedVol = data.realized ? (data.realized.average_volatility * 100).toFixed(2) : "0";
        
        const synthItem: IntelligenceItem = {
          id: `synth-${selected}`,
          type: "impact",
          title: `Synth Probabilistic Forecast: ${selected}`,
          description: `SN50 models predict ${forecastVol}% annualized volatility. Realized volatility is currently ${realizedVol}%.`,
          impact: parseFloat(forecastVol) > parseFloat(realizedVol) ? "negative" : "positive",
          impactAsset: selected,
          timestamp: "Live",
        };

        const price = data.current_price;
        const percentiles = forecast24h?.percentiles || {};
        setSynthForecast({
          p10: price * (1 + (percentiles.p10 || 0)),
          p50: price * (1 + (percentiles.p50 || 0)),
          p90: price * (1 + (percentiles.p90 || 0)),
        });

        setIntelligenceItems(prev => {
          // Replace previous synth item for this specific asset to avoid duplicates
          const filtered = prev.filter(item => item.id !== `synth-${selected}`);
          return [synthItem, ...filtered];
        });
      }
    };

    fetchSynthIntelligence();
    const interval = setInterval(fetchSynthIntelligence, 60000);
    return () => clearInterval(interval);
  }, [selected]);

  // Market Intelligence feed - driven by real-world stimuli
  useEffect(() => {
    const fetchMarketIntelligence = async () => {
      try {
        const pulseItems = await marketPulseService.generateIntelligenceItems();
        
        const staticItems: IntelligenceItem[] = [
          {
            id: "static-1",
            type: "news",
            title: "DiversiFi Expands to Latin America",
            description: "New regional integration expected to drive volume for emerging market assets.",
            impact: "positive",
            timestamp: "15m ago",
          },
        ];
        
        setIntelligenceItems([...pulseItems, ...staticItems]);
      } catch (error) {
        console.warn("[Trade] Failed to fetch market pulse:", error);
        setIntelligenceItems([
          {
            id: "static-1",
            type: "news",
            title: "DiversiFi Expands to Latin America",
            description: "New regional integration expected to drive volume for emerging market assets.",
            impact: "positive",
            timestamp: "15m ago",
          },
        ]);
      }
    };

    fetchMarketIntelligence();
    const interval = setInterval(fetchMarketIntelligence, 60000);
    return () => clearInterval(interval);
  }, []);

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

        const out =
          mode === "buy"
            ? await amm.quoteSwapETH(parsed, stockAddress)
            : await amm.quoteSwapTokenForETH(parsed, stockAddress);

        setQuote(parseFloat(ethers.utils.formatEther(out)).toFixed(6));
        setError(null);

        try {
          const [reserveA, reserveB] = await amm.getReserves(
            WETH_ADDRESS,
            stockAddress,
          );
          const relevantReserve = mode === "buy" ? reserveA : reserveB;
          if (!relevantReserve.isZero()) {
            setPriceImpact(
              parseFloat(parsed.mul(10000).div(relevantReserve).toString()) /
                100,
            );
          }
        } catch {
          setPriceImpact(null);
        }
      } catch {
        setQuote(null);
        setError("Could not get quote");
      } finally {
        setIsQuoting(false);
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [inputAmount, selected, mode, isOnRH, stockAddress]);

  // --- Handlers ---

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
        const minOut = quote
          ? ethers.utils.parseEther((parseFloat(quote) * slippage).toFixed(18))
          : 0;
        tx = await amm.swapExactETHForTokens(
          minOut,
          stockAddress,
          address,
          deadline,
          { value: amountIn },
        );
      } else {
        const amountIn = ethers.utils.parseEther(inputAmount);
        const token = new ethers.Contract(stockAddress, ERC20_ABI, signer);
        const allowance = await token.allowance(address, AMM_ADDRESS);
        if (allowance.lt(amountIn)) {
          const approveTx = await token.approve(
            AMM_ADDRESS,
            ethers.constants.MaxUint256,
          );
          await approveTx.wait();
        }
        const minOut = quote
          ? ethers.utils.parseEther((parseFloat(quote) * slippage).toFixed(18))
          : 0;
        tx = await amm.swapExactTokensForETH(
          amountIn,
          minOut,
          stockAddress,
          address,
          deadline,
        );
      }
      setTxHash(tx.hash);
      await tx.wait();
      fetchBalances();
    } catch (e: unknown) {
      const err = e as { reason?: string; message?: string };
      setError(err.reason || err.message || "Swap failed");
    } finally {
      setIsSwapping(false);
    }
  };

  const handleMax = () => {
    if (mode === "buy" && ethBalance) {
      const max = Math.max(0, parseFloat(ethBalance) - 0.001);
      setInputAmount(max > 0 ? max.toFixed(6) : "");
    } else if (mode === "sell") {
      setInputAmount(stockBalances[selected]);
    }
  };

  const hasBalance =
    mode === "buy"
      ? Boolean(ethBalance && parseFloat(ethBalance) > 0.001)
      : parseFloat(stockBalances[selected]) > 0;

  if (!isConnected) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-20 space-y-4"
      >
        <p className="text-5xl">📈</p>
        <h2 className="text-2xl font-bold">Fictional Stock Trading</h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
          Swap testnet ETH for fictional company stocks on Robinhood
          Chain. Connect your wallet to get started.
        </p>
        <button
          onClick={connect}
          className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition transform active:scale-95 shadow-lg shadow-blue-500/20"
        >
          Connect Wallet
        </button>
      </motion.div>
    );
  }

  if (!isOnRH) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-16 space-y-4"
      >
        <p className="text-4xl">🔗</p>
        <h2 className="text-xl font-bold">
          Switch to Robinhood Chain
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          You need to be on Robinhood Chain Testnet to trade stocks.
        </p>
        <button
          onClick={() => switchNetwork(RH_CHAIN_ID)}
          className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition transform active:scale-95 shadow-lg shadow-blue-500/20"
        >
          Switch Network
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Paper Trading Badge */}
      <div className="flex items-center justify-center gap-2">
        <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-bold">
          🎮 Paper Trading
        </span>
        <span className="text-[10px] text-gray-400">Practice with fictional tokens • No real money</span>
      </div>

      {/* Market Selector */}
      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
        <button
          onClick={() => {
            setActiveMarket("robinhood");
            setActiveTab("trade");
          }}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 ${
            activeMarket === "robinhood"
              ? "bg-white dark:bg-gray-700 shadow-sm text-blue-600"
              : "text-gray-500 hover:text-gray-600"
          }`}
        >
          <span>⚡</span>
          <span className="hidden sm:inline">Robinhood Testnet</span>
          <span className="sm:hidden">Robinhood</span>
        </button>
        <button
          onClick={() => {
            setActiveMarket("emerging-markets");
            setActiveTab("track");
          }}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 ${
            activeMarket === "emerging-markets"
              ? "bg-white dark:bg-gray-700 shadow-sm text-green-600"
              : "text-gray-500 hover:text-gray-600"
          }`}
        >
          <span>🌍</span>
          <span className="hidden sm:inline">Emerging Markets</span>
          <span className="sm:hidden">Emerging</span>
        </button>
      </div>

      {/* Emerging Markets View */}
      {activeMarket === "emerging-markets" && (
        <AnimatePresence mode="wait">
          <motion.div
            key="emerging-markets"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Track/Trade Tabs for Emerging Markets */}
            <div className="flex bg-gray-100 dark:bg-gray-800/60 rounded-xl p-1">
              <button
                onClick={() => setActiveTab("track")}
                className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
                  activeTab === "track"
                    ? "bg-white dark:bg-gray-700 shadow-sm text-green-600 dark:text-green-400"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                📈 Track Real Stocks
              </button>
              <button
                onClick={() => setActiveTab("trade")}
                className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
                  activeTab === "trade"
                    ? "bg-white dark:bg-gray-700 shadow-sm text-green-600 dark:text-green-400"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                🎮 Trade Fictional
              </button>
            </div>

            {/* Tab Explanation */}
            <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl border border-amber-200 dark:border-amber-800">
              <p className="text-xs text-amber-800 dark:text-amber-300">
                {activeTab === "track"
                  ? "📊 View real emerging market stocks with live prices. Track only - cannot trade these directly."
                  : "🎮 Trade fictional companies inspired by emerging market fiction & mythology. Practice risk-free!"
                }
              </p>
            </div>

            {activeTab === "track" ? (
              <EmergingMarketsTracker
                onSelectStock={(symbol) => {
                  console.log("Selected stock:", symbol);
                }}
              />
            ) : (
              <div className="text-center py-12">
                <p className="text-4xl mb-4">🌍</p>
                <h3 className="text-lg font-bold mb-2">Trade Fictional Companies</h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-4">
                  Trade fictional emerging market companies on Celo Sepolia testnet.
                  Switch to Celo Sepolia network to begin trading.
                </p>
                {chainId !== EMERGING_MARKETS_CONFIG.chainId ? (
                  <button
                    onClick={() => switchNetwork(EMERGING_MARKETS_CONFIG.chainId)}
                    className="px-6 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold transition"
                  >
                    Switch to Celo Sepolia
                  </button>
                ) : (
                  <p className="text-sm text-green-600">
                    ✓ Connected to Celo Sepolia
                  </p>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Robinhood Market View */}
      {activeMarket === "robinhood" && (
        <AnimatePresence mode="wait">
          <motion.div
            key="robinhood"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Stock Selection Ticker */}
            <StockTicker
        stocks={STOCKS}
        selected={selected}
        onSelect={(s) => {
          setSelected(s as Stock);
          setInputAmount("");
          setQuote(null);
          setPriceImpact(null);
          setTxHash(null);
          setError(null);
          setSynthForecast(null);
        }}
        liveRates={liveRates}
        stockBalances={stockBalances}
      />

      {/* Main Content Area */}
      <div className="grid grid-cols-1 gap-4">
        {/* Info Card: Chart & Basic Stats */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 shadow-sm overflow-hidden">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{design.icon}</span>
                <h2 className="text-xl font-bold">
                  {design.name}
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 uppercase tracking-tighter">
                  {selected}
                </span>
              </div>
              {!isBeginner && (
                <p className="text-gray-500 dark:text-gray-400 text-xs max-w-sm leading-relaxed">
                  {design.description}
                </p>
              )}
            </div>
            <div className="text-right">
              {/* Price Display with Toggle */}
              <div className="flex items-center justify-end gap-2 mb-1">
                <div className="text-xl font-bold">
                  {(() => {
                    const rate = liveRates[selected];
                    if (!rate) return "---";
                    // Convert ETH price to USDC (assuming ETH = $3000)
                    const ethPrice = parseFloat(rate);
                    const usdcPrice = ethPrice * 3000;
                    return `$${usdcPrice.toFixed(2)} USDC`;
                  })()}
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <span className="text-[9px] text-gray-400">
                  ≈ {liveRates[selected] ? `${liveRates[selected]} ${selected}/ETH` : "---"}
                </span>
              </div>
            </div>
          </div>

          <div className="h-[200px] w-full mb-4">
            <StockChart
              symbol={selected}
              height={200}
              currentPrice={liveRates[selected]}
              volatility={volatilityValue}
              forecastPercentiles={synthForecast}
            />
          </div>

          {!isBeginner && (
            <div className="flex gap-2 border-t border-gray-50 dark:border-gray-800 pt-3 mt-4">
              {["1D", "1W", "1M", "ALL"].map((p) => (
                <button
                  key={p}
                  className={`text-[10px] font-bold px-3 py-1 rounded-lg transition ${p === "1D" ? "bg-blue-600 text-white shadow-sm" : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Trade/Earn Control Card */}
        <div className="space-y-4">
          <TradeIntelligence 
            items={intelligenceItems} 
            selectedAsset={selected} 
            isAdvanced={isAdvanced}
          />

          <div className="flex bg-gray-100 dark:bg-gray-800/60 rounded-xl p-1">
            <button
              onClick={() => setActiveTab("trade")}
              className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
                activeTab === "trade"
                  ? "bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              Trade
            </button>
            <button
              onClick={() => setActiveTab("earn")}
              className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
                activeTab === "earn"
                  ? "bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              Earn
            </button>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === "trade" ? (
              <motion.div
                key="trade-widget"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
              >
                {isRealStock ? (
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl p-6 text-center">
                    <div className="text-3xl mb-3">{design.icon}</div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                      {selected} - Live Forecast
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Probabilistic price predictions powered by Bittensor SN50
                    </p>
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
                    ) : (
                      <div className="text-sm text-gray-500">Loading Synth forecasts...</div>
                    )}
                  </div>
                ) : (
                  <TradeWidget
                    selected={selected}
                    design={design}
                    mode={mode}
                    setMode={setMode}
                    inputAmount={inputAmount}
                    setInputAmount={setInputAmount}
                    quote={quote}
                    priceImpact={priceImpact}
                    isQuoting={isQuoting}
                    isSwapping={isSwapping}
                    hasBalance={hasBalance}
                    ethBalance={ethBalance}
                    stockBalance={stockBalances[selected]}
                    handleMax={handleMax}
                    handleSwap={handleSwap}
                    txHash={txHash}
                    error={error}
                    slippagePercent={SLIPPAGE_PERCENT}
                    explorerUrl={NETWORKS.RH_TESTNET.explorerUrl}
                  />
                )}
              </motion.div>
            ) : (
              <motion.div
                key="earn-widget"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
              >
                {isRealStock ? (
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-100 dark:border-purple-800 rounded-2xl p-6 text-center">
                    <div className="text-3xl mb-3">📈</div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                      Earn with {selected}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Liquidity provision coming soon for real asset tokens. 
                      Connect to Robinhood Chain to trade fictional stocks.
                    </p>
                  </div>
                ) : (
                  <LiquidityWidget
                    selected={selected}
                    address={address}
                    ethBalance={ethBalance}
                    stockBalance={stockBalances[selected]}
                    onSuccess={fetchBalances}
                    explorerUrl={NETWORKS.RH_TESTNET.explorerUrl}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Detailed Stats & Holders - Only for Advanced */}
        {isAdvanced && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3">
                Key Statistics
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {isStatsLoading || !stockStats ? (
                  <div className="col-span-2 flex justify-center py-4">
                    <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  [
                    {
                      label: "Market Cap",
                      value: `${stockStats.marketCapETH.toFixed(2)} ETH`,
                    },
                    {
                      label: "Holders",
                      value: holderData
                        ? holderData.holdersCount.toLocaleString()
                        : "—",
                    },
                    {
                      label: "Div Yield",
                      value:
                        stockStats.divYieldMock > 0
                          ? `${stockStats.divYieldMock.toFixed(2)}%`
                          : "—",
                    },
                    {
                      label: "24h Volume",
                      value: `${stockStats.volume24hETH.toFixed(2)} ETH`,
                    },
                    {
                      label: "Forecast Vol",
                      value: stockStats.forecastVol ? `${(stockStats.forecastVol * 100).toFixed(1)}%` : "—",
                      isSynth: true,
                      description: "Predicted annualized price volatility powered by SynthData's SN50 machine learning models.",
                    },
                    {
                      label: "Realized Vol",
                      value: stockStats.realizedVol ? `${(stockStats.realizedVol * 100).toFixed(1)}%` : "—",
                      isSynth: true,
                      description: "Historical volatility observed in the actual market price over the recent period.",
                    },
                  ].map((stat: any, i) => (
                    <div 
                      key={i} 
                      className={`group bg-gray-50/50 dark:bg-gray-800/40 rounded-xl p-2.5 border border-gray-100/50 dark:border-gray-700/30 transition-all hover:shadow-sm ${stat.isSynth ? 'ring-1 ring-blue-500/10 hover:ring-blue-500/30' : ''}`}
                      title={stat.description}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">
                          {stat.label}
                        </div>
                        {stat.isSynth && (
                          <div className="flex items-center gap-1">
                            <span className="text-[7px] font-black text-blue-500 uppercase tracking-tighter bg-blue-50 dark:bg-blue-900/30 px-1 rounded-sm">
                              SN50
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="text-sm font-bold text-gray-900 dark:text-white">
                        {stat.value}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <HoldersWidget
              holderData={holderData}
              isLoading={isHoldersLoading}
              explorerUrl={NETWORKS.RH_TESTNET.explorerUrl}
            />
          </div>
        )}

        {/* Positions List */}
        {Object.values(stockBalances).some((b) => parseFloat(b) > 0) && (
          <div className="space-y-2">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 ml-1">
              Your Positions
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {STOCKS.filter((s) => parseFloat(stockBalances[s]) > 0).map((s) => {
                const d = getTokenDesign(s);
                return (
                  <div
                    key={s}
                    className="flex items-center justify-between bg-white dark:bg-gray-900 rounded-xl px-3 py-2 border border-gray-100 dark:border-gray-800 overflow-hidden relative shadow-sm"
                  >
                    <div
                      className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${d.gradient}`}
                    />
                    <div className="flex items-center gap-3 ml-1">
                      <span className="text-xl">{d.icon}</span>
                      <div>
                        <div className="font-bold text-sm">
                          {s}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {d.name}
                        </div>
                      </div>
                    </div>
                    <span className="font-bold text-gray-900 dark:text-white">
                      {parseFloat(stockBalances[s]).toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Faucet Link */}
      <div className="text-center pt-4 pb-2">
        <a
          href="https://faucet.testnet.chain.robinhood.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-widest hover:underline"
        >
          Need testnet ETH? Get some from the faucet →
        </a>
      </div>
    </motion.div>
  );
}
