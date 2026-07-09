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
import { ARC_DATA_HUB_CONFIG, ZERO_G_DATA_HUB_CONFIG, NETWORKS, ARC_TOKENS, ARBITRUM_TOKENS, ARBITRUM_SEPOLIA_TOKENS } from '../config';

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

export type SettlementNetwork = 'ARC' | 'ZERO_G' | 'ARBITRUM';
export type SettlementEnv = 'testnet' | 'mainnet';

export interface SettlementConfig {
    rpcUrl: string;
    usdcAddress: string;
    recipientAddress: string;
    explorerBase: string;
    chainId: number;
    name: string;
}

/**
 * Settlement environment — testnet (default) or mainnet.
 *
 * Read from SETTLEMENT_ENV so the mainnet flip is a pure config change: the
 * default is 'testnet' (behavior-preserving for every existing deployment),
 * and setting SETTLEMENT_ENV=mainnet points x402 nanopayments at the mainnet
 * rails below. Each mainnet rail also needs its USDC + RPC env vars set (see
 * .env.example → "MAINNET FLIP"); if a mainnet USDC address is not yet
 * configured, settlement skips gracefully (non-blocking) rather than erroring.
 */
export const SETTLEMENT_ENV: SettlementEnv =
    process.env.SETTLEMENT_ENV === 'mainnet' ? 'mainnet' : 'testnet';

/**
 * Global daily settlement cap in USDC. This is a safety valve on the agent
 * wallet: no more than this amount of USDC can be spent by the settlement
 * service across all rails in a UTC day. Defaults to 50 USDC; set
 * SETTLEMENT_DAILY_CAP_USDC=0 to disable the cap.
 *
 * Note: the counter is currently in-memory. For multi-instance or
 * restart-resilient production deployments, persist it to MongoDB/Redis.
 * For the single-server buildathon demo this is acceptable.
 */
export const SETTLEMENT_DAILY_CAP_USDC = parseFloat(
    process.env.SETTLEMENT_DAILY_CAP_USDC || '50.0',
);

/** Pluggable store for the daily settlement cap. Implementations should be
 * atomic: if the cap would be exceeded, the spend must NOT be recorded. */
export interface SettlementCapStore {
    recordSpendAtomic(
        date: string,
        network: string,
        amountUSDC: number,
        capUSDC: number,
    ): Promise<{ allowed: boolean; newTotal: number }>;
    getSpendTotal(date: string, network: string): Promise<number>;
}

// Default in-memory store. Production deployments should inject a MongoDB-backed
// store via setSettlementCapStore() so the cap survives restarts and scales
// across instances.
const _memoryTotals: Record<string, { date: string; spent: number }> = {};

const defaultCapStore: SettlementCapStore = {
    async recordSpendAtomic(date, network, amountUSDC, capUSDC) {
        const key = `${date}:${network}`;
        const bucket = _memoryTotals[key];
        if (!bucket || bucket.date !== date) {
            _memoryTotals[key] = { date, spent: 0 };
        }
        if (_memoryTotals[key].spent + amountUSDC > capUSDC + 1e-9) {
            return { allowed: false, newTotal: _memoryTotals[key].spent };
        }
        _memoryTotals[key].spent += amountUSDC;
        return { allowed: true, newTotal: _memoryTotals[key].spent };
    },
    async getSpendTotal(date, network) {
        const key = `${date}:${network}`;
        const bucket = _memoryTotals[key];
        return bucket && bucket.date === date ? bucket.spent : 0;
    },
};

let _settlementCapStore: SettlementCapStore | null = null;

export function setSettlementCapStore(store: SettlementCapStore): void {
    _settlementCapStore = store;
}

function getCapStore(): SettlementCapStore {
    return _settlementCapStore ?? defaultCapStore;
}

function getCurrentDateKey(): string {
    return new Date().toISOString().slice(0, 10);
}

export async function checkDailyCap(amountUSDC: number, network: SettlementNetwork): Promise<{ allowed: boolean; remaining: number }> {
    if (SETTLEMENT_DAILY_CAP_USDC <= 0) {
        return { allowed: true, remaining: Infinity };
    }
    const today = getCurrentDateKey();
    const current = await getCapStore().getSpendTotal(today, network);
    const remaining = Math.max(0, SETTLEMENT_DAILY_CAP_USDC - current);
    return { allowed: current + amountUSDC <= SETTLEMENT_DAILY_CAP_USDC + 1e-9, remaining };
}

export async function recordDailySpend(amountUSDC: number, network: SettlementNetwork): Promise<{ allowed: boolean; newTotal: number }> {
    if (SETTLEMENT_DAILY_CAP_USDC <= 0) {
        return { allowed: true, newTotal: 0 };
    }
    const today = getCurrentDateKey();
    return getCapStore().recordSpendAtomic(today, network, amountUSDC, SETTLEMENT_DAILY_CAP_USDC);
}

/**
 * Per-rail config for both environments. NETWORK_CONFIGS (the single source of
 * truth) is resolved from this by SETTLEMENT_ENV. All chain-specific values
 * (chainId, RPC, explorer) come from the shared NETWORKS registry — DRY.
 */
function buildNetworkConfigs(env: SettlementEnv): Record<SettlementNetwork, SettlementConfig> {
    const variants: Record<SettlementNetwork, Record<SettlementEnv, SettlementConfig>> = {
        ARC: {
            testnet: {
                rpcUrl: process.env.ARC_RPC_URL || NETWORKS.ARC_TESTNET.rpcUrl,
                usdcAddress: process.env.ARC_TESTNET_USDC || ARC_TOKENS.USDC,
                recipientAddress: process.env.DATA_HUB_RECIPIENT_ADDRESS || ARC_DATA_HUB_CONFIG.RECIPIENT_ADDRESS,
                explorerBase: NETWORKS.ARC_TESTNET.explorerUrl,
                chainId: NETWORKS.ARC_TESTNET.chainId,
                name: 'Arc Testnet',
            },
            mainnet: {
                rpcUrl: process.env.ARC_MAINNET_RPC_URL || NETWORKS.ARC_MAINNET.rpcUrl,
                // Arc USDC is a system predeploy (stable across Arc networks); override if it differs on mainnet.
                usdcAddress: process.env.ARC_MAINNET_USDC || ARC_TOKENS.USDC,
                recipientAddress: process.env.DATA_HUB_RECIPIENT_ADDRESS || ARC_DATA_HUB_CONFIG.RECIPIENT_ADDRESS,
                explorerBase: NETWORKS.ARC_MAINNET.explorerUrl,
                chainId: NETWORKS.ARC_MAINNET.chainId,
                name: 'Arc',
            },
        },
        ZERO_G: {
            testnet: {
                rpcUrl: process.env.ZERO_G_RPC_URL || NETWORKS.ZERO_G_TESTNET.rpcUrl,
                usdcAddress: ZERO_G_DATA_HUB_CONFIG.USDC_TESTNET,
                recipientAddress: process.env.ZERO_G_PAY_RECIPIENT || ZERO_G_DATA_HUB_CONFIG.RECIPIENT_ADDRESS,
                explorerBase: NETWORKS.ZERO_G_TESTNET.explorerUrl,
                chainId: NETWORKS.ZERO_G_TESTNET.chainId,
                name: '0G Galileo Testnet',
            },
            mainnet: {
                rpcUrl: process.env.ZERO_G_MAINNET_RPC_URL || NETWORKS.ZERO_G_MAINNET.rpcUrl,
                // No committed default: 0G mainnet USDC must be set before mainnet settlement runs.
                usdcAddress: process.env.ZERO_G_MAINNET_USDC || '',
                recipientAddress: process.env.ZERO_G_PAY_RECIPIENT || ZERO_G_DATA_HUB_CONFIG.RECIPIENT_ADDRESS,
                explorerBase: NETWORKS.ZERO_G_MAINNET.explorerUrl,
                chainId: NETWORKS.ZERO_G_MAINNET.chainId,
                name: '0G',
            },
        },
        ARBITRUM: {
            testnet: {
                rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC_URL || NETWORKS.ARBITRUM_SEPOLIA.rpcUrl,
                usdcAddress: process.env.ARBITRUM_TESTNET_USDC || ARBITRUM_SEPOLIA_TOKENS.USDC,
                recipientAddress: process.env.DATA_HUB_RECIPIENT_ADDRESS || ARC_DATA_HUB_CONFIG.RECIPIENT_ADDRESS,
                explorerBase: NETWORKS.ARBITRUM_SEPOLIA.explorerUrl,
                chainId: NETWORKS.ARBITRUM_SEPOLIA.chainId,
                name: 'Arbitrum Sepolia',
            },
            mainnet: {
                rpcUrl: process.env.ARBITRUM_ONE_RPC_URL || NETWORKS.ARBITRUM_ONE.rpcUrl,
                // Circle-native USDC on Arbitrum One — verified, live, and the preferred buildathon rail.
                usdcAddress: process.env.ARBITRUM_MAINNET_USDC || ARBITRUM_TOKENS.USDC,
                recipientAddress: process.env.DATA_HUB_RECIPIENT_ADDRESS || ARC_DATA_HUB_CONFIG.RECIPIENT_ADDRESS,
                explorerBase: NETWORKS.ARBITRUM_ONE.explorerUrl,
                chainId: NETWORKS.ARBITRUM_ONE.chainId,
                name: 'Arbitrum',
            },
        },
    };
    return { ARC: variants.ARC[env], ZERO_G: variants.ZERO_G[env], ARBITRUM: variants.ARBITRUM[env] };
}

const NETWORK_CONFIGS: Record<SettlementNetwork, SettlementConfig> = buildNetworkConfigs(SETTLEMENT_ENV);

/**
 * Returns the active settlement config for a rail, defaulting to
 * DEFAULT_SETTLEMENT_NETWORK. Callers (x402 gateway, metrics, etc.) use this so
 * payment challenges, verification, and explorer links automatically follow the
 * SETTLEMENT_NETWORK + SETTLEMENT_ENV switches without hardcoded chain IDs.
 */
export function getSettlementConfig(network: SettlementNetwork = DEFAULT_SETTLEMENT_NETWORK): SettlementConfig {
    return NETWORK_CONFIGS[network];
}

/**
 * Default settlement network (which rail: ARC or ZERO_G).
 * Reads from SETTLEMENT_NETWORK env var so deploy-time config controls the rail
 * without code changes. Defaults to ZERO_G (interim) while Arc mainnet is pending.
 * Flip to 'ARC' once ARC_MAINNET is live and funded.
 *
 * Testnet vs mainnet for the chosen rail is controlled separately by
 * SETTLEMENT_ENV (see above) — so `SETTLEMENT_NETWORK=ZERO_G SETTLEMENT_ENV=mainnet`
 * settles on 0G mainnet.
 */
export const DEFAULT_SETTLEMENT_NETWORK: SettlementNetwork =
    (process.env.SETTLEMENT_NETWORK as SettlementNetwork) || 'ZERO_G';

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

    const { usdcAddress } = NETWORK_CONFIGS[network];
    if (!usdcAddress) {
        // Mainnet flip staged but USDC not yet configured — skip gracefully.
        console.warn(`[SettlementService] No USDC address for ${network} (${SETTLEMENT_ENV}) — on-chain settlement disabled. Set the mainnet USDC env var to enable.`);
        return null;
    }

    if (!_usdcContracts[network]) {
        const provider = getProvider(network);
        const signer = new ethers.Wallet(key, provider);
        const usdc = new ethers.Contract(usdcAddress, ERC20_TRANSFER_ABI, signer);
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

export async function getSettlementStats(network: SettlementNetwork = DEFAULT_SETTLEMENT_NETWORK, options?: {
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

    // Global daily safety cap on the agent wallet (MongoDB-backed atomic check)
    const capCheck = await checkDailyCap(micro, network);
    if (!capCheck.allowed) {
        return {
            settled: false,
            reason: `Daily settlement cap reached on ${network} (cap ${SETTLEMENT_DAILY_CAP_USDC} USDC, remaining ${capCheck.remaining.toFixed(6)} USDC)`,
        };
    }

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

        // Record against the daily safety cap atomically (optimistically, at broadcast time)
        await recordDailySpend(micro, network);

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

// No per-rail convenience wrappers. Use settleOnChain(network, ...) and
// getSettlementStats(network, ...) with DEFAULT_SETTLEMENT_NETWORK or the
// desired SettlementNetwork to keep a single settlement API.
