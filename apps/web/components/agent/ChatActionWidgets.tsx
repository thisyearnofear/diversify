/**
 * Inline action widgets rendered inside Ask Guardian replies.
 *
 * RwaActionWidget executes a Guardian-proposed move through the vault route
 * (permission check → fee calc → execution) — always user-tapped, never
 * automatic. HoldActionWidget confirms a "hold" decision.
 */
import React, { useState } from "react";
import { motion } from "framer-motion";
// Deep leaf import — NOT the barrel — so this constant doesn't drag the
// shared AI/swap/ethers stack into the chunk.
import { CELO_TOKEN_ADDRESS_BY_SYMBOL } from "@diversifi/shared/src/config/celo-tokens";
import { useWalletContext } from "../wallet/WalletProvider";

export const RwaActionWidget = ({ action, onComplete }: { action: any, onComplete: (result: any) => void }) => {
  const [status, setStatus] = useState<'idle' | 'executing' | 'success' | 'error'>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [explorerUrl, setExplorerUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { signMessage } = useWalletContext();

  const handleExecute = async () => {
    setStatus('executing');
    setErrorMessage(null);

    try {
      const userAddress = action.userAddress;
      if (!userAddress || userAddress === '0x0000000000000000000000000000000000000000') {
        throw new Error('Connect your wallet first');
      }

      // Parse target asset (e.g., "cEUR" → swap some base stablecoin to cEUR)
      const assetParts = action.targetAsset?.split('-') || [];
      const tokenIn = assetParts.length > 1 ? assetParts[1] : 'cUSD';
      const tokenOut = assetParts[0] || action.targetAsset || 'cUSD';

      const amountIn = action.amount?.toString() || '500';

      // Route through vault system: permission check → fee calc → smart account execution.
      // The route requires wallet-auth proof the caller owns userAddress.
      const { getWalletAuthHeaders } = await import("@/lib/wallet-auth");
      const authHeaders = (await getWalletAuthHeaders(userAddress, signMessage)) || {};

      const response = await fetch('/api/vault/rebalance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          userAddress,
          recommendations: [{
            action: 'swap',
            urgency: 'high',
            tokenIn,
            tokenInAddress: CELO_TOKEN_ADDRESS_BY_SYMBOL[tokenIn] || CELO_TOKEN_ADDRESS_BY_SYMBOL.cUSD,
            tokenOut,
            tokenOutAddress: CELO_TOKEN_ADDRESS_BY_SYMBOL[tokenOut] || CELO_TOKEN_ADDRESS_BY_SYMBOL.cUSD,
            amountIn: (parseFloat(amountIn) * 1e18).toString(),
            reason: action.reason || `AI-recommended rebalance to ${tokenOut}`,
            estimatedAmountUSD: parseFloat(amountIn),
          }],
        }),
      });

      const result = await response.json();

      if (result.success && result.executed > 0) {
        const tx = result.transactions?.[0];
        setTxHash(tx?.txHash || null);
        setExplorerUrl(tx?.explorerUrl || null);
        setStatus('success');
        onComplete({ txHash: tx?.txHash, explorerUrl: tx?.explorerUrl });
      } else if (result.success && result.skipped > 0) {
        throw new Error('Move skipped — check your daily limit on the Guardian tab');
      } else {
        throw new Error(result.error || result.transactions?.[0]?.error || 'Execution failed');
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Transaction failed');
      setStatus('error');
    }
  };

  const handleRetry = () => {
    setStatus('idle');
    setErrorMessage(null);
    setTxHash(null);
    setExplorerUrl(null);
  };

  return (
    <div className="mt-4 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-inner w-full max-w-[280px]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
           <span className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs">⛽</span>
           <span className="text-3xs font-black uppercase text-gray-500 tracking-wider">Guardian wallet</span>
        </div>
        <span className="text-3xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase">
          {action.network}
        </span>
      </div>

      <div className="flex items-end justify-between mb-4">
        <div>
           <p className="text-3xs uppercase text-gray-400 font-bold mb-1">Target Asset</p>
           <p className="text-sm font-black text-gray-800 dark:text-gray-100">{action.targetAsset}</p>
        </div>
        <div className="text-right">
           <p className="text-3xs uppercase text-gray-400 font-bold mb-1">Est. Amount</p>
           <p className="text-sm font-black text-gray-800 dark:text-gray-100">${action.amount}</p>
        </div>
      </div>

      <button
        onClick={status === 'error' ? handleRetry : handleExecute}
        disabled={status === 'executing' || status === 'success'}
        className={`w-full py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-colors ${
          status === 'success' ? 'bg-green-500 text-white' :
          status === 'executing' ? 'bg-blue-400 text-white cursor-wait' :
          status === 'error' ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20' :
          'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20'
        }`}
      >
        {status === 'idle' && 'Move savings'}
        {status === 'executing' && (
          <span className="flex items-center justify-center gap-2">
            <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>⚙️</motion.span>
            Signing tx...
          </span>
        )}
        {status === 'success' && '✓ Executed'}
        {status === 'error' && 'Retry'}
      </button>

      {/* Error message */}
      {status === 'error' && errorMessage && (
        <p className="text-3xs text-center text-red-500 mt-2 font-medium">
          ⚠ {errorMessage}
        </p>
      )}

      {/* Success with tx hash */}
      {status === 'success' && txHash && (
        <div className="mt-2 text-center">
          <p className="text-3xs text-gray-400 font-medium">
            Tx: {txHash.slice(0, 10)}...{txHash.slice(-8)}
          </p>
          {explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-3xs text-blue-500 hover:text-blue-600 underline mt-0.5 inline-block"
            >
              View on Explorer →
            </a>
          )}
        </div>
      )}

      {status === 'idle' && (
        <p className="text-3xs text-center text-gray-400 mt-2 font-medium">
          Gas covered autonomously via local MPC wallet
        </p>
      )}
    </div>
  );
};

export const HoldActionWidget = ({ action }: { action: any }) => {
  return (
    <div className="mt-4 p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border-2 border-green-200 dark:border-green-700 shadow-inner w-full max-w-[280px]">
      <div className="flex items-center gap-3 mb-3">
        {/* Still, not pulsing — a hold is a confirmation, not an alarm (§5). */}
        <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-xl shadow-lg">
          ✓
        </div>
        <div>
          <p className="text-xs font-black uppercase text-green-700 dark:text-green-300 tracking-wider">
            Portfolio Status
          </p>
          <p className="text-3xs text-green-600 dark:text-green-400 font-medium">
            Well-Balanced
          </p>
        </div>
      </div>

      <div className="bg-white/50 dark:bg-black/20 rounded-lg p-3 mb-3">
        <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
          {action.message || 'Your portfolio is well-diversified. No immediate action needed.'}
        </p>
      </div>

      <div className="flex items-center justify-center gap-2 text-3xs text-green-600 dark:text-green-400 font-bold">
        <span>💎</span>
        <span>HOLD STEADY</span>
        <span>💎</span>
      </div>
    </div>
  );
};
