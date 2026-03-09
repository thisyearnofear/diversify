import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ethers } from "ethers";
import { ProviderFactoryService } from "@diversifi/shared";
import { RH_TESTNET_TOKENS, BROKER_ADDRESSES } from "../../config";

const AMM_ADDRESS = BROKER_ADDRESSES.RH_TESTNET;
const WETH_ADDRESS = RH_TESTNET_TOKENS.WETH;

const AMM_ABI = [
  "function getPoolInfo(address tokenA, address tokenB) view returns (uint256 reserveA, uint256 reserveB, uint256 totalPoolShares, uint256 userShares, uint32 lastUpdate)",
  "function addLiquidity(address tokenA, address tokenB, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin) returns (uint256 amountA, uint256 amountB, uint256 shares)",
  "function removeLiquidity(address tokenA, address tokenB, uint256 sharesToBurn, uint256 amountAMin, uint256 amountBMin) returns (uint256 amountA, uint256 amountB)",
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function deposit() payable", // For WETH
];

interface LiquidityWidgetProps {
  selected: string;
  address: string | null;
  ethBalance: string | null;
  stockBalance: string;
  onSuccess: () => void;
  explorerUrl?: string;
}

/**
 * LiquidityWidget Component
 *
 * Implements "Earn Yield" feature by allowing users to provide liquidity
 * to the Robinhood Chain AMM pools.
 */
export const LiquidityWidget: React.FC<LiquidityWidgetProps> = ({
  selected,
  address,
  ethBalance,
  stockBalance,
  onSuccess,
  explorerUrl,
}) => {
  const [tab, setTab] = useState<"add" | "remove">("add");
  const [inputAmount, setInputAmount] = useState("");
  const [matchingAmount, setMatchingAmount] = useState<string>("0");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pool state
  const [poolInfo, setPoolInfo] = useState<{
    reserveETH: string;
    reserveStock: string;
    userShares: string;
    totalShares: string;
  } | null>(null);

  const stockAddress =
    RH_TESTNET_TOKENS[selected as keyof typeof RH_TESTNET_TOKENS];

  const fetchPoolInfo = useCallback(async () => {
    if (!address) return;
    try {
      const provider = await ProviderFactoryService.getWeb3Provider();
      const amm = new ethers.Contract(AMM_ADDRESS, AMM_ABI, provider);
      // Explicitly pass 'from' to ensure msg.sender is recognized in the view call
      const info = await amm.getPoolInfo(WETH_ADDRESS, stockAddress, {
        from: address,
      });

      setPoolInfo({
        reserveETH: ethers.utils.formatEther(info.reserveA),
        reserveStock: ethers.utils.formatEther(info.reserveB),
        userShares: ethers.utils.formatEther(info.userShares),
        totalShares: ethers.utils.formatEther(info.totalPoolShares),
      });
    } catch (e) {
      console.warn("[Liquidity] Fetch error:", e);
    }
  }, [address, stockAddress]);

  useEffect(() => {
    fetchPoolInfo();
    const interval = setInterval(fetchPoolInfo, 15000);
    return () => clearInterval(interval);
  }, [fetchPoolInfo]);

  // Calculate matching amount when input changes (Standard AMM ratio)
  useEffect(() => {
    if (!inputAmount || !poolInfo || parseFloat(inputAmount) <= 0) {
      setMatchingAmount("0");
      return;
    }

    const val = parseFloat(inputAmount);
    const rETH = parseFloat(poolInfo.reserveETH);
    const rStock = parseFloat(poolInfo.reserveStock);

    if (rETH > 0) {
      const match = (val * rStock) / rETH;
      setMatchingAmount(match.toFixed(6));
    }
  }, [inputAmount, poolInfo]);

  const handleAddLiquidity = async () => {
    if (!inputAmount || !address) return;
    setIsLoading(true);
    setError(null);
    setTxHash(null);

    try {
      const signer = await ProviderFactoryService.getSigner();
      const userAddress = await signer.getAddress();
      const amm = new ethers.Contract(AMM_ADDRESS, AMM_ABI, signer);
      const weth = new ethers.Contract(WETH_ADDRESS, ERC20_ABI, signer);
      const stock = new ethers.Contract(stockAddress, ERC20_ABI, signer);

      const amountETH = ethers.utils.parseEther(inputAmount);
      const amountStock = ethers.utils.parseEther(matchingAmount);

      // 1. Wrap ETH -> WETH
      setStatus("Wrapping ETH...");
      const wrapTx = await weth.deposit({ value: amountETH });
      await wrapTx.wait();

      // 2. Approve WETH
      setStatus("Approving WETH...");
      const wethAllowance = await weth.allowance(userAddress, AMM_ADDRESS);
      if (wethAllowance.lt(amountETH)) {
        const appTx = await weth.approve(
          AMM_ADDRESS,
          ethers.constants.MaxUint256,
        );
        await appTx.wait();
      }

      // 3. Approve Stock
      setStatus(`Approving ${selected}...`);
      const stockAllowance = await stock.allowance(userAddress, AMM_ADDRESS);
      if (stockAllowance.lt(amountStock)) {
        const appTx = await stock.approve(
          AMM_ADDRESS,
          ethers.constants.MaxUint256,
        );
        await appTx.wait();
      }

      // 4. Add Liquidity
      setStatus("Adding Liquidity...");
      // Slippage tolerance 2%
      const minETH = amountETH.mul(98).div(100);
      const minStock = amountStock.mul(98).div(100);

      const tx = await amm.addLiquidity(
        WETH_ADDRESS,
        stockAddress,
        amountETH,
        amountStock,
        minETH,
        minStock,
      );

      setTxHash(tx.hash);
      await tx.wait();
      setStatus(null);
      setInputAmount("");
      onSuccess();
      fetchPoolInfo();
    } catch (e: unknown) {
      const err = e as { reason?: string; message?: string };
      setError(err.reason || err.message || "Failed to add liquidity");
    } finally {
      setIsLoading(false);
      setStatus(null);
    }
  };

  const handleRemoveLiquidity = async () => {
    if (!poolInfo || parseFloat(poolInfo.userShares) <= 0) return;
    setIsLoading(true);
    setError(null);
    setTxHash(null);

    try {
      const signer = await ProviderFactoryService.getSigner();
      const amm = new ethers.Contract(AMM_ADDRESS, AMM_ABI, signer);

      // Remove 100% of shares for simplicity in this version
      const shares = ethers.utils.parseEther(poolInfo.userShares);

      setStatus("Removing Liquidity...");
      const tx = await amm.removeLiquidity(
        WETH_ADDRESS,
        stockAddress,
        shares,
        0, // minAmountA
        0, // minAmountB
      );

      setTxHash(tx.hash);
      await tx.wait();
      onSuccess();
      fetchPoolInfo();
    } catch (e: unknown) {
      const err = e as { reason?: string; message?: string };
      setError(err.reason || err.message || "Failed to remove liquidity");
    } finally {
      setIsLoading(false);
      setStatus(null);
    }
  };

  const hasBalance =
    ethBalance &&
    parseFloat(ethBalance) >= parseFloat(inputAmount) &&
    parseFloat(stockBalance) >= parseFloat(matchingAmount);

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold">Earn Yield</h3>
          <p className="text-xs text-gray-400 uppercase tracking-tighter font-bold">
            Liquidity Provider Rewards
          </p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-800">
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">~12.4% APY</span>
        </div>
      </div>

      <div className="flex bg-gray-100 dark:bg-gray-800/60 rounded-xl p-1 mb-4">
        <button
          onClick={() => setTab("add")}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
            tab === "add"
              ? "bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400"
              : "text-gray-400"
          }`}
        >
          Deposit
        </button>
        <button
          onClick={() => setTab("remove")}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
            tab === "remove"
              ? "bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400"
              : "text-gray-400"
          }`}
        >
          Withdraw
        </button>
      </div>

      <AnimatePresence mode="wait">
        {tab === "add" ? (
          <motion.div
            key="add"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-3"
          >
            <div className="bg-gray-50 dark:bg-gray-800/40 rounded-xl p-3 border border-gray-100 dark:border-gray-800">
              <div className="flex justify-between mb-1">
                <span className="text-xs font-bold text-gray-400 uppercase">
                  Input ETH
                </span>
                <span className="text-xs font-bold text-gray-400">
                  {parseFloat(ethBalance || "0").toFixed(4)} ETH
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="0.0"
                  value={inputAmount}
                  onChange={(e) => setInputAmount(e.target.value)}
                  className="bg-transparent text-lg font-bold outline-none w-full"
                />
                <span className="font-bold text-sm text-gray-400">ETH</span>
              </div>
            </div>

            <div className="flex justify-center -my-1.5 relative z-10">
              <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-full p-1 shadow-sm">
                <span className="text-sm">➕</span>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800/40 rounded-xl p-3 border border-gray-100 dark:border-gray-800">
              <div className="flex justify-between mb-1">
                <span className="text-xs font-bold text-gray-400 uppercase">
                  Input {selected}
                </span>
                <span className="text-xs font-bold text-gray-400">
                  {parseFloat(stockBalance).toFixed(2)} {selected}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-lg font-bold text-gray-900 dark:text-white w-full">
                  {matchingAmount}
                </div>
                <span className="font-bold text-sm text-gray-400">{selected}</span>
              </div>
            </div>

            <button
              disabled={
                isLoading || !inputAmount || parseFloat(inputAmount) <= 0
              }
              onClick={handleAddLiquidity}
              className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:shadow-none"
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{status || "Processing..."}</span>
                </div>
              ) : !hasBalance ? (
                "Insufficient Balance"
              ) : (
                "Deposit to Pool"
              )}
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="remove"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-4"
          >
            <div className="bg-gray-50 dark:bg-gray-800/40 rounded-xl p-4 border border-gray-100 dark:border-gray-800 text-center">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
                Your Pool Shares
              </div>
              <div className="text-3xl font-bold mb-1">
                {parseFloat(poolInfo?.userShares || "0").toFixed(4)}
              </div>
              <div className="text-xs font-bold text-emerald-500 uppercase tracking-tighter">
                {poolInfo && parseFloat(poolInfo.totalShares) > 0
                  ? `${((parseFloat(poolInfo.userShares) / parseFloat(poolInfo.totalShares)) * 100).toFixed(2)}% of Pool`
                  : "0% of Pool"}
              </div>
            </div>

            <button
              disabled={
                isLoading || !poolInfo || parseFloat(poolInfo.userShares) <= 0
              }
              onClick={handleRemoveLiquidity}
              className="w-full py-3.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold text-sm transition disabled:opacity-50"
            >
              {isLoading ? "Processing..." : "Withdraw All Assets"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {txHash && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800"
          >
            <div className="text-xs font-black text-green-600 mb-1">
              ✅ Transaction Successful!
            </div>
            <a
              href={`${explorerUrl}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-400 hover:underline font-bold"
            >
              View on Explorer →
            </a>
          </motion.div>
        )}
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-4 text-xs font-black text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded-lg"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LiquidityWidget;
