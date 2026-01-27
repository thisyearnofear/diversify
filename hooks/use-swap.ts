/**
 * Orchestrator hook for swap functionality
 * Clean, modular, and testable - uses SwapOrchestrator
 * Enhanced with user-friendly messaging and smart defaults
 */

import { useState, useEffect, useCallback } from 'react';
import { SwapOrchestratorService } from '../services/swap/swap-orchestrator.service';
import { ProviderFactoryService } from '../services/swap/provider-factory.service';
import { ChainDetectionService } from '../services/swap/chain-detection.service';
import { SwapErrorHandler } from '../services/swap/error-handler';
import { isMiniPayEnvironment } from '../utils/environment';
import { TX_CONFIG } from '../config';
import type { SwapParams as OrchestratorSwapParams, SwapCallbacks, SwapResult, SwapState } from '../types/swap';
import { getWalletProvider, setupWalletEventListenersForProvider } from '../utils/wallet-provider';

interface HookSwapParams {
    fromToken: string;
    toToken: string;
    amount: string;
    fromChainId?: number;
    toChainId?: number;
    slippageTolerance?: number;
    optimization?: 'speed' | 'cost'; // User preference for optimization
    onApprovalSubmitted?: (hash: string) => void;
    onApprovalConfirmed?: () => void;
    onSwapSubmitted?: (hash: string) => void;
    onProgress?: (message: string, step: number, totalSteps: number) => void;
}

interface SwapEstimate {
    expectedOutput: string;
    minimumOutput: string;
    estimatedTime: string;
    networkFee: string;
    priceImpact: string;
    riskLevel: 'low' | 'medium' | 'high';
    route: string;
}

export function useSwap() {
    const [state, setState] = useState<SwapState>({
        step: 'idle',
        isLoading: false,
        error: null,
        txHash: null,
        approvalTxHash: null,
    });

    const [chainId, setChainId] = useState<number | null>(null);
    const [isMiniPay, setIsMiniPay] = useState(false);
    const [currentEstimate, setCurrentEstimate] = useState<SwapEstimate | null>(null);

    // Refresh chain ID from wallet
    const refreshChainId = useCallback(async () => {
        try {
            const detectedChainId = await ProviderFactoryService.getCurrentChainId();
            setChainId(detectedChainId);
            return detectedChainId;
        } catch (err) {
            console.warn('Error detecting chain ID:', err);
            return null;
        }
    }, []);

    // Detect environment on mount and listen for chain changes
    useEffect(() => {
        setIsMiniPay(isMiniPayEnvironment());
        refreshChainId();

        // Listen for chain changes using the cached provider
        let cleanup: (() => void) | undefined;
        
        const setupListeners = async () => {
            try {
                const provider = await getWalletProvider();
                cleanup = setupWalletEventListenersForProvider(
                    provider,
                    (chainIdHex: string) => {
                        const newChainId = parseInt(chainIdHex, 16);
                        console.log('[useSwap] Chain changed to:', newChainId);
                        // Only accept supported chains, otherwise keep current or default to Celo
                        if (ChainDetectionService.isSupported(newChainId)) {
                            setChainId(newChainId);
                        } else {
                            console.log('[useSwap] Unsupported chain detected, defaulting to Celo');
                            setChainId(42220);
                        }
                    },
                    () => { } // No accounts changed handler needed here
                );
            } catch (err) {
                console.warn('[useSwap] Failed to setup chain change listener:', err);
            }
        };
        
        setupListeners();

        return () => {
            cleanup?.();
        };
    }, [refreshChainId]);

    // Get user-friendly swap estimate
    const getEstimate = useCallback(async (params: Omit<HookSwapParams, 'onApprovalSubmitted' | 'onApprovalConfirmed' | 'onSwapSubmitted' | 'onProgress'>): Promise<SwapEstimate | null> => {
        try {
            if (!ProviderFactoryService.isWalletConnected()) {
                return null;
            }

            const currentChainId = await ProviderFactoryService.getCurrentChainId();
            const signer = await ProviderFactoryService.getSigner();
            const userAddress = await signer.getAddress();

            const swapParams: OrchestratorSwapParams = {
                fromToken: params.fromToken,
                toToken: params.toToken,
                amount: params.amount,
                fromChainId: params.fromChainId || currentChainId,
                toChainId: params.toChainId || currentChainId,
                userAddress,
                slippageTolerance: params.slippageTolerance || (isMiniPay ? TX_CONFIG.MINIPAY_SLIPPAGE : TX_CONFIG.DEFAULT_SLIPPAGE),
            };

            const estimate = await SwapOrchestratorService.getEstimate(swapParams);

            // Convert to user-friendly format
            const userEstimate: SwapEstimate = {
                expectedOutput: estimate.expectedOutput,
                minimumOutput: estimate.minimumOutput,
                estimatedTime: getEstimatedTime(swapParams),
                networkFee: formatNetworkFee(estimate.gasCostEstimate),
                priceImpact: `${estimate.priceImpact.toFixed(2)}%`,
                riskLevel: assessRiskLevel(swapParams, estimate),
                route: getRouteDescription(swapParams)
            };

            setCurrentEstimate(userEstimate);
            return userEstimate;

        } catch (error: any) {
            console.error('Failed to get estimate:', error);
            return null;
        }
    }, [chainId, isMiniPay]);

    const swap = async (params: HookSwapParams): Promise<SwapResult> => {
        const {
            fromToken,
            toToken,
            amount,
            fromChainId,
            toChainId,
            slippageTolerance,
            onApprovalSubmitted,
            onApprovalConfirmed,
            onSwapSubmitted,
            onProgress,
        } = params;

        // Determine slippage tolerance
        const finalSlippage = slippageTolerance !== undefined
            ? slippageTolerance
            : (isMiniPay ? TX_CONFIG.MINIPAY_SLIPPAGE : TX_CONFIG.DEFAULT_SLIPPAGE);

        // Reset state
        setState({
            step: 'approving',
            isLoading: true,
            error: null,
            txHash: null,
            approvalTxHash: null,
        });

        const result: SwapResult = { success: false };

        try {
            onProgress?.('Connecting to wallet...', 1, 4);

            // Validate wallet connection
            if (!ProviderFactoryService.isWalletConnected()) {
                throw new Error('No wallet detected');
            }

            // Always get fresh chain ID from wallet to ensure we're on the right network
            const currentChainId = await ProviderFactoryService.getCurrentChainId();
            if (currentChainId !== chainId) {
                console.log(`[useSwap] Chain ID updated: ${chainId} -> ${currentChainId}`);
                setChainId(currentChainId);
            }

            // Get user address
            const signer = await ProviderFactoryService.getSigner();
            const userAddress = await signer.getAddress();

            onProgress?.('Finding best swap route...', 2, 4);

            // Prepare swap parameters for orchestrator
            const swapParams: OrchestratorSwapParams = {
                fromToken,
                toToken,
                amount,
                fromChainId: params.fromChainId || currentChainId,
                toChainId: params.toChainId || currentChainId,
                userAddress,
                slippageTolerance: finalSlippage,
            };

            // Check if swap is supported
            if (!SwapOrchestratorService.isSwapSupported(swapParams)) {
                throw new Error(
                    `This token pair is not available on ${ChainDetectionService.getNetworkName(currentChainId)}`
                );
            }

            console.log(`[useSwap] Executing ${SwapOrchestratorService.getSwapType(swapParams)} swap`);

            // Execute swap via orchestrator with enhanced callbacks
            const swapResult = await SwapOrchestratorService.executeSwap(swapParams, {
                onApprovalSubmitted: (hash) => {
                    setState((prev) => ({ ...prev, approvalTxHash: hash }));
                    onProgress?.('Token approval submitted...', 3, 4);
                    onApprovalSubmitted?.(hash);
                },
                onApprovalConfirmed: () => {
                    setState((prev) => ({ ...prev, step: 'swapping' }));
                    onProgress?.('Executing swap...', 3, 4);
                    onApprovalConfirmed?.();
                },
                onSwapSubmitted: (hash) => {
                    setState((prev) => ({ ...prev, txHash: hash }));
                    onProgress?.('Swap submitted, waiting for confirmation...', 4, 4);
                    onSwapSubmitted?.(hash);
                },
            });

            if (!swapResult.success) {
                throw new Error(swapResult.error || 'Swap failed');
            }

            // Success
            result.success = true;
            result.swapTxHash = swapResult.txHash;
            result.approvalTxHash = swapResult.approvalTxHash;

            setState({
                step: 'completed',
                isLoading: false,
                error: null,
                txHash: swapResult.txHash || null,
                approvalTxHash: swapResult.approvalTxHash || null,
            });

            onProgress?.('Swap completed successfully!', 4, 4);
            return result;

        } catch (error) {
            console.error('Swap error:', error);

            const errorMessage = SwapErrorHandler.handle(error, 'swap tokens');
            result.error = errorMessage;

            setState({
                step: 'error',
                isLoading: false,
                error: errorMessage,
                txHash: null,
                approvalTxHash: result.approvalTxHash || null,
            });

            return result;
        }
    };

    // Helper function to get estimated time
    const getEstimatedTime = (params: OrchestratorSwapParams): string => {
        if (ChainDetectionService.isCrossChain(params.fromChainId, params.toChainId)) {
            return '5-10 minutes';
        }

        if (ChainDetectionService.isCelo(params.fromChainId)) {
            return '~30 seconds';
        }

        if (ChainDetectionService.isArbitrum(params.fromChainId)) {
            return '~15 seconds';
        }

        return '~30 seconds';
    };

    // Helper function to format network fee
    const formatNetworkFee = (gasCostWei: any): string => {
        try {
            const gasInEth = parseFloat(gasCostWei.toString()) / 1e18;
            const gasInUsd = gasInEth * 2000; // Rough ETH price

            if (gasInUsd < 0.01) return '<$0.01';
            if (gasInUsd < 1) return `$${gasInUsd.toFixed(2)}`;
            return `$${gasInUsd.toFixed(0)}`;
        } catch {
            return '~$2-5';
        }
    };

    // Helper function to assess risk level
    const assessRiskLevel = (params: OrchestratorSwapParams, estimate: any): 'low' | 'medium' | 'high' => {
        if (ChainDetectionService.isCrossChain(params.fromChainId, params.toChainId)) {
            return 'medium';
        }

        if (estimate.priceImpact > 2) return 'high';
        if (estimate.priceImpact > 0.5) return 'medium';

        if (params.fromToken === 'PAXG' || params.toToken === 'PAXG') {
            return 'medium';
        }

        return 'low';
    };

    // Helper function to get route description
    const getRouteDescription = (params: OrchestratorSwapParams): string => {
        if (ChainDetectionService.isCrossChain(params.fromChainId, params.toChainId)) {
            return 'Cross-chain bridge';
        }

        if (ChainDetectionService.isCelo(params.fromChainId)) {
            return 'Celo native swap';
        }

        if (ChainDetectionService.isArbitrum(params.fromChainId)) {
            return 'Best rate aggregator';
        }

        return 'Optimized route';
    };

    return {
        swap,
        getEstimate,
        currentEstimate,
        ...state,
        chainId,
        isMiniPay,
        refreshChainId,
    };
}
