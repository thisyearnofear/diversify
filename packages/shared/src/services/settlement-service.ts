/**
 * Cross-Chain On-Chain Settlement Service
 *
 * Sends real USDC micro-payments on supported networks (0G, Arc, etc.) for each paid research request.
 * Uses the VAULT_PRIVATE_KEY EOA — no Circle entity secret required.
 *
 * Core Principles:
 * - ENHANCEMENT FIRST: Generalized from Arc-only to multi-chain (0G ready)
 * - SINGLE RESPONSIBILITY: Only handles EOA settlement across supported chains
 * - PERFORMANT: Non-blocking — fires tx and returns hash immediately
 * - DRY: RPCs and USDC addresses come from shared config
 */

import { ethers } from 'ethers';
import { ARC_DATA_HUB_CONFIG, ZERO_G_DATA_HUB_CONFIG, NETWORKS, ARC_TOKENS } from '../config';

// Minimal ERC-20 ABI — transfer only
const ERC20_TRANSFER_ABI = [
    'function transfer(address to, uint256 amount) returns (bool)',
    'function balanceOf(address owner) view returns (uint256)',
] as const;
const TRANSFER_EVENT_ABI = [
    'event Transfer(address indexed from, address indexed to, uint256 value)',
] as const;

const transferInterface = new ethers.utils.Interface(TRANSFER_EVENT_ABI);
const transferTopic = transferInterface.getEventTopic('Transfer');

export type SettlementNetwork = 'ARC' | 'ZERO_G';

export interface SettlementConfig {
    rpcUrl: string;
    usdcAddress: string;
    recipientAddress: string;
    explorerBase: string;
    chainId: number;
    name: string;
}

const NETWORK_CONFIGS: Record<SettlementNetwork, SettlementConfig> = {
    ARC: {
        rpcUrl: process.env.ARC_RPC_URL || NETWORKS.ARC_TESTNET.rpcUrl,
        usdcAddress: ARC_TOKENS.USDC,
        recipientAddress: process.env.DATA_HUB_RECIPIENT_ADDRESS || ARC_DATA_HUB_CONFIG.RECIPIENT_ADDRESS,
        explorerBase: NETWORKS.ARC_TESTNET.explorerUrl,
        chainId: NETWORKS.ARC_TESTNET.chainId,
        name: 'Arc Testnet',
    },
    ZERO_G: {
        rpcUrl: process.env.ZERO_G_RPC_URL || NETWORKS.ZERO_G_TESTNET.rpcUrl,
        usdcAddress: ZERO_G_DATA_HUB_CONFIG.USDC_TESTNET,
        recipientAddress: ZERO_G_DATA_HUB_CONFIG.RECIPIENT_ADDRESS,
        explorerBase: NETWORKS.ZERO_G_TESTNET.explorerUrl,
        chainId: NETWORKS.ZERO_G_TESTNET.chainId,
        name: '0G Galileo Testnet',
    },
};

const SETTLEMENT_CACHE_TTL_MS = 30_000;
const SETTLEMENT_LOG_CHUNK_SIZE = 20_000;
const SETTLEMENT_RECENT_LIMIT = 10;
const MIN_LOG_CHUNK_SIZE = 500;

/**
 * Returns the starting block for settlement log scanning on a given network.
 * Reads from an env var (e.g. ARC_SETTLEMENT_START_BLOCK) for production,
 * otherwise scans the most recent 10,000 blocks to avoid timeouts on cold starts.
 */
function getSettlementStartBlock(network: SettlementNetwork, latestBlock: number): number {
  const envKey = `${network}_SETTLEMENT_START_BLOCK`;
  const configured = process.env[envKey];
  if (configured) {
    const parsed = parseInt(configured, 10);
    if (!Number.isNaN(parsed) && parsed >= 0) return parsed;
  }
  // Default: scan last 10k blocks (avoids genesis scan on cold start)
  return Math.max(0, latestBlock - 10_000);
}

// Lazily initialised providers and signers per network
const _providers: Record<string, ethers.providers.JsonRpcProvider> = {};
const _signers: Record<string, ethers.Wallet> = {};
const _usdcContracts: Record<string, ethers.Contract> = {};
const _settlementStatsCache: Record<string, {
    updatedAt: number;
    latestBlock: number;
    stats: SettlementStats;
}> = {};

function getProvider(network: SettlementNetwork): ethers.providers.JsonRpcProvider {
    if (!_providers[network]) {
        _providers[network] = new ethers.providers.JsonRpcProvider(NETWORK_CONFIGS[network].rpcUrl);
    }
    return _providers[network];
}

function getContracts(network: SettlementNetwork): { provider: ethers.providers.JsonRpcProvider; signer: ethers.Wallet; usdc: ethers.Contract } | null {
    const key = process.env.VAULT_PRIVATE_KEY;
    if (!key) {
        console.warn(`[SettlementService] VAULT_PRIVATE_KEY not set — on-chain settlement disabled for ${network}`);
        return null;
    }

    if (!_usdcContracts[network]) {
        const provider = getProvider(network);
        const signer = new ethers.Wallet(key, provider);
        const usdc = new ethers.Contract(NETWORK_CONFIGS[network].usdcAddress, ERC20_TRANSFER_ABI, signer);
        _signers[network] = signer;
        _usdcContracts[network] = usdc;
    }

    return { provider: _providers[network], signer: _signers[network], usdc: _usdcContracts[network] };
}

export interface SettlementResult {
    txHash: string;
    amount: string;       // USDC, e.g. "0.001"
    explorer: string;     // Explorer link
    settled: true;
    network: SettlementNetwork;
}

export interface SettlementSkipped {
    settled: false;
    reason: string;
}

export interface SettlementTransfer {
    txHash: string;
    amountUSDC: string;
    blockNumber: number;
    blockTimestamp: string | null;
    logIndex: number;
    explorer: string;
}

export interface SettlementStats {
    proofSource: string;
    agentAddress: string;
    recipientAddress: string;
    tokenAddress: string;
    transferCount: number;
    totalSettledUSDC: string;
    latestTransferBlock: number | null;
    recentTransfers: SettlementTransfer[];
    amountBreakdown: Record<string, number>;
    network: SettlementNetwork;
}

function getTransferTopic(address: string): string {
    return ethers.utils.hexZeroPad(ethers.utils.getAddress(address), 32);
}

function createEmptySettlementStats(network: SettlementNetwork, agentAddress: string, recipientAddress: string): SettlementStats {
    const config = NETWORK_CONFIGS[network];
    return {
        proofSource: `${network.toLowerCase()}_usdc_transfer_logs`,
        agentAddress,
        recipientAddress,
        tokenAddress: config.usdcAddress,
        transferCount: 0,
        totalSettledUSDC: '0.000000',
        latestTransferBlock: null,
        recentTransfers: [],
        amountBreakdown: {},
        network,
    };
}

function sortRecentTransfers(transfers: SettlementTransfer[]): SettlementTransfer[] {
    return [...transfers].sort((left, right) => {
        if (left.blockNumber !== right.blockNumber) {
            return right.blockNumber - left.blockNumber;
        }
        return right.logIndex - left.logIndex;
    });
}

function mergeSettlementStats(
    base: SettlementStats,
    delta: SettlementStats,
    maxRecentTransfers: number,
): SettlementStats {
    const mergedRecent = sortRecentTransfers([
        ...base.recentTransfers,
        ...delta.recentTransfers,
    ]).slice(0, maxRecentTransfers);
    const amountBreakdown = { ...base.amountBreakdown };
    for (const [amount, count] of Object.entries(delta.amountBreakdown)) {
        amountBreakdown[amount] = (amountBreakdown[amount] || 0) + count;
    }

    const totalSettled = ethers.utils
        .parseUnits(base.totalSettledUSDC, 6)
        .add(ethers.utils.parseUnits(delta.totalSettledUSDC, 6));

    return {
        ...base,
        transferCount: base.transferCount + delta.transferCount,
        totalSettledUSDC: ethers.utils.formatUnits(totalSettled, 6),
        latestTransferBlock: Math.max(base.latestTransferBlock || 0, delta.latestTransferBlock || 0) || null,
        recentTransfers: mergedRecent,
        amountBreakdown,
    };
}

async function fetchTransferLogs(
    network: SettlementNetwork,
    provider: ethers.providers.JsonRpcProvider,
    fromBlock: number,
    toBlock: number,
    topics: string[],
    chunkSize: number = SETTLEMENT_LOG_CHUNK_SIZE,
): Promise<ethers.providers.Log[]> {
    const allLogs: ethers.providers.Log[] = [];
    const usdcAddress = NETWORK_CONFIGS[network].usdcAddress;

    for (let start = fromBlock; start <= toBlock;) {
        const end = Math.min(start + chunkSize - 1, toBlock);

        try {
            const logs = await provider.getLogs({
                address: usdcAddress,
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
            const logs = await fetchTransferLogs(network, provider, start, end, topics, smallerChunk);
            allLogs.push(...logs);
            start = end + 1;
        }
    }

    return allLogs;
}

async function scanSettlementRange(
    network: SettlementNetwork,
    provider: ethers.providers.JsonRpcProvider,
    agentAddress: string,
    recipientAddress: string,
    fromBlock: number,
    toBlock: number,
    maxRecentTransfers: number,
): Promise<SettlementStats> {
    if (fromBlock > toBlock) {
        return createEmptySettlementStats(network, agentAddress, recipientAddress);
    }

    const config = NETWORK_CONFIGS[network];
    const logs = await fetchTransferLogs(
        network,
        provider,
        fromBlock,
        toBlock,
        [transferTopic, getTransferTopic(agentAddress), getTransferTopic(recipientAddress)],
    );

    let totalSettled = ethers.BigNumber.from(0);
    const transferRecords = logs.map((log) => {
        const parsed = transferInterface.parseLog(log);
        const amount = parsed.args.value as ethers.BigNumber;
        totalSettled = totalSettled.add(amount);

        return {
            txHash: log.transactionHash,
            amountUSDC: ethers.utils.formatUnits(amount, 6),
            blockNumber: log.blockNumber,
            blockTimestamp: null,
            logIndex: log.logIndex,
            explorer: `${config.explorerBase}/tx/${log.transactionHash}`,
        };
    });

    const amountBreakdown = transferRecords.reduce<Record<string, number>>((acc, transfer) => {
        const normalizedAmount = Number.parseFloat(transfer.amountUSDC).toFixed(6);
        acc[normalizedAmount] = (acc[normalizedAmount] || 0) + 1;
        return acc;
    }, {});
    const recentTransfers = sortRecentTransfers(transferRecords).slice(0, maxRecentTransfers);
    const uniqueBlocks = [...new Set(recentTransfers.map((transfer) => transfer.blockNumber))];
    const blocks = await Promise.all(uniqueBlocks.map((blockNumber) => provider.getBlock(blockNumber)));
    const blockTimestamps = new Map(blocks.map((block) => [block.number, new Date(block.timestamp * 1000).toISOString()]));
    const recentTransfersWithTimestamps = recentTransfers.map((transfer) => ({
        ...transfer,
        blockTimestamp: blockTimestamps.get(transfer.blockNumber) || null,
    }));

    return {
        proofSource: `${network.toLowerCase()}_usdc_transfer_logs`,
        agentAddress,
        recipientAddress,
        tokenAddress: config.usdcAddress,
        transferCount: transferRecords.length,
        totalSettledUSDC: ethers.utils.formatUnits(totalSettled, 6),
        latestTransferBlock: recentTransfersWithTimestamps[0]?.blockNumber ?? null,
        recentTransfers: recentTransfersWithTimestamps,
        amountBreakdown,
        network,
    };
}

/**
 * Check whether the agent wallet has enough USDC to settle on a specific network.
 */
export async function getAgentUSDCBalance(network: SettlementNetwork = 'ZERO_G'): Promise<string | null> {
    try {
        const c = getContracts(network);
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

export async function getSettlementStats(network: SettlementNetwork = 'ZERO_G', options?: {
    agentAddress?: string | null;
    recipientAddress?: string;
    maxRecentTransfers?: number;
}): Promise<SettlementStats | null> {
    const agentAddress = options?.agentAddress ?? getAgentAddress();
    if (!agentAddress) return null;

    const config = NETWORK_CONFIGS[network];
    const recipientAddress = options?.recipientAddress || config.recipientAddress;
    const maxRecentTransfers = options?.maxRecentTransfers || SETTLEMENT_RECENT_LIMIT;
    const provider = getProvider(network);
    
    // Attempt to get block number, fallback to 0 if network is down
    let latestBlock = 0;
    try {
        latestBlock = await provider.getBlockNumber();
    } catch (err) {
        console.warn(`[SettlementService] Failed to get block number for ${network}:`, err);
        return createEmptySettlementStats(network, agentAddress, recipientAddress);
    }

    const cacheKey = `${network}:${ethers.utils.getAddress(agentAddress)}:${ethers.utils.getAddress(recipientAddress)}:${maxRecentTransfers}`;

    if (
        _settlementStatsCache[cacheKey] &&
        Date.now() - _settlementStatsCache[cacheKey].updatedAt < SETTLEMENT_CACHE_TTL_MS &&
        _settlementStatsCache[cacheKey].latestBlock >= latestBlock
    ) {
        return _settlementStatsCache[cacheKey].stats;
    }

    const isCacheHit = !!_settlementStatsCache[cacheKey];
    const baseStats = isCacheHit
        ? _settlementStatsCache[cacheKey].stats
        : createEmptySettlementStats(network, agentAddress, recipientAddress);
    const scanFromBlock = isCacheHit
        ? _settlementStatsCache[cacheKey].latestBlock + 1
        : getSettlementStartBlock(network, latestBlock);

    const deltaStats = await scanSettlementRange(
        network,
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

    _settlementStatsCache[cacheKey] = {
        updatedAt: Date.now(),
        latestBlock,
        stats,
    };

    return stats;
}

/**
 * Settle a micro-payment by sending `amountUSDC` from the agent EOA
 * to the data-hub recipient. Fire-and-forget.
 */
export async function settleOnChain(
    amountUSDC: number,
    sourceId: string,
    network: SettlementNetwork = 'ZERO_G'
): Promise<SettlementResult | SettlementSkipped> {
    const c = getContracts(network);
    const config = NETWORK_CONFIGS[network];
    if (!c) return { settled: false, reason: `No agent wallet configured for ${network}` };

    // Minimum settlement: 0.001 USDC (1000 micro-USDC)
    const micro = Math.max(0.001, Math.min(amountUSDC, 0.01));
    const raw   = ethers.utils.parseUnits(micro.toFixed(6), 6);

    try {
        // Non-blocking balance pre-check
        const balance: ethers.BigNumber = await c.usdc.balanceOf(c.signer.address);
        if (balance.lt(raw)) {
            return {
                settled: false,
                reason: `Insufficient USDC balance on ${network} (${ethers.utils.formatUnits(balance, 6)} < ${micro})`,
            };
        }

        // Send — do NOT await mining
        const tx: ethers.providers.TransactionResponse = await c.usdc.transfer(config.recipientAddress, raw, {
            gasLimit: 100_000,
        });

        const result: SettlementResult = {
            txHash:   tx.hash,
            amount:   micro.toFixed(6),
            explorer: `${config.explorerBase}/tx/${tx.hash}`,
            settled:  true,
            network,
        };

        console.log(`[SettlementService] ✅ ${sourceId} → ${micro} USDC on ${network} → ${tx.hash}`);

        // Mine in background
        tx.wait(1).then(receipt => {
            console.log(`[SettlementService] ⛏ ${network} confirmed block ${receipt.blockNumber}: ${tx.hash}`);
        }).catch(err => {
            console.warn(`[SettlementService] ${network} tx ${tx.hash} mining warning:`, err.message);
        });

        return result;
    } catch (err: any) {
        console.error(`[SettlementService] ${network} transfer failed:`, err.message);
        return { settled: false, reason: err.message };
    }
}

// Backward compatibility exports for Arc (deprecated)
export const settleOnArc = (amount: number, sourceId: string) => settleOnChain(amount, sourceId, 'ARC');
export const getArcSettlementStats = (options?: any) => getSettlementStats('ARC', options);
