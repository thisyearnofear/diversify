/**
 * Arc On-Chain Settlement
 *
 * Sends real USDC micro-payments on Arc testnet for each paid research request.
 * Uses the VAULT_PRIVATE_KEY EOA — no Circle entity secret required.
 *
 * Core Principles:
 * - ENHANCEMENT FIRST: Plugs into existing verifyCircleGatewayPayment path
 * - SINGLE RESPONSIBILITY: Only handles Arc EOA settlement, nothing else
 * - PERFORMANT: Non-blocking — fires tx and returns hash immediately, does not
 *   wait for confirmation so gateway latency is unaffected
 * - DRY: ARC_RPC and USDC address come from shared config, never duplicated
 */

import { ethers } from 'ethers';
import { ARC_DATA_HUB_CONFIG, ARC_TOKENS } from '../config';

// Minimal ERC-20 ABI — transfer only
const ERC20_TRANSFER_ABI = [
    'function transfer(address to, uint256 amount) returns (bool)',
    'function balanceOf(address owner) view returns (uint256)',
] as const;
const TRANSFER_EVENT_ABI = [
    'event Transfer(address indexed from, address indexed to, uint256 value)',
] as const;

const ARC_RPC   = process.env.ARC_RPC_URL            || 'https://rpc.testnet.arc.network';
const USDC_ADDR = ARC_TOKENS.USDC;                    // 0x3600...0000
const HUB_ADDR  = process.env.DATA_HUB_RECIPIENT_ADDRESS || ARC_DATA_HUB_CONFIG.RECIPIENT_ADDRESS;
const ARC_EXPLORER_BASE = 'https://testnet.arcscan.app';
const SETTLEMENT_CACHE_TTL_MS = Number(process.env.ARC_SETTLEMENT_CACHE_TTL_MS || 30_000);
const SETTLEMENT_LOG_CHUNK_SIZE = Number(process.env.ARC_SETTLEMENT_LOG_CHUNK_SIZE || 20_000);
const SETTLEMENT_START_BLOCK = Number(process.env.ARC_SETTLEMENT_START_BLOCK || 0);
const SETTLEMENT_RECENT_LIMIT = Number(process.env.ARC_SETTLEMENT_RECENT_LIMIT || 10);
const MIN_LOG_CHUNK_SIZE = 500;
const transferInterface = new ethers.utils.Interface(TRANSFER_EVENT_ABI);
const transferTopic = transferInterface.getEventTopic('Transfer');

// Lazily initialised — one provider + signer for the lifetime of the process
let _provider: ethers.providers.JsonRpcProvider | null = null;
let _signer:   ethers.Wallet | null = null;
let _usdc:     ethers.Contract | null = null;
let _ready:    boolean | null = null; // null = unchecked, true/false = result
let _settlementStatsCache: {
    key: string;
    updatedAt: number;
    latestBlock: number;
    stats: ArcSettlementStats;
} | null = null;

function getProvider(): ethers.providers.JsonRpcProvider {
    if (!_provider) {
        _provider = new ethers.providers.JsonRpcProvider(ARC_RPC);
    }

    return _provider;
}

function getContracts(): { provider: ethers.providers.JsonRpcProvider; signer: ethers.Wallet; usdc: ethers.Contract } | null {
    if (_ready === false) return null;

    const key = process.env.VAULT_PRIVATE_KEY;
    if (!key) {
        _ready = false;
        console.warn('[ArcSettlement] VAULT_PRIVATE_KEY not set — on-chain settlement disabled');
        return null;
    }

    if (!_provider || !_signer || !_usdc) {
        _provider = getProvider();
        _signer   = new ethers.Wallet(key, _provider);
        _usdc     = new ethers.Contract(USDC_ADDR, ERC20_TRANSFER_ABI, _signer);
    }

    return { provider: _provider, signer: _signer!, usdc: _usdc! };
}

export interface SettlementResult {
    txHash: string;
    amount: string;       // USDC, e.g. "0.001"
    explorer: string;     // Arc testnet explorer link
    settled: true;
}

export interface SettlementSkipped {
    settled: false;
    reason: string;
}

export interface ArcSettlementTransfer {
    txHash: string;
    amountUSDC: string;
    blockNumber: number;
    logIndex: number;
    explorer: string;
}

export interface ArcSettlementStats {
    proofSource: 'arc_usdc_transfer_logs';
    agentAddress: string;
    recipientAddress: string;
    tokenAddress: string;
    transferCount: number;
    totalSettledUSDC: string;
    latestTransferBlock: number | null;
    recentTransfers: ArcSettlementTransfer[];
}

function getTransferTopic(address: string): string {
    return ethers.utils.hexZeroPad(ethers.utils.getAddress(address), 32);
}

function createEmptySettlementStats(agentAddress: string, recipientAddress: string): ArcSettlementStats {
    return {
        proofSource: 'arc_usdc_transfer_logs',
        agentAddress,
        recipientAddress,
        tokenAddress: USDC_ADDR,
        transferCount: 0,
        totalSettledUSDC: '0.000000',
        latestTransferBlock: null,
        recentTransfers: [],
    };
}

function sortRecentTransfers(transfers: ArcSettlementTransfer[]): ArcSettlementTransfer[] {
    return [...transfers].sort((left, right) => {
        if (left.blockNumber !== right.blockNumber) {
            return right.blockNumber - left.blockNumber;
        }

        return right.logIndex - left.logIndex;
    });
}

function mergeSettlementStats(
    base: ArcSettlementStats,
    delta: ArcSettlementStats,
    maxRecentTransfers: number,
): ArcSettlementStats {
    const mergedRecent = sortRecentTransfers([
        ...base.recentTransfers,
        ...delta.recentTransfers,
    ]).slice(0, maxRecentTransfers);

    const totalSettled = ethers.utils
        .parseUnits(base.totalSettledUSDC, 6)
        .add(ethers.utils.parseUnits(delta.totalSettledUSDC, 6));

    return {
        ...base,
        transferCount: base.transferCount + delta.transferCount,
        totalSettledUSDC: ethers.utils.formatUnits(totalSettled, 6),
        latestTransferBlock: Math.max(base.latestTransferBlock || 0, delta.latestTransferBlock || 0) || null,
        recentTransfers: mergedRecent,
    };
}

async function fetchTransferLogs(
    provider: ethers.providers.JsonRpcProvider,
    fromBlock: number,
    toBlock: number,
    topics: string[],
    chunkSize: number = SETTLEMENT_LOG_CHUNK_SIZE,
): Promise<ethers.providers.Log[]> {
    const allLogs: ethers.providers.Log[] = [];

    for (let start = fromBlock; start <= toBlock;) {
        const end = Math.min(start + chunkSize - 1, toBlock);

        try {
            const logs = await provider.getLogs({
                address: USDC_ADDR,
                fromBlock: start,
                toBlock: end,
                topics,
            });
            allLogs.push(...logs);
            start = end + 1;
        } catch (error) {
            if (chunkSize <= MIN_LOG_CHUNK_SIZE) {
                throw error;
            }

            const smallerChunk = Math.max(MIN_LOG_CHUNK_SIZE, Math.floor(chunkSize / 2));
            const logs = await fetchTransferLogs(provider, start, end, topics, smallerChunk);
            allLogs.push(...logs);
            start = end + 1;
        }
    }

    return allLogs;
}

async function scanSettlementRange(
    provider: ethers.providers.JsonRpcProvider,
    agentAddress: string,
    recipientAddress: string,
    fromBlock: number,
    toBlock: number,
    maxRecentTransfers: number,
): Promise<ArcSettlementStats> {
    if (fromBlock > toBlock) {
        return createEmptySettlementStats(agentAddress, recipientAddress);
    }

    const logs = await fetchTransferLogs(
        provider,
        fromBlock,
        toBlock,
        [transferTopic, getTransferTopic(agentAddress), getTransferTopic(recipientAddress)],
    );

    let totalSettled = ethers.BigNumber.from(0);
    const transfers = logs.map((log) => {
        const parsed = transferInterface.parseLog(log);
        const amount = parsed.args.value as ethers.BigNumber;
        totalSettled = totalSettled.add(amount);

        return {
            txHash: log.transactionHash,
            amountUSDC: ethers.utils.formatUnits(amount, 6),
            blockNumber: log.blockNumber,
            logIndex: log.logIndex,
            explorer: `${ARC_EXPLORER_BASE}/tx/${log.transactionHash}`,
        };
    });

    const recentTransfers = sortRecentTransfers(transfers).slice(0, maxRecentTransfers);

    return {
        proofSource: 'arc_usdc_transfer_logs',
        agentAddress,
        recipientAddress,
        tokenAddress: USDC_ADDR,
        transferCount: transfers.length,
        totalSettledUSDC: ethers.utils.formatUnits(totalSettled, 6),
        latestTransferBlock: recentTransfers[0]?.blockNumber ?? null,
        recentTransfers,
    };
}

/**
 * Check whether the agent wallet has enough USDC to settle.
 * Returns balance in human-readable USDC or null if unavailable.
 */
export async function getAgentUSDCBalance(): Promise<string | null> {
    try {
        const c = getContracts();
        if (!c) return null;
        const raw: ethers.BigNumber = await c.usdc.balanceOf(c.signer.address);
        return ethers.utils.formatUnits(raw, 6);
    } catch {
        return null;
    }
}

export function getAgentAddress(): string | null {
    const key = process.env.VAULT_PRIVATE_KEY;
    if (!key) return null;
    try {
        return new ethers.Wallet(key).address;
    } catch {
        return null;
    }
}

export async function getArcSettlementStats(options?: {
    agentAddress?: string | null;
    recipientAddress?: string;
    maxRecentTransfers?: number;
    provider?: ethers.providers.JsonRpcProvider;
}): Promise<ArcSettlementStats | null> {
    const agentAddress = options?.agentAddress ?? getAgentAddress();
    if (!agentAddress) return null;

    const recipientAddress = options?.recipientAddress || HUB_ADDR;
    const maxRecentTransfers = options?.maxRecentTransfers || SETTLEMENT_RECENT_LIMIT;
    const provider = options?.provider || getProvider();
    const latestBlock = await provider.getBlockNumber();
    const cacheKey = `${ethers.utils.getAddress(agentAddress)}:${ethers.utils.getAddress(recipientAddress)}:${maxRecentTransfers}`;

    if (
        _settlementStatsCache &&
        _settlementStatsCache.key === cacheKey &&
        Date.now() - _settlementStatsCache.updatedAt < SETTLEMENT_CACHE_TTL_MS &&
        _settlementStatsCache.latestBlock >= latestBlock
    ) {
        return _settlementStatsCache.stats;
    }

    const isCacheHit = _settlementStatsCache?.key === cacheKey;
    const baseStats = isCacheHit
        ? _settlementStatsCache!.stats
        : createEmptySettlementStats(agentAddress, recipientAddress);
    const scanFromBlock = isCacheHit
        ? _settlementStatsCache!.latestBlock + 1
        : Math.max(0, SETTLEMENT_START_BLOCK);

    const deltaStats = await scanSettlementRange(
        provider,
        agentAddress,
        recipientAddress,
        scanFromBlock,
        latestBlock,
        maxRecentTransfers,
    );

    const stats = isCacheHit
        ? mergeSettlementStats(baseStats, deltaStats, maxRecentTransfers)
        : deltaStats;

    _settlementStatsCache = {
        key: cacheKey,
        updatedAt: Date.now(),
        latestBlock,
        stats,
    };

    return stats;
}

/**
 * Settle a micro-payment on Arc by sending `amountUSDC` from the agent EOA
 * to the data-hub recipient. Fire-and-forget: returns the tx hash without
 * waiting for confirmation so the gateway response stays fast.
 *
 * Returns SettlementSkipped if the wallet is unfunded or the key is missing.
 */
export async function settleOnArc(
    amountUSDC: number,
    sourceId: string,
): Promise<SettlementResult | SettlementSkipped> {
    const c = getContracts();
    if (!c) return { settled: false, reason: 'No agent wallet configured' };

    // Minimum settlement: 0.001 USDC (1000 micro-USDC)
    const micro = Math.max(0.001, Math.min(amountUSDC, 0.01));
    const raw   = ethers.utils.parseUnits(micro.toFixed(6), 6);

    try {
        // Non-blocking balance pre-check to avoid wasting a nonce on a doomed tx
        const balance: ethers.BigNumber = await c.usdc.balanceOf(c.signer.address);
        if (balance.lt(raw)) {
            return {
                settled: false,
                reason: `Insufficient USDC balance (${ethers.utils.formatUnits(balance, 6)} < ${micro})`,
            };
        }

        // Send — do NOT await mining; return the hash immediately
        const tx: ethers.providers.TransactionResponse = await c.usdc.transfer(HUB_ADDR, raw, {
            gasLimit: 80_000,
        });

        const result: SettlementResult = {
            txHash:   tx.hash,
            amount:   micro.toFixed(6),
            explorer: `${ARC_EXPLORER_BASE}/tx/${tx.hash}`,
            settled:  true,
        };

        console.log(`[ArcSettlement] ✅ ${sourceId} → ${micro} USDC → ${tx.hash}`);

        // Mine in background so we get a receipt for logging — does not block response
        tx.wait(1).then(receipt => {
            console.log(`[ArcSettlement] ⛏  confirmed block ${receipt.blockNumber}: ${tx.hash}`);
        }).catch(err => {
            console.warn(`[ArcSettlement] tx ${tx.hash} mining warning:`, err.message);
        });

        return result;
    } catch (err: any) {
        console.error('[ArcSettlement] transfer failed:', err.message);
        return { settled: false, reason: err.message };
    }
}
