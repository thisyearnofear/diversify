
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWealthProtectionAgent, AgentAdvice } from "../hooks/use-wealth-protection-agent";
import { useInflationData } from "../hooks/use-inflation-data";
import { Region } from "../hooks/use-user-region";

interface AgentWealthGuardProps {
    amount: number;
    currentRegions: Region[];
    userRegion: Region;
    onExecuteSwap: (targetToken: string) => void;
}

export default function AgentWealthGuard({ amount, currentRegions, userRegion, onExecuteSwap }: AgentWealthGuardProps) {
    const { analyze, advice, isAnalyzing } = useWealthProtectionAgent();
    const { inflationData } = useInflationData();

    if (!inflationData) return null;

    const handleAnalyze = () => {
        analyze(inflationData, amount, [userRegion, ...currentRegions]);
    };

    return (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1E293B] to-[#0F172A] p-6 shadow-xl text-white border border-blue-800/50">
            {/* Background Decoration */}
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Header Section */}
            <div className="relative z-10 flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center border border-blue-400/30">
                            <span className="text-xl">🤖</span>
                        </div>
                        {isAnalyzing && (
                            <div className="absolute top-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-[#1E293B] animate-pulse" />
                        )}
                    </div>
                    <div>
                        <h2 className="text-lg font-bold tracking-tight">Wealth Guard AI</h2>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-200 border border-blue-500/20">
                                Gemini 3 Flash
                            </span>
                            <span className="text-xs text-slate-400">• Arc Network</span>
                        </div>
                    </div>
                </div>

                {!advice && !isAnalyzing && (
                    <button
                        onClick={handleAnalyze}
                        className="group flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 transition-all rounded-lg font-semibold shadow-lg shadow-blue-900/50"
                    >
                        <span>Analyze Risk</span>
                        <svg className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                )}
            </div>

            {/* Analysis State */}
            {isAnalyzing && (
                <div className="py-8 text-center animate-pulse">
                    <div className="inline-block mb-3">
                        <div className="flex gap-1 justify-center">
                            <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                            <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                            <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></span>
                        </div>
                    </div>
                    <p className="text-blue-200 font-medium">Analyzing global inflation metrics...</p>
                </div>
            )}

            {/* Result State */}
            {advice && !isAnalyzing && (
                <div className="relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className={`rounded-xl p-4 mb-4 border ${advice.action === 'SWAP' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-green-500/10 border-green-500/30'}`}>
                        <div className="flex justify-between items-center mb-2">
                            <h3 className={`font-bold ${advice.action === 'SWAP' ? 'text-amber-400' : 'text-green-400'}`}>
                                {advice.action === 'SWAP' ? '⚠️ Inflation Risk Detected' : '✅ Holdings Optimized'}
                            </h3>
                            <span className="text-xs text-slate-400">Confidence: {(advice.confidence * 100).toFixed(0)}%</span>
                        </div>
                        <p className="text-sm text-slate-200 leading-relaxed opacity-90">
                            {advice.reasoning}
                        </p>
                    </div>

                    {advice.action === 'SWAP' && advice.targetToken && (
                        <div className="mt-4">
                            <button
                                onClick={() => onExecuteSwap(advice.targetToken!)}
                                className="w-full group flex items-center justify-center gap-3 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl font-bold shadow-lg shadow-emerald-900/50 transition-all active:scale-[0.98]"
                            >
                                <span>Transfer to {advice.targetToken}</span>
                                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                            </button>
                            <p className="text-center text-xs text-slate-500 mt-2">
                                Powered by Arc • 1s Settlement
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
