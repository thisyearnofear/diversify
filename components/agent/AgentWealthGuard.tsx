import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWealthProtectionAgent, AIMessage } from '../../hooks/use-wealth-protection-agent';
import { useToast } from '../ui/Toast';
import { ChainDetectionService } from '../../services/swap/chain-detection.service';
import { NETWORKS } from '../../config';

interface AgentWealthGuardProps {
    amount: number;
    holdings: string[];
    chainId?: number;
    inflationData?: any;
    embedded?: boolean;
    onExecute?: (token: string) => void;
}

export default function AgentWealthGuard({
    amount,
    holdings,
    chainId,
    inflationData,
    embedded = false,
    onExecute
}: AgentWealthGuardProps) {
    const {
        advice,
        isAnalyzing,
        thinkingStep,
        analysisSteps,
        analysisProgress,
        config,
        analyze,
        sendMessage,
        updateConfig,
        arcAgent,
        initializeArcAgent
    } = useWealthProtectionAgent();

    const { showToast } = useToast();

    // Initialize agent on mount
    useEffect(() => {
        initializeArcAgent();
    }, [initializeArcAgent]);

    const handleExecuteRecommendation = (token: string) => {
        if (onExecute) {
            onExecute(token);
        } else {
            showToast(`Initiating swap to ${token}...`, 'info');
        }
    };

    const handleAnalyze = () => {
        const networkName = ChainDetectionService.getNetworkName(chainId ?? null);
        const networkInfo = { chainId: chainId || 0, name: networkName };
        showToast('Starting comprehensive wealth protection analysis...', 'ai', { cost: 0.05, sources: 5 });
        analyze(
            inflationData,
            amount,
            holdings,
            networkInfo
        );
    };

    const handleQuickAction = (goal: string) => {
        sendMessage(`Analyze my portfolio for ${goal}. What are the top 3 items I should consider?`);
        showToast(`Requesting ${goal} analysis...`, 'ai', { cost: 0.02, sources: 2 });
    };

    return (
        <div className={`flex flex-col h-full bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-white/10 shadow-xl overflow-hidden pointer-events-auto`}>
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 shrink-0 shadow-lg">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/30">
                            <span className="text-xl">🤖</span>
                        </div>
                        <div>
                            <h3 className="text-white font-black text-sm tracking-tight uppercase leading-none">AI Wealth Guard</h3>
                            <div className="flex items-center gap-1.5 mt-1">
                                <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider">AI</span>
                                <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-black/20 border border-white/10">
                                    <div className="w-1 h-1 rounded-full bg-blue-400 animate-pulse" />
                                    <span className="text-[9px] font-mono text-blue-100">Arc Agent v2</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    {arcAgent?.isProxy && (
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] text-blue-100 font-bold uppercase tracking-tighter opacity-80 underline">On-Chain Verified</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <AnimatePresence mode="wait">
                    {/* Analysis Progress - Premium State */}
                    {isAnalyzing && (
                        <motion.div
                            key="progress"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.05 }}
                            className="space-y-6 py-4"
                        >
                            <div className="flex flex-col items-center text-center space-y-4">
                                <div className="relative w-24 h-24">
                                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" className="text-gray-100 dark:text-gray-800" />
                                        <motion.circle
                                            cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8"
                                            strokeLinecap="round" className="text-blue-600"
                                            initial={{ pathLength: 0 }}
                                            animate={{ pathLength: analysisProgress / 100 }}
                                            transition={{ type: "spring", stiffness: 50, damping: 20 }}
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-2xl font-black text-blue-600">{analysisProgress}%</span>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-800 dark:text-white uppercase tracking-widest text-xs">Oracle Thinking</h4>
                                    <p className="text-sm text-blue-600 font-bold mt-1 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full">{thinkingStep || 'Connecting to data hub...'}</p>
                                </div>
                            </div>

                            <div className="space-y-3 px-2">
                                {analysisSteps.slice(-3).map((step, idx) => (
                                    <motion.div
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        key={idx}
                                        className="flex items-center gap-3 text-xs font-bold text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-white/5 p-3 rounded-xl border border-gray-100 dark:border-white/5"
                                    >
                                        <span className="text-blue-500">✓</span>
                                        {step}
                                    </motion.div>
                                ))}
                                {analysisSteps.length > 0 && analysisProgress < 100 && (
                                    <div className="flex items-center gap-3 text-xs font-bold text-gray-400 p-3 rounded-xl border border-dashed border-gray-200">
                                        Processing multi-chain data hubs...
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 border-t border-gray-100 dark:border-white/10">
                                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                    <span>Analysis Cost</span>
                                    <span className="text-blue-600">✨ Sponsored: $0.05 USDC</span>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Recommendation Display - Premium UX */}
                    {advice && !isAnalyzing && (
                        <motion.div
                            key="advice"
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="space-y-4"
                        >
                            {/* Action Header Card */}
                            <div className={`rounded-2xl overflow-hidden border shadow-xl ${advice.action === 'HOLD' ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                                <div className={`p-4 border-b flex justify-between items-center ${advice.action === 'HOLD' ? 'bg-emerald-600/10 border-emerald-200' : 'bg-amber-600/10 border-amber-200'}`}>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">{advice.action === 'HOLD' ? '🛡️' : '⚡'}</span>
                                        <h3 className={`font-black uppercase tracking-tight text-sm ${advice.action === 'HOLD' ? 'text-emerald-800' : 'text-amber-800'}`}>
                                            {advice.action === 'HOLD' ? 'Portfolio Protected' : 'Action Required'}
                                        </h3>
                                    </div>
                                    <div className="bg-white/80 px-2 py-1 rounded-lg border border-black/5 flex items-center gap-1.5 shadow-sm">
                                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                        <span className="text-xs font-black text-blue-700">{(advice.confidence * 100).toFixed(0)}% Confidence</span>
                                    </div>
                                </div>

                                <div className="p-4 space-y-4">
                                    <div className="flex items-start gap-4">
                                        <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center border-2 border-blue-500/20 shadow-inner shrink-0 mt-1">
                                            <span className="text-3xl">🧠</span>
                                        </div>
                                        <p className="text-sm text-gray-800 dark:text-gray-100 font-bold leading-relaxed italic border-l-4 border-blue-500 pl-4 py-1">
                                            &quot;{advice.reasoning}&quot;
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-green-600/10 border border-green-500/20 p-3 rounded-xl flex flex-col items-center text-center">
                                            <span className="text-[10px] font-black text-green-700 uppercase tracking-widest leading-none mb-1.5">Est. Savings</span>
                                            <span className="text-base font-black text-green-800">{advice.expectedSavings ? `+$${advice.expectedSavings}` : '$0'}</span>
                                        </div>
                                        <div className="bg-blue-600/10 border border-blue-500/20 p-3 rounded-xl flex flex-col items-center text-center">
                                            <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest leading-none mb-1.5">Risk Level</span>
                                            <span className={`text-base font-black ${advice.riskLevel === 'HIGH' ? 'text-red-600' : 'text-blue-800'}`}>{advice.riskLevel || 'MEDIUM'}</span>
                                        </div>
                                    </div>

                                    {/* Action Steps Accordion */}
                                    {advice.actionSteps && advice.actionSteps.length > 0 && (
                                        <details className="group border border-gray-200 rounded-xl bg-white overflow-hidden shadow-sm">
                                            <summary className="flex items-center justify-between p-3 cursor-pointer list-none bg-gray-50/50 hover:bg-gray-50 transition-colors">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-base">📋</span>
                                                    <span className="text-xs font-black text-gray-700 uppercase tracking-widest">Action Plan</span>
                                                </div>
                                                <span className="text-blue-500 font-black transition-transform group-open:rotate-180 text-xs">▼</span>
                                            </summary>
                                            <div className="px-3 pb-3 pt-2 space-y-2">
                                                {advice.actionSteps.map((step, idx) => (
                                                    <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-blue-50/30 border border-blue-100/50">
                                                        <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-lg flex items-center justify-center text-[10px] font-black shadow-sm">
                                                            {idx + 1}
                                                        </div>
                                                        <span className="text-xs text-gray-700 font-bold leading-tight">
                                                            {step}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </details>
                                    )}

                                    {/* Logical Insights Accordion */}
                                    {advice.thoughtChain && (
                                        <details className="group border border-gray-200 rounded-xl bg-white overflow-hidden shadow-sm">
                                            <summary className="flex items-center justify-between p-3 cursor-pointer list-none bg-gray-50/50 hover:bg-gray-50 transition-colors">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-base">🔍</span>
                                                    <span className="text-xs font-black text-gray-700 uppercase tracking-widest">Logic Trace</span>
                                                </div>
                                                <span className="text-blue-500 font-black transition-transform group-open:rotate-180 text-xs">▼</span>
                                            </summary>
                                            <div className="px-3 pb-3 pt-2 space-y-1.5">
                                                {advice.thoughtChain.map((thought, idx) => (
                                                    <div key={idx} className="flex items-start gap-2.5 text-[11px] text-gray-600 font-bold p-1">
                                                        <span className="text-blue-500 font-black">↪</span>
                                                        <span>{thought}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </details>
                                    )}

                                    {(advice.action === 'SWAP' || advice.action === 'BRIDGE') && advice.targetToken && (
                                        <button
                                            onClick={() => handleExecuteRecommendation(advice.targetToken!)}
                                            className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-500/30 hover:shadow-indigo-500/40 active:scale-[0.98] transition-all flex items-center justify-center gap-3 border-b-4 border-indigo-900"
                                        >
                                            <span>{advice.action} to {advice.targetToken}</span>
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Verification Data Receipts */}
                            {advice.paymentHashes && Object.keys(advice.paymentHashes).length > 0 && (
                                <div className="pt-2 px-1">
                                    <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] mb-2 px-1">Institutional Proof of Analysis</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        {Object.entries(advice.paymentHashes).slice(0, 4).map(([source, hash]) => (
                                            <a
                                                key={source}
                                                href={`${NETWORKS.ARC_TESTNET.explorerUrl}/tx/${hash}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="bg-gray-50 dark:bg-white/5 p-2 rounded-lg border border-gray-100 dark:border-white/5 flex items-center justify-between group hover:border-blue-500/30 transition-all"
                                            >
                                                <div className="flex flex-col">
                                                    <span className="text-[8px] font-black text-gray-500 uppercase tracking-tighter truncate w-20">{source}</span>
                                                    <span className="text-[8px] font-mono text-blue-500 font-bold">VERIFY</span>
                                                </div>
                                                <svg className="w-2.5 h-2.5 text-gray-300 group-hover:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" strokeWidth={3} /></svg>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Reset Button */}
                            <button
                                onClick={() => analyze(inflationData, amount, holdings)}
                                className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 dark:border-white/10 text-gray-400 font-black text-[10px] uppercase tracking-widest hover:text-blue-600 hover:border-blue-500/50 transition-all"
                            >
                                Re-Analyze Portfolio Context
                            </button>
                        </motion.div>
                    )}

                    {/* Initial / Welcome State */}
                    {!advice && !isAnalyzing && (
                        <motion.div
                            key="initial"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-6 pt-2"
                        >
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-5 border border-blue-100 dark:border-blue-500/20 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <span className="text-6xl">🛡️</span>
                                </div>
                                <h4 className="text-blue-800 dark:text-blue-100 font-black text-base leading-tight mb-2 pr-12">Universal Wealth Protection</h4>
                                <p className="text-blue-700/80 dark:text-blue-200/60 text-xs font-bold leading-relaxed mb-4">
                                    Analyze your <span className="text-blue-600 dark:text-blue-400">${amount.toFixed(2)}</span> portfolio against real-time global inflation data.
                                </p>

                                <button
                                    onClick={handleAnalyze}
                                    className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-600/30 transition-all active:scale-[0.98] flex items-center justify-center gap-3 border-b-4 border-blue-800"
                                >
                                    <span>Run Full Analysis</span>
                                    <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full">$0.05</span>
                                </button>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-1">Quick Analysis Shields</label>
                                <div className="grid grid-cols-1 gap-2">
                                    <button
                                        onClick={() => handleQuickAction('Inflation Protection')}
                                        className="group p-4 bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl hover:border-blue-500/30 hover:shadow-lg transition-all flex items-center gap-4 text-left"
                                    >
                                        <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <span className="text-xl">📈</span>
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-gray-900 dark:text-white font-black text-xs uppercase">Inflation Hedge</div>
                                            <div className="text-gray-500 dark:text-gray-400 text-[10px] font-bold">Assess regional price risks</div>
                                        </div>
                                        <span className="text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all">❯</span>
                                    </button>

                                    <button
                                        onClick={() => handleQuickAction('Portfolio Diversification')}
                                        className="group p-4 bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl hover:border-blue-500/30 hover:shadow-lg transition-all flex items-center gap-4 text-left"
                                    >
                                        <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <span className="text-xl">🌍</span>
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-gray-900 dark:text-white font-black text-xs uppercase">Global Diversity</div>
                                            <div className="text-gray-500 dark:text-gray-400 text-[10px] font-bold">Optimize cross-region holdings</div>
                                        </div>
                                        <span className="text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all">❯</span>
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Sticky Actions Footer */}
            <div className="p-4 bg-gray-50 dark:bg-black/20 border-t border-gray-100 dark:border-white/5 shrink-0 flex items-center justify-around">
                <div className="flex flex-col items-center gap-1 group cursor-pointer">
                    <span className="text-xl group-hover:scale-110 transition-transform">📊</span>
                    <span className="text-[8px] font-black text-gray-500 uppercase tracking-tighter">Insights</span>
                </div>
                <div className="flex flex-col items-center gap-1 group cursor-pointer">
                    <span className="text-xl group-hover:scale-110 transition-transform">🔄</span>
                    <span className="text-[8px] font-black text-gray-500 uppercase tracking-tighter">Rebalance</span>
                </div>
                <div className="flex flex-col items-center gap-1 group cursor-pointer" onClick={() => onExecute?.('PAXG')}>
                    <span className="text-xl group-hover:scale-110 transition-transform">⚡</span>
                    <span className="text-[8px] font-black text-gray-500 uppercase tracking-tighter">Swap</span>
                </div>
                <div className="flex flex-col items-center gap-1 group cursor-pointer">
                    <span className="text-xl group-hover:scale-110 transition-transform">⚙️</span>
                    <span className="text-[8px] font-black text-gray-500 uppercase tracking-tighter">Config</span>
                </div>
            </div>
        </div>
    );
}
