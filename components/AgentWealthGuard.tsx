
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWealthProtectionAgent, RiskTolerance, InvestmentGoal } from "../hooks/use-wealth-protection-agent";
import { useInflationData } from "../hooks/use-inflation-data";
import { Region } from "../hooks/use-user-region";

interface AgentWealthGuardProps {
    amount: number;
    currentRegions: Region[];
    userRegion: Region;
    onExecuteSwap: (targetToken: string) => void;
}

export default function AgentWealthGuard({ amount, currentRegions, userRegion, onExecuteSwap }: AgentWealthGuardProps) {
    const { analyze, advice, isAnalyzing, thinkingStep, config, updateConfig } = useWealthProtectionAgent();
    const { inflationData } = useInflationData();
    const [showConfig, setShowConfig] = useState(false);

    if (!inflationData) return null;

    const handleAnalyze = () => {
        analyze(inflationData, amount, [userRegion, ...currentRegions]);
    };

    return (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0F172A] to-[#1E293B] shadow-2xl text-white border border-blue-500/20">
            {/* Glossy Overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 to-transparent pointer-events-none" />

            <div className="relative z-10 p-6">
                {/* Header Section */}
                <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <motion.div
                                animate={isAnalyzing ? { rotate: 360 } : {}}
                                transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
                                className="w-12 h-12 rounded-full bg-blue-600/10 flex items-center justify-center border border-blue-400/20 shadow-inner"
                            >
                                <span className="text-2xl">🧠</span>
                            </motion.div>
                            {isAnalyzing && (
                                <div className="absolute -top-1 -right-1 flex">
                                    <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500 border-2 border-[#0F172A]"></span>
                                </div>
                            )}
                        </div>
                        <div>
                            <h2 className="text-xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-blue-200">
                                DiversiFi Oracle
                            </h2>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                    Agentic Core v2
                                </span>
                                <span className="text-[10px] text-slate-500 font-medium">ARC MAINNET READY</span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => setShowConfig(!showConfig)}
                        className={`p-2 rounded-lg transition-colors ${showConfig ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:bg-white/5'}`}
                        title="Configure Strategy"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                        </svg>
                    </button>
                </div>

                {/* Configuration Panel */}
                <AnimatePresence>
                    {showConfig && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden mb-6"
                        >
                            <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-2 block">Risk Tolerance</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {(['Conservative', 'Balanced', 'Aggressive'] as RiskTolerance[]).map(t => (
                                            <button
                                                key={t}
                                                onClick={() => updateConfig({ riskTolerance: t })}
                                                className={`px-2 py-1.5 rounded-md text-[10px] font-bold transition-all ${config.riskTolerance === t ? 'bg-blue-600 text-white shadow-lg' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-2 block">Investment Goal</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {(['Capital Preservation', 'Inflation Hedge', 'Growth'] as InvestmentGoal[]).map(g => (
                                            <button
                                                key={g}
                                                onClick={() => updateConfig({ goal: g })}
                                                className={`px-2 py-1.5 rounded-md text-[10px] font-bold transition-all ${config.goal === g ? 'bg-blue-600 text-white shadow-lg' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                                            >
                                                {g.split(' ')[0]}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Main Action / Result Area */}
                <div className="min-h-[160px] flex flex-col justify-center">
                    {!advice && !isAnalyzing && (
                        <div className="text-center">
                            <p className="text-slate-400 text-sm mb-6 max-w-[240px] mx-auto leading-relaxed">
                                Let the Oracle analyze global market conditions to optimize your ${amount.toFixed(2)} portfolio.
                            </p>
                            <button
                                onClick={handleAnalyze}
                                className="w-full group relative flex items-center justify-center gap-3 py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-all overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                                <span className="relative">Run Intelligent Analysis</span>
                                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </button>
                        </div>
                    )}

                    {/* Thinking Terminal Experience */}
                    {isAnalyzing && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 text-blue-400">
                                <motion.div
                                    animate={{ opacity: [0.4, 1, 0.4] }}
                                    transition={{ repeat: Infinity, duration: 1.5 }}
                                    className="w-1.5 h-1.5 bg-blue-400 rounded-full"
                                />
                                <span className="text-xs font-mono font-medium tracking-tight">AGENT_THOUGHT: {thinkingStep}</span>
                            </div>

                            {/* Visual Activity Bar */}
                            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full bg-gradient-to-r from-blue-600 via-indigo-400 to-blue-600"
                                    animate={{ x: ["-100%", "100%"] }}
                                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                                    style={{ width: '40%' }}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="h-8 bg-white/5 rounded-lg border border-white/5 animate-pulse" />
                                <div className="h-8 bg-white/5 rounded-lg border border-white/5 animate-pulse [animation-delay:0.5s]" />
                            </div>
                        </div>
                    )}

                    {/* Result Integration */}
                    <AnimatePresence>
                        {advice && !isAnalyzing && (
                            <motion.div
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                className="space-y-4"
                            >
                                <div className={`rounded-xl p-5 border shadow-2xl ${advice.action === 'SWAP' ? 'bg-amber-500/10 border-amber-500/30 shadow-amber-900/10' : 'bg-emerald-500/10 border-emerald-500/30 shadow-emerald-900/10'}`}>
                                    <div className="flex justify-between items-center mb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">{advice.action === 'SWAP' ? '⚡' : '🛡️'}</span>
                                            <h3 className={`font-black text-sm uppercase tracking-tighter ${advice.action === 'SWAP' ? 'text-amber-400' : 'text-emerald-400'}`}>
                                                {advice.action === 'SWAP' ? 'Action Required' : 'Portfolio Shielded'}
                                            </h3>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/30 border border-white/10">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                            <span className="text-[10px] font-mono text-blue-200">ACCUR:{(advice.confidence * 100).toFixed(0)}%</span>
                                        </div>
                                    </div>
                                    <p className="text-sm text-slate-300 font-medium leading-relaxed italic border-l-2 border-white/10 pl-3">
                                        "{advice.reasoning}"
                                    </p>
                                </div>

                                {advice.action === 'SWAP' && advice.targetToken && (
                                    <button
                                        onClick={() => onExecuteSwap(advice.targetToken!)}
                                        className="w-full group flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:shadow-[0_0_30px_-5px_#10b98150] text-white rounded-xl font-black transition-all active:scale-[0.97]"
                                    >
                                        <span>Deploy to {advice.targetToken}</span>
                                        <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                        </svg>
                                    </button>
                                )}

                                <div className="flex justify-center">
                                    <button
                                        onClick={handleAnalyze}
                                        className="text-[10px] text-slate-500 hover:text-blue-400 font-bold uppercase tracking-widest transition-colors flex items-center gap-1"
                                    >
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        Re-calculate
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Matrix-like subtle grid in background */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 0)', backgroundSize: '24px 24px' }} />
        </div>
    );
}
