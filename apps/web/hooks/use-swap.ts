/**
 * Orchestrator hook for swap functionality
 * Clean, modular, and testable - uses SwapOrchestrator
 * Enhanced with user-friendly messaging and smart defaults
 */

import { useState, useEffect, useCallback } from 'react';
// Deep leaf imports — NOT the barrel — keeps the swap / wallet-provider
// stacks out of first-load.
import { SwapOrchestratorService } from '@diversifi/shared/src/services/swap/swap-orchestrator.service';
import { ProviderFactoryService } from '@diversifi/shared/src/services/swap/provider-factory.service';
import { ChainDetectionService } from '@diversifi/shared/src/services/swap/chain-detection.service';
import { SwapErrorHandler } from '@diversifi/shared/src/services/swap/error-handler';
import type { SwapState, SwapResult, SwapParams as OrchestratorSwapParams } from '@diversifi/shared/src/types/swap';
import {
    isMiniPayEnvironment,
} from '@diversifi/shared/src/utils/environment';
import {
    getWalletProvider,
    setupWalletEventListenersForProvider,
} from '@diversifi/shared/src/modules/wallet/core/provider-registry';
import {
    getAddChainParameter,
    toHexChainId,
} from '@diversifi/shared/src/modules/wallet/core/chains';
import { NETWORKS, TX_CONFIG } from '../config';

interface HookSwapParams {
    fromToken: string;
    toToken: string;
    amount: string;
    fromChainId?: number;
    toChainId?: number;
    slippageTolerance?: number;
    recipientAddress?: string;
    phoneNumber?: string;
    optimization?: 'speed' | 'cost'; // User preference for optimization
    contractCall?: {
        toContractAddress: string;
        toContractCallData: string;
        toContractGasLimit: string;
    };
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
    provider?: string;
}

// Native gas token per supported chain — for the pre-signing preflight.
const NATIVE_GAS_SYMBOLS: Record<number, string> = {
    [NETWORKS.CELO_MAINNET.chainId]: 'CELO',
    [NETWORKS.CELO_SEPOLIA.chainId]: 'CELO',
    [NETWORKS.ARBITRUM_ONE.chainId]: 'ETH',
    [NETWORKS.ARBITRUM_SEPOLIA.chainId]: 'ETH',
    [NETWORKS.ARC_TESTNET.chainId]: 'USDC',
    5042001: 'USDC', // Arc mainnet
};

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
                if (!provider) return;
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
                            setChainId(NETWORKS.CELO_MAINNET.chainId);
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
                recipientAddress: params.recipientAddress,
                phoneNumber: params.phoneNumber,
                contractCall: params.contractCall,
            };

            const estimate = await SwapOrchestratorService.getEstimate(swapParams);

            // Convert to user-friendly format
            const userEstimate: SwapEstimate = {
                expectedOutput: estimate.expectedOutput ?? '0',
                minimumOutput: estimate.minimumOutput ?? '0',
                estimatedTime: getEstimatedTime(swapParams),
                networkFee: formatNetworkFee(estimate.gasCostEstimate),
                priceImpact: `${estimate.priceImpact.toFixed(2)}%`,
                riskLevel: assessRiskLevel(swapParams, estimate),
                route: getRouteDescription(swapParams),
                provider: estimate.provider,
            };

            setCurrentEstimate(userEstimate);
            return userEstimate;

        } catch (error: any) {
            console.error('Failed to get estimate:', error);
            return null;
        }
    }, [isMiniPay]);

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
            let currentChainId = await ProviderFactoryService.getCurrentChainId();
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
                toChainId: params.toChainId || params.fromChainId || currentChainId,
                userAddress,
                slippageTolerance: finalSlippage,
                recipientAddress: params.recipientAddress,
                phoneNumber: params.phoneNumber,
                contractCall: params.contractCall,
            };

            // An explicitly pinned but unsupported source chain can't be
            // served — fail before any strategy runs. When no source was
            // pinned, the ticket displays the Celo asset list for unknown
            // wallet chains (getChainAssets fallback), so anchor the route
            // to Celo there rather than letting Celo token addresses leak
            // into a foreign-chain execution.
            if (!ChainDetectionService.isSupported(swapParams.fromChainId)) {
                if (params.fromChainId) {
                    throw new Error(
                        `Swaps on ${ChainDetectionService.getNetworkName(swapParams.fromChainId)} aren't supported. Please switch to a supported network.`
                    );
                }
                swapParams.fromChainId = NETWORKS.CELO_MAINNET.chainId;
                if (!params.toChainId) {
                    swapParams.toChainId = NETWORKS.CELO_MAINNET.chainId;
                }
            }

            // The wallet must sit on the source chain to sign. If it
            // doesn't (e.g. user is on Ethereum mainnet while the ticket
            // targets Celo), ask the wallet to switch before touching any
            // strategy — otherwise Celo token addresses get routed to a
            // foreign chain and fail deep inside 1inch/Uniswap.
            if (currentChainId !== swapParams.fromChainId && !isMiniPay) {
                const targetName = ChainDetectionService.getNetworkName(swapParams.fromChainId);
                onProgress?.(`Switching to ${targetName}...`, 2, 4);
                const provider = await getWalletProvider();
                try {
                    await provider.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: toHexChainId(swapParams.fromChainId) }],
                    });
                } catch (switchError: any) {
                    console.warn('[useSwap] wallet_switchEthereumChain failed:', switchError?.code, switchError?.message);
                    try {
                        await provider.request({
                            method: 'wallet_addEthereumChain',
                            params: [getAddChainParameter(swapParams.fromChainId)],
                        });
                    } catch (addError) {
                        console.error('[useSwap] wallet_addEthereumChain failed:', addError);
                        throw new Error(`Please switch your wallet to ${targetName} to continue.`);
                    }
                }
                const switchedChainId = await ProviderFactoryService.getCurrentChainId();
                if (switchedChainId !== swapParams.fromChainId) {
                    throw new Error(`Please switch your wallet to ${targetName} to continue.`);
                }
                currentChainId = switchedChainId;
                setChainId(switchedChainId);
                // The cached Web3Provider pins its detected network
                // (anyNetwork=false) — after a chain switch its
                // getNetwork() throws "underlying network changed".
                // Drop it so strategies get a provider bound to the
                // wallet's new chain.
                ProviderFactoryService.clearWeb3Cache();
            }

            // Gas preflight: a zero native balance can't even submit the
            // approval — fail before any strategy asks for a signature.
            try {
                const nativeBalance = await signer.provider!.getBalance(userAddress);
                if (nativeBalance.isZero()) {
                    const native = NATIVE_GAS_SYMBOLS[swapParams.fromChainId] || 'the native token';
                    const gasError: any = new Error(
                        `You need a little ${native} for network fees before swapping.`
                    );
                    gasError.errorClass = 'no-gas';
                    throw gasError;
                }
            } catch (gasCheckError: any) {
                if (gasCheckError?.errorClass) throw gasCheckError;
                // A failed balance read must not block the swap — continue.
            }

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
                    // LiFi never fires onApprovalConfirmed — without this the
                    // ticket would say "Preparing your route" for the entire
                    // on-chain wait. Submission IS the swapping state.
                    setState((prev) => ({ ...prev, step: 'swapping', txHash: hash }));
                    onProgress?.('Swap submitted, waiting for confirmation...', 4, 4);
                    onSwapSubmitted?.(hash);
                },
            });

            if (!swapResult.success) {
                const failure: any = new Error(swapResult.error || 'Swap failed');
                failure.errorClass = swapResult.errorClass;
                throw failure;
            }

            // Success
            result.success = true;
            result.txHash = swapResult.txHash;
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

        } catch (error: any) {
            console.error('Swap error:', error);

            // Classified errors already carry humanized orchestrator copy —
            // re-wrapping them in SwapErrorHandler's "Failed to swap tokens"
            // prefix would bury the actual reason.
            const errorMessage = error?.errorClass
                ? (error.message || 'Swap failed')
                : SwapErrorHandler.handle(error, 'swap tokens');
            result.error = errorMessage;
            result.errorClass = error?.errorClass;

            // Keep a submitted tx hash: on an on-chain failure the explorer
            // link is the proof that funds never left the wallet.
            setState((prev) => ({
                step: error?.errorClass === 'cancelled' ? 'idle' : 'error',
                isLoading: false,
                error: error?.errorClass === 'cancelled' ? null : errorMessage,
                errorClass: error?.errorClass || null,
                txHash: prev.txHash,
                approvalTxHash: result.approvalTxHash || prev.approvalTxHash,
            }));

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
