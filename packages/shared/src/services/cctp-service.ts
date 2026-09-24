/**
 * CCTP V2 Service — burn/mint USDC transfers between supported chains.
 *
 * Implements the flow from
 * https://developers.circle.com/cctp/quickstarts/transfer-usdc-ethereum-to-arc:
 *   1. approve USDC spend to TokenMessengerV2 (only when allowance is short)
 *   2. depositForBurn (direct mint) or depositForBurnWithHook (Forwarding
 *      Service — Circle performs the destination receiveMessage itself)
 *   3. poll the Iris messages API until the attestation is `complete`
 *      (or `forwardTxHash` appears on the forwarding path)
 *   4. MessageTransmitterV2.receiveMessage on the destination (skipped when
 *      forwarded)
 *
 * Contract addresses: https://developers.circle.com/cctp/references/contract-addresses
 * Fees API:           https://developers.circle.com/cctp/concepts/fees
 *                     GET /v2/burn/USDC/fees/{sourceDomain}/{destDomain}
 *                     (`?forward=true` adds the forwarding fee breakdown)
 * Messages API:       GET /v2/messages/{sourceDomain}?transactionHash={hash}
 *
 * ethers v5 (the version this package already depends on).
 */

import { ethers } from 'ethers';
import { CIRCLE_CONFIG } from '../config';

export type CctpChainKey = 'arbitrum' | 'arc' | 'arbitrum-sepolia' | 'arc-testnet';

export interface CctpChainConfig {
    key: CctpChainKey;
    chainId: number;
    domain: number;
    usdc: string;
    tokenMessenger: string;
    messageTransmitter: string;
    rpcUrl: string;
    explorerBase: string;
    /** Iris host: mainnet API vs sandbox API. */
    irisBase: string;
}

const IRIS_MAINNET = 'https://iris-api.circle.com';
const IRIS_SANDBOX = 'https://iris-api-sandbox.circle.com';

export const CCTP_CHAINS: Record<CctpChainKey, CctpChainConfig> = {
    arbitrum: {
        key: 'arbitrum',
        chainId: 42161,
        domain: CIRCLE_CONFIG.CCTP.DOMAINS.ARBITRUM,
        usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        tokenMessenger: CIRCLE_CONFIG.CCTP.TOKEN_MESSENGER.ARBITRUM,
        messageTransmitter: CIRCLE_CONFIG.CCTP.MESSAGE_TRANSMITTER.ARBITRUM,
        rpcUrl: process.env.ARBITRUM_ONE_RPC_URL || 'https://arb1.arbitrum.io/rpc',
        explorerBase: 'https://arbiscan.io',
        irisBase: IRIS_MAINNET,
    },
    arc: {
        key: 'arc',
        chainId: 5042,
        domain: CIRCLE_CONFIG.CCTP.DOMAINS.ARC,
        usdc: '0x3600000000000000000000000000000000000000',
        tokenMessenger: CIRCLE_CONFIG.CCTP.TOKEN_MESSENGER.ARC,
        messageTransmitter: CIRCLE_CONFIG.CCTP.MESSAGE_TRANSMITTER.ARC,
        rpcUrl: process.env.ARC_MAINNET_RPC_URL || 'https://rpc.mainnet.arc.io',
        explorerBase: 'https://explorer.arc.io',
        irisBase: IRIS_MAINNET,
    },
    'arbitrum-sepolia': {
        key: 'arbitrum-sepolia',
        chainId: 421614,
        domain: CIRCLE_CONFIG.CCTP.DOMAINS.ARBITRUM,
        usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
        tokenMessenger: CIRCLE_CONFIG.CCTP.TOKEN_MESSENGER.ARBITRUM_SEPOLIA,
        messageTransmitter: CIRCLE_CONFIG.CCTP.MESSAGE_TRANSMITTER.ARBITRUM_SEPOLIA,
        rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc',
        explorerBase: 'https://sepolia.arbiscan.io',
        irisBase: IRIS_SANDBOX,
    },
    'arc-testnet': {
        key: 'arc-testnet',
        chainId: 5042002,
        domain: CIRCLE_CONFIG.CCTP.DOMAINS.ARC,
        usdc: '0x3600000000000000000000000000000000000000',
        tokenMessenger: CIRCLE_CONFIG.CCTP.TOKEN_MESSENGER.ARC_TESTNET,
        messageTransmitter: CIRCLE_CONFIG.CCTP.MESSAGE_TRANSMITTER.ARC_TESTNET,
        rpcUrl: process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network',
        explorerBase: 'https://explorer.testnet.arc.io',
        irisBase: IRIS_SANDBOX,
    },
};

export function cctpChainForChainId(chainId: number): CctpChainConfig | null {
    return Object.values(CCTP_CHAINS).find((c) => c.chainId === chainId) ?? null;
}

/** ERC-20 address → bytes32 (left-padded), per the CCTP interface. */
export function addressToBytes32(address: string): string {
    return ethers.utils.hexZeroPad(ethers.utils.getAddress(address), 32);
}

export const CCTP_DESTINATION_CALLER_ANY =
    '0x0000000000000000000000000000000000000000000000000000000000000000';

/** Fast Transfer = minFinalityThreshold 1000; Standard = 2000. */
export const FAST_FINALITY_THRESHOLD = 1000;
export const STANDARD_FINALITY_THRESHOLD = 2000;

const ERC20_ABI = [
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function balanceOf(address owner) view returns (uint256)',
    'function decimals() view returns (uint8)',
] as const;

const TOKEN_MESSENGER_V2_ABI = [
    'function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, bytes32 destinationCaller, uint256 maxFee, uint32 minFinalityThreshold)',
    'function depositForBurnWithHook(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, bytes32 destinationCaller, uint256 maxFee, uint32 minFinalityThreshold, bytes hookData)',
] as const;

const MESSAGE_TRANSMITTER_V2_ABI = [
    'function receiveMessage(bytes message, bytes attestation)',
] as const;

export interface CctpFeeEntry {
    finalityThreshold: number;
    minimumFee: number; // basis points
    forwardFee?: { low: number; med: number; high: number };
}

/**
 * GET /v2/burn/USDC/fees/{sourceDomain}/{destDomain}[?forward=true].
 * Never throws — returns null on any failure so callers can fall back.
 */
export async function quoteFee(
    sourceChain: CctpChainKey,
    destinationChain: CctpChainKey,
    forward = false,
): Promise<CctpFeeEntry[] | null> {
    const src = CCTP_CHAINS[sourceChain];
    const dst = CCTP_CHAINS[destinationChain];
    try {
        const url = `${src.irisBase}/v2/burn/USDC/fees/${src.domain}/${dst.domain}${forward ? '?forward=true' : ''}`;
        const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
        if (!res.ok) return null;
        const data = await res.json();
        return Array.isArray(data) ? (data as CctpFeeEntry[]) : null;
    } catch {
        return null;
    }
}

/**
 * Fee math per the docs (fees page worked example):
 *   protocolFee = amount × round(minimumFee × 100) / 1_000_000   (bps → subunits)
 *   maxFee      = (protocolFee + forwardFee.med) × 1.2 buffer
 * All in USDC subunits (6 decimals). Never hardcode fee values — this is
 * computed from the live fees response.
 */
export function computeMaxFee(
    amountSubunits: ethers.BigNumber,
    feeEntry: CctpFeeEntry,
    forward = false,
): ethers.BigNumber {
    const protocolFee = amountSubunits
        .mul(ethers.BigNumber.from(Math.round(feeEntry.minimumFee * 100)))
        .div(1_000_000);
    const forwardFee = forward && feeEntry.forwardFee
        ? ethers.BigNumber.from(Math.round(feeEntry.forwardFee.med))
        : ethers.BigNumber.from(0);
    return protocolFee.add(forwardFee).mul(120).div(100);
}

export function usdcToSubunits(amountUsdc: string): ethers.BigNumber {
    return ethers.utils.parseUnits(amountUsdc, 6);
}

export interface BurnResult {
    txHash: string;
    maxFee: string;
    totalAmount: string;
    approved: boolean;
    forwarded: boolean;
}

export interface BurnParams {
    signer: ethers.Signer;
    sourceChain: CctpChainKey;
    destinationChain: CctpChainKey;
    recipient: string;
    amountUsdc: string;
    /** Fast Transfer (minFinalityThreshold 1000) — default true. */
    fast?: boolean;
    /** Forwarding Service — Circle submits the destination mint. */
    forward?: boolean;
    /** Pre-fetched fee entries (e.g. from a dry-run quote) to avoid refetching. */
    feeEntries?: CctpFeeEntry[];
    /** Escape hatch: allow a burn with maxFee=0 (Standard transfers only —
     *  Fast/Forwarded burns with maxFee=0 will revert or strand the transfer). */
    allowZeroMaxFee?: boolean;
}

/**
 * Approve (if needed) + depositForBurn on the source chain. Returns the burn
 * tx hash; attestation/mint are separate steps.
 */
export async function burn(params: BurnParams): Promise<BurnResult> {
    const src = CCTP_CHAINS[params.sourceChain];
    const dst = CCTP_CHAINS[params.destinationChain];
    if (!src || !dst) throw new Error(`Unsupported CCTP route ${params.sourceChain}→${params.destinationChain}`);

    const forward = params.forward === true;
    const fast = params.fast !== false;
    const finality = fast ? FAST_FINALITY_THRESHOLD : STANDARD_FINALITY_THRESHOLD;

    const fees = params.feeEntries ?? (await quoteFee(params.sourceChain, params.destinationChain, forward));
    const entry = fees?.find((f) => f.finalityThreshold === finality) ?? fees?.[0];

    // Per https://developers.circle.com/cctp/concepts/fees, maxFee is charged at
    // mint/burn time — an under-quoted maxFee on a Fast or Forwarded transfer
    // can strand the burn or revert at mint. Never burn on a missing/guessed
    // quote; Standard callers may opt out explicitly via allowZeroMaxFee.
    if (!entry && !params.allowZeroMaxFee) {
        throw new Error(
            `No CCTP fee quote for ${params.sourceChain}→${params.destinationChain} ` +
            `(finality ${finality}${forward ? ', forwarding' : ''}) — refusing to burn with a guessed maxFee`,
        );
    }

    const amount = usdcToSubunits(params.amountUsdc);
    const maxFee = entry ? computeMaxFee(amount, entry, forward) : ethers.BigNumber.from(0);
    // Forwarding burns amount + maxFee (fees are pulled alongside the burn);
    // the direct path deducts the fee at mint instead.
    const burnAmount = forward ? amount.add(maxFee) : amount;

    const signerAddress = await params.signer.getAddress();
    const usdc = new ethers.Contract(src.usdc, ERC20_ABI, params.signer);
    const allowance: ethers.BigNumber = await usdc.allowance(signerAddress, src.tokenMessenger);

    let approved = false;
    if (allowance.lt(burnAmount)) {
        const approveTx = await usdc.approve(src.tokenMessenger, burnAmount);
        await approveTx.wait(1);
        approved = true;
    }

    const messenger = new ethers.Contract(src.tokenMessenger, TOKEN_MESSENGER_V2_ABI, params.signer);
    const mintRecipient = addressToBytes32(params.recipient);

    const burnTx = forward
        ? await messenger.depositForBurnWithHook(
            burnAmount, dst.domain, mintRecipient, src.usdc,
            CCTP_DESTINATION_CALLER_ANY, maxFee, finality,
            CIRCLE_CONFIG.CCTP.FORWARDING_HOOK_DATA,
          )
        : await messenger.depositForBurn(
            burnAmount, dst.domain, mintRecipient, src.usdc,
            CCTP_DESTINATION_CALLER_ANY, maxFee, finality,
          );

    return {
        txHash: burnTx.hash,
        maxFee: ethers.utils.formatUnits(maxFee, 6),
        totalAmount: ethers.utils.formatUnits(burnAmount, 6),
        approved,
        forwarded: forward,
    };
}

export interface AttestationResult {
    message: string;
    attestation: string;
    /** Present on the Forwarding path — Circle's destination mint tx. */
    forwardTxHash?: string;
}

/**
 * Poll the Iris messages API until the burn's attestation completes (direct
 * path) or a forwardTxHash appears (forwarding path). Default timeout 10 min —
 * Standard transfers can take several minutes.
 */
export async function waitForAttestation(params: {
    sourceChain: CctpChainKey;
    txHash: string;
    timeoutMs?: number;
    pollMs?: number;
    forwarded?: boolean;
}): Promise<AttestationResult> {
    const src = CCTP_CHAINS[params.sourceChain];
    const timeoutMs = params.timeoutMs ?? 10 * 60 * 1000;
    const pollMs = params.pollMs ?? 5_000;
    const deadline = Date.now() + timeoutMs;
    const url = `${src.irisBase}/v2/messages/${src.domain}?transactionHash=${params.txHash}`;

    while (Date.now() < deadline) {
        try {
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                const msg = data?.messages?.[0];
                if (params.forwarded && msg?.forwardTxHash) {
                    return {
                        message: msg.message ?? '',
                        attestation: msg.attestation ?? '',
                        forwardTxHash: msg.forwardTxHash,
                    };
                }
                if (msg?.status === 'complete') {
                    return { message: msg.message, attestation: msg.attestation };
                }
            }
        } catch {
            // transient — keep polling until the deadline
        }
        await new Promise((r) => setTimeout(r, pollMs));
    }
    throw new Error(`Attestation not ready within ${timeoutMs}ms for ${params.txHash}`);
}

/**
 * Submit MessageTransmitterV2.receiveMessage on the destination chain.
 * Skipped on the Forwarding path (Circle performs it).
 */
export async function mint(params: {
    signer: ethers.Signer;
    destinationChain: CctpChainKey;
    message: string;
    attestation: string;
}): Promise<string> {
    const dst = CCTP_CHAINS[params.destinationChain];
    if (!dst) throw new Error(`Unsupported CCTP destination ${params.destinationChain}`);
    const transmitter = new ethers.Contract(dst.messageTransmitter, MESSAGE_TRANSMITTER_V2_ABI, params.signer);
    const tx = await transmitter.receiveMessage(params.message, params.attestation);
    return tx.hash;
}
