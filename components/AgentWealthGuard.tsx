import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWealthProtectionAgent, RiskTolerance } from "../hooks/use-wealth-protection-agent";
import { useInflationData } from "../hooks/use-inflation-data";
import { useWalletContext } from "./WalletProvider";
import { NETWORKS, MAINNET_TOKENS, ARBITRUM_TOKENS } from "../config";
import { BridgeService } from "../services/swap/bridge-service";
import { ethers } from "ethers";

interface AgentWealthGuardProps {
    amount: number;
    holdings: string[];
    onExecuteSwap: (targetToken: string) => void;
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

// Mobile-optimized progress indicator
const AIProgress = ({ currentStep }: { currentStep: string }) => (
    <div className="bg-gray-50 rounded-lg p-3 mb-4">
        <div className="flex items-center gap-2 mb-2">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium">Oracle Processing</span>
        </div>

        <div className="text-xs text-gray-600 space-y-1">
            <div className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span>Arc RPC: Connected (0.1s)</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                <span>{currentStep}</span>
            </div>
        </div>
    </div>
);

export default function AgentWealthGuard({ amount, holdings, onExecuteSwap }: AgentWealthGuardProps) {
    const hookResult = useWealthProtectionAgent();
    const {
        analyze, advice, isAnalyzing, thinkingStep, config, updateConfig,
        sendMessage
    } = hookResult;
    const { inflationData } = useInflationData();
    const [showConfig, setShowConfig] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [showHint] = useState(true);
    const [bridgeState, setBridgeState] = useState<{
        status: 'idle' | 'checking' | 'approving' | 'bridging' | 'success' | 'error';
        error?: string;
        txHash?: string;
        provider?: 'lifi' | 'circle';
    }>({ status: 'idle' });
    const { chainId } = useWalletContext();
    const [useCircleNative, setUseCircleNative] = useState(false);
    const [isVisionLoading, setIsVisionLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!inflationData) return null;

    const handleAnalyze = () => {
        const networkName = chainId === 42220 ? 'Celo Mainnet' : chainId === 44787 ? 'Celo Alfajores' : 'Unknown Network';
        analyze(
            inflationData,
            amount,
            holdings,
            { chainId: chainId || 0, name: networkName }
        );
    };

    const handleVisionAnalysis = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsVisionLoading(true);
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
                setIsVisionLoading(false);
            } catch (err) {
                console.error("Vision failed:", err);
                setIsVisionLoading(false);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleExecuteAction = async (targetToken: string) => {
        if (!advice) return;

        // If advice is for Arbitrum but user is on Celo, trigger BRIDGE
        if (advice.targetNetwork === 'Arbitrum' && chainId === 42220) {
            try {
                setBridgeState({ status: 'checking' });

                if (!window.ethereum) throw new Error("No wallet found");
                const provider = new ethers.providers.Web3Provider(window.ethereum);
                const signer = provider.getSigner();
                const userAddress = await signer.getAddress();

                // Map symbol to address
                const toTokenAddr = (ARBITRUM_TOKENS as Record<string, string>)[targetToken] || ARBITRUM_TOKENS.USDC;

                setBridgeState({ status: 'bridging' });
                const result = await BridgeService.bridgeToWealth(
                    signer,
                    userAddress,
                    amount.toString(),
                    { address: MAINNET_TOKENS.CUSD, chainId: 42220 },
                    { address: toTokenAddr, chainId: 42161 },
                    useCircleNative ? 'circle' : 'lifi'
                );

                setBridgeState({
                    status: 'success',
                    txHash: result.txHash,
                    provider: result.provider
                });
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Bridge operation failed';
                console.error("Bridge failed:", err);
                setBridgeState({ status: 'error', error: errorMessage });
            }
        } else {
            // Internal Celo swap logic
            onExecuteSwap(targetToken);
        }
    };

    const hasNewInsight = advice && !isAnalyzing;

    // Mobile-first: Show compact hint by default, full interface on demand
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

    // Full interface (slide-up modal on mobile, compact card on desktop)
    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                className="fixed inset-x-0 bottom-0 h-[70vh] bg-white rounded-t-2xl shadow-2xl z-50 md:relative md:h-auto md:rounded-2xl md:bg-gradient-to-br md:from-[#0F172A] md:to-[#1E293B] md:text-white"
            >
                {/* Mobile Header */}
                <div className="flex items-center justify-between p-4 border-b md:border-none">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center md:w-12 md:h-12 md:bg-blue-600/10">
                            <motion.span
                                className="text-xl md:text-2xl"
                                animate={isAnalyzing ? { rotate: 360 } : {}}
                                transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
                            >
                                🧠
                            </motion.span>
                        </div>
                        <div>
                            <h3 className="font-semibold text-sm md:text-xl md:font-black md:bg-clip-text md:text-transparent md:bg-gradient-to-r md:from-white md:to-blue-200">
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
                            className={`p-2 rounded-lg transition-all ${isVisionLoading ? 'animate-pulse bg-blue-500/20' : 'hover:bg-gray-100 md:hover:bg-white/5'} text-blue-500`}
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
                            className="p-2 rounded-lg transition-colors text-gray-400 hover:bg-gray-100 md:hover:bg-white/5"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                            </svg>
                        </button>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-2 rounded-lg transition-colors text-gray-400 hover:bg-gray-100 md:hover:bg-white/5"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Configuration Panel - Mobile Optimized */}
                <AnimatePresence>
                    {showConfig && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden border-b md:border-none"
                        >
                            <div className="p-4 space-y-3 bg-gray-50 md:bg-white/5 md:rounded-xl md:border md:border-white/10">
                                <div>
                                    <label className="text-xs font-bold text-gray-600 md:text-slate-400 uppercase mb-2 block">Risk Tolerance</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {(['Conservative', 'Balanced', 'Aggressive'] as RiskTolerance[]).map(t => (
                                            <button
                                                key={t}
                                                onClick={() => updateConfig({ riskTolerance: t })}
                                                className={`px-2 py-1.5 rounded-md text-xs font-bold transition-all ${config.riskTolerance === t
                                                    ? 'bg-blue-600 text-white shadow-lg'
                                                    : 'bg-white text-gray-600 hover:bg-gray-100 md:bg-white/5 md:text-slate-400 md:hover:bg-white/10'
                                                    }`}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-600 md:text-slate-400 uppercase mb-2 block">Bridge Optionality</label>
                                    <button
                                        onClick={() => setUseCircleNative(!useCircleNative)}
                                        className={`w-full px-3 py-2 rounded-md text-xs font-bold flex items-center justify-between transition-all ${useCircleNative
                                            ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40'
                                            : 'bg-white text-gray-600 md:bg-white/5 md:text-slate-400 border border-transparent'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span>🔵</span>
                                            <span>Circle Native (CCTP)</span>
                                        </div>
                                        <div className={`w-8 h-4 rounded-full relative transition-colors ${useCircleNative ? 'bg-blue-600' : 'bg-gray-300'}`}>
                                            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${useCircleNative ? 'left-4.5' : 'left-0.5'}`} />
                                        </div>
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto p-4">
                    {/* Analysis Progress */}
                    {isAnalyzing && (
                        <AIProgress currentStep={thinkingStep} />
                    )}

                    {/* Recommendation Display */}
                    {advice && !isAnalyzing && (
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="space-y-4"
                        >
                            <div className={`rounded-xl p-4 border shadow-lg ${advice.action === 'SWAP'
                                ? 'bg-amber-50 border-amber-200 md:bg-amber-500/10 md:border-amber-500/30'
                                : 'bg-emerald-50 border-emerald-200 md:bg-emerald-500/10 md:border-emerald-500/30'
                                }`}>
                                <div className="flex justify-between items-center mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">{advice.action === 'SWAP' ? '⚡' : '🛡️'}</span>
                                        <h3 className={`font-bold text-sm uppercase ${advice.action === 'SWAP'
                                            ? 'text-amber-800 md:text-amber-400'
                                            : 'text-emerald-800 md:text-emerald-400'
                                            }`}>
                                            {advice.action === 'SWAP' ? 'Action Required' : 'Portfolio Protected'}
                                        </h3>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-gray-100 md:bg-black/30 border">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                            <span className="text-xs font-mono text-blue-600 md:text-blue-200">
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
                                <div className="bg-blue-600/5 rounded-xl p-4 border border-blue-500/20">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-xl">🧠</span>
                                        <div>
                                            <h4 className="font-bold text-gray-800 md:text-white text-sm">Wealth Protection Strategy</h4>
                                            <div className="flex items-center gap-2 text-[10px] text-blue-400 font-mono">
                                                <span className="animate-pulse">●</span>
                                                <span>Agent: {advice._meta?.modelUsed || 'Gemini 3 Flash'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <p className="text-sm text-gray-700 md:text-slate-300 font-medium leading-relaxed italic border-l-2 border-gray-300 md:border-white/10 pl-3">
                                        &quot;{advice.reasoning}&quot;
                                    </p>

                                    {/* Thought Trace Display */}
                                    {advice.thoughtChain && (
                                        <div className="space-y-2 mt-4 pt-4 border-t border-blue-500/10">
                                            <label className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block">Logic Trace</label>
                                            {advice.thoughtChain.map((thought, idx) => (
                                                <motion.div
                                                    initial={{ opacity: 0, x: -5 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    key={idx}
                                                    className="flex items-start gap-2 text-[11px] text-gray-500 md:text-slate-400 font-medium"
                                                >
                                                    <span className="text-blue-500 mt-1">↪</span>
                                                    <span>{thought}</span>
                                                </motion.div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {advice.expectedSavings && (
                                    <div className="mt-3 flex items-center justify-between text-xs text-gray-600 md:text-slate-400">
                                        <span>Expected protection: <span className="font-bold text-green-600">${advice.expectedSavings}</span></span>
                                        <span className="opacity-60">{advice.timeHorizon} horizon</span>
                                    </div>
                                )}

                                {/* RWA Specific Asset Card */}
                                {advice.targetToken && (['PAXG', 'USDY', 'OUSG', 'PROP', 'GLP'].includes(advice.targetToken)) && (
                                    <div className="mt-4 p-3 bg-white/50 md:bg-white/5 rounded-lg border border-white/10 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center text-xl shadow-inner">
                                                {advice.targetToken === 'PAXG' ? '🏆' : advice.targetToken === 'PROP' ? '🏠' : '📈'}
                                            </div>
                                            <div>
                                                <div className="text-xs font-bold">{advice.targetToken} Asset Info</div>
                                                <div className="text-[10px] text-gray-500 md:text-slate-400">
                                                    {advice.targetToken === 'PAXG' ? 'Physical Gold Hedge' :
                                                        advice.targetToken === 'USDY' ? 'Ondo USD Yield (4.8%)' :
                                                            advice.targetToken === 'OUSG' ? 'US Treasury Bills (5.2%)' :
                                                                'RWA Yield Opportunity'}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] font-bold text-blue-600 md:text-blue-400">Arbitrum One</div>
                                            <div className="text-[9px] text-gray-400">x402 Verified</div>
                                        </div>
                                    </div>
                                )}

                                {advice.paymentHashes && Object.keys(advice.paymentHashes).length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-gray-200 md:border-white/10">
                                        <h4 className="text-[10px] font-bold uppercase text-gray-500 md:text-slate-500 mb-2 tracking-widest">On-Chain Data Receipts</h4>
                                        <div className="space-y-2">
                                            {Object.entries(advice.paymentHashes).map(([source, hash]) => (
                                                <div key={source} className="flex items-center justify-between bg-white/50 md:bg-black/20 p-2 rounded border border-gray-100 md:border-white/5">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-bold text-gray-600 md:text-blue-200">{source}</span>
                                                        <span className="text-[9px] font-mono text-gray-400 md:text-slate-500 truncate w-32 md:w-48">{hash}</span>
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

                            {advice.action === 'SWAP' && advice.targetToken && (
                                <div className="space-y-3">
                                    {bridgeState.status !== 'idle' && (
                                        <div className={`p-3 rounded-lg text-xs font-bold flex items-center gap-3 ${bridgeState.status === 'success' ? 'bg-green-100 text-green-700' :
                                            bridgeState.status === 'error' ? 'bg-red-100 text-red-700' :
                                                'bg-blue-100 text-blue-700'
                                            }`}>
                                            {bridgeState.status === 'bridging' && <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />}
                                            <span>
                                                {bridgeState.status === 'checking' && "🔍 Finding optimal route..."}
                                                {bridgeState.status === 'bridging' && (bridgeState.provider === 'circle' ? "🔵 Circle CCTP Native Path..." : "🌉 Bridging via LI.FI (Multi-step)...")}
                                                {bridgeState.status === 'success' && (bridgeState.provider === 'circle' ? "✅ Native Wealth Protection Deployed!" : "✅ Wealth Protection Deployed!")}
                                                {bridgeState.status === 'error' && `❌ Error: ${bridgeState.error?.slice(0, 50)}`}
                                            </span>
                                        </div>
                                    )}

                                    <button
                                        disabled={['checking', 'bridging'].includes(bridgeState.status)}
                                        onClick={() => handleExecuteAction(advice.targetToken!)}
                                        className={`w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:shadow-lg text-white rounded-xl font-bold transition-all active:scale-[0.97] flex items-center justify-center gap-2 ${['checking', 'bridging'].includes(bridgeState.status) ? 'opacity-50 grayscale' : ''
                                            }`}
                                    >
                                        <span>
                                            {bridgeState.status === 'success' ? 'View Deployment' : `Deploy to ${advice.targetToken}`}
                                        </span>
                                        {advice.targetNetwork && advice.targetNetwork !== 'Celo' && (
                                            <span className="text-[10px] px-1.5 py-0.5 bg-black/20 rounded uppercase">via {advice.targetNetwork}</span>
                                        )}
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* Initial State */}
                    {!advice && !isAnalyzing && (
                        <div className="text-center py-8">
                            <p className="text-gray-600 md:text-slate-400 text-sm mb-6 leading-relaxed">
                                Let the Oracle analyze global market conditions to optimize your ${amount.toFixed(2)} portfolio.
                            </p>
                            <button
                                onClick={handleAnalyze}
                                className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-3"
                            >
                                <span>Run Intelligent Analysis</span>
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </button>
                        </div>
                    )}
                </div>

                {/* Quick Actions Footer */}
                <div className="p-4 border-t bg-gray-50 md:bg-transparent md:border-white/10">
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
