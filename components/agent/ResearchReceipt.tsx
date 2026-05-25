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

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Hide research receipt' : 'Show research receipt'}
        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
      >
        <span className="text-emerald-500">⛓</span>
        <span>${receipt.amount} on Arc</span>
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
                <span className="text-[10px] font-mono text-emerald-400">
                  ${receipt.amount} USDC
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-blue-500/10 text-blue-300 rounded-full border border-blue-500/20">
                  World Bank
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-orange-500/10 text-orange-300 rounded-full border border-orange-500/20">
                  CoinGecko
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-purple-500/10 text-purple-300 rounded-full border border-purple-500/20">
                  DeFi Llama
                </span>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <div className="flex items-center gap-1">
                  <span className="inline-block w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-[9px]">
                    ✓
                  </span>
                  <span className="text-emerald-400 font-bold text-[10px]">
                    Verified
                  </span>
                </div>
                {provider && (
                  <span className="text-slate-500">
                    via <span className="capitalize font-bold">{provider}</span>
                  </span>
                )}
              </div>

              <a
                href={receipt.explorer}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-[10px] font-mono text-blue-400 hover:text-blue-300 truncate"
              >
                {receipt.txHash.slice(0, 18)}...{receipt.txHash.slice(-6)} ↗
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
