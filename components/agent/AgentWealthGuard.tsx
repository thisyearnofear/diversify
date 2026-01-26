import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWealthProtectionAgent, RiskTolerance } from "../../hooks/use-wealth-protection-agent";
import { useInflationData } from "../../hooks/use-inflation-data";
import { useWalletContext } from "../wallet/WalletProvider";
import { useAppState } from "../../context/AppStateContext";
import { NETWORKS } from "../../config";
import { ChainDetectionService } from "../../services/swap/chain-detection.service";
import { useToast } from "../ui/Toast";

interface AgentWealthGuardProps {
    amount: number;
    holdings: string[];
    embedded?: boolean;
}

// Mobile-first AI Chat Bubble Component
const AIChatBubble = ({ onClick, hasNewInsight }: { onClick: () => void; hasNewInsight: boolean }) => (
    <motion.button
        className="fixed bottom-4 right-4 w-14 h-14 bg-blue-600 rounded-full shadow-lg z-50 flex items-center justify-center"
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
    >
        <span className="text-2xl">🧠</span>
        {hasNewInsight && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse" />
        )}
    </motion.button>
);

// Compact AI Hint Component
const AIHint = ({ suggestion, onAskAI }: { suggestion: string; onAskAI: () => void }) => (
    <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-blue-50 border-l-2 border-blue-400 p-2 mb-3 rounded-r text-xs"
    >
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
                <span className="text-blue-600">💡</span>
                <span className="font-medium text-blue-800">{suggestion}</span>
            </div>
            <button
                onClick={onAskAI}
                className="text-blue-600 text-xs px-2 py-1 bg-blue-100 rounded hover:bg-blue-200 transition-colors"
            >
                Ask AI
            </button>
        </div>
    </motion.div>
);

// Mobile-optimized progress indicator with real-time steps
const AIProgress = ({ currentStep, steps, progress }: {
    currentStep: string;
    steps: string[];
    progress: number;
}) => (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 mb-4 border border-blue-100">
        {/* Header with animated brain */}
        <div className="flex items-center gap-3 mb-4">
            <motion.div
                className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center"
                animate={{
                    scale: [1, 1.1, 1],
                    rotate: [0, 5, -5, 0]
                }}
                transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
            >
                <span className="text-xl">🧠</span>
            </motion.div>
            <div>
                <h4 className="font-bold text-gray-900">DiversiFi Oracle Processing</h4>
                <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                        />
                    </div>
                    <span className="text-xs font-medium text-gray-600">{progress}%</span>
                </div>
            </div>
        </div>

        {/* Current step with animation */}
        <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-lg p-3 mb-3 border border-blue-200"
        >
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-gray-800">{currentStep}</span>
            </div>
        </motion.div>

        {/* Step history */}
        <div className="space-y-1">
            {steps.slice(-3).map((step, idx) => (
                <motion.div
                    key={`${step}-${idx}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-2 text-xs text-gray-600"
                >
                    <span className="text-green-500">✓</span>
                    <span className="truncate">{step}</span>
                </motion.div>
            ))}
        </div>

        {/* Cost tracker */}
        <div className="mt-3 pt-3 border-t border-blue-100">
            <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">Analysis Cost</span>
                <span className="font-mono text-blue-600">$0.43 USDC</span>
            </div>
        </div>
    </div>
);

export default function AgentWealthGuard({ amount, holdings, embedded = false }: AgentWealthGuardProps) {
    const hookResult = useWealthProtectionAgent();
    const {
        analyze, advice, isAnalyzing, thinkingStep, analysisSteps, analysisProgress, config, updateConfig,
        sendMessage
    } = hookResult;
    const { inflationData } = useInflationData();
    const { navigateToSwap } = useAppState();
    const [showConfig, setShowConfig] = useState(false);
    const [isOpen, setIsOpen] = useState(embedded); // Default to open if embedded
    const [showHint] = useState(true);
    const { chainId } = useWalletContext();
    const [isVisionLoading, setIsVisionLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { showToast } = useToast();

    // Navigate to swap with AI recommendation pre-filled
    const handleExecuteRecommendation = (targetToken: string) => {
        // Determine source token based on current holdings
        const sourceToken = holdings.length > 0 ? holdings[0] : 'CUSD';
        navigateToSwap({
            fromToken: sourceToken,
            toToken: targetToken,
            amount: amount.toString(),
            reason: advice?.reasoning,
        });
    };

    if (!inflationData) return null;

    const handleAnalyze = () => {
        const networkName = ChainDetectionService.getNetworkName(chainId);
        const networkInfo = { chainId: chainId || 0, name: networkName };
        showToast('Starting comprehensive wealth protection analysis...', 'ai', { cost: 0.43, sources: 5 });
        analyze(
            inflationData,
            amount,
            holdings,
            networkInfo
        );
    };

    // Get network info for display
    const networkName = ChainDetectionService.getNetworkName(chainId);
    const networkInfo = { chainId: chainId || 0, name: networkName };

    const handleVisionAnalysis = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsVisionLoading(true);
        showToast('Analyzing portfolio screenshot with Gemini Vision...', 'ai', { cost: 0.05, sources: 1 });

        const reader = new FileReader();
        reader.onloadend = async () => {
            try {
                const base64 = reader.result as string;
                const response = await fetch('/api/agent/vision', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: base64 })
                });
                const data = await response.json();

                // Show as an AI message
                setIsOpen(true); // Open modal to show result
                // Since sendMessage only takes content, we just send the text
                sendMessage(data.text);
                showToast('Portfolio analysis complete!', 'success');
                setIsVisionLoading(false);
            } catch (err) {
                console.error("Vision failed:", err);
                showToast('Vision analysis failed. Please try again.', 'error');
                setIsVisionLoading(false);
            }
        };
        reader.readAsDataURL(file);
    };

    const hasNewInsight = advice && !isAnalyzing;

    // Mobile-first: Show compact hint by default, full interface on demand
    // ONLY if not embedded. If embedded, we skip this check and render the full UI.
    if (!embedded) {
        if (!isOpen && showHint && !!hasNewInsight) {
            return (
                <>
                    <AIHint
                        suggestion={`${advice?.action === 'SWAP' ? '⚡' : '🛡️'} ${advice?.reasoning.slice(0, 50)}...`}
                        onAskAI={() => setIsOpen(true)}
                    />
                    <AIChatBubble onClick={() => setIsOpen(true)} hasNewInsight={!!hasNewInsight} />
                </>
            );
        }

        // Floating chat bubble when closed
        if (!isOpen) {
            return <AIChatBubble onClick={() => setIsOpen(true)} hasNewInsight={!!hasNewInsight} />;
        }
    }

    // Full interface (slide-up modal on mobile, compact card on desktop)
    // If embedded, remove fixed positioning and modal behavior
    const containerClasses = embedded
        ? "w-full bg-white rounded-xl shadow-sm border border-gray-100"
        : "fixed inset-x-0 bottom-0 h-[70vh] bg-white rounded-t-2xl shadow-2xl z-50 md:relative md:h-auto md:rounded-2xl md:bg-gradient-to-br md:from-[#0F172A] md:to-[#1E293B] md:text-white";

    return (
        <AnimatePresence>
            <motion.div
                initial={embedded ? { opacity: 0 } : { y: "100%" }}
                animate={embedded ? { opacity: 1 } : { y: 0 }}
                exit={embedded ? { opacity: 0 } : { y: "100%" }}
                className={containerClasses}
            >
                {/* Mobile Header */}
                <div className={`flex items-center justify-between p-4 border-b ${embedded ? 'border-gray-100' : 'md:border-none'}`}>
                    <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center ${!embedded ? 'md:w-12 md:h-12 md:bg-blue-600/10' : ''}`}>
                            <motion.span
                                className={`text-xl ${!embedded ? 'md:text-2xl' : ''}`}
                                animate={isAnalyzing ? { rotate: 360 } : {}}
                                transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
                            >
                                🧠
                            </motion.span>
                        </div>
                        <div>
                            <h3 className={`font-semibold text-sm ${!embedded ? 'md:text-xl md:font-black md:bg-clip-text md:text-transparent md:bg-gradient-to-r md:from-white md:to-blue-200' : 'text-gray-900'}`}>
                                DiversiFi Oracle
                            </h3>
                            <div className="flex items-center gap-2">
                                <span className="text-xs px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                    Arc Agent v2
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleVisionAnalysis}
                            accept="image/*"
                            className="hidden"
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isVisionLoading}
                            className={`p-2 rounded-lg transition-all ${isVisionLoading ? 'animate-pulse bg-blue-500/20' : `hover:bg-gray-100 ${!embedded ? 'md:hover:bg-white/5' : ''}`} text-blue-500`}
                            title="Scan Portfolio Screenshot (Gemini Vision)"
                        >
                            {isVisionLoading ? (
                                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            )}
                        </button>
                        <button
                            onClick={() => setShowConfig(!showConfig)}
                            className={`p-2 rounded-lg transition-colors text-gray-400 hover:bg-gray-100 ${!embedded ? 'md:hover:bg-white/5' : ''}`}
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                            </svg>
                        </button>
                        {!embedded && (
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-2 rounded-lg transition-colors text-gray-400 hover:bg-gray-100 md:hover:bg-white/5"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>

                {/* Configuration Panel - Mobile Optimized */}
                <AnimatePresence>
                    {showConfig && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className={`overflow-hidden border-b ${embedded ? 'border-gray-100' : 'md:border-none'}`}
                        >
                            <div className={`p-4 space-y-3 bg-gray-50 ${!embedded ? 'md:bg-white/5 md:rounded-xl md:border md:border-white/10' : ''}`}>
                                <div>
                                    <label className={`text-xs font-bold text-gray-600 ${!embedded ? 'md:text-slate-400' : ''} uppercase mb-2 block`}>Risk Tolerance</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {(['Conservative', 'Balanced', 'Aggressive'] as RiskTolerance[]).map(t => (
                                            <button
                                                key={t}
                                                onClick={() => updateConfig({ riskTolerance: t })}
                                                className={`px-2 py-1.5 rounded-md text-xs font-bold transition-all ${config.riskTolerance === t
                                                    ? 'bg-blue-600 text-white shadow-lg'
                                                    : `bg-white text-gray-600 hover:bg-gray-100 ${!embedded ? 'md:bg-white/5 md:text-slate-400 md:hover:bg-white/10' : ''}`
                                                    }`}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto p-4">
                    {/* Analysis Progress */}
                    {isAnalyzing && (
                        <AIProgress
                            currentStep={thinkingStep}
                            steps={analysisSteps}
                            progress={analysisProgress}
                        />
                    )}

                    {/* Recommendation Display */}
                    {advice && !isAnalyzing && (
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="space-y-4"
                        >
                            <div className={`rounded-xl p-4 border shadow-lg ${advice.action === 'SWAP'
                                ? `bg-amber-50 border-amber-200 ${!embedded ? 'md:bg-amber-500/10 md:border-amber-500/30' : ''}`
                                : `bg-emerald-50 border-emerald-200 ${!embedded ? 'md:bg-emerald-500/10 md:border-emerald-500/30' : ''}`
                                }`}>
                                <div className="flex justify-between items-center mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">{advice.action === 'SWAP' ? '⚡' : '🛡️'}</span>
                                        <h3 className={`font-bold text-sm uppercase ${advice.action === 'SWAP'
                                            ? `text-amber-800 ${!embedded ? 'md:text-amber-400' : ''}`
                                            : `text-emerald-800 ${!embedded ? 'md:text-emerald-400' : ''}`
                                            }`}>
                                            {advice.action === 'SWAP' ? 'Action Required' : 'Portfolio Protected'}
                                        </h3>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded bg-gray-100 ${!embedded ? 'md:bg-black/30' : ''} border`}>
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                            <span className={`text-xs font-mono text-blue-600 ${!embedded ? 'md:text-blue-200' : ''}`}>
                                                {(advice.confidence * 100).toFixed(0)}%
                                            </span>
                                        </div>
                                        {advice.targetNetwork && (
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-600 text-white text-[10px] font-bold">
                                                {advice.targetNetwork}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className={`bg-blue-600/5 rounded-xl p-4 border border-blue-500/20`}>
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-xl">🧠</span>
                                        <div>
                                            <h4 className={`font-bold text-gray-800 ${!embedded ? 'md:text-white' : ''} text-sm`}>Wealth Protection Strategy</h4>
                                            <div className="flex items-center gap-2 text-[10px] text-blue-400 font-mono">
                                                <span className="animate-pulse">●</span>
                                                <span>Agent: {advice._meta?.modelUsed || 'Gemini 3 Flash'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <p className={`text-sm text-gray-700 ${!embedded ? 'md:text-slate-300' : ''} font-medium leading-relaxed italic border-l-2 border-gray-300 ${!embedded ? 'md:border-white/10' : ''} pl-3`}>
                                        &quot;{advice.reasoning}&quot;
                                    </p>

                                    {/* Action Steps - NEW */}
                                    {advice.actionSteps && advice.actionSteps.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-blue-500/10">
                                            <div className="flex items-center gap-2 mb-3">
                                                <span className="text-lg">📋</span>
                                                <h4 className={`font-bold text-gray-800 ${!embedded ? 'md:text-white' : ''} text-sm`}>Action Plan</h4>
                                                {advice.urgencyLevel && advice.urgencyLevel !== 'LOW' && (
                                                    <span className={`text-xs px-2 py-1 rounded-full font-bold ${advice.urgencyLevel === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                                                        advice.urgencyLevel === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                                                            'bg-yellow-100 text-yellow-700'
                                                        }`}>
                                                        {advice.urgencyLevel} PRIORITY
                                                    </span>
                                                )}
                                            </div>
                                            <div className="space-y-2">
                                                {advice.actionSteps.map((step, idx) => (
                                                    <div key={idx} className={`flex items-start gap-3 p-2 rounded-lg bg-white/50 ${!embedded ? 'md:bg-white/5' : ''} border border-gray-100 ${!embedded ? 'md:border-white/10' : ''}`}>
                                                        <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                                                            {idx + 1}
                                                        </div>
                                                        <span className={`text-sm text-gray-700 ${!embedded ? 'md:text-slate-300' : ''} font-medium`}>
                                                            {step}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Expected Savings Highlight - Enhanced */}
                                    {advice.expectedSavings && (
                                        <div className="mt-4 pt-4 border-t border-blue-500/10">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg">💰</span>
                                                    <div>
                                                        <div className={`text-sm font-bold text-gray-800 ${!embedded ? 'md:text-white' : ''}`}>
                                                            Expected Protection
                                                        </div>
                                                        <div className="text-xs text-green-600 font-bold">
                                                            +${advice.expectedSavings} saved
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className={`text-xs text-gray-500 ${!embedded ? 'md:text-slate-400' : ''}`}>
                                                        {advice.timeHorizon || '6 months'}
                                                    </div>
                                                    <div className={`text-xs font-bold ${advice.confidence > 0.8 ? 'text-green-600' :
                                                        advice.confidence > 0.6 ? 'text-yellow-600' :
                                                            'text-gray-600'
                                                        }`}>
                                                        {(advice.confidence * 100).toFixed(0)}% confidence
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Thought Trace Display */}
                                    {advice.thoughtChain && (
                                        <div className="space-y-2 mt-4 pt-4 border-t border-blue-500/10">
                                            <label className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block">Logic Trace</label>
                                            {advice.thoughtChain.map((thought, idx) => (
                                                <motion.div
                                                    initial={{ opacity: 0, x: -5 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    key={idx}
                                                    className={`flex items-start gap-2 text-[11px] text-gray-500 ${!embedded ? 'md:text-slate-400' : ''} font-medium`}
                                                >
                                                    <span className="text-blue-500 mt-1">↪</span>
                                                    <span>{thought}</span>
                                                </motion.div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Action Buttons Row */}
                                    <div className="mt-4 pt-4 border-t border-blue-500/10">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => {
                                                    const shareText = `DiversiFi Oracle Recommendation: ${advice.action} ${advice.targetToken || ''} - ${advice.reasoning.slice(0, 100)}...`;
                                                    if (navigator.share) {
                                                        navigator.share({
                                                            title: 'DiversiFi Oracle Analysis',
                                                            text: shareText,
                                                            url: window.location.href
                                                        }).then(() => {
                                                            showToast('Analysis shared successfully!', 'success');
                                                        }).catch(() => {
                                                            navigator.clipboard.writeText(shareText);
                                                            showToast('Analysis copied to clipboard', 'info');
                                                        });
                                                    } else {
                                                        navigator.clipboard.writeText(shareText);
                                                        showToast('Analysis copied to clipboard', 'info');
                                                    }
                                                }}
                                                className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors bg-gray-100 hover:bg-gray-200 text-gray-700 ${!embedded ? 'md:bg-white/10 md:hover:bg-white/20 md:text-white' : ''} flex items-center justify-center gap-1`}
                                            >
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                                                </svg>
                                                Share
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const analysisData = {
                                                        timestamp: new Date().toISOString(),
                                                        recommendation: advice,
                                                        portfolio: { amount, holdings },
                                                        network: networkInfo
                                                    };
                                                    localStorage.setItem(`diversifi_analysis_${Date.now()}`, JSON.stringify(analysisData));
                                                    showToast('Analysis saved to local storage', 'success');
                                                }}
                                                className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors bg-gray-100 hover:bg-gray-200 text-gray-700 ${!embedded ? 'md:bg-white/10 md:hover:bg-white/20 md:text-white' : ''} flex items-center justify-center gap-1`}
                                            >
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" />
                                                </svg>
                                                Save
                                            </button>
                                            <button
                                                onClick={() => {
                                                    // Toggle detailed view or open modal with more info
                                                    sendMessage(`Tell me more details about this ${advice.action} recommendation for ${advice.targetToken}`);
                                                    showToast('Requesting detailed analysis...', 'ai', { cost: 0.02, sources: 3 });
                                                }}
                                                className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors bg-gray-100 hover:bg-gray-200 text-gray-700 ${!embedded ? 'md:bg-white/10 md:hover:bg-white/20 md:text-white' : ''} flex items-center justify-center gap-1`}
                                            >
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                Details
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Arc Testnet Specific Features */}
                                {networkInfo.chainId === 5042002 && (
                                    <div className="mt-4 pt-4 border-t border-blue-500/10">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="text-lg">🧪</span>
                                            <h4 className={`font-bold text-gray-800 ${!embedded ? 'md:text-white' : ''} text-sm`}>Arc Testnet Demo</h4>
                                            <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-bold">
                                                RISK-FREE
                                            </span>
                                        </div>
                                        <div className={`text-sm text-gray-700 ${!embedded ? 'md:text-slate-300' : ''} space-y-2`}>
                                            <p>Test real diversification strategies with:</p>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <div className="bg-blue-50 p-2 rounded border">
                                                    <div className="font-bold">USDC</div>
                                                    <div className="text-gray-600">Native gas</div>
                                                </div>
                                                <div className="bg-green-50 p-2 rounded border">
                                                    <div className="font-bold">EURC</div>
                                                    <div className="text-gray-600">EUR hedge</div>
                                                </div>
                                            </div>
                                            <div className="text-xs bg-blue-50 p-2 rounded border border-blue-200">
                                                💡 Get free testnet funds: <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">faucet.circle.com</a>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {advice.paymentHashes && Object.keys(advice.paymentHashes).length > 0 && (
                                    <div className={`mt-4 pt-4 border-t border-gray-200 ${!embedded ? 'md:border-white/10' : ''}`}>
                                        <h4 className={`text-[10px] font-bold uppercase text-gray-500 ${!embedded ? 'md:text-slate-500' : ''} mb-2 tracking-widest`}>On-Chain Data Receipts</h4>
                                        <div className="space-y-2">
                                            {Object.entries(advice.paymentHashes).map(([source, hash]) => (
                                                <div key={source} className={`flex items-center justify-between bg-white/50 ${!embedded ? 'md:bg-black/20' : ''} p-2 rounded border border-gray-100 ${!embedded ? 'md:border-white/5' : ''}`}>
                                                    <div className="flex flex-col">
                                                        <span className={`text-[10px] font-bold text-gray-600 ${!embedded ? 'md:text-blue-200' : ''}`}>{source}</span>
                                                        <span className={`text-[9px] font-mono text-gray-400 ${!embedded ? 'md:text-slate-500' : ''} truncate w-32 md:w-48`}>{hash}</span>
                                                    </div>
                                                    <a
                                                        href={`${NETWORKS.ARC_TESTNET.explorerUrl}/tx/${hash}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-[10px] bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 transition-colors font-bold"
                                                    >
                                                        VERIFY
                                                    </a>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {(advice.action === 'SWAP' || advice.action === 'BRIDGE') && advice.targetToken && (
                                <div className="space-y-3">
                                    {advice.urgencyLevel && advice.urgencyLevel !== 'LOW' && (
                                        <div className={`p-3 rounded-lg border-l-4 ${advice.urgencyLevel === 'CRITICAL' ? 'bg-red-50 border-red-500 text-red-800' :
                                            advice.urgencyLevel === 'HIGH' ? 'bg-orange-50 border-orange-500 text-orange-800' :
                                                'bg-yellow-50 border-yellow-500 text-yellow-800'
                                            }`}>
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg">⚠️</span>
                                                <div>
                                                    <div className="font-bold text-sm">
                                                        {advice.urgencyLevel === 'CRITICAL' ? 'URGENT ACTION REQUIRED' :
                                                            advice.urgencyLevel === 'HIGH' ? 'HIGH PRIORITY' :
                                                                'RECOMMENDED ACTION'}
                                                    </div>
                                                    <div className="text-xs">
                                                        {advice.urgencyLevel === 'CRITICAL' ? 'Immediate action recommended to protect wealth' :
                                                            advice.urgencyLevel === 'HIGH' ? 'Action recommended within 24 hours' :
                                                                'Consider taking action soon'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        onClick={() => handleExecuteRecommendation(advice.targetToken!)}
                                        className={`w-full py-4 rounded-xl font-bold transition-all active:scale-[0.97] flex items-center justify-center gap-3 shadow-lg hover:shadow-xl ${advice.urgencyLevel === 'CRITICAL' ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white' :
                                            advice.urgencyLevel === 'HIGH' ? 'bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-500 hover:to-orange-600 text-white' :
                                                'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white'
                                            }`}
                                    >
                                        <span>
                                            {advice.action === 'BRIDGE' ? 'Bridge to' : 'Swap to'} {advice.targetToken}
                                            {advice.expectedSavings ? ` (Save $${advice.expectedSavings})` : ''}
                                        </span>
                                        {advice.targetNetwork && advice.targetNetwork !== 'Celo' && (
                                            <span className="text-[10px] px-2 py-1 bg-black/20 rounded-full uppercase font-bold">
                                                via {advice.targetNetwork}
                                            </span>
                                        )}
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* Initial State - Enhanced */}
                    {!advice && !isAnalyzing && (
                        <div className="space-y-6">
                            <div className="text-center py-4">
                                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <span className="text-2xl">🧠</span>
                                </div>
                                <h3 className={`font-bold text-lg text-gray-800 ${!embedded ? 'md:text-white' : ''} mb-2`}>
                                    Wealth Protection Analysis
                                </h3>
                                <p className={`text-gray-600 ${!embedded ? 'md:text-slate-400' : ''} text-sm mb-6 leading-relaxed`}>
                                    Get personalized recommendations to protect your ${amount.toFixed(2)} portfolio from inflation and market volatility.
                                </p>
                            </div>

                            {/* Quick Scenarios */}
                            <div className="space-y-3">
                                <h4 className={`text-sm font-bold text-gray-700 ${!embedded ? 'md:text-slate-300' : ''} mb-3`}>
                                    Quick Analysis Options:
                                </h4>

                                <button
                                    onClick={() => sendMessage("I'm worried about inflation affecting my savings. What should I do?")}
                                    className="w-full p-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg text-left transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-xl">📈</span>
                                        <div>
                                            <div className="font-medium text-amber-800 text-sm">Inflation Protection</div>
                                            <div className="text-xs text-amber-600">Protect against rising prices</div>
                                        </div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => sendMessage("Should I diversify across different stablecoins and networks?")}
                                    className="w-full p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-left transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-xl">🌍</span>
                                        <div>
                                            <div className="font-medium text-blue-800 text-sm">Portfolio Diversification</div>
                                            <div className="text-xs text-blue-600">Spread risk across regions</div>
                                        </div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => sendMessage("What's the best strategy for my current holdings and risk tolerance?")}
                                    className="w-full p-3 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg text-left transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-xl">🎯</span>
                                        <div>
                                            <div className="font-medium text-green-800 text-sm">Personalized Strategy</div>
                                            <div className="text-xs text-green-600">Tailored to your portfolio</div>
                                        </div>
                                    </div>
                                </button>
                            </div>

                            <div className="pt-4 border-t border-gray-200">
                                <button
                                    onClick={handleAnalyze}
                                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-3"
                                >
                                    <span>Run Complete Analysis</span>
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Quick Actions Footer */}
                <div className={`p-4 border-t bg-gray-50 ${!embedded ? 'md:bg-transparent md:border-white/10' : ''}`}>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        <button
                            onClick={handleAnalyze}
                            className="px-3 py-2 bg-blue-100 text-blue-800 rounded-lg text-xs font-medium whitespace-nowrap hover:bg-blue-200 transition-colors"
                        >
                            📊 Analyze
                        </button>
                        <button
                            onClick={() => sendMessage("What's the best rebalancing strategy?")}
                            className="px-3 py-2 bg-gray-100 text-gray-800 rounded-lg text-xs font-medium whitespace-nowrap hover:bg-gray-200 transition-colors"
                        >
                            🔄 Rebalance
                        </button>
                        <button
                            onClick={() => sendMessage("Show me current market insights")}
                            className="px-3 py-2 bg-gray-100 text-gray-800 rounded-lg text-xs font-medium whitespace-nowrap hover:bg-gray-200 transition-colors"
                        >
                            💡 Insights
                        </button>
                        <button
                            onClick={() => sendMessage("Quick swap recommendation")}
                            className="px-3 py-2 bg-gray-100 text-gray-800 rounded-lg text-xs font-medium whitespace-nowrap hover:bg-gray-200 transition-colors"
                        >
                            ⚡ Quick Swap
                        </button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
