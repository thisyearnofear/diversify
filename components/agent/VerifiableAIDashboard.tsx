/**
 * VerifiableAIDashboard
 *
 * Full 0G Stack Trace visualizer — shows the end-to-end path from
 *   AI inference (0G Serving) → evidence anchoring (0G Storage) → 
 *   on-chain record (0G Chain RecommendationLedger)
 *
 * Replaces the basic AuditTrailModal with a comprehensive verifiability dashboard.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

// ============================================================================
// TYPES
// ============================================================================

interface LedgerRecommendation {
  id: number;
  user: string;
  action: string;
  targetToken: string;
  reasoning: string;
  evidenceCid: string;
  servingModel: string;
  settlementTxHash: string;
  timestamp: number;
  confidence: number;
}

interface LedgerStats {
  totalRecommendations: number;
  contractAddress: string;
  chainId: number;
  isDeployed: boolean;
}

interface ZeroGLedgerResponse {
  stats: LedgerStats;
  recent: LedgerRecommendation[];
  explorerBase: string;
  contractExplorer: string | null;
}

interface MetricsResponse {
  zeroGIntegratedLedger: LedgerStats | null;
  zeroGServing: {
    status: string;
    description: string;
  };
}

interface V0AIDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function VerifiableAIDashboard({ isOpen, onClose }: V0AIDashboardProps) {
  const [ledgerData, setLedgerData] = useState<ZeroGLedgerResponse | null>(null);
  const [metricsData, setMetricsData] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'trace' | 'status' | 'ledger'>('trace');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [metricsRes, ledgerRes] = await Promise.all([
        fetch(`${API_BASE}/api/agent/x402-metrics`).then(r => r.json()),
        fetch(`${API_BASE}/api/agent/zero-g-ledger`).then(r => r.json()),
      ]);

      setMetricsData(metricsRes);
      setLedgerData(ledgerRes);
    } catch (err: any) {
      setError(err.message || 'Failed to load Verifiable AI data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, fetchData]);

  const servingConfigured = metricsData?.zeroGServing?.status === 'configured';
  const ledgerDeployed = ledgerData?.stats?.isDeployed ?? false;
  const totalRecommendations = ledgerData?.stats?.totalRecommendations ?? 0;
  const recent = ledgerData?.recent ?? [];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
          />

          {/* Dashboard Panel */}
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 30 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-2xl max-h-[85vh] bg-white/95 dark:bg-gray-950/95 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_32px_80px_rgba(0,0,0,0.5)] overflow-hidden border border-white/20 dark:border-white/5 flex flex-col"
          >
            {/* ================================================================ */}
            {/* HEADER */}
            {/* ================================================================ */}
            <div className="bg-gradient-to-br from-indigo-700 via-purple-700 to-violet-800 p-6 sm:p-8 relative overflow-hidden shrink-0">
              {/* Decorative blobs */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl" />
              <div className="absolute bottom-0 left-1/3 w-32 h-32 bg-purple-400/20 rounded-full -mb-16 blur-2xl" />

              <div className="relative z-10 flex items-start justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center text-sm backdrop-blur-sm border border-white/10">
                      🛡️
                    </div>
                    <h2 className="text-white font-black text-xl sm:text-2xl tracking-tight">
                      Verifiable AI
                    </h2>
                    <span className="relative flex h-2 w-2">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${ledgerDeployed ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${ledgerDeployed ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    </span>
                  </div>
                  <p className="text-indigo-200/80 text-xs font-medium max-w-sm leading-relaxed">
                    End-to-end verifiability across 0G&apos;s decentralized stack — from AI inference to on-chain settlement.
                  </p>
                </div>
              </div>

              {/* 0G Stack Status Badges */}
              <div className="relative z-10 flex flex-wrap gap-2 mt-4">
                <StatusBadge
                  label="0G Storage"
                  status={true}
                  tooltip="Evidence CIDs anchored to decentralized storage"
                />
                <StatusBadge
                  label="0G Serving"
                  status={servingConfigured}
                  tooltip="Decentralized AI inference via Router API"
                />
                <StatusBadge
                  label="0G Chain"
                  status={ledgerDeployed}
                  tooltip="RecommendationLedger contract on Galileo testnet"
                />
              </div>
            </div>

            {/* ================================================================ */}
            {/* TAB BAR */}
            {/* ================================================================ */}
            <div className="flex border-b border-gray-100 dark:border-white/5 px-6 pt-4 gap-4 shrink-0">
              {[
                { id: 'trace' as const, label: 'Trace', icon: '🔗' },
                { id: 'status' as const, label: 'Status', icon: '📊' },
                { id: 'ledger' as const, label: 'Ledger', icon: '⛓️' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`pb-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 flex items-center gap-1.5 ${
                    activeTab === tab.id
                      ? 'text-purple-700 dark:text-purple-400 border-purple-600'
                      : 'text-gray-400 dark:text-gray-600 border-transparent hover:text-gray-600 dark:hover:text-gray-400'
                  }`}
                >
                  <span className="text-sm">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ================================================================ */}
            {/* CONTENT */}
            {/* ================================================================ */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
              {loading ? (
                /* Skeleton loading */
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-28 animate-pulse bg-gray-100 dark:bg-white/5 rounded-2xl" />
                  ))}
                </div>
              ) : error ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3 opacity-30">⚠️</div>
                  <p className="text-sm font-bold text-gray-500 dark:text-gray-400">{error}</p>
                  <button
                    onClick={fetchData}
                    className="mt-4 text-xs font-black text-purple-600 dark:text-purple-400 uppercase tracking-wider hover:underline"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    {activeTab === 'trace' && (
                      <TraceView
                        servingConfigured={servingConfigured}
                        ledgerDeployed={ledgerDeployed}
                        recent={recent}
                        contractExplorer={ledgerData?.contractExplorer ?? null}
                        explorerBase={ledgerData?.explorerBase ?? ''}
                      />
                    )}
                    {activeTab === 'status' && (
                      <StatusView
                        metrics={metricsData}
                        contractExplorer={ledgerData?.contractExplorer ?? null}
                      />
                    )}
                    {activeTab === 'ledger' && (
                      <LedgerView
                        stats={ledgerData?.stats}
                        recent={recent}
                        contractExplorer={ledgerData?.contractExplorer ?? null}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              )}
            </div>

            {/* ================================================================ */}
            {/* FOOTER */}
            {/* ================================================================ */}
            <div className="p-5 bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-white/5 shrink-0">
              <button
                onClick={onClose}
                className="w-full py-3.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-black rounded-3xl shadow-[0_8px_24px_rgba(0,0,0,0.15)] hover:scale-[1.01] active:scale-95 transition-all"
              >
                Close Dashboard
              </button>
              <p className="text-center text-[9px] text-gray-400 dark:text-gray-600 font-bold uppercase tracking-widest mt-3">
                Powered by 0G Foundation · Galileo Testnet
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function StatusBadge({ label, status, tooltip }: { label: string; status: boolean; tooltip: string }) {
  return (
    <div
      title={tooltip}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${
        status
          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20'
          : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${status ? 'bg-emerald-400' : 'bg-amber-400'}`} />
      {label}
    </div>
  );
}

// -------- TRACE VIEW --------------------------------------------------------

function TraceView({
  servingConfigured,
  ledgerDeployed,
  recent,
  contractExplorer,
  explorerBase,
}: {
  servingConfigured: boolean;
  ledgerDeployed: boolean;
  recent: LedgerRecommendation[];
  contractExplorer: string | null;
  explorerBase: string;
}) {
  const lastRec = recent[0];

  const steps = [
    {
      icon: '🧠',
      title: 'AI Inference',
      subtitle: servingConfigured ? '0G Serving (Router API)' : 'Centralized Provider',
      detail: servingConfigured
        ? lastRec?.servingModel || 'deepseek-v4-pro'
        : 'Venice AI / Gemini',
      status: servingConfigured ? 'active' as const : 'fallback' as const,
    },
    {
      icon: '📦',
      title: 'Evidence Anchoring',
      subtitle: '0G Storage',
      detail: lastRec?.evidenceCid || 'CID generated per analysis',
      status: 'active' as const,
    },
    {
      icon: '⛓️',
      title: 'On-Chain Record',
      subtitle: '0G Galileo Testnet',
      detail: ledgerDeployed
        ? `Recommendation #${lastRec?.id ?? '—'} recorded`
        : 'Contract pending deployment',
      status: ledgerDeployed ? 'active' as const : 'pending' as const,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Flow Diagram */}
      <div className="relative">
        {steps.map((step, i) => (
          <div key={step.title} className="flex items-start gap-4 relative">
            {/* Connector line */}
            {i < steps.length - 1 && (
              <div className="absolute left-[17px] top-10 bottom-0 w-0.5 bg-gradient-to-b from-purple-500/40 to-indigo-500/40" />
            )}

            {/* Step dot */}
            <div className={`relative z-10 w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 border ${
              step.status === 'active'
                ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 border-emerald-400/30 shadow-[0_4px_12px_rgba(16,185,129,0.3)]'
                : step.status === 'fallback'
                  ? 'bg-gradient-to-br from-amber-500 to-amber-600 border-amber-400/30 shadow-[0_4px_12px_rgba(245,158,11,0.3)]'
                  : 'bg-gradient-to-br from-gray-500 to-gray-600 border-gray-400/30'
            }`}>
              {step.icon}
            </div>

            {/* Step content */}
            <div className="flex-1 pb-6">
              <div className="bg-gray-50 dark:bg-white/[0.04] p-4 rounded-2xl border border-gray-100 dark:border-white/5 hover:border-purple-400/20 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">
                    {step.title}
                  </h4>
                  <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    step.status === 'active'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : step.status === 'fallback'
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        : 'bg-gray-500/10 text-gray-500 dark:text-gray-400'
                  }`}>
                    {step.status}
                  </span>
                </div>
                <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400">
                  {step.subtitle}
                </p>
                <p className="text-[11px] font-mono text-purple-700 dark:text-purple-300 mt-1.5 bg-purple-500/5 px-2 py-1 rounded-lg truncate">
                  {step.detail}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary Card */}
      <div className="bg-gradient-to-br from-purple-600/10 to-indigo-600/10 p-4 rounded-2xl border border-purple-500/20">
        <h4 className="text-xs font-black text-purple-700 dark:text-purple-300 uppercase tracking-wider mb-1">
          Verifiability Status
        </h4>
        <p className="text-[10px] text-gray-600 dark:text-gray-400 leading-relaxed">
          {ledgerDeployed
            ? `All three 0G layers are active. Every AI recommendation is traceable from model inference → storage evidence → on-chain record.`
            : servingConfigured
              ? `0G Serving and Storage are active. Deploy the RecommendationLedger contract to complete the chain.`
              : `0G Storage is active. Configure 0G Serving and deploy the ledger contract for full verifiability.`}
        </p>
        {contractExplorer && (
          <a
            href={contractExplorer}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-3 text-[10px] font-black text-purple-600 dark:text-purple-400 hover:underline uppercase tracking-wider"
          >
            View Contract on Explorer ↗
          </a>
        )}
      </div>
    </div>
  );
}

// -------- STATUS VIEW -------------------------------------------------------

function StatusView({
  metrics,
  contractExplorer,
}: {
  metrics: MetricsResponse | null;
  contractExplorer: string | null;
}) {
  const statusEntries = [
    {
      label: '0G Storage',
      value: 'Active',
      status: 'active' as const,
      description: 'Evidence CIDs anchored to 0G Storage for every AI analysis',
    },
    {
      label: '0G Serving',
      value: metrics?.zeroGServing?.status ?? 'Unknown',
      status: metrics?.zeroGServing?.status === 'configured' ? 'active' as const : 'inactive' as const,
      description: metrics?.zeroGServing?.description ?? 'Decentralized AI inference via Router API',
    },
    {
      label: 'Recommendation Ledger',
      value: contractExplorer ? 'Deployed' : 'Not Deployed',
      status: contractExplorer ? 'active' as const : 'inactive' as const,
      description: 'On-chain recommendation records on 0G Galileo testnet',
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
        0G Infrastructure Status — each layer powers agent verifiability
      </p>

      {statusEntries.map(entry => (
        <div
          key={entry.label}
          className="bg-gray-50 dark:bg-white/[0.04] p-4 rounded-2xl border border-gray-100 dark:border-white/5"
        >
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight">
              {entry.label}
            </h4>
            <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
              entry.status === 'active'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-gray-500/10 text-gray-500'
            }`}>
              {entry.status}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
            {entry.description}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  entry.status === 'active'
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 w-full'
                    : 'bg-gradient-to-r from-gray-400 to-gray-300 w-1/4'
                }`}
              />
            </div>
            <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase">
              {entry.status === 'active' ? '100%' : '0%'}
            </span>
          </div>
        </div>
      ))}

      <div className="text-center pt-2">
        <p className="text-[10px] text-gray-400 dark:text-gray-500">
          All three 0G layers must be active for <span className="font-bold text-purple-600 dark:text-purple-400">full verifiability</span>.
        </p>
      </div>
    </div>
  );
}

// -------- LEDGER VIEW -------------------------------------------------------

function LedgerView({
  stats,
  recent,
  contractExplorer,
}: {
  stats: LedgerStats | undefined;
  recent: LedgerRecommendation[];
  contractExplorer: string | null;
}) {
  const isEmpty = !stats?.isDeployed;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
        <div className="text-5xl opacity-20">⛓️</div>
        <p className="text-sm font-black text-gray-500 dark:text-gray-400">
          Ledger Contract Not Deployed
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 max-w-xs">
          Deploy the RecommendationLedger contract to 0G Galileo testnet to start recording recommendations on-chain.
        </p>
        <span className="text-[9px] font-mono text-purple-600 dark:text-purple-400 bg-purple-500/5 px-3 py-1.5 rounded-xl border border-purple-500/20">
          forge create —rpc-url zero_g_testnet —broadcast
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Records', value: stats?.totalRecommendations ?? 0, color: 'text-purple-600 dark:text-purple-400' },
          { label: 'Chain ID', value: stats?.chainId ?? 16602, color: 'text-indigo-600 dark:text-indigo-400' },
          { label: 'Status', value: 'Live', color: 'text-emerald-600 dark:text-emerald-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-gray-50 dark:bg-white/[0.04] p-3 rounded-2xl border border-gray-100 dark:border-white/5 text-center">
            <div className={`text-lg font-black ${stat.color}`}>{stat.value}</div>
            <div className="text-[9px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mt-0.5">
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Recommendation entries */}
      {recent.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-gray-400 dark:text-gray-500 font-bold">
            No recommendations recorded yet.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
            Recommendations will appear here once the agent makes autonomous decisions.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <h4 className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
            Recent Recommendations
          </h4>
          {recent.map((rec) => (
            <motion.div
              key={rec.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-gray-50 dark:bg-white/[0.04] p-4 rounded-2xl border border-gray-100 dark:border-white/5 hover:border-purple-400/20 transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">
                    #{rec.id}
                  </span>
                  <span className={`text-[10px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-full ${
                    rec.action === 'SWAP' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                    rec.action === 'HOLD' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                    rec.action === 'REBALANCE' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' :
                    'bg-gray-500/10 text-gray-600 dark:text-gray-400'
                  }`}>
                    {rec.action}
                  </span>
                </div>
                <span className="text-[9px] text-gray-400 dark:text-gray-500 font-mono">
                  {new Date(rec.timestamp * 1000).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <span className="text-gray-400 font-bold uppercase tracking-wider">Target</span>
                  <p className="font-mono text-gray-800 dark:text-gray-200 font-bold mt-0.5">
                    {rec.targetToken || '—'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400 font-bold uppercase tracking-wider">Confidence</span>
                  <p className="font-mono text-gray-800 dark:text-gray-200 font-bold mt-0.5">
                    {(rec.confidence * 100).toFixed(0)}%
                  </p>
                </div>
              </div>

              {/* Expandable details */}
              <details className="mt-3 group">
                <summary className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
                  View Evidence Chain →
                </summary>
                <div className="mt-2 space-y-1.5 text-[9px] font-mono">
                  <div className="flex items-center gap-2">
                    <span className="text-purple-400 font-black">CID:</span>
                    <span className="text-gray-600 dark:text-gray-400 truncate">{rec.evidenceCid || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-purple-400 font-black">Model:</span>
                    <span className="text-gray-600 dark:text-gray-400">{rec.servingModel}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-purple-400 font-black">Tx:</span>
                    <span className="text-gray-600 dark:text-gray-400 truncate">{rec.settlementTxHash || '—'}</span>
                  </div>
                  {rec.reasoning && (
                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-white/5">
                      <span className="text-purple-400 font-black block mb-1">Reasoning:</span>
                      <p className="text-gray-600 dark:text-gray-400 leading-relaxed font-medium text-[10px]">
                        {rec.reasoning}
                      </p>
                    </div>
                  )}
                </div>
              </details>
            </motion.div>
          ))}
        </div>
      )}

      {/* Contract link */}
      {contractExplorer && (
        <a
          href={contractExplorer}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-[10px] font-black text-purple-600 dark:text-purple-400 hover:underline uppercase tracking-wider py-2"
        >
          View Contract on ChainScan Explorer ↗
        </a>
      )}
    </div>
  );
}

export default VerifiableAIDashboard;
