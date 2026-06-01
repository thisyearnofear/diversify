/**
 * useX402Payment — Client-side x402 payment hook
 *
 * Implements the full buyer side of the x402 protocol:
 *   1. Fetch 402 challenge from gateway (nonce, amount, recipient)
 *   2. Send real USDC transfer on Arc from user's connected wallet
 *   3. Return tx hash as x-payment-proof for the follow-up request
 *
 * Core Principles:
 * - ENHANCEMENT FIRST: Wraps existing providerRef from use-wallet, no new infra
 * - SINGLE RESPONSIBILITY: Only payment — data fetching stays in use-agent-chat
 * - DRY: ARC_TOKENS.USDC and ARC_TESTNET chainId from shared config
 */

import { useCallback, useState } from 'react';
import { ethers } from 'ethers';
import { useWallets } from '@privy-io/react-auth';
import { useWalletContext } from '../components/wallet/WalletProvider';
import { ARC_TOKENS, NETWORKS } from '../config';
import type { ResearchQuote, ResearchReceipt, ResearchSourceLineItem } from '@diversifi/shared';

const GATEWAY_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';
const ARC_CHAIN_ID = NETWORKS.ARC_TESTNET.chainId; // 5042002

// Minimal ERC-20 transfer ABI
const USDC_ABI = [
    'function transfer(address to, uint256 amount) returns (bool)',
    'function balanceOf(address owner) view returns (uint256)',
] as const;

export interface X402PaymentResult {
    txHash: string;
    amount: string;
    explorer: string;
    nonce: string;
}

type X402Challenge = {
    status?: 'free' | 'quoted';
    recipient: string;
    amount: string;
    nonce: string;
    currency: 'USDC';
    chainId: number;
    expires: number;
    current_balance?: string;
    required_cost?: number;
    requested_sources?: string[];
    bundle_requested?: boolean;
    reason?: string;
    sources?: Array<ResearchSourceLineItem & { freeRemaining?: number }>;
};

export interface X402PaymentState {
    isPaying: boolean;
    lastPayment: X402PaymentResult | null;
    error: string | null;
}

export function useX402Payment() {
    const { address } = useWalletContext();
    const { wallets } = useWallets();
    const [state, setState] = useState<X402PaymentState>({
        isPaying: false,
        lastPayment: null,
        error: null,
    });

    const toQuote = (challenge: X402Challenge): ResearchQuote => ({
        status: challenge.status === 'free' ? 'free' : 'quoted',
        amount: challenge.amount,
        currency: challenge.currency,
        chainId: challenge.chainId,
        recipient: challenge.recipient,
        nonce: challenge.nonce,
        expires: challenge.expires,
        currentBalance: challenge.current_balance || '0.0000',
        requiredCost: challenge.required_cost ?? parseFloat(challenge.amount),
        requestedSources: challenge.requested_sources || [],
        bundleRequested: Boolean(challenge.bundle_requested),
        reason: challenge.reason || 'Premium research requires Arc USDC.',
        sources: challenge.sources || [],
    });

    const buildReceipt = (
        gatewayData: any,
        payment: X402PaymentResult | null,
        fallbackStatus: ResearchReceipt['status'] = 'free',
    ): ResearchReceipt => {
        const sources = ((gatewayData?.sources || (gatewayData?._research?.source ? [gatewayData._research.source] : [])) as any[])
            .map((source): ResearchSourceLineItem => ({
                sourceId: source.sourceId || source.id || source.source_id || source.label,
                label: source.label || source.sourceId || source.id || 'Research source',
                tier: source.tier === 'paid' ? 'paid' : 'free',
                cost: Number(source.cost || 0),
                dataType: source.dataType,
                category: source.category,
                freshnessMinutes: source.freshnessMinutes,
                reputation: source.reputation,
            }));
        const billing = gatewayData?._billing || {};
        const sourceCost = sources.reduce((sum, source) => sum + source.cost, 0);
        const amount = payment?.amount || Number(billing.cost ?? sourceCost ?? 0).toFixed(3);
        const status: ResearchReceipt['status'] = payment
            ? 'paid'
            : Number(billing.cost || sourceCost) > 0
                ? 'credit'
                : fallbackStatus;

        return {
            status,
            amount,
            currency: 'USDC',
            sources,
            txHash: payment?.txHash,
            explorer: payment?.explorer,
            nonce: payment?.nonce,
            remainingCredit: billing.remaining_credit,
            reason: billing.reason,
            arcSettled: Boolean(billing.arcSettled),
            settlementTxHashes: billing.txHashes,
            settlementExplorers: billing.explorer,
        };
    };

    const payChallenge = useCallback(async (
        challenge: X402Challenge,
    ): Promise<{ headers: Record<string, string>; payment: X402PaymentResult }> => {
        const { recipient, amount, nonce, currency } = challenge;

        if (currency !== 'USDC') {
            throw new Error(`Unexpected payment currency: ${currency}`);
        }

        if (!address) {
            throw new Error('Wallet not connected — connect your wallet to use premium research');
        }

        setState(s => ({ ...s, isPaying: true, error: null }));

        try {
            // Step 2: get the user's wallet provider via Privy
            const embeddedWallet = wallets[0];
            if (!embeddedWallet) throw new Error('No wallet available — connect your wallet first');

            const rawProvider = await embeddedWallet.getEthereumProvider();
            if (!rawProvider) throw new Error('No wallet provider available');

            const web3Provider = new ethers.providers.Web3Provider(rawProvider as any);
            const signer = web3Provider.getSigner();

            // Step 3: switch to Arc testnet if needed
            const network = await web3Provider.getNetwork();
            if (network.chainId !== ARC_CHAIN_ID) {
                await (rawProvider as any).request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: `0x${ARC_CHAIN_ID.toString(16)}` }],
                });
            }

            // Step 4: send the USDC transfer on Arc
            const usdc = new ethers.Contract(ARC_TOKENS.USDC, USDC_ABI, signer);
            const amountRaw = ethers.utils.parseUnits(
                parseFloat(amount).toFixed(6),
                6, // USDC decimals
            );

            const tx = await usdc.transfer(recipient, amountRaw, {
                gasLimit: 80_000,
            });

            const payment: X402PaymentResult = {
                txHash: tx.hash,
                amount,
                nonce,
                explorer: `https://testnet.arcscan.app/tx/${tx.hash}`,
            };

            setState(s => ({ ...s, isPaying: false, lastPayment: payment }));

            // Step 5: return headers for the real follow-up request
            return {
                headers: {
                    'x-payment-proof': `${tx.hash}`,
                    'x-payment-nonce': nonce,
                },
                payment,
            };

        } catch (err: any) {
            const msg = err?.message || 'Payment failed';
            setState(s => ({ ...s, isPaying: false, error: msg }));
            throw new Error(msg);
        }
    }, [address, wallets]);

    /**
     * Pay for a source and return the proof headers to attach to the real request.
     * Returns null if the source is free-tier (no payment needed).
     */
    const payForSource = useCallback(async (
        source: string,
    ): Promise<{ headers: Record<string, string>; payment: X402PaymentResult | null; quote?: ResearchQuote }> => {

        // Step 1: probe the gateway — if 200 (free tier), no payment needed
        const probe = await fetch(
            `${GATEWAY_BASE}/api/agent/x402-gateway?source=${source}`,
            { method: 'GET' },
        );

        if (probe.ok) {
            // Free tier — no payment required
            return { headers: {}, payment: null };
        }

        if (probe.status !== 402) {
            throw new Error(`Gateway returned unexpected status ${probe.status}`);
        }

        const challenge = await probe.json() as X402Challenge;
        const quote = toQuote(challenge);
        const result = await payChallenge(challenge);
        return { ...result, quote };
    }, [payChallenge]);

    const quoteResearch = useCallback(async (source: string): Promise<ResearchQuote> => {
        const paramKey = source.includes(',') ? 'sources' : 'source';
        const url = `${GATEWAY_BASE}/api/agent/x402-gateway?${paramKey}=${encodeURIComponent(source)}&quote=1`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Research quote failed: ${response.status}`);
        }
        return toQuote(await response.json() as X402Challenge);
    }, []);

    /**
     * Fetch a paid source end-to-end: handle 402 → pay → re-fetch with proof.
     * Drop-in replacement for a plain fetch() call to the gateway.
     */
    const fetchPaidSource = useCallback(async (source: string): Promise<{
        data: any;
        payment: X402PaymentResult | null;
        quote: ResearchQuote | null;
        receipt: ResearchReceipt;
    }> => {
        // Use 'sources' param for comma-separated bundles, 'source' for single
        const paramKey = source.includes(',') ? 'sources' : 'source';
        const url = `${GATEWAY_BASE}/api/agent/x402-gateway?${paramKey}=${encodeURIComponent(source)}`;

        // First attempt — may return 200 (free tier) or 402 (needs payment)
        const firstAttempt = await fetch(url);

        if (firstAttempt.ok) {
            // Free tier — return data directly
            const data = await firstAttempt.json();
            return { data, payment: null, quote: null, receipt: buildReceipt(data, null) };
        }

        if (firstAttempt.status !== 402) {
            throw new Error(`Gateway returned unexpected status ${firstAttempt.status}`);
        }

        // 402 — pay the exact challenge amount for this request. For bundles, this
        // must be the bundle quote, not the first source's single-source price.
        const challenge = await firstAttempt.json() as X402Challenge;
        const quote = toQuote(challenge);
        const { headers, payment } = await payChallenge(challenge);

        // Re-fetch with payment proof
        const res = await fetch(url, { headers: { ...headers } });

        if (!res.ok) {
            throw new Error(`Gateway request failed after payment: ${res.status}`);
        }

        const data = await res.json();
        return { data, payment, quote, receipt: buildReceipt(data, payment) };
    }, [payChallenge]);

    return {
        ...state,
        payForSource,
        payChallenge,
        quoteResearch,
        fetchPaidSource,
        isArcConnected: true, // Arc chain switching handled inside payForSource
    };
}
