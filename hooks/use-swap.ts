/**
 * Orchestrator hook for swap functionality
 * Clean, modular, and testable
 */

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { getTokenAddresses, getBrokerAddress, TX_CONFIG, NETWORKS, TOKEN_METADATA } from '../config';
import { ApprovalService } from '../services/swap/approval';
import { ExchangeDiscoveryService } from '../services/swap/exchange-discovery';
import { SwapExecutionService } from '../services/swap/execution';
import { SwapErrorHandler } from '../services/swap/error-handler';
import { isMiniPayEnvironment } from '../utils/environment';
import type { SwapParams, SwapCallbacks, SwapResult, SwapState } from '../types/swap';

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

    // Detect environment on mount
    useEffect(() => {
        const detectEnvironment = async () => {
            setIsMiniPay(isMiniPayEnvironment());

            if (typeof window !== 'undefined' && window.ethereum) {
                try {
                    const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
                    setChainId(parseInt(chainIdHex as string, 16));
                } catch (err) {
                    console.warn('Error detecting chain ID:', err);
                }
            }
        };

        detectEnvironment();
    }, []);

    const swap = async (params: SwapParams & SwapCallbacks): Promise<SwapResult> => {
        const {
            fromToken,
            toToken,
            amount,
            slippageTolerance = isMiniPay ? TX_CONFIG.MINIPAY_SLIPPAGE : TX_CONFIG.DEFAULT_SLIPPAGE,
            onApprovalSubmitted,
            onApprovalConfirmed,
            onSwapSubmitted,
        } = params;

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
            // Validate environment
            if (!window.ethereum) {
                throw new Error('No wallet detected');
            }

            // Get accounts
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            const userAddress = accounts[0];

            // Get current chain ID
            const currentChainId = chainId || parseInt(
                await window.ethereum.request({ method: 'eth_chainId' }) as string,
                16
            );

            // Setup provider and signer
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const signer = provider.getSigner();

            // Get configuration
            const tokens = getTokenAddresses(currentChainId);
            const brokerAddress = getBrokerAddress(currentChainId);
            const isTestnet = currentChainId === NETWORKS.ALFAJORES.chainId;

            // Get token addresses
            const fromTokenAddress = tokens[fromToken as keyof typeof tokens];
            const toTokenAddress = tokens[toToken as keyof typeof tokens];

            if (!fromTokenAddress || !toTokenAddress) {
                throw new Error(`Invalid token selection: ${fromToken}/${toToken}`);
            }

            // Get decimals
            const fromTokenMetadata = TOKEN_METADATA[fromToken] || TOKEN_METADATA[fromToken.toUpperCase()] || { decimals: 18 };
            const decimals = fromTokenMetadata.decimals || 18;

            // Parse amount
            const amountInWei = ethers.utils.parseUnits(amount, decimals);

            // Transaction options
            const useLegacyTx = isMiniPay || isTestnet;
            const gasPrice = useLegacyTx ? await provider.getGasPrice() : undefined;
            const txOptions = { useLegacyTx, gasPrice };

            // Step 1: Check and handle approval
            const approvalStatus = await ApprovalService.checkApproval(
                fromTokenAddress,
                userAddress,
                brokerAddress,
                amountInWei,
                provider,
                decimals
            );

            if (!approvalStatus.isApproved) {
                console.log(`Approving ${amount} ${fromToken}...`);

                const approveTx = await ApprovalService.approve(
                    fromTokenAddress,
                    brokerAddress,
                    amountInWei,
                    signer,
                    txOptions
                );

                result.approvalTxHash = approveTx.hash;
                setState((prev) => ({ ...prev, approvalTxHash: approveTx.hash }));
                onApprovalSubmitted?.(approveTx.hash);

                const confirmations = isTestnet
                    ? TX_CONFIG.CONFIRMATIONS.TESTNET
                    : TX_CONFIG.CONFIRMATIONS.MAINNET;

                await ApprovalService.waitForApproval(approveTx, confirmations);
                onApprovalConfirmed?.();
            }

            // Step 2: Find exchange
            setState((prev) => ({ ...prev, step: 'swapping' }));

            const exchangeInfo = await ExchangeDiscoveryService.findDirectExchange(
                brokerAddress,
                fromTokenAddress,
                toTokenAddress,
                provider
            );

            if (!exchangeInfo) {
                throw new Error(`No exchange found for ${fromToken}/${toToken}`);
            }

            // Step 3: Get quote
            const expectedAmountOut = await ExchangeDiscoveryService.getQuote(
                brokerAddress,
                exchangeInfo,
                fromTokenAddress,
                toTokenAddress,
                amountInWei,
                provider
            );

            const minAmountOut = SwapExecutionService.calculateMinAmountOut(
                expectedAmountOut,
                slippageTolerance
            );

            // Step 4: Execute swap
            const swapTx = await SwapExecutionService.executeSwap(
                brokerAddress,
                exchangeInfo,
                fromTokenAddress,
                toTokenAddress,
                amountInWei,
                minAmountOut,
                signer,
                txOptions
            );

            result.swapTxHash = swapTx.hash;
            setState((prev) => ({ ...prev, txHash: swapTx.hash }));
            onSwapSubmitted?.(swapTx.hash);

            // Step 5: Wait for confirmation
            const confirmations = isTestnet
                ? TX_CONFIG.CONFIRMATIONS.TESTNET
                : TX_CONFIG.CONFIRMATIONS.MAINNET;

            await SwapExecutionService.waitForSwap(swapTx, confirmations);

            // Success
            result.success = true;
            setState({
                step: 'completed',
                isLoading: false,
                error: null,
                txHash: swapTx.hash,
                approvalTxHash: result.approvalTxHash || null,
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
    };
}
