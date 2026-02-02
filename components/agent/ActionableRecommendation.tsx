/**
 * ActionableRecommendation Component
 * 
 * Surfaces specific, executable actions based on portfolio analysis.
 * Designed to close the gap between "showing data" and "guiding action".
 * 
 * Principles:
 * - Shows WHAT to do, WHY, and HOW MUCH it helps
 * - Surfaces multi-chain opportunities explicitly
 * - Provides step-by-step execution plan
 * - Displays confidence factors transparently
 */

import React from 'react';
import { motion } from 'framer-motion';
import type { PortfolioAnalysis, RebalancingOpportunity } from '../../utils/portfolio-analysis';
import type { AggregatedPortfolio } from '../../hooks/use-stablecoin-balances';

interface ActionableRecommendationProps {
    analysis: PortfolioAnalysis | null;
    portfolio: AggregatedPortfolio | null;
    onExecuteSwap: (fromToken: string, toToken: string, amount: string, reason: string) => void;
    onExecuteBridge?: (fromChain: number, toChain: number, token: string, amount: string) => void;
}

interface ActionStep {
    id: string;
    type: 'swap' | 'bridge' | 'hold' | 'diversify';
    title: string;
    description: string;
    impact: string;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    tokens?: { from: string; to: string; amount: string };
    chainInfo?: { from: string; to: string };
}

export default function ActionableRecommendation({
    analysis,
    portfolio,
    onExecuteSwap,
    onExecuteBridge
}: ActionableRecommendationProps) {
    if (!analysis || analysis.totalValue === 0) {
        return (
            <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-sm text-gray-500">No portfolio data available for recommendations.</p>
            </div>
        );
    }

    // Generate actionable steps from analysis
    const actionSteps: ActionStep[] = generateActionSteps(analysis, portfolio);

    // Find cross-chain opportunities
    const crossChainOps = generateCrossChainOpportunities(portfolio, analysis);

    return (
        <div className="space-y-4">
            {/* Primary Recommendation */}
            {actionSteps.length > 0 && (
                <PrimaryRecommendation 
                    step={actionSteps[0]} 
                    analysis={analysis}
                    onExecute={onExecuteSwap}
                />
            )}

            {/* Cross-Chain Opportunities */}
            {crossChainOps.length > 0 && (
                <CrossChainSection 
                    opportunities={crossChainOps}
                    onExecuteBridge={onExecuteBridge}
                />
            )}

            {/* Rebalancing Opportunities */}
            {analysis.rebalancingOpportunities.length > 0 && (
                <RebalancingSection
                    opportunities={analysis.rebalancingOpportunities}
                    onExecuteSwap={onExecuteSwap}
                />
            )}

            {/* Confidence Factors */}
            <ConfidenceFactors analysis={analysis} />
        </div>
    );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function PrimaryRecommendation({ 
    step, 
    analysis,
    onExecute 
}: { 
    step: ActionStep; 
    analysis: PortfolioAnalysis;
    onExecute: (from: string, to: string, amount: string, reason: string) => void;
}) {
    const isHighImpact = step.confidence === 'HIGH' && analysis.weightedInflationRisk > 5;
    
    return (
        <div className={`rounded-xl p-4 border-2 ${
            isHighImpact 
                ? 'bg-amber-50 border-amber-300' 
                : 'bg-blue-50 border-blue-200'
        }`}>
            <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${
                    isHighImpact ? 'bg-amber-200' : 'bg-blue-200'
                }`}>
                    {step.type === 'swap' ? '⚡' : step.type === 'bridge' ? '🌉' : '🎯'}
                </div>
                <div className="flex-1">
                    <h4 className={`font-bold text-sm ${isHighImpact ? 'text-amber-900' : 'text-blue-900'}`}>
                        {step.title}
                    </h4>
                    <p className={`text-xs mt-1 ${isHighImpact ? 'text-amber-700' : 'text-blue-700'}`}>
                        {step.description}
                    </p>
                    
                    {step.tokens && (
                        <div className="mt-3 flex items-center gap-2">
                            <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border">
                                <span className="text-xs font-bold">{step.tokens.from}</span>
                                <span className="text-gray-400">→</span>
                                <span className="text-xs font-bold text-blue-600">{step.tokens.to}</span>
                            </div>
                            <span className="text-xs text-gray-500">{step.tokens.amount}</span>
                        </div>
                    )}
                    
                    <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ImpactBadge impact={step.impact} />
                            <ConfidenceBadge level={step.confidence} />
                        </div>
                        
                        {step.tokens && (
                            <button
                                onClick={() => onExecute(
                                    step.tokens!.from, 
                                    step.tokens!.to, 
                                    step.tokens!.amount.replace('$', ''),
                                    step.description
                                )}
                                className={`px-4 py-2 rounded-lg text-xs font-bold text-white transition-all ${
                                    isHighImpact 
                                        ? 'bg-amber-600 hover:bg-amber-700' 
                                        : 'bg-blue-600 hover:bg-blue-700'
                                }`}
                            >
                                Execute
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function CrossChainSection({ 
    opportunities,
    onExecuteBridge 
}: { 
    opportunities: Array<{
        chainName: string;
        chainId: number;
        value: number;
        opportunity: string;
        recommendedAction: string;
    }>;
    onExecuteBridge?: (fromChain: number, toChain: number, token: string, amount: string) => void;
}) {
    return (
        <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
            <h4 className="text-xs font-black uppercase text-indigo-600 tracking-wider mb-3 flex items-center gap-2">
                <span>🌉</span> Cross-Chain Opportunities
            </h4>
            
            <div className="space-y-3">
                {opportunities.map((op, idx) => (
                    <div key={idx} className="bg-white rounded-lg p-3 border border-indigo-100">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-gray-900">{op.chainName}</span>
                                    <span className="text-xs text-gray-500">${op.value.toFixed(2)}</span>
                                </div>
                                <p className="text-xs text-indigo-600 mt-1">{op.opportunity}</p>
                            </div>
                            {onExecuteBridge && op.chainId !== 42220 && (
                                <button
                                    onClick={() => onExecuteBridge(op.chainId, 42161, 'USDC', op.value.toFixed(2))}
                                    className="px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-bold rounded-lg hover:bg-indigo-700 transition-colors"
                                >
                                    Bridge
                                </button>
                            )}
                        </div>
                        <p className="text-[10px] text-gray-500 mt-2">💡 {op.recommendedAction}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

function RebalancingSection({
    opportunities,
    onExecuteSwap
}: {
    opportunities: RebalancingOpportunity[];
    onExecuteSwap: (from: string, to: string, amount: string, reason: string) => void;
}) {
    // Show top 3 opportunities
    const topOpportunities = opportunities.slice(0, 3);
    
    return (
        <div className="bg-white rounded-xl p-4 border border-gray-200">
            <h4 className="text-xs font-black uppercase text-gray-500 tracking-wider mb-3 flex items-center gap-2">
                <span>⚖️</span> Rebalancing Opportunities
            </h4>
            
            <div className="space-y-2">
                {topOpportunities.map((opp, idx) => (
                    <motion.div 
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${
                                opp.priority === 'HIGH' ? 'bg-red-500' :
                                opp.priority === 'MEDIUM' ? 'bg-amber-500' :
                                'bg-green-500'
                            }`} />
                            <div>
                                <div className="flex items-center gap-1 text-sm font-bold">
                                    <span className="text-gray-700">{opp.fromToken}</span>
                                    <span className="text-gray-400">→</span>
                                    <span className="text-blue-600">{opp.toToken}</span>
                                </div>
                                <div className="text-[10px] text-gray-500 mt-0.5">
                                    Save ${opp.annualSavings.toFixed(2)}/year • {opp.inflationDelta.toFixed(1)}% inflation reduction
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-700">${opp.suggestedAmount.toFixed(0)}</span>
                            <button
                                onClick={() => onExecuteSwap(
                                    opp.fromToken,
                                    opp.toToken,
                                    opp.suggestedAmount.toFixed(2),
                                    `Rebalance: Reduce ${opp.fromRegion} exposure (${opp.fromInflation}%) → ${opp.toRegion} (${opp.toInflation}%)`
                                )}
                                className="px-3 py-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Swap
                            </button>
                        </div>
                    </motion.div>
                ))}
            </div>
            
            {opportunities.length > 3 && (
                <p className="text-[10px] text-gray-400 text-center mt-2">
                    +{opportunities.length - 3} more opportunities
                </p>
            )}
        </div>
    );
}

function ConfidenceFactors({ analysis }: { analysis: PortfolioAnalysis }) {
    // Calculate confidence factors
    const factors = [
        { 
            label: 'Inflation Data', 
            value: 0.90, 
            status: 'Live (IMF)',
            icon: '📊'
        },
        { 
            label: 'Portfolio Data', 
            value: analysis.tokenCount > 0 ? 0.95 : 0.50, 
            status: analysis.tokenCount > 0 ? `${analysis.tokenCount} tokens scanned` : 'No data',
            icon: '💰'
        },
        { 
            label: 'Chain Coverage', 
            value: analysis.regionCount > 2 ? 0.90 : 0.70, 
            status: `${analysis.regionCount} regions analyzed`,
            icon: '🔗'
        },
        { 
            label: 'Model Confidence', 
            value: analysis.diversificationScore > 50 ? 0.85 : 0.75, 
            status: analysis.diversificationScore > 50 ? 'High' : 'Medium',
            icon: '🤖'
        },
    ];
    
    const overallConfidence = factors.reduce((sum, f) => sum + f.value, 0) / factors.length;
    
    return (
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-black uppercase text-gray-500 tracking-wider">
                    Analysis Confidence
                </h4>
                <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${
                        overallConfidence > 0.8 ? 'bg-green-500' :
                        overallConfidence > 0.6 ? 'bg-amber-500' :
                        'bg-red-500'
                    }`} />
                    <span className="text-xs font-bold">{(overallConfidence * 100).toFixed(0)}%</span>
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
                {factors.map((factor, idx) => (
                    <div key={idx} className="bg-white rounded-lg p-2 border border-gray-100">
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs">{factor.icon}</span>
                            <span className="text-[10px] font-bold text-gray-600">{factor.label}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                            <div className="h-1.5 w-16 bg-gray-100 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full rounded-full ${
                                        factor.value > 0.8 ? 'bg-green-500' :
                                        factor.value > 0.6 ? 'bg-amber-500' :
                                        'bg-red-500'
                                    }`}
                                    style={{ width: `${factor.value * 100}%` }}
                                />
                            </div>
                            <span className="text-[9px] text-gray-500">{factor.status}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function ImpactBadge({ impact }: { impact: string }) {
    const isHigh = impact.includes('$') && parseFloat(impact.replace(/[^0-9.]/g, '')) > 10;
    
    return (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
            isHigh 
                ? 'bg-green-100 text-green-700' 
                : 'bg-blue-100 text-blue-700'
        }`}>
            {impact}
        </span>
    );
}

function ConfidenceBadge({ level }: { level: 'HIGH' | 'MEDIUM' | 'LOW' }) {
    const colors = {
        HIGH: 'bg-emerald-100 text-emerald-700',
        MEDIUM: 'bg-amber-100 text-amber-700',
        LOW: 'bg-gray-100 text-gray-600'
    };
    
    return (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${colors[level]}`}>
            {level} confidence
        </span>
    );
}

// ============================================================================
// LOGIC FUNCTIONS
// ============================================================================

function generateActionSteps(
    analysis: PortfolioAnalysis,
    portfolio: AggregatedPortfolio | null
): ActionStep[] {
    const steps: ActionStep[] = [];
    
    // Priority 1: High inflation risk reduction
    if (analysis.weightedInflationRisk > 5 && analysis.rebalancingOpportunities.length > 0) {
        const topOpp = analysis.rebalancingOpportunities[0];
        steps.push({
            id: '1',
            type: 'swap',
            title: `Reduce ${topOpp.fromRegion} Inflation Exposure`,
            description: `Your ${topOpp.fromToken} holdings face ${topOpp.fromInflation}% inflation. Swapping to ${topOpp.toToken} (${topOpp.toInflation}% inflation) preserves purchasing power.`,
            impact: `Save $${topOpp.annualSavings.toFixed(2)}/year`,
            confidence: topOpp.priority === 'HIGH' ? 'HIGH' : 'MEDIUM',
            tokens: {
                from: topOpp.fromToken,
                to: topOpp.toToken,
                amount: `$${topOpp.suggestedAmount.toFixed(2)}`
            }
        });
    }
    
    // Priority 2: Diversification if concentrated
    if (analysis.concentrationRisk === 'HIGH' && analysis.missingRegions.length > 0) {
        const targetRegion = analysis.missingRegions[0];
        const targetToken = getTokenForRegion(targetRegion);
        const suggestedAmount = analysis.totalValue * 0.15;
        
        steps.push({
            id: '2',
            type: 'diversify',
            title: `Diversify into ${targetRegion}`,
            description: `Your portfolio is concentrated in ${analysis.overExposedRegions[0]}. Adding ${targetRegion} exposure reduces correlation risk.`,
            impact: `Improve diversification score by ~15 points`,
            confidence: 'MEDIUM',
            tokens: {
                from: analysis.tokens[0]?.symbol || 'CUSD',
                to: targetToken,
                amount: `$${suggestedAmount.toFixed(2)}`
            }
        });
    }
    
    // Priority 3: Hold if well positioned
    if (steps.length === 0) {
        steps.push({
            id: '3',
            type: 'hold',
            title: 'Maintain Current Position',
            description: `Your portfolio shows good diversification (${analysis.diversificationScore}/100) and manageable inflation exposure (${analysis.weightedInflationRisk.toFixed(1)}%).`,
            impact: 'Continue monitoring',
            confidence: 'HIGH'
        });
    }
    
    return steps;
}

function generateCrossChainOpportunities(
    portfolio: AggregatedPortfolio | null,
    analysis: PortfolioAnalysis
): Array<{
    chainName: string;
    chainId: number;
    value: number;
    opportunity: string;
    recommendedAction: string;
}> {
    const opportunities: ReturnType<typeof generateCrossChainOpportunities> = [];
    
    if (!portfolio) return opportunities;
    
    for (const chain of portfolio.chains) {
        if (chain.totalValue === 0) continue;
        
        // Celo opportunities
        if (chain.chainId === 42220 && chain.totalValue > 10) {
            opportunities.push({
                chainName: 'Celo',
                chainId: 42220,
                value: chain.totalValue,
                opportunity: `${chain.totalValue.toFixed(2)} available to bridge for PAXG access`,
                recommendedAction: 'Bridge to Arbitrum to access tokenized Gold (PAXG)'
            });
        }
        
        // Arbitrum opportunities
        if (chain.chainId === 42161) {
            const hasPAXG = Object.keys(chain.balances).some(t => t.toUpperCase() === 'PAXG');
            if (!hasPAXG && chain.totalValue > 5) {
                opportunities.push({
                    chainName: 'Arbitrum',
                    chainId: 42161,
                    value: chain.totalValue,
                    opportunity: `${chain.totalValue.toFixed(2)} on Arbitrum - PAXG available`,
                    recommendedAction: 'Swap to PAXG for inflation hedge'
                });
            }
        }
    }
    
    return opportunities;
}

function getTokenForRegion(region: string): string {
    const map: Record<string, string> = {
        'Europe': 'cEUR',
        'USA': 'cUSD',
        'Asia': 'PUSO',
        'Africa': 'cKES',
        'LatAm': 'cREAL',
        'Global': 'PAXG'
    };
    return map[region] || 'cUSD';
}
