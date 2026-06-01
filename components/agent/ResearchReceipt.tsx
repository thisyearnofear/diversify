import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import type { AIMessage } from '../../hooks/agent-types';

interface ResearchReceiptProps {
  receipt: NonNullable<AIMessage['x402Receipt']>;
  provider?: string;
}

export function ResearchReceipt({ receipt, provider }: ResearchReceiptProps) {
  const [open, setOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  const hasSpend = Number.parseFloat(receipt.amount || '0') > 0;
  const statusLabel =
    receipt.status === 'failed' ? 'Research skipped' :
    receipt.status === 'skipped' ? 'Research skipped' :
    receipt.status === 'quoted' ? 'Research quote' :
    receipt.status === 'paid' ? 'Paid research' :
    receipt.status === 'credit' ? 'Credits used' :
    'Free research';
  const statusColor =
    receipt.status === 'failed' || receipt.status === 'skipped' || receipt.status === 'quoted'
      ? 'text-amber-600 dark:text-amber-400'
      : hasSpend
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-gray-500 dark:text-gray-400';

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Hide research receipt' : 'Show research receipt'}
        className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${statusColor} opacity-80 hover:opacity-100 transition-opacity cursor-pointer`}
      >
        <span>{receipt.status === 'failed' ? '!' : '⛓'}</span>
        <span>{statusLabel} · ${Number.parseFloat(receipt.amount || '0').toFixed(3)} USDC</span>
        <motion.span
          animate={reducedMotion ? undefined : { rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-[9px]"
        >
          ▾
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={reducedMotion ? undefined : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={reducedMotion ? undefined : { opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-2 overflow-hidden"
          >
            <div className="bg-white/5 dark:bg-white/5 border border-white/10 rounded-xl p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Research receipt
                </span>
                <span className={`text-[10px] font-mono ${statusColor}`}>
                  ${Number.parseFloat(receipt.amount || '0').toFixed(3)} USDC
                </span>
              </div>

              {receipt.reason && (
                <p className="text-[10px] leading-snug text-slate-400">
                  {receipt.reason}
                </p>
              )}

              {receipt.error && (
                <p className="text-[10px] leading-snug text-amber-500 dark:text-amber-400">
                  {receipt.error}
                </p>
              )}

              {receipt.sources.length > 0 && (
                <div className="space-y-1">
                  {receipt.sources.map((source) => (
                    <div key={source.sourceId} className="flex items-center justify-between gap-3 text-[10px]">
                      <span className="truncate text-slate-400">{source.label}</span>
                      <span className={source.tier === 'paid' ? 'font-mono text-emerald-400' : 'font-mono text-slate-500'}>
                        ${source.cost.toFixed(3)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <div className="flex items-center gap-1">
                  <span className="inline-block w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-[9px]">
                    {receipt.status === 'failed' ? '!' : '✓'}
                  </span>
                  <span className={`${statusColor} font-bold text-[10px]`}>
                    {receipt.txHash ? 'Verified on Arc' : statusLabel}
                  </span>
                </div>
                {provider && (
                  <span className="text-slate-500">
                    via <span className="capitalize font-bold">{provider}</span>
                  </span>
                )}
              </div>

              {receipt.remainingCredit && (
                <div className="text-[10px] text-slate-500">
                  Gateway credit left: <span className="font-mono">${receipt.remainingCredit}</span>
                </div>
              )}

              {receipt.txHash && receipt.explorer && (
                <a
                  href={receipt.explorer}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-[10px] font-mono text-blue-400 hover:text-blue-300 truncate"
                >
                  {receipt.txHash.slice(0, 18)}...{receipt.txHash.slice(-6)} ↗
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
