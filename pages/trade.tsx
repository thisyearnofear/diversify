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
import { StaggerContainer, staggerItemVariants } from "../hooks/use-animation";

const RH_CHAIN_ID = NETWORKS.RH_TESTNET.chainId;
const AMM_ADDRESS = BROKER_ADDRESSES.RH_TESTNET;
const WETH_ADDRESS = RH_TESTNET_TOKENS.WETH;

const STOCKS = ["ACME", "SPACELY", "WAYNE", "OSCORP", "STARK"] as const;
type Stock = (typeof STOCKS)[number];

const AMM_ABI = [
  "function quoteSwapETH(uint256 ethAmountIn, address tokenOut) view returns (uint256)",
  "function quoteSwapTokenForETH(uint256 amountIn, address tokenIn) view returns (uint256)",
  "function swapExactETHForTokens(uint256 amountOutMin, address tokenOut, address to, uint256 deadline) payable returns (uint256)",
  "function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address tokenIn, address to, uint256 deadline) returns (uint256)",
  "function getReserves(address tokenA, address tokenB) view returns (uint256, uint256)",
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

const SLIPPAGE_PERCENT = 3;
type TradeMode = "buy" | "sell";

export default function TradePage() {
  const { address, chainId, switchNetwork, isConnected, connect } = useWalletContext();

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
    ACME: "0", SPACELY: "0", WAYNE: "0", OSCORP: "0", STARK: "0",
  });
  const [liveRates, setLiveRates] = useState<Record<Stock, string | null>>({
    ACME: null, SPACELY: null, WAYNE: null, OSCORP: null, STARK: null,
  });

  const isOnRH = chainId === RH_CHAIN_ID;
  const stockAddress = RH_TESTNET_TOKENS[selected];
  const design = getTokenDesign(selected);

  // Fetch balances
  const fetchBalances = useCallback(async () => {
    if (!address || !isOnRH) return;
    try {
      const provider = ProviderFactoryService.getProvider(RH_CHAIN_ID);
      const bal = await provider.getBalance(address);
      setEthBalance(ethers.utils.formatEther(bal));

      const entries = await Promise.all(
        STOCKS.map(async (s) => {
          const token = new ethers.Contract(RH_TESTNET_TOKENS[s], ERC20_ABI, provider);
          const b = await token.balanceOf(address);
          return [s, ethers.utils.formatEther(b)] as const;
        })
      );
      setStockBalances(Object.fromEntries(entries) as Record<Stock, string>);
    } catch (e) {
      console.warn("[Trade] Balance fetch error:", e);
    }
  }, [address, isOnRH]);

  useEffect(() => { fetchBalances(); }, [fetchBalances]);

  // Fetch live AMM rates (tokens per 1 ETH)
  useEffect(() => {
    if (!isOnRH) return;
    const provider = ProviderFactoryService.getProvider(RH_CHAIN_ID);
    const amm = new ethers.Contract(AMM_ADDRESS, AMM_ABI, provider);
    const refETH = ethers.utils.parseEther("0.001");

    Promise.all(
      STOCKS.map(async (s) => {
        try {
          const out = await amm.quoteSwapETH(refETH, RH_TESTNET_TOKENS[s]);
          const perMilliETH = parseFloat(ethers.utils.formatEther(out));
          const perETH = perMilliETH * 1000;
          return [s, perETH.toLocaleString("en-US", { maximumFractionDigits: 0 })] as const;
        } catch { return [s, null] as const; }
      })
    ).then((res) =>
      setLiveRates(Object.fromEntries(res) as Record<Stock, string | null>)
    );
  }, [isOnRH]);

  // Get quote + price impact when input changes
  useEffect(() => {
    if (!inputAmount || !isOnRH || parseFloat(inputAmount) <= 0) {
      setQuote(null);
      setPriceImpact(null);
      return;
    }
    const timeout = setTimeout(async () => {
      setIsQuoting(true);
      try {
        const provider = ProviderFactoryService.getProvider(RH_CHAIN_ID);
        const amm = new ethers.Contract(AMM_ADDRESS, AMM_ABI, provider);
        const parsed = ethers.utils.parseEther(inputAmount);

        const out = mode === "buy"
          ? await amm.quoteSwapETH(parsed, stockAddress)
          : await amm.quoteSwapTokenForETH(parsed, stockAddress);
        setQuote(parseFloat(ethers.utils.formatEther(out)).toFixed(6));
        setError(null);

        // Compute price impact from reserves
        try {
          const [reserveA, reserveB] = await amm.getReserves(WETH_ADDRESS, stockAddress);
          const relevantReserve = mode === "buy" ? reserveA : reserveB;
          if (!relevantReserve.isZero()) {
            const impact = parseFloat(parsed.mul(10000).div(relevantReserve).toString()) / 100;
            setPriceImpact(impact);
          } else {
            setPriceImpact(null);
          }
        } catch {
          setPriceImpact(null);
        }
      } catch (e: any) {
        setQuote(null);
        setPriceImpact(null);
        setError("Could not get quote");
      } finally {
        setIsQuoting(false);
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [inputAmount, selected, mode, isOnRH, stockAddress]);

  // Execute swap
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
          : ethers.BigNumber.from(0);
        tx = await amm.swapExactETHForTokens(minOut, stockAddress, address, deadline, { value: amountIn });
      } else {
        const amountIn = ethers.utils.parseEther(inputAmount);
        const token = new ethers.Contract(stockAddress, ERC20_ABI, signer);
        const allowance = await token.allowance(address, AMM_ADDRESS);
        if (allowance.lt(amountIn)) {
          const approveTx = await token.approve(AMM_ADDRESS, ethers.constants.MaxUint256);
          await approveTx.wait();
        }
        const minOut = quote
          ? ethers.utils.parseEther((parseFloat(quote) * slippage).toFixed(18))
          : ethers.BigNumber.from(0);
        tx = await amm.swapExactTokensForETH(amountIn, minOut, stockAddress, address, deadline);
      }

      setTxHash(tx.hash);
      await tx.wait();
      setInputAmount("");
      setQuote(null);
      setPriceImpact(null);
      fetchBalances();
    } catch (e: any) {
      console.error("[Trade] Swap error:", e);
      setError(e?.reason || e?.message || "Swap failed");
    } finally {
      setIsSwapping(false);
    }
  };

  const handleMax = () => {
    if (mode === "buy" && ethBalance) {
      const max = Math.max(0, parseFloat(ethBalance) - 0.001);
      setInputAmount(max > 0 ? max.toFixed(6) : "");
    } else if (mode === "sell") {
      const bal = stockBalances[selected];
      if (parseFloat(bal) > 0) setInputAmount(bal);
    }
  };

  const inputLabel = mode === "buy" ? "ETH" : selected;
  const outputLabel = mode === "buy" ? selected : "ETH";
  const hasBalance = mode === "buy"
    ? ethBalance && parseFloat(ethBalance) > 0.001
    : parseFloat(stockBalances[selected]) > 0;
  const minimumOutput = quote
    ? (parseFloat(quote) * (100 - SLIPPAGE_PERCENT) / 100).toFixed(6)
    : null;

  return (
    <>
      <Head>
        <title>Trade Stocks | DiversiFi</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-white transition-colors">
        {/* Header */}
        <header className="border-b border-gray-200 dark:border-gray-800/50 backdrop-blur-sm sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-sm">
                ← DiversiFi
              </Link>
              <h1 className="text-lg font-black bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent">
                📈 Stock Trading
              </h1>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 font-black uppercase tracking-wider border border-violet-500/20 dark:border-violet-500/30">
                Testnet
              </span>
            </div>
            <WalletButton />
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
          <AnimatePresence mode="wait">
            {!isConnected ? (
              <motion.div
                key="connect"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="text-center py-20 space-y-4"
              >
                <p className="text-5xl">📈</p>
                <h2 className="text-2xl font-black">Fictional Stock Trading</h2>
                <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                  Swap testnet ETH for fictional company stocks on Robinhood Chain.
                  Connect your wallet to get started.
                </p>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={connect}
                  className="px-6 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-black transition"
                >
                  Connect Wallet
                </motion.button>
              </motion.div>
            ) : !isOnRH ? (
              <motion.div
                key="switch"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="text-center py-16 space-y-4"
              >
                <p className="text-4xl">🔗</p>
                <h2 className="text-xl font-black">Switch to Robinhood Chain</h2>
                <p className="text-gray-500 dark:text-gray-400">You need to be on Robinhood Chain Testnet to trade stocks.</p>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => switchNetwork(RH_CHAIN_ID)}
                  className="px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-black transition"
                >
                  Switch Network
                </motion.button>
              </motion.div>
            ) : (
              <motion.div
                key="trade"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="space-y-6"
              >
                {/* Faucet banner */}
                {ethBalance && parseFloat(ethBalance) < 0.001 && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl px-4 py-3 flex items-center justify-between"
                  >
                    <span className="text-amber-700 dark:text-amber-300 text-sm font-medium">💧 You need testnet ETH to trade.</span>
                    <a
                      href="https://faucet.testnet.chain.robinhood.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-black text-amber-600 dark:text-amber-400 hover:text-amber-500 dark:hover:text-amber-300"
                    >
                      Get ETH →
                    </a>
                  </motion.div>
                )}

                {/* Stock ticker strip */}
                <StaggerContainer className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide sm:grid sm:grid-cols-5 sm:overflow-visible sm:pb-0">
                  {STOCKS.map((s) => {
                    const d = getTokenDesign(s);
                    const isSelected = s === selected;
                    const rate = liveRates[s];
                    const bal = stockBalances[s];
                    return (
                      <motion.button
                        key={s}
                        variants={staggerItemVariants}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => { setSelected(s); setInputAmount(""); setQuote(null); setPriceImpact(null); setTxHash(null); setError(null); }}
                        className={`snap-start shrink-0 w-[6.5rem] sm:w-auto relative rounded-xl p-3 text-left transition-all border overflow-hidden ${
                          isSelected
                            ? "border-green-500/60 bg-green-50 dark:bg-green-500/10 ring-1 ring-green-500/30"
                            : "border-gray-200 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-800/40 hover:border-gray-300 dark:hover:border-gray-600"
                        }`}
                      >
                        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${d.gradient}`} />
                        <div className="text-xl mb-1 mt-1">{d.icon}</div>
                        <div className="font-black text-sm">{s}</div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{d.name}</div>
                        {rate && (
                          <div className="text-[10px] text-green-600 dark:text-green-400 mt-1 font-bold">
                            {rate}/ETH
                          </div>
                        )}
                        {parseFloat(bal) > 0 && (
                          <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 font-medium">
                            Own: {parseFloat(bal).toFixed(1)}
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </StaggerContainer>

                {/* Trade widget */}
                <div className="max-w-md mx-auto space-y-4">
                  {/* Buy / Sell toggle */}
                  <div className="flex bg-gray-100 dark:bg-gray-800/60 rounded-xl p-1">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => { setMode("buy"); setInputAmount(""); setQuote(null); setPriceImpact(null); }}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-black uppercase tracking-wider transition ${
                        mode === "buy" ? "bg-green-600 text-white shadow-sm" : "text-gray-400 hover:text-gray-600 dark:hover:text-white"
                      }`}
                    >
                      Buy {selected}
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => { setMode("sell"); setInputAmount(""); setQuote(null); setPriceImpact(null); }}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-black uppercase tracking-wider transition ${
                        mode === "sell" ? "bg-red-600 text-white shadow-sm" : "text-gray-400 hover:text-gray-600 dark:hover:text-white"
                      }`}
                    >
                      Sell {selected}
                    </motion.button>
                  </div>

                  {/* Input */}
                  <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-4 border border-gray-200 dark:border-gray-700/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">You pay</span>
                      <button onClick={handleMax} className="text-[10px] text-green-600 dark:text-green-400 hover:text-green-500 dark:hover:text-green-300 font-black uppercase">
                        Max
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        placeholder="0.0"
                        value={inputAmount}
                        onChange={(e) => setInputAmount(e.target.value)}
                        className="flex-1 bg-transparent text-2xl font-black outline-none placeholder-gray-300 dark:placeholder-gray-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-gray-500 dark:text-gray-400 font-black">{inputLabel}</span>
                    </div>
                    <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                      {mode === "buy"
                        ? `Balance: ${ethBalance ? parseFloat(ethBalance).toFixed(6) : "—"} ETH`
                        : `Balance: ${parseFloat(stockBalances[selected]).toFixed(2)} ${selected}`}
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="flex justify-center -my-1">
                    <div className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1.5">
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    </div>
                  </div>

                  {/* Output preview */}
                  <div className="bg-gray-50/50 dark:bg-gray-800/40 rounded-xl p-4 border border-gray-200/50 dark:border-gray-700/30">
                    <span className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">You receive</span>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-2xl font-black">
                        {isQuoting ? (
                          <span className="inline-block w-5 h-5 border-2 border-gray-300 dark:border-gray-600 border-t-green-500 rounded-full animate-spin" />
                        ) : quote || "0.0"}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 font-black">{outputLabel}</span>
                    </div>
                  </div>

                  {/* Price impact & slippage */}
                  <AnimatePresence>
                    {quote && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-gray-50 dark:bg-gray-800/30 rounded-xl px-4 py-3 border border-gray-200/50 dark:border-gray-700/20 space-y-1.5 overflow-hidden"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500 dark:text-gray-400">Slippage tolerance</span>
                          <span className="font-bold text-gray-700 dark:text-gray-300">{SLIPPAGE_PERCENT}%</span>
                        </div>
                        {priceImpact !== null && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500 dark:text-gray-400">Price impact</span>
                            <span className={`font-bold ${
                              priceImpact < 1 ? "text-green-600 dark:text-green-400" :
                              priceImpact < 5 ? "text-amber-600 dark:text-amber-400" :
                              "text-red-600 dark:text-red-400"
                            }`}>
                              {priceImpact < 0.01 ? "<0.01" : priceImpact.toFixed(2)}%
                            </span>
                          </div>
                        )}
                        {minimumOutput && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500 dark:text-gray-400">Minimum received</span>
                            <span className="font-bold text-gray-700 dark:text-gray-300">
                              {parseFloat(minimumOutput).toFixed(4)} {outputLabel}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500 dark:text-gray-400">Swap fee</span>
                          <span className="font-bold text-gray-700 dark:text-gray-300">0.3%</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Swap button */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleSwap}
                    disabled={!inputAmount || !quote || isSwapping || !hasBalance}
                    className={`w-full py-4 rounded-xl font-black text-lg transition ${
                      isSwapping
                        ? "bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-wait"
                        : !inputAmount || !quote || !hasBalance
                          ? "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                          : mode === "buy"
                            ? "bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-600/20"
                            : "bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20"
                    }`}
                  >
                    {isSwapping ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Swapping…
                      </span>
                    ) : !hasBalance
                      ? mode === "buy" ? "Need ETH — Use Faucet" : `No ${selected} to sell`
                      : `${mode === "buy" ? "Buy" : "Sell"} ${selected}`}
                  </motion.button>

                  {/* Success */}
                  <AnimatePresence>
                    {txHash && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-xl p-4 text-center space-y-2"
                      >
                        <p className="text-green-700 dark:text-green-400 font-black">✅ Swap successful!</p>
                        <a
                          href={`${NETWORKS.RH_TESTNET.explorerUrl}/tx/${txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-green-600 dark:text-green-300 hover:underline font-bold"
                        >
                          View on Explorer →
                        </a>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Error */}
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl p-3 text-center"
                      >
                        <p className="text-red-700 dark:text-red-400 text-sm font-bold">{error}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Portfolio */}
                <AnimatePresence>
                  {Object.values(stockBalances).some((b) => parseFloat(b) > 0) && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="max-w-md mx-auto"
                    >
                      <h3 className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">Your Portfolio</h3>
                      <div className="space-y-2">
                        {STOCKS.filter((s) => parseFloat(stockBalances[s]) > 0).map((s) => {
                          const d = getTokenDesign(s);
                          const bal = parseFloat(stockBalances[s]);
                          return (
                            <motion.div
                              key={s}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/40 rounded-lg px-4 py-3 border border-gray-200/50 dark:border-gray-700/30 overflow-hidden relative"
                            >
                              <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${d.gradient}`} />
                              <div className="flex items-center gap-3 ml-2">
                                <span className="text-xl">{d.icon}</span>
                                <div>
                                  <span className="font-black text-sm">{s}</span>
                                  <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">{d.name}</span>
                                </div>
                              </div>
                              <span className="font-black">{bal.toFixed(2)}</span>
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Info footer */}
                <div className="max-w-md mx-auto text-center space-y-2 pt-4">
                  <p className="text-xs text-gray-400 dark:text-gray-600">
                    Trading fictional stock tokens on Robinhood Chain Testnet (Arbitrum Orbit).
                    <br />0.3% swap fee • Constant-product AMM • All tokens are fictional.
                  </p>
                  <div className="flex justify-center gap-4 text-xs">
                    <a href="https://faucet.testnet.chain.robinhood.com" target="_blank" rel="noopener noreferrer" className="text-violet-500 dark:text-violet-400 hover:text-violet-400 dark:hover:text-violet-300 font-bold">
                      Faucet
                    </a>
                    <a href={`${NETWORKS.RH_TESTNET.explorerUrl}/address/${AMM_ADDRESS}`} target="_blank" rel="noopener noreferrer" className="text-violet-500 dark:text-violet-400 hover:text-violet-400 dark:hover:text-violet-300 font-bold">
                      AMM Contract
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
