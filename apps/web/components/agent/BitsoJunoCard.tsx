import React from 'react';
import { motion } from 'framer-motion';
import { useJunoStatus } from '../../hooks/use-juno-status';

interface BitsoJunoCardProps {
  walletConnected: boolean;
  onPrepareSwap?: () => void;
}

export default function BitsoJunoCard({ walletConnected, onPrepareSwap }: BitsoJunoCardProps) {
  const { status, isLoading, error } = useJunoStatus();
  const configured = status?.configured ?? false;
  const demoMode = status?.demoMode ?? false;
  const mutationsEnabled = status?.mutationsEnabled ?? false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-950/20 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            Bitso/Juno MXNB
          </p>
          <h3 className="mt-1 text-base font-black text-gray-950 dark:text-white">
            Mexico peso hedge rail
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-emerald-900 dark:text-emerald-100">
            MXNB is wired as an Arbitrum token and Juno is wired for signed balance, CLABE, conversion, sandbox deposit, and redemption calls.
          </p>
        </div>
        <div className="shrink-0 rounded-xl bg-white dark:bg-gray-900 px-3 py-2 text-right border border-emerald-100 dark:border-emerald-800/50">
          <p className="text-[10px] font-black uppercase text-gray-400">API</p>
          <p className={`text-xs font-black ${configured ? 'text-emerald-600' : 'text-amber-600'}`}>
            {isLoading ? 'Checking' : demoMode ? 'Demo' : configured ? 'Ready' : 'Keys needed'}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <StatusPill label="Token" value="MXNB" ok />
        <StatusPill label="Chain" value="Arbitrum" ok />
        <StatusPill label="Mode" value={demoMode ? 'Demo data' : mutationsEnabled ? 'Mutable' : 'Read-only'} ok={!mutationsEnabled || demoMode} />
      </div>

      {demoMode && (
        <p className="mt-2 rounded-lg bg-white/70 dark:bg-gray-900/70 px-3 py-2 text-[11px] font-medium text-emerald-900 dark:text-emerald-100 border border-emerald-100 dark:border-emerald-800/50">
          Demo mode uses deterministic sample Juno responses until sponsor sandbox credentials are available.
        </p>
      )}

      {error && (
        <p className="mt-2 text-[11px] font-medium text-red-600 dark:text-red-300">
          {error}
        </p>
      )}

      <button
        onClick={onPrepareSwap}
        disabled={!walletConnected || !onPrepareSwap}
        className="mt-3 w-full rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black uppercase tracking-wider text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-800 dark:disabled:text-gray-500"
      >
        {walletConnected ? 'Prepare USDC to MXNB' : 'Connect wallet to prepare swap'}
      </button>
    </motion.div>
  );
}

function StatusPill({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="rounded-xl bg-white dark:bg-gray-900 px-3 py-2 border border-emerald-100 dark:border-emerald-800/50">
      <p className="text-[10px] font-black uppercase text-gray-400">{label}</p>
      <p className={`mt-0.5 text-xs font-black truncate ${ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
        {value}
      </p>
    </div>
  );
}
