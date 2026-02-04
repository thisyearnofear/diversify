import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDiversifiAI, type AIAdvice } from '../../hooks/use-diversifi-ai';
import { useToast } from '../ui/Toast';
import { ChainDetectionService } from '../../services/swap/chain-detection.service';
import { useInflationData } from '../../hooks/use-inflation-data';
import { useAppState } from '../../context/AppStateContext';
import { useAIConversationOptional } from '../../context/AIConversationContext';
import VoiceButton from '../ui/VoiceButton';
import InteractiveAdviceCard from '../agent/InteractiveAdviceCard';
import type { AggregatedPortfolio } from '../../hooks/use-stablecoin-balances';
import type { RegionalInflationData } from '../../hooks/use-inflation-data';

import sdk from '@farcaster/miniapp-sdk';

interface AIAssistantProps {
    amount: number;
    holdings: string[];
    chainId?: number;
    inflationData?: unknown;
    /** When true, renders in compact embedded mode without header/footer for use within other cards */
    embedded?: boolean;
    onExecute?: (token: string) => void;
    aggregatedPortfolio?: AggregatedPortfolio;
}

export default function AIAssistant({
    amount,
    holdings,
    chainId,
    inflationData: propInflationData,
    embedded = false,
    onExecute,
    aggregatedPortfolio
}: AIAssistantProps) {
    const {
        advice,
        isAnalyzing,
        thinkingStep,
        analysisProgress,
        analyze,
        sendMessage,
        messages,
        autonomousStatus,
        capabilities,
        clearMessages,
        initializeAI,
        portfolioAnalysis
    } = useDiversifiAI();

    const { inflationData: liveInflationData } = useInflationData();
    const { showToast } = useToast();
    const { startTour, dismissTour, isTourDismissed } = useAppState();
    const globalConversation = useAIConversationOptional();
    const unreadCount = globalConversation?.unreadCount ?? 0;
    const markAsRead = globalConversation?.markAsRead;

    // Initialize AI on mount
    useEffect(() => {
        initializeAI();
    }, [initializeAI]);

    // Milestone haptics for Farcaster
    useEffect(() => {
        if (isAnalyzing && analysisProgress % 25 === 0 && analysisProgress > 0) {
            try {
                (sdk.actions as unknown as { hapticFeedback: (options: { type: string }) => void }).hapticFeedback({ type: 'light' });
            } catch { }
        }
        if (analysisProgress === 100) {
            try {
                (sdk.actions as unknown as { hapticFeedback: (options: { type: string }) => void }).hapticFeedback({ type: 'success' });
            } catch { }
        }
    }, [analysisProgress, isAnalyzing]);

    const handleExecuteRecommendation = (token: string, amount?: number) => {
        if (onExecute) {
            onExecute(token);
        } else {
            const amountText = amount ? ` ($${amount.toFixed(2)})` : '';
            showToast(`Initiating swap to ${token}${amountText}...`, 'info');
        }
    };

    const handleSelectAlternative = (alternative: AIAdvice) => {
        const token = alternative.token || alternative.targetToken;
        if (token) {
            showToast(`Switched to ${token} recommendation`, 'success');
            handleExecuteRecommendation(token, alternative.suggestedAmount);
        }
    };

    const handleAnalyze = () => {
        if (!capabilities.analysis) {
            showToast('AI Intelligence Hub is currently in maintenance mode (API not configured).', 'error');
            return;
        }
        showToast('Starting comprehensive wealth protection analysis...', 'ai', { cost: 0.05, sources: 5 });

        // Use live inflation data if available, otherwise fall back to prop
        const inflationDataToUse = (liveInflationData || propInflationData) as Record<string, RegionalInflationData>;

        // Build portfolio from holdings and amount
        const portfolio = aggregatedPortfolio || {
            totalValue: amount,
            chains: [],
            allHoldings: holdings,
            diversificationScore: 0,
        };

        analyze(inflationDataToUse, portfolio);
    };

    const handleVoiceTranscription = (transcription: string) => {
        try {
            (sdk.actions as unknown as { hapticFeedback: (options: { type: string }) => void }).hapticFeedback({ type: 'selection' });
        } catch { }
        sendMessage(transcription);
    };

    // Listen for voice queries from main page
    useEffect(() => {
        const handleVoiceQuery = (event: CustomEvent) => {
            sendMessage(event.detail);
        };
        
        window.addEventListener('voiceQuery', handleVoiceQuery as EventListener);
        return () => window.removeEventListener('voiceQuery', handleVoiceQuery as EventListener);
    }, [sendMessage]);

    // ============================================================================
    // EMBEDDED MODE: Compact rendering for integration within other cards
    // ============================================================================
    if (embedded) {
        return (
            <div className="pointer-events-auto">
                {/* Inline unread insights indicator */}
                {unreadCount > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-3 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-3 py-2"
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-blue-600 text-sm">💬</span>
                            <span className="text-xs font-bold text-blue-700">
                                {unreadCount} new insight{unreadCount !== 1 ? 's' : ''}
                            </span>
                        </div>
                        <button
                            onClick={() => markAsRead?.()}
                            className="text-[10px] font-bold text-blue-500 hover:text-blue-700 uppercase tracking-wide"
                        >
                            Mark read
                        </button>
                    </motion.div>
                )}
                <AnimatePresence mode="wait">
                    {/* Analysis Progress */}
                    {isAnalyzing && (
                        <motion.div
                            key="progress"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.05 }}
                            className="py-4"
                        >
                            <div className="flex items-center gap-4">
                                <div className="relative w-16 h-16 shrink-0">
                                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="10" className="text-gray-100" />
                                        <motion.circle
                                            cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="10"
                                            strokeLinecap="round" className="text-blue-600"
                                            initial={{ pathLength: 0 }}
                                            animate={{ pathLength: (analysisProgress || 0) / 100 }}
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-sm font-black text-blue-600">{analysisProgress}%</span>
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Analyzing</h4>
                                    <p className="text-sm text-blue-600 font-bold mt-1 truncate">{thinkingStep || 'Connecting...'}</p>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Analysis Results - Compact (with interactive card) */}
                    {advice && !isAnalyzing && (
                        <motion.div
                            key="advice"
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="space-y-3"
                        >
                            {/* Use Interactive Card for better UX */}
                            {(advice.alternatives?.length || advice.expandableReasoning) ? (
                                <InteractiveAdviceCard
                                    advice={advice}
                                    onSelectAlternative={handleSelectAlternative}
                                    onExecute={handleExecuteRecommendation}
                                />
                            ) : (
                                /* Fallback to original compact view */
                                <>
                            {/* AI Reasoning Quote */}
                            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                <p className="text-xs text-gray-700 font-medium leading-relaxed italic">
                                    &ldquo;{advice.reasoning}&rdquo;
                                </p>
                            </div>

                            {/* Projection Comparison */}
                            <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[10px] font-black uppercase text-gray-400">3-Year Projection</span>
                                    {portfolioAnalysis && (
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${portfolioAnalysis.diversificationScore > 70 ? 'bg-emerald-100 text-emerald-700' :
                                            portfolioAnalysis.diversificationScore > 40 ? 'bg-amber-100 text-amber-700' :
                                                'bg-red-100 text-red-700'
                                            }`}>
                                            Diversification: {portfolioAnalysis.diversificationScore}/100
                                        </span>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-gray-500 w-20 shrink-0">Current</span>
                                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{
                                                    width: `${advice.comparisonProjection ?
                                                        (advice.comparisonProjection.currentPathValue / amount) * 100 :
                                                        85}%`
                                                }}
                                                className="h-full bg-red-400"
                                            />
                                        </div>
                                        <span className="text-[10px] text-red-500 font-bold w-16 text-right">
                                            -${advice.comparisonProjection ?
                                                (amount - advice.comparisonProjection.currentPathValue).toFixed(0) :
                                                (amount * 0.15).toFixed(0)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-blue-600 w-20 shrink-0">Optimized</span>
                                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: '100%' }}
                                                className="h-full bg-gradient-to-r from-blue-500 to-emerald-500"
                                            />
                                        </div>
                                        <span className="text-[10px] text-emerald-600 font-bold w-16 text-right">
                                            +${advice.expectedSavings?.toFixed(0) ||
                                                (advice.comparisonProjection?.oraclePathValue ?
                                                    (advice.comparisonProjection.oraclePathValue - advice.comparisonProjection.currentPathValue).toFixed(0) :
                                                    (amount * 0.2).toFixed(0))}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Execute Button (only if action needed) */}
                            {advice.action !== 'HOLD' && advice.targetToken && (
                                <button
                                    onClick={() => handleExecuteRecommendation(advice.targetToken!)}
                                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                                >
                                    <span>Execute {advice.action} to {advice.targetToken}</span>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                                </button>
                            )}

                            {/* Guided Tour Recommendation (embedded mode) */}
                            {advice.guidedTour && !isTourDismissed(advice.guidedTour.tourId) && (
                                <div className="p-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200">
                                    <div className="flex items-start gap-2 mb-2">
                                        <span className="text-lg">🎯</span>
                                        <div className="flex-1">
                                            <h4 className="text-xs font-bold text-indigo-900">{advice.guidedTour.title}</h4>
                                            <p className="text-[10px] text-indigo-700 mt-1">{advice.guidedTour.description}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] text-indigo-600">💰 {advice.guidedTour.estimatedBenefit}</span>
                                        <span className="text-[10px] text-indigo-500">{advice.guidedTour.steps.length} steps</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                const tour = advice.guidedTour!;
                                                const firstStep = tour.steps[0];
                                                startTour(tour.tourId, tour.steps.length, firstStep.tab, firstStep.section);
                                                showToast(`Starting ${tour.title}`, 'info');
                                            }}
                                            className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold"
                                        >
                                            Start Tour
                                        </button>
                                        <button
                                            onClick={() => dismissTour(advice.guidedTour!.tourId)}
                                            className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold"
                                        >
                                            Skip
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Onramp Recommendation (embedded mode) */}
                            {(advice.action === 'BUY' || advice.action === 'SELL') && advice.onrampRecommendation && (
                                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-sm">{advice.action === 'BUY' ? '💳' : '💰'}</span>
                                        <span className="text-xs font-bold text-blue-800">
                                            {advice.onrampRecommendation.provider}
                                        </span>
                                    </div>
                                    <p className="text-xs text-blue-600 leading-relaxed">
                                        {advice.onrampRecommendation.reasoning}
                                    </p>
                                </div>
                            )}

                            {/* Hold State */}
                            {advice.action === 'HOLD' && (
                                <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                                    <span className="text-lg">🛡️</span>
                                    <span className="text-sm font-bold text-emerald-800">Portfolio well-protected</span>
                                </div>
                            )}
                            </>
                            )}
                        </motion.div>
                    )}

                    {/* Initial State - Run Analysis with Voice Option */}
                    {!advice && !isAnalyzing && (
                        <motion.div
                            key="initial"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center py-4"
                        >
                            {/* Inline Conversation Display */}
                            {messages.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mb-4 space-y-2 max-h-48 overflow-y-auto custom-scrollbar"
                                >
                                    {messages.slice(-3).map((msg, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.1 }}
                                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div
                                                className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs ${
                                                    msg.role === 'user'
                                                        ? 'bg-blue-600 text-white rounded-br-md'
                                                        : 'bg-gray-100 text-gray-800 rounded-bl-md'
                                                }`}
                                            >
                                                {msg.content.length > 120 
                                                    ? msg.content.slice(0, 120) + '...'
                                                    : msg.content
                                                }
                                            </div>
                                        </motion.div>
                                    ))}
                                    {messages.length > 3 && (
                                        <div className="text-[9px] text-gray-400 text-center">
                                            {messages.length - 3} earlier messages
                                        </div>
                                    )}
                                </motion.div>
                            )}

                            <div className="flex items-center gap-2 mb-3">
                                <button
                                    onClick={() => {
                                        if (!capabilities.analysis) {
                                            showToast('AI Intelligence Hub unavailable', 'error');
                                            return;
                                        }
                                        const networkName = ChainDetectionService.getNetworkName(chainId ?? null);
                                        analyze(
                                            (liveInflationData || propInflationData) as Record<string, RegionalInflationData>,
                                            amount,
                                            holdings,
                                            { chainId: chainId || 0, name: networkName },
                                            undefined,
                                            aggregatedPortfolio
                                        );
                                    }}
                                    disabled={!capabilities.analysis}
                                    className={`flex-1 py-4 px-6 rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${capabilities.analysis
                                        ? "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20"
                                        : "bg-gray-200 text-gray-500 cursor-not-allowed"
                                        }`}
                                >
                                    <span>{capabilities.analysis ? 'Run Analysis' : 'AI Unavailable'}</span>
                                    {capabilities.analysis && <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">$0.05</span>}
                                </button>

                                {/* Voice Query Button */}
                                <VoiceButton
                                    onTranscription={handleVoiceTranscription}
                                    size="lg"
                                    variant="embedded"
                                />
                            </div>

                            {messages.length === 0 ? (
                                <p className="text-[10px] text-gray-400">
                                    Analyzes ${amount.toFixed(2)} against real-time global inflation data
                                </p>
                            ) : (
                                <button
                                    onClick={clearMessages}
                                    className="text-[10px] text-gray-400 hover:text-gray-600 underline"
                                >
                                    Clear conversation
                                </button>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    // ============================================================================
    // FULL MODE: Standalone card with header/footer
    // ============================================================================
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
                            <h3 className="text-white font-black text-sm tracking-tight uppercase leading-none">AI Assistant</h3>
                            <div className="flex items-center gap-1.5 mt-1">
                                <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider">AI</span>
                                <div className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-black/20 border border-white/10">
                                    <div className="w-1 h-1 rounded-full bg-blue-400 animate-pulse" />
                                    <span className="text-[9px] font-mono text-blue-100">AI Assistant</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <VoiceButton
                            onTranscription={handleVoiceTranscription}
                            size="md"
                            variant="header"
                        />

                        {autonomousStatus?.enabled && (
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
                                    <h4 className="font-bold text-gray-800 dark:text-white uppercase tracking-widest text-xs">Analyzing</h4>
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
                                                {portfolioAnalysis ? `Inflation Risk: ${portfolioAnalysis.weightedInflationRisk.toFixed(1)}%` : 'Protection Model'}
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
                                                        animate={{
                                                            width: `${advice.comparisonProjection ?
                                                                (advice.comparisonProjection.currentPathValue / amount) * 100 :
                                                                85}%`
                                                        }}
                                                        className="h-full bg-red-400"
                                                    />
                                                </div>
                                                <div className="text-[9px] text-gray-400">
                                                    Value: ${advice.comparisonProjection?.currentPathValue.toFixed(2) || (amount * 0.85).toFixed(2)}
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <div className="flex justify-between text-[10px] font-bold">
                                                    <span className="text-blue-600">Optimized Path</span>
                                                    <span className="text-green-600">
                                                        +${advice.expectedSavings?.toFixed(2) || (advice.comparisonProjection?.oraclePathValue ?
                                                            (advice.comparisonProjection.oraclePathValue - advice.comparisonProjection.currentPathValue).toFixed(2) :
                                                            (amount * 0.2).toFixed(2))}
                                                    </span>
                                                </div>
                                                <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{
                                                            width: `${advice.comparisonProjection?.oraclePathValue ?
                                                                (advice.comparisonProjection.oraclePathValue / amount) * 100 :
                                                                100}%`
                                                        }}
                                                        className="h-full bg-gradient-to-r from-blue-500 to-emerald-500"
                                                    />
                                                </div>
                                                <div className="text-[9px] text-gray-400">
                                                    Value: ${advice.comparisonProjection?.oraclePathValue?.toFixed(2) || amount.toFixed(2)}
                                                </div>
                                            </div>
                                        </div>

                                        {portfolioAnalysis && (
                                            <div className="mt-3 pt-3 border-t border-gray-100">
                                                <div className="flex justify-between text-[10px]">
                                                    <span className="text-gray-500">Diversification Score</span>
                                                    <span className={`font-bold ${portfolioAnalysis.diversificationScore > 70 ? 'text-emerald-600' :
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

                                    {/* Onramp Recommendation for BUY/SELL actions */}
                                    {(advice.action === 'BUY' || advice.action === 'SELL') && advice.onrampRecommendation && (
                                        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-500/20">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-lg">{advice.action === 'BUY' ? '💳' : '💰'}</span>
                                                <h4 className="font-bold text-blue-800 dark:text-blue-200 text-sm">
                                                    {advice.action === 'BUY' ? 'Recommended Onramp' : 'Recommended Offramp'}
                                                </h4>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                                                        {advice.onrampRecommendation.provider}
                                                    </span>
                                                    {advice.onrampRecommendation.amount && (
                                                        <span className="text-xs bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                                                            {advice.onrampRecommendation.amount}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-blue-600 dark:text-blue-400">
                                                    {advice.onrampRecommendation.reasoning}
                                                </p>
                                                {advice.onrampRecommendation.paymentMethod && (
                                                    <div className="text-xs text-blue-500 dark:text-blue-400">
                                                        <span className="font-medium">Payment:</span> {advice.onrampRecommendation.paymentMethod}
                                                    </div>
                                                )}
                                                {advice.onrampRecommendation.alternatives && advice.onrampRecommendation.alternatives.length > 0 && (
                                                    <div className="text-xs text-blue-500 dark:text-blue-400">
                                                        <span className="font-medium">Alternatives:</span> {advice.onrampRecommendation.alternatives.join(', ')}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Portfolio Analysis Summary */}
                                    {advice.portfolioAnalysis && (
                                        <div className="mt-4 pt-4 border-t border-gray-200">
                                            <h5 className="text-[10px] font-black uppercase text-gray-400 mb-2">Analysis Factors</h5>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="bg-gray-50 rounded-lg p-2">
                                                    <div className="text-[9px] text-gray-500">Inflation Risk</div>
                                                    <div className={`text-sm font-bold ${advice.portfolioAnalysis.weightedInflationRisk > 5 ? 'text-red-600' :
                                                        advice.portfolioAnalysis.weightedInflationRisk > 3 ? 'text-amber-600' :
                                                            'text-green-600'
                                                        }`}>
                                                        {advice.portfolioAnalysis.weightedInflationRisk.toFixed(1)}%
                                                    </div>
                                                </div>
                                                <div className="bg-gray-50 rounded-lg p-2">
                                                    <div className="text-[9px] text-gray-500">Diversification</div>
                                                    <div className={`text-sm font-bold ${advice.portfolioAnalysis.diversificationScore > 70 ? 'text-green-600' :
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
                                                            (+${advice.portfolioAnalysis.topOpportunity.annualSavings?.toFixed(2) ?? advice.portfolioAnalysis.topOpportunity.potentialSavings.toFixed(2)}/year)
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {amount === 0 && (
                                        <button
                                            onClick={clearMessages}
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
                            {/* Inline Conversation Display */}
                            {messages.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar"
                                >
                                    {messages.slice(-5).map((msg, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.1 }}
                                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div
                                                className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm ${
                                                    msg.role === 'user'
                                                        ? 'bg-blue-600 text-white rounded-br-md'
                                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-bl-md'
                                                }`}
                                            >
                                                {msg.content}
                                            </div>
                                        </motion.div>
                                    ))}
                                    {messages.length > 5 && (
                                        <div className="text-xs text-gray-400 text-center">
                                            {messages.length - 5} earlier messages
                                        </div>
                                    )}
                                    <button
                                        onClick={clearMessages}
                                        className="w-full text-xs text-gray-400 hover:text-gray-600 py-2"
                                    >
                                        Clear conversation
                                    </button>
                                </motion.div>
                            )}

                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-5 border border-blue-100 dark:border-blue-500/20 relative overflow-hidden">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="text-blue-800 dark:text-blue-100 font-black text-base leading-tight">
                                        {messages.length > 0 ? 'Ask me anything' : (amount > 0 ? 'Universal Wealth Protection' : 'Simulation')}
                                    </h4>
                                    {amount === 0 && messages.length === 0 && (
                                        <span className="bg-blue-600 text-white text-[8px] font-black uppercase px-1.5 py-0.5 rounded tracking-tighter shadow-sm">Sim Mode</span>
                                    )}
                                </div>
                                <p className="text-blue-700/80 dark:text-blue-200/60 text-xs font-bold leading-relaxed mb-4">
                                    {messages.length > 0 
                                        ? "I can analyze your portfolio, explain inflation data, or help you understand wealth protection strategies."
                                        : (capabilities.analysis
                                            ? amount > 0
                                                ? `Analyze your $${amount.toFixed(2)} portfolio against real-time global inflation data.`
                                                : "No assets detected. Let's run a simulation ($1,000) to see how DiversiFi protects your wealth."
                                            : "Wealth analysis engine is currently undergoing maintenance."
                                        )
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
                <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => handleExecuteRecommendation(advice?.targetToken || 'PAXG')}><span className="text-xl">⚡</span><span className="text-[8px] font-black uppercase tracking-tighter">Swap</span></div>
                <div className="flex flex-col items-center gap-1 opacity-50"><span className="text-xl">⚙️</span><span className="text-[8px] font-black uppercase tracking-tighter">Config</span></div>
            </div>
        </div>
    );
}
