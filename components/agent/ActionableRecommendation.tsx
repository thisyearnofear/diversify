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
import { type PortfolioAnalysis, type RebalancingOpportunity } from '@diversifi/shared';
import type { MultichainPortfolio } from '../../hooks/use-multichain-balances';
import { useJunoStatus } from '../../hooks/use-juno-status';
import { NETWORKS } from '../../config';
import { GuardianRecommendationCard } from './GuardianRecommendationCard';
import { buildPortfolioSwapContract } from '@diversifi/shared/src/services/guardian/recommendation-contract';
import { useGuardianTierSnapshot } from './AgentTierStatus';
import { useSessionKey } from '../../hooks/use-session-key';

interface ActionableRecommendationProps {
    analysis: PortfolioAnalysis | null;
    portfolio: MultichainPortfolio | null;
    /** Opens the swap dry-run/quote surface. Execution requires its separate approval. */
    onReviewSwap: (fromToken: string, toToken: string, amount: string, reason: string) => void;
    onExecuteBridge?: (fromChain: number, toChain: number, token: string, amount: string) => void;
    onAskGuardian?: (prompt: string) => void;
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
    onReviewSwap,
    onExecuteBridge,
    onAskGuardian,
}: ActionableRecommendationProps) {
    // All recommendation actions route to the quote/review surface first.
    const onExecuteSwap = onReviewSwap;
    const portfolioTotalValue = portfolio?.totalValue ?? 0;
    const { status: junoStatus } = useJunoStatus();
    const { guardianState } = useGuardianTierSnapshot();
    const { signedPermission } = useSessionKey();

    const guardianBounds =
        guardianState === 'monitoring' && signedPermission
            ? `Guardian can act up to $${signedPermission.permission.dailyLimitUSD}/day within signed limits.`
            : 'Manual review — set up Auto-Saver permissions for bounded execution.';

    if (!analysis && portfolioTotalValue > 0) {
        return (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
                <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                    💡 Portfolio detected (${portfolioTotalValue.toFixed(0)} total)
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    Ask Guardian for a fresh review to see personalized recommendations.
                </p>
            </div>
        );
    }

    if (!analysis || (analysis.totalValue === 0 && portfolioTotalValue === 0)) {
        return (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    {portfolioTotalValue === 0
                        ? 'Connect a wallet with funds to see recommendations.'
                        : 'Run portfolio analysis to see actionable recommendations.'}
                </p>
            </div>
        );
    }

    // Generate actionable steps from analysis
    const actionSteps: ActionStep[] = generateActionSteps(analysis);

    // Find cross-chain opportunities
    const crossChainOps = generateCrossChainOpportunities(portfolio);

    return (
        <div className="space-y-4">
            {/* Primary Recommendation */}
            {actionSteps.length > 0 && actionSteps[0].type === 'swap' && actionSteps[0].tokens && (
                <GuardianRecommendationCard
                    contract={buildPortfolioSwapContract({
                        fromToken: actionSteps[0].tokens.from,
                        toToken: actionSteps[0].tokens.to,
                        fromRegion: analysis.rebalancingOpportunities[0]?.fromRegion,
                        fromInflation: analysis.rebalancingOpportunities[0]?.fromInflation,
                        toInflation: analysis.rebalancingOpportunities[0]?.toInflation,
                        suggestedAmountUsd: analysis.rebalancingOpportunities[0]?.suggestedAmount,
                        annualSavingsUsd: analysis.rebalancingOpportunities[0]?.annualSavings,
                        guardianBounds,
                    })}
                    onReview={() =>
                        onReviewSwap(
                            actionSteps[0].tokens!.from,
                            actionSteps[0].tokens!.to,
                            actionSteps[0].tokens!.amount.replace('$', ''),
                            actionSteps[0].description,
                        )
                    }
                    onAskWhy={() =>
                        onAskGuardian?.(
                            `Explain why Guardian proposes swapping ${actionSteps[0].tokens!.from} → ${actionSteps[0].tokens!.to}: ${actionSteps[0].description}`,
                        )
                    }
                />
            )}

            {actionSteps.length > 0 && actionSteps[0].type !== 'swap' && (
                <PrimaryRecommendation
                    step={actionSteps[0]}
                    analysis={analysis}
                    onExecute={onReviewSwap}
                />
            )}

            {/* Bitso/Juno MXNB Opportunity */}
            <BitsoMxnbOpportunity
                analysis={analysis}
                portfolio={portfolio}
                junoConfigured={junoStatus?.configured ?? false}
                junoMutationsEnabled={junoStatus?.mutationsEnabled ?? false}
                onExecuteSwap={onExecuteSwap}
            />

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
        <div className={`rounded-xl p-4 border-2 ${isHighImpact
            ? 'bg-amber-50 border-amber-300'
            : 'bg-blue-50 border-blue-200'
            }`}>
            <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${isHighImpact ? 'bg-amber-200' : 'bg-blue-200'
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
                                className={`px-4 py-2 rounded-lg text-xs font-bold text-white transition-colors ${isHighImpact
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

function BitsoMxnbOpportunity({
    analysis,
    portfolio,
    junoConfigured,
    junoMutationsEnabled,
    onExecuteSwap
}: {
    analysis: PortfolioAnalysis;
    portfolio: MultichainPortfolio | null;
    junoConfigured: boolean;
    junoMutationsEnabled: boolean;
    onExecuteSwap: (from: string, to: string, amount: string, reason: string) => void;
}) {
    const totalValue = analysis.totalValue || portfolio?.totalValue || 0;
    const suggestedAmount = Math.max(10, Math.min(250, totalValue > 0 ? totalValue * 0.2 : 100));
    const hasMxnb = portfolio?.chains.some((chain) =>
        chain.balances.some((token) => token.symbol.toUpperCase() === 'MXNB' && Number(token.value || 0) > 0)
    ) ?? false;

    return (
        <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
            <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-200 flex items-center justify-center text-xl font-black text-emerald-900">
                    $
                </div>
                <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                        <div>
                            <h4 className="font-bold text-sm text-emerald-950">
                                Bitso MXNB Peso Hedge
                            </h4>
                            <p className="text-xs mt-1 text-emerald-800">
                                MXNB is available on Arbitrum as a Mexican peso stablecoin. DiversiFi can route a Mexico hedge into MXNB, then use Juno for sandbox balances, SPEI issuance, USD stablecoin conversion, or redemption.
                            </p>
                        </div>
                        <span className={`shrink-0 px-2 py-1 rounded text-[10px] font-black uppercase ${
                            junoConfigured ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-700 border border-emerald-200'
                        }`}>
                            {junoConfigured ? 'Juno API ready' : 'Keys needed'}
                        </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="bg-white rounded-lg border border-emerald-100 px-3 py-2">
                            <p className="text-[10px] font-black uppercase text-emerald-600">On-chain leg</p>
                            <p className="text-xs font-bold text-gray-900 mt-0.5">USDC to MXNB</p>
                        </div>
                        <div className="bg-white rounded-lg border border-emerald-100 px-3 py-2">
                            <p className="text-[10px] font-black uppercase text-emerald-600">Juno leg</p>
                            <p className="text-xs font-bold text-gray-900 mt-0.5">
                                {junoMutationsEnabled ? 'Conversion/redeem enabled' : 'Read-only sandbox'}
                            </p>
                        </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <ImpactBadge impact={hasMxnb ? 'MXNB detected' : 'Mexico coverage'} />
                            <ConfidenceBadge level={junoConfigured ? 'HIGH' : 'MEDIUM'} />
                        </div>
                        <button
                            onClick={() => onExecuteSwap(
                                'USDC',
                                'MXNB',
                                suggestedAmount.toFixed(2),
                                'Bitso/Juno MXNB hedge: use Arbitrum MXNB for Mexico peso exposure, with Juno API support for balances, SPEI issuance, USD stablecoin conversion, and redemption.'
                            )}
                            className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
                        >
                            Review Swap
                        </button>
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
                            {onExecuteBridge && op.chainId !== NETWORKS.CELO_MAINNET.chainId && (
                                <button
                                    onClick={() => onExecuteBridge(op.chainId, 42161, 'USDC', op.value.toFixed(2))}
                                    className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors"
                                >
                                    Bridge
                                </button>
                            )}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">💡 {op.recommendedAction}</p>
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
                            <div className={`w-2 h-2 rounded-full ${opp.priority === 'HIGH' ? 'bg-red-500' :
                                opp.priority === 'MEDIUM' ? 'bg-amber-500' :
                                    'bg-green-500'
                                }`} />
                            <div>
                                <div className="flex items-center gap-1 text-sm font-bold">
                                    <span className="text-gray-700">{opp.fromToken}</span>
                                    <span className="text-gray-400">→</span>
                                    <span className="text-blue-600">{opp.toToken}</span>
                                </div>
                                <div className="text-xs text-gray-500 mt-0.5">
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
                                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Swap
                            </button>
                        </div>
                    </motion.div>
                ))}
            </div>

            {opportunities.length > 3 && (
                <p className="text-xs text-gray-400 text-center mt-2">
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
                    <div className={`w-2 h-2 rounded-full ${overallConfidence > 0.8 ? 'bg-green-500' :
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
                            <span className="text-xs font-bold text-gray-600">{factor.label}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                            <div className="h-1.5 w-16 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${factor.value > 0.8 ? 'bg-green-500' :
                                        factor.value > 0.6 ? 'bg-amber-500' :
                                            'bg-red-500'
                                        }`}
                                    style={{ width: `${factor.value * 100}%` }}
                                />
                            </div>
                            <span className="text-xs text-gray-500">{factor.status}</span>
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
        <span className={`px-2 py-0.5 rounded text-xs font-bold ${isHigh
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
        <span className={`px-2 py-0.5 rounded text-xs font-bold ${colors[level]}`}>
            {level} confidence
        </span>
    );
}

// ============================================================================
// LOGIC FUNCTIONS
// ============================================================================

function generateActionSteps(
    analysis: PortfolioAnalysis
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
                from: analysis.tokens[0]?.symbol || 'USDm',
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
    portfolio: MultichainPortfolio | null
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
        if (chain.chainId === NETWORKS.CELO_MAINNET.chainId && chain.totalValue > 10) {
            opportunities.push({
                chainName: 'Celo',
                chainId: NETWORKS.CELO_MAINNET.chainId,
                value: chain.totalValue,
                opportunity: `${chain.totalValue.toFixed(2)} available to bridge for PAXG access`,
                recommendedAction: 'Bridge to Arbitrum to access tokenized Gold (PAXG)'
            });
        }

        // Arbitrum opportunities
        if (chain.chainId === 42161) {
            const hasPAXG = chain.balances.some(t => t.symbol.toUpperCase() === 'PAXG');
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
        'Europe': 'EURm',
        'USA': 'USDm',
        'Asia': 'PHPm',
        'Africa': 'KESm',
        'LatAm': 'MXNB',
        'Global': 'PAXG'
    };
    return map[region] || 'USDm';
}
