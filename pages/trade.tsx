import { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import Link from "next/link";
import { ethers } from "ethers";
import { motion, AnimatePresence } from "framer-motion";
import { useWalletContext } from "../components/wallet/WalletProvider";
import WalletButton from "../components/wallet/WalletButton";
import { NETWORKS, RH_TESTNET_TOKENS, BROKER_ADDRESSES } from "../config";
import { getTokenDesign } from "../constants/tokens";
import { ProviderFactoryService } from "../services/swap/provider-factory.service";

// Modular Components
import StockChart from "../components/trade/StockChart";
import StockTicker from "../components/trade/StockTicker";
import TradeWidget from "../components/trade/TradeWidget";
import LiquidityWidget from "../components/trade/LiquidityWidget";
import { useStockStats } from "../hooks/use-stock-stats";
import { useTokenHolders } from "../hooks/use-token-holders";
import HoldersWidget from "../components/trade/HoldersWidget";

const RH_CHAIN_ID = NETWORKS.RH_TESTNET.chainId;
const AMM_ADDRESS = BROKER_ADDRESSES.RH_TESTNET;
const WETH_ADDRESS = RH_TESTNET_TOKENS.WETH;

const STOCKS = ["ACME", "SPACELY", "WAYNE", "OSCORP", "STARK"] as const;
type Stock = (typeof STOCKS)[number];

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

export default function TradePage() {
  const { address, chainId, switchNetwork, isConnected, connect } =
    useWalletContext();

  // --- State ---
  const [activeTab, setActiveTab] = useState<"trade" | "earn">("trade");
  const [selected, setSelected] = useState<Stock>("ACME");
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
  });
  const [liveRates, setLiveRates] = useState<Record<Stock, string | null>>({
    ACME: null,
    SPACELY: null,
    WAYNE: null,
    OSCORP: null,
    STARK: null,
  });
  const [reserves, setReserves] = useState<
    Record<Stock, { eth: string; stock: string } | null>
  >({
    ACME: null,
    SPACELY: null,
    WAYNE: null,
    OSCORP: null,
    STARK: null,
  });

  const isOnRH = chainId === RH_CHAIN_ID;
  const design = getTokenDesign(selected);
  const stockAddress = RH_TESTNET_TOKENS[selected];

  const { stats: stockStats, isLoading: isStatsLoading } = useStockStats(
    selected,
    liveRates[selected],
  );

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
        STOCKS.map(async (s) => {
          const token = new ethers.Contract(
            RH_TESTNET_TOKENS[s],
            ERC20_ABI,
            provider,
          );
          const b = await token.balanceOf(address);
          return [s, ethers.utils.formatEther(b)] as const;
        }),
      );
      setStockBalances(Object.fromEntries(entries) as Record<Stock, string>);
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
        STOCKS.map(async (s) => {
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
      };
      const resMap: Record<Stock, { eth: string; stock: string } | null> = {
        ACME: null,
        SPACELY: null,
        WAYNE: null,
        OSCORP: null,
        STARK: null,
      };

      res.forEach((item) => {
        rates[item.symbol as Stock] = item.rate;
        resMap[item.symbol as Stock] = item.reserves;
      });

      setLiveRates(rates);
      setReserves(resMap);
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

  // --- Quoting ---

  useEffect(() => {
    if (!inputAmount || !isOnRH || parseFloat(inputAmount) <= 0) {
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
    if (!inputAmount || !address) return;
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

  return (
    <>
      <Head>
        <title>Stock Trading | DiversiFi</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0"
        />
      </Head>

      <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-white font-sans selection:bg-green-100 dark:selection:bg-green-900/30">
        {/* Header */}
        <header className="border-b border-gray-200 dark:border-gray-800/50 backdrop-blur-sm sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-sm"
              >
                ← DiversiFi
              </Link>
              <h1 className="text-lg font-black bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent">
                📈 Stock Trading
              </h1>
              <div className="hidden sm:block px-2 py-0.5 rounded bg-violet-100 dark:bg-violet-900/30 text-[10px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-tighter">
                Testnet
              </div>
            </div>
            <WalletButton />
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-8">
          <AnimatePresence mode="wait">
            {!isConnected ? (
              <motion.div
                key="connect"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-20 space-y-4"
              >
                <p className="text-5xl">📈</p>
                <h2 className="text-2xl font-black">Fictional Stock Trading</h2>
                <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                  Swap testnet ETH for fictional company stocks on Robinhood
                  Chain. Connect your wallet to get started.
                </p>
                <button
                  onClick={connect}
                  className="px-6 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-black transition transform active:scale-95"
                >
                  Connect Wallet
                </button>
              </motion.div>
            ) : !isOnRH ? (
              <motion.div
                key="switch"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-16 space-y-4"
              >
                <p className="text-4xl">🔗</p>
                <h2 className="text-xl font-black">
                  Switch to Robinhood Chain
                </h2>
                <p className="text-gray-500 dark:text-gray-400">
                  You need to be on Robinhood Chain Testnet to trade stocks.
                </p>
                <button
                  onClick={() => switchNetwork(RH_CHAIN_ID)}
                  className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-black transition transform active:scale-95"
                >
                  Switch Network
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="trade"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Low Balance Alert */}
                {ethBalance && parseFloat(ethBalance) < 0.001 && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl px-4 py-3 flex items-center justify-between"
                  >
                    <span className="text-amber-700 dark:text-amber-300 text-sm font-medium">
                      💧 You need testnet ETH to trade.
                    </span>
                    <a
                      href="https://faucet.testnet.chain.robinhood.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-black text-amber-600 dark:text-amber-400 hover:underline"
                    >
                      Get ETH →
                    </a>
                  </motion.div>
                )}

                {/* Modular Ticker */}
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
                  }}
                  liveRates={liveRates}
                  stockBalances={stockBalances}
                />

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                  {/* Left: Chart & Info */}
                  <div className="md:col-span-7 lg:col-span-8 space-y-6">
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm overflow-hidden">
                      <div className="flex items-start justify-between mb-8">
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <span className="text-3xl">{design.icon}</span>
                            <h2 className="text-2xl font-black">
                              {design.name}
                            </h2>
                            <span className="text-[10px] font-black px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 uppercase tracking-tighter">
                              {selected}
                            </span>
                          </div>
                          <p className="text-gray-500 dark:text-gray-400 text-sm max-w-sm leading-relaxed">
                            {design.description}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-black">
                            {liveRates[selected]
                              ? `${liveRates[selected]} ${selected}`
                              : "---"}
                          </div>
                          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                            Price per 1.00 ETH
                          </div>
                          {reserves[selected] && (
                            <div className="mt-1 flex items-center justify-end gap-1.5">
                              <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">
                                Liquidity:
                              </span>
                              <span className="text-[10px] font-black text-green-500">
                                {parseFloat(reserves[selected]!.eth).toFixed(2)}{" "}
                                ETH
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="h-[280px] w-full mb-4">
                        <StockChart
                          symbol={selected}
                          height={280}
                          currentPrice={liveRates[selected]}
                        />
                      </div>

                      <div className="flex gap-2 border-t border-gray-100 dark:border-gray-800 pt-4 mt-6">
                        {["1D", "1W", "1M", "3M", "1Y", "ALL"].map((p) => (
                          <button
                            key={p}
                            className={`text-[10px] font-black px-3 py-1.5 rounded-lg transition ${p === "1D" ? "bg-green-500 text-white shadow-sm" : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Market Stats */}
                    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 shadow-sm">
                      <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-4 ml-1">
                        Key Statistics
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                        {isStatsLoading || !stockStats ? (
                          <div className="col-span-4 flex justify-center py-4">
                            <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
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
                          ].map((stat, i) => (
                            <div key={i} className="space-y-1">
                              <div className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">
                                {stat.label}
                              </div>
                              <div className="text-sm font-black text-gray-900 dark:text-white">
                                {stat.value}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Holders Distribution */}
                    <HoldersWidget
                      holderData={holderData}
                      isLoading={isHoldersLoading}
                      selectedStock={selected}
                      explorerUrl={NETWORKS.RH_TESTNET.explorerUrl}
                    />

                    {/* Desktop Assets List */}
                    <div className="hidden md:block">
                      <AnimatePresence>
                        {Object.values(stockBalances).some(
                          (b) => parseFloat(b) > 0,
                        ) && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="w-full"
                          >
                            <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-3 ml-1">
                              Your Positions
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {STOCKS.filter(
                                (s) => parseFloat(stockBalances[s]) > 0,
                              ).map((s) => {
                                const d = getTokenDesign(s);
                                return (
                                  <div
                                    key={s}
                                    className="flex items-center justify-between bg-white dark:bg-gray-900 rounded-2xl px-4 py-3 border border-gray-200 dark:border-gray-800 overflow-hidden relative shadow-sm"
                                  >
                                    <div
                                      className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${d.gradient}`}
                                    />
                                    <div className="flex items-center gap-3">
                                      <span className="text-xl">{d.icon}</span>
                                      <div>
                                        <div className="font-black text-sm">
                                          {s}
                                        </div>
                                        <div className="text-[10px] text-gray-400 dark:text-gray-500">
                                          {d.name}
                                        </div>
                                      </div>
                                    </div>
                                    <span className="font-black text-gray-900 dark:text-white">
                                      {parseFloat(stockBalances[s]).toFixed(2)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Right: Modular Trade/Earn Widget */}
                  <div className="md:col-span-5 lg:col-span-4 space-y-4 md:sticky md:top-24">
                    <div className="flex bg-gray-100 dark:bg-gray-800/60 rounded-2xl p-1 mb-2">
                      <button
                        onClick={() => setActiveTab("trade")}
                        className={`flex-1 py-3 rounded-xl text-sm font-black uppercase tracking-wider transition ${
                          activeTab === "trade"
                            ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white"
                            : "text-gray-400 hover:text-gray-600"
                        }`}
                      >
                        Trade
                      </button>
                      <button
                        onClick={() => setActiveTab("earn")}
                        className={`flex-1 py-3 rounded-xl text-sm font-black uppercase tracking-wider transition ${
                          activeTab === "earn"
                            ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white"
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
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                        >
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
                        </motion.div>
                      ) : (
                        <motion.div
                          key="earn-widget"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                        >
                          <LiquidityWidget
                            selected={selected}
                            address={address}
                            ethBalance={ethBalance}
                            stockBalance={stockBalances[selected]}
                            onSuccess={fetchBalances}
                            explorerUrl={NETWORKS.RH_TESTNET.explorerUrl}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Mobile Assets (Hidden on Desktop) */}
                    <div className="md:hidden">
                      <AnimatePresence>
                        {Object.values(stockBalances).some(
                          (b) => parseFloat(b) > 0,
                        ) && (
                          <div className="space-y-3 pt-4">
                            <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 ml-1">
                              Your Positions
                            </h3>
                            {STOCKS.filter(
                              (s) => parseFloat(stockBalances[s]) > 0,
                            ).map((s) => {
                              const d = getTokenDesign(s);
                              return (
                                <div
                                  key={s}
                                  className="flex items-center justify-between bg-white dark:bg-gray-900 rounded-2xl px-4 py-3 border border-gray-200 dark:border-gray-800 overflow-hidden relative"
                                >
                                  <div
                                    className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${d.gradient}`}
                                  />
                                  <div className="flex items-center gap-3">
                                    <span className="text-xl">{d.icon}</span>
                                    <span className="font-black text-sm">
                                      {s}
                                    </span>
                                  </div>
                                  <span className="font-black">
                                    {parseFloat(stockBalances[s]).toFixed(2)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                {/* Footer Info */}
                <div className="max-w-md mx-auto text-center space-y-3 pt-8 pb-4">
                  <p className="text-[10px] text-gray-400 dark:text-gray-600 leading-relaxed uppercase tracking-widest font-bold">
                    Robinhood Chain Testnet (Arbitrum Orbit)
                    <br />
                    0.3% Fee • Constant-Product AMM • Fictional Assets
                  </p>
                  <div className="flex justify-center gap-4 text-xs">
                    <a
                      href="https://faucet.testnet.chain.robinhood.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-500 hover:text-green-400 font-black uppercase tracking-tighter"
                    >
                      Faucet
                    </a>
                    <a
                      href={`${NETWORKS.RH_TESTNET.explorerUrl}/address/${AMM_ADDRESS}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-500 hover:text-green-400 font-black uppercase tracking-tighter"
                    >
                      Contract
                    </a>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </>
  );
}
