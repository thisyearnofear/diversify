/**
 * Cross-Chain On-Chain Settlement Service
 *
 * Settles REAL buyer payments on supported networks (EIP-3009
 * transferWithAuthorization mandates, verified tx-proof transfers) and scans
 * buyer→recipient USDC Transfer logs for settlement metrics. Uses the
 * VAULT_PRIVATE_KEY EOA to submit buyer-signed mandates (gas payer only — the
 * funds always move buyer→merchant). The old agent→recipient mirror
 * (settleOnChain + daily cap) was removed: it sent the vault's own USDC per
 * paid request, which is fabricated volume on any network.
 *
 * Core Principles:
 * - ENHANCEMENT FIRST: Generalized from Arc-only to multi-chain (0G ready)
 * - SINGLE RESPONSIBILITY: Only handles EOA settlement across supported chains
 * - DRY: RPCs and USDC addresses come from shared config
 */

import { ethers } from 'ethers';
import { ARC_DATA_HUB_CONFIG, ZERO_G_DATA_HUB_CONFIG, NETWORKS, ARC_TOKENS, ARC_TESTNET_TOKENS, ARBITRUM_TOKENS, ARBITRUM_SEPOLIA_TOKENS, HASHKEY_TOKENS, HASHKEY_TESTNET_TOKENS } from '../config';
import { withTimeout } from '../utils/promise-utils';
import { eip3009NonceBytes32 } from '../utils/eip3009';

// ERC-20 transfer + EIP-3009 mandate settlement (FiatTokenV2 rails only)
const ERC20_TRANSFER_ABI = [
    'function transfer(address to, uint256 amount) returns (bool)',
    'function balanceOf(address owner) view returns (uint256)',
    'function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)',
    'function authorizationState(address authorizer, bytes32 nonce) view returns (bool)',
] as const;
const TRANSFER_EVENT_ABI = [
    'event Transfer(address indexed from, address indexed to, uint256 value)',
] as const;

const transferInterface = new ethers.utils.Interface(TRANSFER_EVENT_ABI);
const transferTopic = transferInterface.getEventTopic('Transfer');

export type SettlementNetwork = 'ARC' | 'ZERO_G' | 'ARBITRUM' | 'HASHKEY';
export type SettlementEnv = 'testnet' | 'mainnet';

export interface SettlementConfig {
    rpcUrl: string;
    usdcAddress: string;
    recipientAddress: string;
    explorerBase: string;
    chainId: number;
    name: string;
    /**
     * Whether the rail's settlement token supports EIP-3009
     * `transferWithAuthorization` (FiatTokenV2 — Arc/Arbitrum USDC yes,
     * 0G token unknown, HashKey USDT no). Drives `mandate_supported` in the
     * x402 challenge and gates the mandate settlement path.
     */
    eip3009: boolean;
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
 * Per-rail config for both environments. NETWORK_CONFIGS (the single source of
 * truth) is resolved from this by SETTLEMENT_ENV. All chain-specific values
 * (chainId, RPC, explorer) come from the shared NETWORKS registry — DRY.
 */
function buildNetworkConfigs(env: SettlementEnv): Record<SettlementNetwork, SettlementConfig> {
    const variants: Record<SettlementNetwork, Record<SettlementEnv, SettlementConfig>> = {
        ARC: {
            testnet: {
                rpcUrl: process.env.ARC_RPC_URL || NETWORKS.ARC_TESTNET.rpcUrl,
                usdcAddress: process.env.ARC_TESTNET_USDC || ARC_TESTNET_TOKENS.USDC,
                recipientAddress: process.env.DATA_HUB_RECIPIENT_ADDRESS || ARC_DATA_HUB_CONFIG.RECIPIENT_ADDRESS,
                explorerBase: NETWORKS.ARC_TESTNET.explorerUrl,
                chainId: NETWORKS.ARC_TESTNET.chainId,
                name: 'Arc Testnet',
                eip3009: true,
            },
            mainnet: {
                rpcUrl: process.env.ARC_MAINNET_RPC_URL || NETWORKS.ARC_MAINNET.rpcUrl,
                // Arc USDC ERC-20 predeploy — same address on mainnet and testnet,
                // verified live on chainId 5042 (FiatTokenV2, version() === '2').
                usdcAddress: process.env.ARC_MAINNET_USDC || ARC_TOKENS.USDC,
                recipientAddress: process.env.DATA_HUB_RECIPIENT_ADDRESS || ARC_DATA_HUB_CONFIG.RECIPIENT_ADDRESS,
                explorerBase: NETWORKS.ARC_MAINNET.explorerUrl,
                chainId: NETWORKS.ARC_MAINNET.chainId,
                name: 'Arc',
                eip3009: true,
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
                eip3009: false,
            },
            mainnet: {
                rpcUrl: process.env.ZERO_G_MAINNET_RPC_URL || NETWORKS.ZERO_G_MAINNET.rpcUrl,
                // No committed default: 0G mainnet USDC must be set before mainnet settlement runs.
                usdcAddress: process.env.ZERO_G_MAINNET_USDC || '',
                recipientAddress: process.env.ZERO_G_PAY_RECIPIENT || ZERO_G_DATA_HUB_CONFIG.RECIPIENT_ADDRESS,
                explorerBase: NETWORKS.ZERO_G_MAINNET.explorerUrl,
                chainId: NETWORKS.ZERO_G_MAINNET.chainId,
                name: '0G',
                eip3009: false,
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
                eip3009: true,
            },
            mainnet: {
                rpcUrl: process.env.ARBITRUM_ONE_RPC_URL || NETWORKS.ARBITRUM_ONE.rpcUrl,
                // Circle-native USDC on Arbitrum One — verified, live, and the preferred buildathon rail.
                usdcAddress: process.env.ARBITRUM_MAINNET_USDC || ARBITRUM_TOKENS.USDC,
                recipientAddress: process.env.DATA_HUB_RECIPIENT_ADDRESS || ARC_DATA_HUB_CONFIG.RECIPIENT_ADDRESS,
                explorerBase: NETWORKS.ARBITRUM_ONE.explorerUrl,
                chainId: NETWORKS.ARBITRUM_ONE.chainId,
                name: 'Arbitrum',
                eip3009: true,
            },
        },
        // HashKey Chain settlement rail — settled zero-custody via HSP (see hsp/).
        // usdcAddress here is a fallback; the authoritative token comes from the HSP
        // Coordinator `GET /chains` at verify time. recipient = merchant/data-hub wallet.
        // The plain-transfer settlement token defaults to USDT (canonical on HashKey);
        // set HASHKEY_SETTLEMENT_TOKEN to a specific address (e.g. bridged USDC) to override.
        // The HSP path ignores this and uses the Coordinator's GET /chains token instead.
        HASHKEY: {
            testnet: {
                rpcUrl: process.env.HASHKEY_TESTNET_RPC_URL || NETWORKS.HASHKEY_TESTNET.rpcUrl,
                usdcAddress: process.env.HASHKEY_SETTLEMENT_TOKEN || HASHKEY_TESTNET_TOKENS.USDT || HASHKEY_TESTNET_TOKENS.USDC,
                recipientAddress: process.env.HASHKEY_PAY_RECIPIENT || process.env.DATA_HUB_RECIPIENT_ADDRESS || ARC_DATA_HUB_CONFIG.RECIPIENT_ADDRESS,
                explorerBase: NETWORKS.HASHKEY_TESTNET.explorerUrl,
                chainId: NETWORKS.HASHKEY_TESTNET.chainId,
                name: 'HashKey Testnet',
                eip3009: false,
            },
            mainnet: {
                rpcUrl: process.env.HASHKEY_MAINNET_RPC_URL || NETWORKS.HASHKEY_MAINNET.rpcUrl,
                usdcAddress: process.env.HASHKEY_SETTLEMENT_TOKEN || HASHKEY_TOKENS.USDT,
                recipientAddress: process.env.HASHKEY_PAY_RECIPIENT || process.env.DATA_HUB_RECIPIENT_ADDRESS || ARC_DATA_HUB_CONFIG.RECIPIENT_ADDRESS,
                explorerBase: NETWORKS.HASHKEY_MAINNET.explorerUrl,
                chainId: NETWORKS.HASHKEY_MAINNET.chainId,
                name: 'HashKey Chain',
                eip3009: false,
            },
        },
    };
    return {
        ARC: variants.ARC[env],
        ZERO_G: variants.ZERO_G[env],
        ARBITRUM: variants.ARBITRUM[env],
        HASHKEY: variants.HASHKEY[env],
    };
}

/**
 * HSP-specific settlement metadata, kept OUT of SettlementConfig so the other
 * rails' config shape is untouched. Keyed by chainId. `verifyingContract` is a
 * convenience fallback only — the HSP client bootstraps the authoritative
 * verifyingContract/adapter/token from the Coordinator `GET /chains` at runtime.
 */
export interface HspRailConfig {
    coordinatorUrl: string;
    /** Coordinator chain name, e.g. "hashkey-testnet" | "hashkey". */
    chainName: string;
    /** EIP-712 domain verifyingContract fallback (authoritative value from GET /chains). */
    verifyingContract?: string;
}

export const HSP_CONFIG: Record<number, HspRailConfig> = {
    [NETWORKS.HASHKEY_TESTNET.chainId]: {
        coordinatorUrl: process.env.HSP_COORDINATOR_URL || '',
        chainName: process.env.HSP_CHAIN_NAME_TESTNET || 'hashkey-testnet',
        verifyingContract: process.env.HSP_VERIFYING_CONTRACT_TESTNET,
    },
    [NETWORKS.HASHKEY_MAINNET.chainId]: {
        coordinatorUrl: process.env.HSP_COORDINATOR_URL || '',
        chainName: process.env.HSP_CHAIN_NAME_MAINNET || 'hashkey',
        verifyingContract: process.env.HSP_VERIFYING_CONTRACT_MAINNET,
    },
};

/** HSP rail metadata for a settlement chainId (177/133), or undefined for non-HashKey rails. */
export function getHspRailConfig(chainId: number): HspRailConfig | undefined {
    return HSP_CONFIG[chainId];
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
 * without code changes. Defaults to ZERO_G (interim). Arc mainnet is live since
 * 2026-09-16 — flip to 'ARC' once the vault wallet is funded on chainId 5042.
 *
 * Testnet vs mainnet for the chosen rail is controlled separately by
 * SETTLEMENT_ENV (see above) — so `SETTLEMENT_NETWORK=ZERO_G SETTLEMENT_ENV=mainnet`
 * settles on 0G mainnet.
 */
export const DEFAULT_SETTLEMENT_NETWORK: SettlementNetwork =
    (process.env.SETTLEMENT_NETWORK as SettlementNetwork) || 'ZERO_G';

const SETTLEMENT_CACHE_TTL_MS = 30_000;
// An unavailable RPC must not stall x402 settlement, Guardian work, or the
// metrics endpoint indefinitely. Eight seconds matches the shared timeout
// convention for chain-facing Guardian/vault operations.
const SETTLEMENT_RPC_TIMEOUT_MS = 8_000;
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

export interface SettlementTransfer {
    txHash: string;
    amountUSDC: string;
    blockNumber: number;
    blockTimestamp: string | null;
    logIndex: number;
    explorer: string;
}

/**
 * Buyer→recipient settlement stats. Counts only real buyer settlements: USDC
 * Transfer logs where `to == recipient` and `from !=` the operator vault/agent
 * address (which excludes the retired agent-side mirror and the operator's own
 * funding txs). Gateway batched settlements credit the merchant's Gateway
 * balance inside Circle's batch — they do NOT appear as direct ERC-20
 * transfers and are not counted here.
 */
export interface SettlementStats {
    proofSource: string;
    /** Operator vault/agent address excluded from buyer counts (empty when no VAULT_PRIVATE_KEY). */
    excludedOperatorAddress: string;
    recipientAddress: string;
    tokenAddress: string;
    buyerSettlementCount: number;
    totalBuyerSettledUSDC: string;
    latestTransferBlock: number | null;
    recentBuyerTransfers: SettlementTransfer[];
    amountBreakdown: Record<string, number>;
    network: SettlementNetwork;
}

function getTransferTopic(address: string): string {
    return ethers.utils.hexZeroPad(ethers.utils.getAddress(address), 32);
}

function createEmptySettlementStats(network: SettlementNetwork, excludedOperatorAddress: string, recipientAddress: string): SettlementStats {
    const config = NETWORK_CONFIGS[network];
    return {
        proofSource: `${network.toLowerCase()}_buyer_usdc_transfer_logs`,
        excludedOperatorAddress,
        recipientAddress,
        tokenAddress: config.usdcAddress,
        buyerSettlementCount: 0,
        totalBuyerSettledUSDC: '0.000000',
        latestTransferBlock: null,
        recentBuyerTransfers: [],
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
        ...base.recentBuyerTransfers,
        ...delta.recentBuyerTransfers,
    ]).slice(0, maxRecentTransfers);
    const amountBreakdown = { ...base.amountBreakdown };
    for (const [amount, count] of Object.entries(delta.amountBreakdown)) {
        amountBreakdown[amount] = (amountBreakdown[amount] || 0) + count;
    }

    const totalSettled = ethers.utils
        .parseUnits(base.totalBuyerSettledUSDC, 6)
        .add(ethers.utils.parseUnits(delta.totalBuyerSettledUSDC, 6));

    return {
        ...base,
        buyerSettlementCount: base.buyerSettlementCount + delta.buyerSettlementCount,
        totalBuyerSettledUSDC: ethers.utils.formatUnits(totalSettled, 6),
        latestTransferBlock: Math.max(base.latestTransferBlock || 0, delta.latestTransferBlock || 0) || null,
        recentBuyerTransfers: mergedRecent,
        amountBreakdown,
    };
}

async function fetchTransferLogs(
    network: SettlementNetwork,
    provider: ethers.providers.JsonRpcProvider,
    fromBlock: number,
    toBlock: number,
    topics: (string | null)[],
    chunkSize: number = SETTLEMENT_LOG_CHUNK_SIZE,
): Promise<ethers.providers.Log[]> {
    const allLogs: ethers.providers.Log[] = [];
    const usdcAddress = NETWORK_CONFIGS[network].usdcAddress;

    for (let start = fromBlock; start <= toBlock;) {
        const end = Math.min(start + chunkSize - 1, toBlock);

        try {
            const logs = await withTimeout(
                provider.getLogs({
                    address: usdcAddress,
                    fromBlock: start,
                    toBlock: end,
                    topics,
                }),
                SETTLEMENT_RPC_TIMEOUT_MS,
                `[SettlementService] ${network} Transfer-log RPC timed out`,
            );
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
    excludedOperatorAddress: string,
    recipientAddress: string,
    fromBlock: number,
    toBlock: number,
    maxRecentTransfers: number,
): Promise<SettlementStats> {
    if (fromBlock > toBlock) {
        return createEmptySettlementStats(network, excludedOperatorAddress, recipientAddress);
    }

    const config = NETWORK_CONFIGS[network];
    // Buyer settlements: any sender → recipient. The `from` topic is left
    // unconstrained so buyer wallets are matched; the operator/vault address is
    // filtered out below (it funded the retired mirror and pays mandate gas).
    const logs = (await fetchTransferLogs(
        network,
        provider,
        fromBlock,
        toBlock,
        [transferTopic, null, getTransferTopic(recipientAddress)],
    )).filter((log) => {
        const from = transferInterface.parseLog(log).args.from as string;
        return !excludedOperatorAddress
            || from.toLowerCase() !== excludedOperatorAddress.toLowerCase();
    });

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
    const blocks = await Promise.all(uniqueBlocks.map((blockNumber) => withTimeout(
        provider.getBlock(blockNumber),
        SETTLEMENT_RPC_TIMEOUT_MS,
        `[SettlementService] ${network} block RPC timed out`,
    )));
    const blockTimestamps = new Map(blocks.map((block) => [block.number, new Date(block.timestamp * 1000).toISOString()]));
    const recentTransfersWithTimestamps = recentTransfers.map((transfer) => ({
        ...transfer,
        blockTimestamp: blockTimestamps.get(transfer.blockNumber) || null,
    }));

    return {
        proofSource: `${network.toLowerCase()}_buyer_usdc_transfer_logs`,
        excludedOperatorAddress,
        recipientAddress,
        tokenAddress: config.usdcAddress,
        buyerSettlementCount: transferRecords.length,
        totalBuyerSettledUSDC: ethers.utils.formatUnits(totalSettled, 6),
        latestTransferBlock: recentTransfersWithTimestamps[0]?.blockNumber ?? null,
        recentBuyerTransfers: recentTransfersWithTimestamps,
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
        const raw: ethers.BigNumber = await withTimeout(
            c.usdc.balanceOf(c.signer.address),
            SETTLEMENT_RPC_TIMEOUT_MS,
            `[SettlementService] ${network} USDC-balance RPC timed out`,
        );
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
    // The operator address is only used to EXCLUDE non-buyer transfers (the
    // retired agent-side mirror, operator funding). Stats still work without a
    // VAULT_PRIVATE_KEY — nothing is excluded in that case.
    const excludedOperatorAddress = options?.agentAddress ?? getAgentAddress() ?? '';

    const config = NETWORK_CONFIGS[network];
    const recipientAddress = options?.recipientAddress || config.recipientAddress;
    const maxRecentTransfers = options?.maxRecentTransfers || SETTLEMENT_RECENT_LIMIT;
    const provider = getProvider(network);

    // Attempt to get block number, fallback to 0 if network is down
    let latestBlock = 0;
    try {
        latestBlock = await withTimeout(
            provider.getBlockNumber(),
            SETTLEMENT_RPC_TIMEOUT_MS,
            `[SettlementService] ${network} block-number RPC timed out`,
        );
    } catch (err) {
        console.warn(`[SettlementService] Failed to get block number for ${network}:`, err);
        return createEmptySettlementStats(network, excludedOperatorAddress, recipientAddress);
    }

    const cacheKey = `${network}:${excludedOperatorAddress ? ethers.utils.getAddress(excludedOperatorAddress) : ''}:${ethers.utils.getAddress(recipientAddress)}:${maxRecentTransfers}`;

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
        : createEmptySettlementStats(network, excludedOperatorAddress, recipientAddress);
    const scanFromBlock = isCacheHit
        ? _settlementStatsCache[cacheKey].latestBlock + 1
        : getSettlementStartBlock(network, latestBlock);

    const deltaStats = await scanSettlementRange(
        network,
        provider,
        excludedOperatorAddress,
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
 * EIP-3009 mandate settlement — the mandate-first x402 buyer path.
 *
 * The buyer signs a `TransferWithAuthorization` off-chain (no gas, no chain
 * switch); the merchant (VAULT_PRIVATE_KEY) submits it on-chain and pays gas.
 * A mandate is only credited AFTER the on-chain transfer succeeds — credit is
 * the settled amount, not the claimed amount.
 *
 * This moves buyer→merchant funds — it is the settlement of record, not a
 * mirror.
 */
export interface Eip3009MandateSettlement {
    sender: string;
    recipient: string;
    amount: string;        // USDC decimal string
    validAfter: number;
    validBefore: number;
    nonce: string;         // challenge nonce (string) or 0x-hex bytes32
    signature: string;
    chainId: number;
    tokenAddress: string;
}

export async function settleWithAuthorization(
    mandate: Eip3009MandateSettlement,
    network: SettlementNetwork = DEFAULT_SETTLEMENT_NETWORK
): Promise<{ txHash: string; amountUSDC: number; explorer: string }> {
    const config = NETWORK_CONFIGS[network];
    if (!config.eip3009) {
        throw new Error(`EIP-3009 mandates are not supported on ${network} (${SETTLEMENT_ENV})`);
    }
    const c = getContracts(network);
    if (!c) {
        throw new Error(`No agent wallet configured for ${network} — cannot settle mandate`);
    }

    // Bind the mandate to THIS rail + merchant before touching the chain — a
    // mandate signed for a different chain/token/recipient must never credit.
    if (mandate.chainId !== config.chainId) {
        throw new Error(`Mandate chainId ${mandate.chainId} does not match rail chainId ${config.chainId}`);
    }
    if (mandate.tokenAddress.toLowerCase() !== config.usdcAddress.toLowerCase()) {
        throw new Error('Mandate token does not match the rail settlement token');
    }
    if (mandate.recipient.toLowerCase() !== config.recipientAddress.toLowerCase()) {
        throw new Error('Mandate recipient is not the settlement wallet');
    }
    const nowSec = Math.floor(Date.now() / 1000);
    if (Number(mandate.validAfter) > nowSec) {
        throw new Error('Mandate is not yet valid');
    }
    if (Number(mandate.validBefore) <= nowSec) {
        throw new Error('Mandate has expired');
    }

    const value = ethers.utils.parseUnits(String(mandate.amount), 6);
    if (value.lte(0)) {
        throw new Error('Mandate amount must be positive');
    }
    const nonce32 = eip3009NonceBytes32(mandate.nonce);
    const { v, r, s } = ethers.utils.splitSignature(mandate.signature);

    // Pre-check: a spent/canceled authorization would revert on-chain — fail
    // cleanly before spending gas.
    const alreadyUsed: boolean = await withTimeout(
        c.usdc.authorizationState(mandate.sender, nonce32),
        SETTLEMENT_RPC_TIMEOUT_MS,
        `[SettlementService] ${network} authorizationState RPC timed out`,
    );
    if (alreadyUsed) {
        throw new Error('Authorization already used or canceled');
    }

    const tx: ethers.providers.TransactionResponse = await c.usdc.transferWithAuthorization(
        mandate.sender,
        mandate.recipient,
        value,
        mandate.validAfter,
        mandate.validBefore,
        nonce32,
        v,
        r,
        s,
        { gasLimit: 150_000 },
    );

    const receipt = await withTimeout(
        tx.wait(1),
        30_000,
        `[SettlementService] ${network} transferWithAuthorization confirmation timed out`,
    );
    if (!receipt.status) {
        throw new Error('transferWithAuthorization reverted on-chain');
    }

    console.log(`[SettlementService] ✅ EIP-3009 mandate settled: ${mandate.amount} USDC ${mandate.sender}→${mandate.recipient} on ${network} → ${tx.hash}`);

    return {
        txHash: tx.hash,
        amountUSDC: parseFloat(ethers.utils.formatUnits(value, 6)),
        explorer: `${config.explorerBase}/tx/${tx.hash}`,
    };
}

// No per-rail convenience wrappers. Use settleWithAuthorization(mandate, network)
// and getSettlementStats(network, ...) with DEFAULT_SETTLEMENT_NETWORK or the
// desired SettlementNetwork to keep a single settlement API.
