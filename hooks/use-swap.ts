/**
 * Orchestrator hook for swap functionality
 * Clean, modular, and testable - uses SwapOrchestrator
 */

import { useState, useEffect, useCallback } from 'react';
import { SwapOrchestratorService } from '../services/swap/swap-orchestrator.service';
import { ProviderFactoryService } from '../services/swap/provider-factory.service';
import { ChainDetectionService } from '../services/swap/chain-detection.service';
import { SwapErrorHandler } from '../services/swap/error-handler';
import { isMiniPayEnvironment } from '../utils/environment';
import { TX_CONFIG } from '../config';
import type { SwapParams as OrchestratorSwapParams, SwapCallbacks, SwapResult, SwapState } from '../types/swap';

interface HookSwapParams {
    fromToken: string;
    toToken: string;
    amount: string;
    fromChainId?: number; // Allow specifying source chain
    toChainId?: number;   // Allow specifying destination chain
    slippageTolerance?: number;
    onApprovalSubmitted?: (hash: string) => void;
    onApprovalConfirmed?: () => void;
    onSwapSubmitted?: (hash: string) => void;
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

        // Listen for chain changes from wallet
        if (typeof window !== 'undefined' && window.ethereum) {
            const handleChainChanged = (chainIdHex: string) => {
                const newChainId = parseInt(chainIdHex, 16);
                console.log('[useSwap] Chain changed to:', newChainId);
                setChainId(newChainId);
            };

            window.ethereum.on('chainChanged', handleChainChanged);

            return () => {
                window.ethereum?.removeListener('chainChanged', handleChainChanged);
            };
        }
    }, [refreshChainId]);

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
                    `Swap not supported: ${fromToken} → ${toToken} on ${ChainDetectionService.getNetworkName(currentChainId)}`
                );
            }

            console.log(`[useSwap] Executing ${SwapOrchestratorService.getSwapType(swapParams)} swap`);

            // Execute swap via orchestrator
            const swapResult = await SwapOrchestratorService.executeSwap(swapParams, {
                onApprovalSubmitted: (hash) => {
                    setState((prev) => ({ ...prev, approvalTxHash: hash }));
                    onApprovalSubmitted?.(hash);
                },
                onApprovalConfirmed: () => {
                    setState((prev) => ({ ...prev, step: 'swapping' }));
                    onApprovalConfirmed?.();
                },
                onSwapSubmitted: (hash) => {
                    setState((prev) => ({ ...prev, txHash: hash }));
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

    return {
        swap,
        ...state,
        chainId,
        isMiniPay,
        refreshChainId,
    };
}
