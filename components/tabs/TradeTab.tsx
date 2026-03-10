import { useState, useEffect, useCallback, useRef } from "react";
import { ethers } from "ethers";
import { motion, AnimatePresence } from "framer-motion";
import { useWalletContext } from "../wallet/WalletProvider";
import { NETWORKS, RH_TESTNET_TOKENS, BROKER_ADDRESSES } from "../../config";
import { getTokenDesign } from "../../constants/tokens";
import {
  ProviderFactoryService,
  TokenPriceService
} from "@diversifi/shared";
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

import {
  EMERGING_MARKETS_CONFIG,
  FICTIONAL_EMERGING_MARKET_COMPANIES,
  type FictionalCompany,
} from "../../config/emerging-markets";
import { useWatchlist } from "../../hooks/use-watchlist";

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
  const [liveRateMetadata, setLiveRateMetadata] = useState<Record<Stock, { isLive: boolean; source: string }>>({
    ACME: { isLive: false, source: 'amm' },
    SPACELY: { isLive: false, source: 'amm' },
    WAYNE: { isLive: false, source: 'amm' },
    OSCORP: { isLive: false, source: 'amm' },
    STARK: { isLive: false, source: 'amm' },
    NVDA: { isLive: false, source: 'none' },
    GOOGL: { isLive: false, source: 'none' },
    TSLA: { isLive: false, source: 'none' },
    AAPL: { isLive: false, source: 'none' },
    BTC: { isLive: false, source: 'none' },
    ETH: { isLive: true, source: 'native' },
  });

  const [intelligenceItems, setIntelligenceItems] = useState<IntelligenceItem[]>([]);
  const [synthForecast, setSynthForecast] = useState<{ p10: number; p50: number; p90: number } | null>(null);
  const [realStockPrice, setRealStockPrice] = useState<number | null>(null);
  const [showAllRobinhood, setShowAllRobinhood] = useState(false);
  const [baseAsset, setBaseAsset] = useState<"ETH" | "BTC">("ETH");
  const [basePrices, setBasePrices] = useState<Record<"ETH" | "BTC", number>>({
    ETH: 3500,
    BTC: 67000,
  });
  // Use a ref to break the infinite loop in fetchRates dependencies
  const basePricesRef = useRef(basePrices);
  useEffect(() => { basePricesRef.current = basePrices; }, [basePrices]);

  // Watchlist for Robinhood stocks
  const { watchlist: robinhoodWatchlist, toggleWatchlist: toggleRobinhoodWatchlist, isInWatchlist: isInRobinhoodWatchlist } = useWatchlist();

  const isOnRH = chainId === RH_CHAIN_ID;
  const design = getTokenDesign(selected);
  const stockAddress = isFictionalStock(selected) ? RH_TESTNET_TOKENS[selected] : undefined;
  const isRealStock = !isFictionalStock(selected);

  // Reset real stock price when switching stocks
  useEffect(() => { setRealStockPrice(null); }, [selected]);

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
    // If connected but on wrong chain, OR if disconnected, we fetch from public provider for preview
    try {
      // 1. Fetch Live Base Prices first
      const [ethResult, btcResult] = await Promise.all([
        TokenPriceService.getTokenUsdPrice({ chainId: 1, symbol: "ETH" }),
        TokenPriceService.getTokenUsdPrice({ chainId: 1, symbol: "BTC" }),
      ]);

      const newBasePrices = {
        ETH: ethResult.price || basePricesRef.current.ETH,
        BTC: btcResult.price || basePricesRef.current.BTC,
      };
      setBasePrices(newBasePrices);

      const currentBasePrice = newBasePrices[baseAsset];

      const provider = (isConnected && isOnRH)
        ? await ProviderFactoryService.getWeb3Provider()
        : ProviderFactoryService.getProvider(RH_CHAIN_ID);

      const amm = new ethers.Contract(AMM_ADDRESS, AMM_ABI, provider);
      const refETH = ethers.utils.parseEther("0.001");

      const [res, realRes] = await Promise.all([
        Promise.all(
          FICTIONAL_STOCKS.map(async (s) => {
            try {
              const stockAddr = RH_TESTNET_TOKENS[s];
              const [out, [rETH, rStock]] = await Promise.all([
                amm.quoteSwapETH(refETH, stockAddr),
                amm.getReserves(WETH_ADDRESS, stockAddr),
              ]);

              const perMilliETH = parseFloat(ethers.utils.formatEther(out));
              let rate = perMilliETH * 1000;
              
              // If base asset is BTC, convert from ETH rate to BTC rate
              if (baseAsset === "BTC") {
                rate = rate * (newBasePrices.BTC / newBasePrices.ETH);
              }

              const formattedRate = rate.toLocaleString("en-US", {
                maximumFractionDigits: baseAsset === "BTC" ? 4 : 0,
              });

              return {
                symbol: s,
                rate: formattedRate,
                reserves: {
                  eth: ethers.utils.formatEther(rETH),
                  stock: ethers.utils.formatEther(rStock),
                },
              };
            } catch {
              return { symbol: s, rate: null, reserves: null };
            }
          }),
        ),
        Promise.all(
          REAL_STOCKS.map(async (s) => {
            try {
              if (s === baseAsset) return { symbol: s, rate: "1", isLive: true, source: 'native' };
              
              const result = await TokenPriceService.getTokenUsdPrice({ chainId: 1, symbol: s });
              // Rate = BaseAsset_Price / Stock_Price
              return { 
                symbol: s, 
                rate: result.price ? (currentBasePrice / result.price).toFixed(baseAsset === "BTC" ? 6 : 2) : null,
                isLive: result.isLive,
                source: result.source
              };
            } catch (err) {
              console.warn(`[Trade] Price fetch error for ${s}:`, err);
              return { symbol: s, rate: null, isLive: false, source: 'error' };
            }
          })
        )
      ]);

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

      const metadata: Record<Stock, { isLive: boolean; source: string }> = { ...liveRateMetadata };

      res.forEach((item) => {
        rates[item.symbol as Stock] = item.rate;
        resMap[item.symbol as Stock] = item.reserves;
        metadata[item.symbol as Stock] = { isLive: false, source: 'amm' };
      });

      realRes.forEach((item) => {
        rates[item.symbol as Stock] = item.rate;
        metadata[item.symbol as Stock] = { isLive: item.isLive, source: item.source };
      });

      setLiveRates(rates);
      setLiveRateMetadata(metadata);
    } catch (e) {
      console.error("[Trade] Rate fetch error:", e);
    }
  }, [isConnected, isOnRH, baseAsset]);

  useEffect(() => {
    fetchBalances();
    const interval = setInterval(fetchBalances, 10000);
    return () => clearInterval(interval);
  }, [fetchBalances]);

  useEffect(() => {
    fetchRates();
    const interval = setInterval(fetchRates, 30000);
    return () => clearInterval(interval);
  }, [fetchRates, baseAsset]);

  // Fetch Synth Data for intelligence feed
  useEffect(() => {
    const fetchSynthIntelligence = async () => {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "";
        const response = await fetch(`${apiBase}/api/trading/stock-stats?stock=${selected}`);
        if (!response.ok) return;

        const data = await response.json();
        
        // Also fetch from our robust TokenPriceService for the actual price display
        const priceResult = await TokenPriceService.getTokenUsdPrice({ chainId: 1, symbol: selected });
        if (priceResult.price) {
          setRealStockPrice(priceResult.price);
          // Update metadata for this stock as well
          setLiveRateMetadata(prev => ({
            ...prev,
            [selected]: { isLive: priceResult.isLive, source: priceResult.source }
          }));
        }

        if (data.success && data.synthData) {
          const forecast = data.synthData;
          // Get volatility from the volatility field (returned from getVolatility API)
          const forecastVol = data.volatility?.forecast
            ? (data.volatility.forecast * 100).toFixed(2)
            : "0";
          const realizedVol = data.volatility?.realized
            ? (data.volatility.realized * 100).toFixed(2)
            : "0";

          const synthItem: IntelligenceItem = {
            id: `synth-${selected}`,
            type: "impact",
            title: `Synth Probabilistic Forecast: ${selected}`,
            description: `SN50 models predict ${forecastVol}% annualized volatility. Realized volatility is currently ${realizedVol}%.`,
            impact: parseFloat(forecastVol) > parseFloat(realizedVol) ? "negative" : "positive",
            impactAsset: selected,
            timestamp: "Live",
          };

          const price = forecast.current_price;
          // Store real stock price directly from Synth API
          if (isRealStock && typeof price === 'number' && price > 0) {
            setRealStockPrice(price);
          }
          // Get the last percentile object from the array (most recent forecast)
          const forecastData = forecast.forecast_future || forecast["24H"];
          const percentiles = forecastData?.percentiles?.[forecastData.percentiles.length - 1] || {};
          setSynthForecast({
            p10: percentiles["0.2"] || price,
            p50: percentiles["0.5"] || price,
            p90: percentiles["0.8"] || price,
          });

          setIntelligenceItems(prev => {
            const filtered = prev.filter(item => item.id !== `synth-${selected}`);
            return [synthItem, ...filtered];
          });
        }
      } catch (e) {
        console.warn("[TradeTab] Failed to fetch synth intelligence:", e);
      }
    };

    fetchSynthIntelligence();
    const interval = setInterval(fetchSynthIntelligence, 300000); // Poll every 5 minutes
    return () => clearInterval(interval);
  }, [selected]);

  // Market Intelligence feed - driven by real-world stimuli
  useEffect(() => {
    const fetchMarketIntelligence = async () => {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "";
        const response = await fetch(`${apiBase}/api/trading/market-pulse`);
        if (!response.ok) throw new Error("Failed to fetch market pulse API");

        const data = await response.json();
        const pulseItems = data.success && data.pulse?.intelligence ? data.pulse.intelligence : [];

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

        setIntelligenceItems(prev => {
          // Keep user-specific synth items, merge with global pulse items
          const synthItems = prev.filter(item => item.id.startsWith("synth-"));
          return [...synthItems, ...pulseItems, ...staticItems];
        });
      } catch (error) {
        console.warn("[Trade] Failed to fetch market pulse:", error);
        setIntelligenceItems(prev => {
          const synthItems = prev.filter(item => item.id.startsWith("synth-"));
          return [
            ...synthItems,
            {
              id: "static-1",
              type: "news",
              title: "DiversiFi Expands to Latin America",
              description: "New regional integration expected to drive volume for emerging market assets.",
              impact: "positive",
              timestamp: "15m ago",
            },
          ];
        });
      }
    };

    fetchMarketIntelligence();
    const interval = setInterval(fetchMarketIntelligence, 300000); // Poll every 5 minutes
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

  // Helper function to render a stock item
  const renderStockItem = (stock: Stock) => {
    const d = getTokenDesign(stock);
    const rate = liveRates[stock];
    const isWatched = isInRobinhoodWatchlist(stock);
    const isSelected = selected === stock;

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
          setSynthForecast(null);
        }}
        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${isSelected
            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
            : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-gray-300'
          }`}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{d.icon}</span>
          <div>
            <div className="font-bold text-sm">{stock}</div>
            <div className="text-xs text-gray-500">{d.name}</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {rate ? (
            <div className="text-right">
              <div className="text-sm font-bold">
                ${(basePrices[baseAsset] / parseFloat(rate.replace(/,/g, ""))).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-gray-400">
                {rate} {stock}/{baseAsset}
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-400">---</div>
          )}

          {/* Star button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleRobinhoodWatchlist(stock);
            }}
            className={`p-1.5 rounded-full transition ${isWatched
                ? 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30'
                : 'text-gray-300 hover:text-gray-400'
              }`}
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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Paper Trading Badge */}
      <div className="flex items-center justify-center gap-2">
        {!isConnected ? (
          <span className="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full text-xs font-bold animate-pulse">
            👁️ Preview Mode
          </span>
        ) : (
          <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-bold">
            🎮 Paper Trading
          </span>
        )}
        <span className="text-xs text-gray-400">Practice with fictional tokens • No real money</span>
      </div>

      {/* Market Selector */}
      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
        <button
          onClick={() => {
            setActiveMarket("robinhood");
            setActiveTab("trade");
          }}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 ${activeMarket === "robinhood"
              ? "bg-white dark:bg-gray-700 shadow-sm text-blue-600"
              : "text-gray-500 hover:text-gray-600"
            }`}
        >
          <span>⚡</span>
          <div className="flex flex-col items-center leading-tight">
            <span className="hidden sm:inline">Robinhood Testnet</span>
            <span className="sm:hidden">Robinhood</span>
            {!isConnected && (
              <span className="text-xs uppercase tracking-tighter text-blue-400 font-black">Preview</span>
            )}
          </div>
        </button>
        <button
          onClick={() => {
            setActiveMarket("emerging-markets");
            setActiveTab("track");
          }}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 ${activeMarket === "emerging-markets"
              ? "bg-white dark:bg-gray-700 shadow-sm text-green-600"
              : "text-gray-500 hover:text-gray-600"
            }`}
        >
          <span>🌍</span>
          <div className="flex flex-col items-center leading-tight">
            <span className="hidden sm:inline">Emerging Markets</span>
            <span className="sm:hidden">Emerging</span>
            {!isConnected && (
              <span className="text-xs uppercase tracking-tighter text-green-400 font-black">Live Track</span>
            )}
          </div>
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
                className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition ${activeTab === "track"
                    ? "bg-white dark:bg-gray-700 shadow-sm text-green-600 dark:text-green-400"
                    : "text-gray-400 hover:text-gray-600"
                  }`}
              >
                📈 Track Real Stocks
              </button>
              <button
                onClick={() => setActiveTab("trade")}
                className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition ${activeTab === "trade"
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
              <div className="space-y-4">
                <div className="text-center py-6">
                  <p className="text-4xl mb-4">🌍</p>
                  <h3 className="text-lg font-bold mb-2">Trade Fictional Companies</h3>
                  <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-4">
                    Trade fictional emerging market companies on Celo Sepolia testnet.
                    Practice risk-free!
                  </p>
                </div>

                {!isConnected ? (
                  <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 text-center shadow-lg shadow-green-500/20 text-white">
                    <div className="text-3xl mb-3">👛</div>
                    <h3 className="text-xl font-bold mb-2">Connect Wallet to Trade</h3>
                    <p className="text-green-100 text-sm mb-6">
                      Join the fictional emerging markets and start trading with testnet assets.
                    </p>
                    <button
                      onClick={connect}
                      className="w-full py-3 bg-white text-green-600 font-bold rounded-xl hover:bg-green-50 transition transform active:scale-95 shadow-md"
                    >
                      Connect Wallet
                    </button>
                  </div>
                ) : chainId !== EMERGING_MARKETS_CONFIG.chainId ? (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-6 text-center">
                    <div className="text-3xl mb-3">🔗</div>
                    <h3 className="text-xl font-bold text-amber-900 dark:text-amber-100 mb-2">Switch Network</h3>
                    <p className="text-amber-800 dark:text-amber-300 text-sm mb-6">
                      To trade fictional companies, you need to be on the Celo Sepolia network.
                    </p>
                    <button
                      onClick={() => switchNetwork(EMERGING_MARKETS_CONFIG.chainId)}
                      className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition transform active:scale-95 shadow-md shadow-amber-500/20"
                    >
                      Switch to Celo Sepolia
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-green-600 font-bold flex items-center justify-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      Connected to Celo Sepolia
                    </p>
                    <p className="text-xs text-gray-400 mt-2 italic">
                      Coming soon: Full trading widget for Celo fictional companies.
                    </p>
                  </div>
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
            {/* Stock Category Tabs */}
            <div className="flex bg-gray-100 dark:bg-gray-800/60 rounded-xl p-1">
              <button
                onClick={() => {
                  setActiveTab("trade");
                  setSelected("ACME");
                }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition ${activeTab === "trade" && FICTIONAL_STOCKS.includes(selected as typeof FICTIONAL_STOCKS[number])
                    ? "bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400"
                    : "text-gray-400 hover:text-gray-600"
                  }`}
              >
                🎮 Fictional ({FICTIONAL_STOCKS.length})
              </button>
              <button
                onClick={() => {
                  setActiveTab("earn");
                  setSelected("NVDA");
                }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition ${activeTab === "earn" || REAL_STOCKS.includes(selected as typeof REAL_STOCKS[number])
                    ? "bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400"
                    : "text-gray-400 hover:text-gray-600"
                  }`}
              >
                📈 Real ({REAL_STOCKS.length})
              </button>
              {robinhoodWatchlist.length > 0 && (
                <button
                  onClick={() => setActiveTab("track")}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition ${activeTab === "track"
                      ? "bg-white dark:bg-gray-700 shadow-sm text-yellow-600 dark:text-yellow-400"
                      : "text-gray-400 hover:text-gray-600"
                    }`}
                >
                  ⭐ Watchlist ({robinhoodWatchlist.length})
                </button>
              )}
            </div>

            {/* Info/Explanation Box */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-800 dark:text-blue-300">
                {activeTab === "track" && robinhoodWatchlist.length > 0
                  ? "⭐ Your starred stocks for quick access. Tap any stock to view details and trade."
                  : activeTab === "earn" || REAL_STOCKS.includes(selected as typeof REAL_STOCKS[number])
                    ? "📈 Trade real-world stocks mirrored on Robinhood Testnet. Prices track actual market movements."
                    : "🎮 Trade fictional stocks on Robinhood Testnet. Practice risk-free with testnet ETH!"
                }
              </p>
            </div>

            {/* Watchlist View */}
            {activeTab === "track" && robinhoodWatchlist.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest">
                    ⭐ Starred Stocks
                  </h4>
                </div>
                {robinhoodWatchlist.map((stock) => renderStockItem(stock as Stock))}
              </div>
            )}

            {/* Fictional Stocks View */}
            {(activeTab === "trade" || (activeTab !== "track" && FICTIONAL_STOCKS.includes(selected as typeof FICTIONAL_STOCKS[number]))) && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest">
                    🎮 Fictional Companies
                  </h4>
                  <span className="text-xs text-gray-400">{FICTIONAL_STOCKS.length} stocks</span>
                </div>
                <div className="space-y-2">
                  {FICTIONAL_STOCKS.map((stock) => renderStockItem(stock))}
                </div>
              </div>
            )}

            {/* Real Stocks View */}
            {(activeTab === "earn" || REAL_STOCKS.includes(selected as typeof REAL_STOCKS[number])) && activeTab !== "track" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest">
                    📈 Real World Stocks
                  </h4>
                  <span className="text-xs text-gray-400">
                    {showAllRobinhood ? REAL_STOCKS.length : Math.min(3, REAL_STOCKS.length)} of {REAL_STOCKS.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {(showAllRobinhood ? REAL_STOCKS : REAL_STOCKS.slice(0, 3)).map((stock) => renderStockItem(stock))}
                </div>
                {!showAllRobinhood && REAL_STOCKS.length > 3 && (
                  <button
                    onClick={() => setShowAllRobinhood(true)}
                    className="w-full py-3 text-sm font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/30 transition"
                  >
                    Show All {REAL_STOCKS.length} Stocks
                  </button>
                )}
              </div>
            )}

            {/* Legacy Stock Ticker - Hidden but kept for compatibility */}
            <div className="hidden">
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
            </div>

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
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 uppercase tracking-tighter">
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
                  {/* Base Asset Toggle */}
                  <div className="flex items-center justify-end gap-2 mb-2">
                    <span className="text-[10px] font-black text-gray-400 uppercase">Rate Base:</span>
                    <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                      {(['ETH', 'BTC'] as const).map((asset) => (
                        <button
                          key={asset}
                          onClick={() => setBaseAsset(asset)}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all ${
                            baseAsset === asset 
                              ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' 
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          {asset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Price Display with Toggle */}
                  <div className="flex items-center justify-end gap-2 mb-1">
                      {liveRateMetadata[selected] && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                          liveRateMetadata[selected].isLive 
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        }`}>
                          {liveRateMetadata[selected].isLive ? 'Live' : 'Fallback'}
                        </span>
                      )}
                      <div className="text-xl font-bold">
                      {(() => {
                        // Real stocks: use direct USD price from price service
                        if (isRealStock) {
                          if (!realStockPrice) return "---";
                          return `$${realStockPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
                        }
                        // Fictional stocks: derive from current base rate
                        const rate = liveRates[selected];
                        if (!rate) return "---";
                        const tokensPerBase = parseFloat(rate.replace(/,/g, ""));
                        if (tokensPerBase === 0) return "---";
                        const usdcPrice = basePrices[baseAsset] / tokensPerBase;
                        return `$${usdcPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`;
                      })()}
                      </div>

                  </div>

                    {!isRealStock && (
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-gray-400">
                          ≈ {liveRates[selected] ? `${liveRates[selected]} ${selected}/${baseAsset}` : "---"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="h-[200px] w-full mb-4">
                  <StockChart
                    symbol={selected}
                    height={200}
                    currentPrice={(() => {
                      if (isRealStock) return realStockPrice?.toString() || null;
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
                      <button
                        key={p}
                        className={`text-xs font-bold px-3 py-1 rounded-lg transition ${p === "1D" ? "bg-blue-600 text-white shadow-sm" : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
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
                    className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition ${activeTab === "trade"
                        ? "bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400"
                        : "text-gray-400 hover:text-gray-600"
                      }`}
                  >
                    Trade
                  </button>
                  <button
                    onClick={() => setActiveTab("earn")}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition ${activeTab === "earn"
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
                      {!isConnected ? (
                        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-6 text-center shadow-lg shadow-blue-500/20 text-white">
                          <div className="text-3xl mb-3">📈</div>
                          <h3 className="text-xl font-bold mb-2">Connect Wallet to Trade</h3>
                          <p className="text-blue-100 text-sm mb-6">
                            Connect your wallet to start trading fictional stocks and earn rewards on the Robinhood Testnet.
                          </p>
                          <button
                            onClick={connect}
                            className="w-full py-3 bg-white text-blue-600 font-bold rounded-xl hover:bg-blue-50 transition transform active:scale-95 shadow-md"
                          >
                            Connect Wallet
                          </button>
                        </div>
                      ) : !isOnRH ? (
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-6 text-center">
                          <div className="text-3xl mb-3">🔗</div>
                          <h3 className="text-xl font-bold text-amber-900 dark:text-amber-100 mb-2">Switch Network</h3>
                          <p className="text-amber-800 dark:text-amber-300 text-sm mb-6">
                            To trade {selected}, you need to be on the Robinhood Chain Testnet.
                          </p>
                          <button
                            onClick={() => switchNetwork(RH_CHAIN_ID)}
                            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition transform active:scale-95 shadow-md shadow-amber-500/20"
                          >
                            Switch to Robinhood
                          </button>
                        </div>
                      ) : isRealStock ? (
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
                      {!isConnected ? (
                        <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl p-6 text-center shadow-lg shadow-purple-500/20 text-white">
                          <div className="text-3xl mb-3">💎</div>
                          <h3 className="text-xl font-bold mb-2">Connect to Earn</h3>
                          <p className="text-purple-100 text-sm mb-6">
                            Provide liquidity for fictional stocks and earn high yield on Robinhood Testnet.
                          </p>
                          <button
                            onClick={connect}
                            className="w-full py-3 bg-white text-purple-600 font-bold rounded-xl hover:bg-purple-50 transition transform active:scale-95 shadow-md"
                          >
                            Connect Wallet
                          </button>
                        </div>
                      ) : !isOnRH ? (
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-6 text-center">
                          <div className="text-3xl mb-3">🔗</div>
                          <h3 className="text-xl font-bold text-amber-900 dark:text-amber-100 mb-2">Switch Network</h3>
                          <p className="text-amber-800 dark:text-amber-300 text-sm mb-6">
                            To provide liquidity, you need to be on the Robinhood Chain Testnet.
                          </p>
                          <button
                            onClick={() => switchNetwork(RH_CHAIN_ID)}
                            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition transform active:scale-95 shadow-md shadow-amber-500/20"
                          >
                            Switch to Robinhood
                          </button>
                        </div>
                      ) : isRealStock ? (
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
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
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
                          value: stockStats?.marketCapETH != null ? `${stockStats.marketCapETH.toFixed(2)} ETH` : "—",
                        },
                        {
                          label: "Holders",
                          value: holderData?.holdersCount != null
                            ? holderData.holdersCount.toLocaleString()
                            : "—",
                        },
                        {
                          label: "Div Yield",
                          value:
                            stockStats?.divYieldMock != null && stockStats.divYieldMock > 0
                              ? `${stockStats.divYieldMock.toFixed(2)}%`
                              : "—",
                        },
                        {
                          label: "24h Volume",
                          value: stockStats?.volume24hETH != null ? `${stockStats.volume24hETH.toFixed(2)} ETH` : "—",
                        },
                        {
                          label: "Forecast Vol",
                          value: stockStats?.forecastVol != null ? `${(stockStats.forecastVol * 100).toFixed(1)}%` : "—",
                          isSynth: true,
                          description: "Predicted annualized price volatility powered by SynthData's SN50 machine learning models.",
                        },
                        {
                          label: "Realized Vol",
                          value: stockStats?.realizedVol != null ? `${(stockStats.realizedVol * 100).toFixed(1)}%` : "—",
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
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-tight">
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
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 ml-1">
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
                            <div className="text-xs text-gray-400">
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
          className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase tracking-widest hover:underline"
        >
          Need testnet ETH? Get some from the faucet →
        </a>
      </div>
    </motion.div>
  );
}
