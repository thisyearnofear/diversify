/**
 * LoopResultSummary — what the Guardian's last loop run did or would do.
 * Extracted from AgentTierStatus: the dry-run status line and the full
 * run's recommendations/results/transactions, one component both
 * inspector sheets share.
 */

import React from "react";
import type { GuardianLoopResult } from "@/hooks/use-session-key";

export function LoopResultSummary({
  loopResult,
}: {
  loopResult: GuardianLoopResult;
}) {
  return (
    <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs space-y-1">
      <div className="font-bold text-gray-700 dark:text-gray-300">
        <span className="font-bold text-purple-700 dark:text-purple-300">
          {loopResult.status === 'ready' && 'Ready'}
          {loopResult.status === 'executed' && 'Executed'}
          {loopResult.status === 'partial' && 'Partial'}
          {loopResult.status === 'blocked' && 'Blocked'}
          {loopResult.status === 'noop' && 'No-op'}
          {loopResult.status === 'failed' && 'Failed'}
          {!['ready', 'executed', 'partial', 'blocked', 'noop', 'failed'].includes(
            loopResult.status || '',
          ) && (loopResult.status || 'ready')}
        </span>
        {loopResult.recommendations?.length || loopResult.summary?.total ? (
          <span>
            {' '}· {loopResult.recommendations?.length || loopResult.summary?.total || 0} recommendation(s)
          </span>
        ) : null}
      </div>
      {loopResult.message && (
        <div className="text-gray-600 dark:text-gray-400">
          {loopResult.message}
          {loopResult.summary && loopResult.summary.total > 0 && (
            <span>
              {' '}
              ({loopResult.summary.total} action
              {loopResult.summary.total === 1 ? '' : 's'}:{' '}
              {loopResult.summary.executed} executed,{' '}
              {loopResult.summary.skipped} skipped,{' '}
              {loopResult.summary.failed} failed)
            </span>
          )}
        </div>
      )}
      {loopResult.recommendations?.map((rec, i: number) => (
        <div key={`${rec.tokenIn}-${rec.tokenOut}-${i}`} className="flex items-center gap-2 text-blue-600">
          <span>🔍</span>
          <span>
            {rec.tokenIn} {"->"} {rec.tokenOut} {" · $"}{rec.amountUSD || 0} {" · "}{rec.reason?.slice(0, 70)}
          </span>
        </div>
      ))}
      {loopResult.results?.map((item, i: number) => (
        <div key={`${item.status}-${item.tokenIn}-${item.tokenOut}-${i}`} className={`flex items-center gap-2 ${
          item.status === 'executed'
            ? 'text-green-600'
            : item.status === 'failed'
              ? 'text-red-600'
              : 'text-amber-600'
        }`}>
          <span>{item.status === 'executed' ? '✅' : item.status === 'failed' ? '❌' : '⏭️'}</span>
          <span>
            {item.tokenIn} {"->"} {item.tokenOut} {" · $"}{item.amountUSD} {" · "}{item.reason || item.error || item.status}
          </span>
          {item.txHash && (
            <a href={item.explorerUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline ml-auto" onClick={(e) => e.stopPropagation()}>tx</a>
          )}
        </div>
      ))}
      {loopResult.transactions?.map((tx, i: number) => (
        <div key={`${tx.txHash || tx.error || i}`} className={`flex items-center gap-2 ${tx.status === 'confirmed' ? 'text-green-600' : tx.status === 'failed' ? 'text-red-600' : 'text-amber-600'}`}>
          <span>{tx.status === 'confirmed' ? '✅' : tx.status === 'failed' ? '❌' : '⏳'}</span>
          <span>
            {(tx.tokenIn || 'asset')} {"->"} {(tx.tokenOut || 'asset')} {" · $"}{tx.amountUSD || 0}
          </span>
          {tx.txHash && (
            <a href={tx.explorerUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline ml-auto" onClick={(e) => e.stopPropagation()}>tx</a>
          )}
        </div>
      ))}
      {(!loopResult.recommendations || loopResult.recommendations.length === 0) &&
        (!loopResult.summary || loopResult.summary.total === 0) && (
        <div className="text-gray-500">No rebalance needed — portfolio looks healthy ✨</div>
      )}
    </div>
  );
}
