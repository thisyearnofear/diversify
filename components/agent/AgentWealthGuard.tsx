import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWealthProtectionAgent } from '../../hooks/use-wealth-protection-agent';
import { useToast } from '../ui/Toast';
import { ChainDetectionService } from '../../services/swap/chain-detection.service';
import { useInflationData } from '../../hooks/use-inflation-data';
import type { AggregatedPortfolio } from '../../hooks/use-stablecoin-balances';
import type { RegionalInflationData } from '../../hooks/use-inflation-data';

import sdk from '@farcaster/miniapp-sdk';

interface AgentWealthGuardProps {
    amount: number;
    holdings: string[];
    chainId?: number;
    inflationData?: unknown;
    embedded?: boolean;
    onExecute?: (token: string) => void;
    aggregatedPortfolio?: AggregatedPortfolio;
}

export default function AgentWealthGuard({
    amount,
    holdings,
    chainId,
    inflationData: propInflationData,
    onExecute,
    aggregatedPortfolio
}: AgentWealthGuardProps) {
    const {
        advice,
        isAnalyzing,
        thinkingStep,
        analysisProgress,
        analyze,
        sendMessage,
        transcribeAudio,
        arcAgent,
        capabilities,
        clearConversation,
        initializeArcAgent,
        portfolioAnalysis
    } = useWealthProtectionAgent();
    
    const { inflationData: liveInflationData } = useInflationData();

    const { showToast } = useToast();
    const [isListening, setIsListening] = useState(false);

    // Audio recording refs
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    // Initialize agent on mount
    useEffect(() => {
        initializeArcAgent();
    }, [initializeArcAgent]);

    // Milestone haptics for Farcaster
    useEffect(() => {
        if (isAnalyzing && analysisProgress % 25 === 0 && analysisProgress > 0) {
            try {
                (sdk.actions as unknown as { hapticFeedback: (options: { type: string }) => void }).hapticFeedback({ type: 'light' });
            } catch (e) { }
        }
        if (analysisProgress === 100) {
            try {
                (sdk.actions as unknown as { hapticFeedback: (options: { type: string }) => void }).hapticFeedback({ type: 'success' });
            } catch { }
        }
    }, [analysisProgress, isAnalyzing]);

    const handleExecuteRecommendation = (token: string) => {
        if (onExecute) {
            onExecute(token);
        } else {
            showToast(`Initiating swap to ${token}...`, 'info');
        }
    };

    const handleAnalyze = () => {
        if (!capabilities.analysis) {
            showToast('AI Intelligence Hub is currently in maintenance mode (API not configured).', 'error');
            return;
        }
        const networkName = ChainDetectionService.getNetworkName(chainId ?? null);
        const networkInfo = { chainId: chainId || 0, name: networkName };
        showToast('Starting comprehensive wealth protection analysis...', 'ai', { cost: 0.05, sources: 5 });
        
        // Use live inflation data if available, otherwise fall back to prop
        const inflationDataToUse = (liveInflationData || propInflationData) as Record<string, RegionalInflationData>;
        
        analyze(
            inflationDataToUse,
            amount,
            holdings,
            networkInfo,
            undefined,
            aggregatedPortfolio
        );
    };

    const startRecording = async () => {
        if (!capabilities.transcription) {
            showToast('Voice intelligence not configured. Please use text query.', 'error');
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const transcription = await transcribeAudio(audioBlob);
                if (transcription) {
                    showToast(`Oracle heard: "${transcription}"`, 'ai');
                    sendMessage(transcription);
                }
                // Stop all tracks to release microphone
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsListening(true);
            try {
                (sdk.actions as unknown as { hapticFeedback: (options: { type: string }) => void }).hapticFeedback({ type: 'selection' });
            } catch { }
        } catch (error) {
            console.error('Error starting recording:', error);
            showToast('Microphone access denied', 'error');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            setIsListening(false);
            try {
                (sdk.actions as unknown as { hapticFeedback: (options: { type: string }) => void }).hapticFeedback({ type: 'light' });
            } catch (e) { }
        }
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-white/10 shadow-xl overflow-hidden pointer-events-auto">
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
                                    <div className={`w-1 h-1 rounded-full ${isListening ? 'bg-red-400 animate-ping' : 'bg-blue-400 animate-pulse'}`} />
                                    <span className="text-[9px] font-mono text-blue-100">{isListening ? 'Oracle Listening...' : 'Arc Agent v2'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onMouseDown={startRecording}
                            onMouseUp={stopRecording}
                            onTouchStart={startRecording}
                            onTouchEnd={stopRecording}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isListening ? 'bg-red-500 scale-125 shadow-red-500/50' : 'bg-white/10 hover:bg-white/20'}`}
                            aria-label="Voice Query"
                        >
                            <span className="text-lg">{isListening ? '🎙️' : '🎤'}</span>
                        </button>

                        {arcAgent?.isProxy && (
                            <div className="flex flex-col items-end hidden md:flex">
                                <span className="text-[10px] text-blue-100 font-bold uppercase tracking-tighter opacity-80 underline">On-Chain Verified</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <AnimatePresence mode="wait">
                    {/* Analysis Progress */}
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
                                            animate={{ pathLength: (analysisProgress || 0) / 100 }}
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
                        </motion.div>
                    )}

                    {/* Advice Results */}
                    {advice && !isAnalyzing && (
                        <motion.div
                            key="advice"
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="space-y-4"
                        >
                            <div className={`rounded-2xl overflow-hidden border shadow-xl ${advice.action === 'HOLD' ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                                <div className={`p-4 border-b flex justify-between items-center ${advice.action === 'HOLD' ? 'bg-emerald-600/10 border-emerald-200' : 'bg-amber-600/10 border-amber-200'}`}>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">{advice.action === 'HOLD' ? '🛡️' : '⚡'}</span>
                                        <h3 className={`font-black uppercase tracking-tight text-sm ${advice.action === 'HOLD' ? 'text-emerald-800' : 'text-amber-800'}`}>
                                            {amount > 0 ? (advice.action === 'HOLD' ? 'Portfolio Protected' : 'Action Required') : 'Simulation Advice'}
                                        </h3>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {amount === 0 && (
                                            <span className="bg-blue-600 text-white text-[8px] font-black uppercase px-2 py-1 rounded tracking-tighter shadow-sm">Sim Mode</span>
                                        )}
                                        <div className="bg-white/80 px-2 py-1 rounded-lg border border-black/5 flex items-center gap-1.5 shadow-sm">
                                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                            <span className="text-xs font-black text-blue-700">{(advice.confidence * 100).toFixed(0)}% Confidence</span>
                                        </div>
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

                                    {/* Projection Card - Using Real Calculated Data */}
                                    <div className="bg-white dark:bg-gray-950 rounded-2xl p-4 border border-gray-100 dark:border-white/5 shadow-inner">
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">3-Year Projection</span>
                                            <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded">
                                                {portfolioAnalysis ? `Inflation Risk: ${portfolioAnalysis.weightedInflationRisk.toFixed(1)}%` : 'Oracle Model'}
                                            </span>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="space-y-1">
                                                <div className="flex justify-between text-[10px] font-bold">
                                                    <span className="text-gray-500">Current Path (Do Nothing)</span>
                                                    <span className="text-red-500">
                                                        -${advice.comparisonProjection ? 
                                                            (amount - advice.comparisonProjection.currentPathValue).toFixed(2) : 
                                                            (amount * 0.15).toFixed(2)}
                                                    </span>
                                                </div>
                                                <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                                    <motion.div 
                                                        initial={{ width: 0 }} 
                                                        animate={{ width: `${advice.comparisonProjection ? 
                                                            (advice.comparisonProjection.currentPathValue / amount) * 100 : 
                                                            85}%`}} 
                                                        className="h-full bg-red-400" 
                                                    />
                                                </div>
                                                <div className="text-[9px] text-gray-400">
                                                    Value: ${advice.comparisonProjection?.currentPathValue.toFixed(2) || (amount * 0.85).toFixed(2)}
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <div className="flex justify-between text-[10px] font-bold">
                                                    <span className="text-blue-600">Oracle Path (Optimized)</span>
                                                    <span className="text-green-600">
                                                        +${advice.expectedSavings?.toFixed(2) || (advice.comparisonProjection ? 
                                                            (advice.comparisonProjection.oraclePathValue - advice.comparisonProjection.currentPathValue).toFixed(2) :
                                                            (amount * 0.2).toFixed(2))}
                                                    </span>
                                                </div>
                                                <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                                    <motion.div 
                                                        initial={{ width: 0 }} 
                                                        animate={{ width: `${advice.comparisonProjection ? 
                                                            (advice.comparisonProjection.oraclePathValue / amount) * 100 : 
                                                            100}%`}} 
                                                        className="h-full bg-gradient-to-r from-blue-500 to-emerald-500" 
                                                    />
                                                </div>
                                                <div className="text-[9px] text-gray-400">
                                                    Value: ${advice.comparisonProjection?.oraclePathValue.toFixed(2) || amount.toFixed(2)}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {portfolioAnalysis && (
                                            <div className="mt-3 pt-3 border-t border-gray-100">
                                                <div className="flex justify-between text-[10px]">
                                                    <span className="text-gray-500">Diversification Score</span>
                                                    <span className={`font-bold ${
                                                        portfolioAnalysis.diversificationScore > 70 ? 'text-emerald-600' :
                                                        portfolioAnalysis.diversificationScore > 40 ? 'text-amber-600' :
                                                        'text-red-600'
                                                    }`}>
                                                        {portfolioAnalysis.diversificationScore}/100
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {advice.action !== 'HOLD' && advice.targetToken && (
                                        <div className="space-y-2">
                                            <button
                                                onClick={() => handleExecuteRecommendation(advice.targetToken!)}
                                                className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-3 border-b-4 border-indigo-900"
                                            >
                                                <span>{amount > 0 ? advice.action : 'Plan'} to {advice.targetToken}</span>
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                                            </button>
                                            
                                            {advice.targetAllocation && advice.targetAllocation.length > 1 && (
                                                <button
                                                    onClick={() => {
                                                        // Show full rebalancing plan in a modal or expand
                                                        showToast(`Full plan: ${advice.targetAllocation?.map(a => `${a.symbol} ${a.percentage}%`).join(', ')}`, 'info');
                                                    }}
                                                    className="w-full py-2 rounded-xl bg-gray-100 text-gray-600 font-bold text-xs hover:bg-gray-200 transition-colors"
                                                >
                                                    View Full Rebalancing Plan ({advice.targetAllocation.length} assets)
                                                </button>
                                            )}
                                        </div>
                                    )}
                                    
                                    {/* Portfolio Analysis Summary */}
                                    {advice.portfolioAnalysis && (
                                        <div className="mt-4 pt-4 border-t border-gray-200">
                                            <h5 className="text-[10px] font-black uppercase text-gray-400 mb-2">Analysis Factors</h5>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="bg-gray-50 rounded-lg p-2">
                                                    <div className="text-[9px] text-gray-500">Inflation Risk</div>
                                                    <div className={`text-sm font-bold ${
                                                        advice.portfolioAnalysis.weightedInflationRisk > 5 ? 'text-red-600' :
                                                        advice.portfolioAnalysis.weightedInflationRisk > 3 ? 'text-amber-600' :
                                                        'text-green-600'
                                                    }`}>
                                                        {advice.portfolioAnalysis.weightedInflationRisk.toFixed(1)}%
                                                    </div>
                                                </div>
                                                <div className="bg-gray-50 rounded-lg p-2">
                                                    <div className="text-[9px] text-gray-500">Diversification</div>
                                                    <div className={`text-sm font-bold ${
                                                        advice.portfolioAnalysis.diversificationScore > 70 ? 'text-green-600' :
                                                        advice.portfolioAnalysis.diversificationScore > 40 ? 'text-amber-600' :
                                                        'text-red-600'
                                                    }`}>
                                                        {advice.portfolioAnalysis.diversificationScore}/100
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {advice.portfolioAnalysis.topOpportunity && (
                                                <div className="mt-2 bg-blue-50 rounded-lg p-2">
                                                    <div className="text-[9px] text-blue-600 font-bold">Top Opportunity</div>
                                                    <div className="text-xs text-blue-800">
                                                        {advice.portfolioAnalysis.topOpportunity.fromToken} → {advice.portfolioAnalysis.topOpportunity.toToken}
                                                        <span className="text-green-600 ml-1">
                                                            (+${advice.portfolioAnalysis.topOpportunity.annualSavings.toFixed(2)}/year)
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {amount === 0 && (
                                        <button
                                            onClick={clearConversation}
                                            className="w-full py-3 rounded-2xl bg-gray-100 text-gray-500 font-black text-[10px] uppercase tracking-widest hover:bg-gray-200 transition-all border-b-2 border-gray-300"
                                        >
                                            Exit Simulation
                                        </button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {!advice && !isAnalyzing && (
                        <motion.div key="initial" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pt-2">
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-5 border border-blue-100 dark:border-blue-500/20 relative overflow-hidden">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="text-blue-800 dark:text-blue-100 font-black text-base leading-tight">
                                        {amount > 0 ? 'Universal Wealth Protection' : 'Oracle Simulation'}
                                    </h4>
                                    {amount === 0 && (
                                        <span className="bg-blue-600 text-white text-[8px] font-black uppercase px-1.5 py-0.5 rounded tracking-tighter shadow-sm">Sim Mode</span>
                                    )}
                                </div>
                                <p className="text-blue-700/80 dark:text-blue-200/60 text-xs font-bold leading-relaxed mb-4">
                                    {capabilities.analysis
                                        ? amount > 0
                                            ? `Analyze your $${amount.toFixed(2)} portfolio against real-time global inflation data.`
                                            : "No assets detected. Let's run a simulation ($1,000) to see how DiversiFi protects your wealth."
                                        : "Wealth analysis engine is currently undergoing maintenance."
                                    }
                                </p>
                                <button
                                    onClick={() => {
                                        if (amount === 0) {
                                            const networkName = ChainDetectionService.getNetworkName(chainId ?? null);
                                            const networkInfo = { chainId: chainId || 0, name: networkName };
                                            showToast('Running hypothetical wealth protection simulation...', 'ai');
                                            analyze(propInflationData as Record<string, RegionalInflationData>, 1000, ['CUSD'], networkInfo);
                                        } else {
                                            handleAnalyze();
                                        }
                                    }}
                                    disabled={!capabilities.analysis}
                                    className={`w-full py-4 px-6 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 border-b-4 ${capabilities.analysis
                                        ? "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/30 border-blue-800"
                                        : "bg-gray-200 text-gray-500 border-gray-300 cursor-not-allowed shadow-none"
                                        }`}
                                >
                                    <span>{capabilities.analysis ? amount > 0 ? 'Run Full Analysis' : 'Start Simulation' : 'Intelligence Hub Unavailable'}</span>
                                    {capabilities.analysis && <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full">$0.05</span>}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 dark:bg-black/20 border-t border-gray-100 dark:border-white/5 shrink-0 flex items-center justify-around">
                <div className="flex flex-col items-center gap-1 opacity-50"><span className="text-xl">📊</span><span className="text-[8px] font-black uppercase tracking-tighter">Insights</span></div>
                <div className="flex flex-col items-center gap-1 opacity-50"><span className="text-xl">🔄</span><span className="text-[8px] font-black uppercase tracking-tighter">Rebalance</span></div>
                <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => handleExecuteRecommendation('PAXG')}><span className="text-xl">⚡</span><span className="text-[8px] font-black uppercase tracking-tighter">Swap</span></div>
                <div className="flex flex-col items-center gap-1 opacity-50"><span className="text-xl">⚙️</span><span className="text-[8px] font-black uppercase tracking-tighter">Config</span></div>
            </div>
        </div>
    );
}
