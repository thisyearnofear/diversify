/**
 * SwapStatusPanel — transaction status + block-explorer link.
 *
 * Extracted from SwapTab to keep it testable in isolation.
 * Single responsibility: display the current swap status and,
 * when a txHash is available, render a deep-link to the correct explorer.
 */
import React from 'react';
import { getNetworkConfig, NETWORKS } from '../../config';

interface SwapStatusPanelProps {
  status: string;
  txHash: string | null;
  chainId?: number | null;
  /** Hide the panel when the swap step is 'completed' */
  isCompleted?: boolean;
}

export default function SwapStatusPanel({
  status,
  txHash,
  chainId,
  isCompleted = false,
}: SwapStatusPanelProps) {
  if (!status || isCompleted) return null;

  const isError = status.includes('Error');
  const explorerUrl = getNetworkConfig(chainId ?? NETWORKS.CELO_MAINNET.chainId).explorerUrl;

  return (
    <div
      className={`mt-3 p-3 rounded-xl border-2 shadow-sm ${
        isError
          ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30 text-red-700 dark:text-red-400'
          : 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900/30 text-green-700 dark:text-green-400'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`size-2 rounded-full ${
            isError ? 'bg-red-500' : 'bg-green-500 animate-pulse'
          }`}
        />
        <span className="text-xs font-black uppercase tracking-tight">{status}</span>
      </div>

      {txHash && (
        <div className="flex items-center justify-between pt-2 border-t border-current/10">
          <span className="text-[10px] font-bold opacity-70">
            Transaction Hash: {txHash.slice(0, 8)}...{txHash.slice(-8)}
          </span>
          <a
            href={`${explorerUrl}/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-black uppercase underline hover:opacity-80 transition-opacity flex items-center gap-1"
          >
            View on Explorer
            <svg className="size-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
        </div>
      )}
    </div>
  );
}
