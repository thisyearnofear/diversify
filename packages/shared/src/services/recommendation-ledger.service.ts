/**
 * Recommendation Ledger Service
 *
 * Records and queries AI recommendations on-chain via the chain-aware
 * RecommendationLedger contract. The ledger of record follows the money:
 * savings actions (Mento stablecoins) settle on Celo mainnet, yield actions
 * (RWA, USDC liquidity) settle on Arbitrum mainnet. 0G is the evidence layer
 * — Storage holds the reasoning CIDs, and the 0G Galileo deployment serves
 * as an evidence anchor/mirror for cross-chain verification.
 *
 * Chain-aware routing is implemented via `getLedgerChainForAction()`, which
 * maps the action's target token to the correct settlement chain. Callers
 * can override with an explicit `chainId` parameter.
 *
 * Each recommendation is linked to:
 *   - 0G Storage evidence CID (AI reasoning + source data)
 *   - 0G Serving model ID (which model generated the advice)
 *   - Settlement tx hash (x402 nanopayment proof)
 */

import { ethers } from 'ethers6';

// ============================================================================
// TYPES
// ============================================================================

export interface LedgerRecommendation {
    id: number;
    user: string;
    action: string;
    targetToken: string;
    reasoningHash: string;
    evidenceCid: string;
    servingModel: string;
    settlementTxHash: string;
    timestamp: number;
    confidence: number;
}

export interface LedgerConfig {
    contractAddress: string;
    rpcUrl: string;
    chainId: number;
}

/**
 * Observable result of anchoring a recommendation to the on-chain ledger.
 *
 * The function never throws — every failure mode is captured as a `status`
 * so call sites can surface it to the user instead of silently dropping it.
 *
 * - `anchored` — the tx was mined, the `RecommendationRecorded` event was
 *   parsed, and `id` is the on-chain recommendation id.
 * - `pending`  — the tx was broadcast (we have a `txHash`) but the receipt
 *   could not be confirmed in the configured timeout. The recommendation
 *   may still land on-chain; callers can re-query by `txHash` later.
 * - `failed`   — the tx reverted, the write contract was unavailable
 *   (no signer / no contract address), or the RPC threw. The `error`
 *   field carries the reason.
 */
export type AnchorStatus = 'anchored' | 'pending' | 'failed';

export type AnchorResult =
    | { status: 'anchored'; id: number; txHash: string; chainId: number; explorerUrl: string }
    | { status: 'pending'; txHash: string; chainId: number; explorerUrl: string }
    | { status: 'failed'; error: string; chainId: number };

export function buildLedgerExplorerUrl(txHash: string, chainId?: number): string {
    const resolvedChainId = chainId ?? getDefaultLedgerChainId();
    if (resolvedChainId === 42220) return `https://celoscan.io/tx/${txHash}`;
    if (resolvedChainId === 11142220) return `https://celoscan.io/tx/${txHash}`; // Celo Sepolia
    if (resolvedChainId === 42161) return `https://arbiscan.io/tx/${txHash}`;
    if (resolvedChainId === 421614) return `https://sepolia.arbiscan.io/tx/${txHash}`;
    if (resolvedChainId === 16602) return `https://chainscan-galileo.0g.ai/tx/${txHash}`;
    if (resolvedChainId === 16661) return `https://chainscan.0g.ai/tx/${txHash}`;
    return `https://chainscan-galileo.0g.ai/tx/${txHash}`;
}

// ============================================================================
// ABI
// ============================================================================

const RECOMMENDATION_LEDGER_ABI = [
    // Events
    'event RecommendationRecorded(uint256 indexed id, address indexed user, string action, string targetToken, bytes32 reasoningHash, string evidenceCid, string servingModel, uint256 confidence, uint256 timestamp)',
    'event AgentAuthorized(address indexed agent, bool authorized)',
    'event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)',

    // State
    'function totalRecommendations() view returns (uint256)',

    // Admin
    'function setAgentAuthorization(address agent, bool authorized) external',
    'function transferOwnership(address newOwner) external',
    'function authorizedAgents(address) view returns (bool)',
    'function owner() view returns (address)',

    // Core
    'function recordRecommendation(address user, string action, string targetToken, bytes32 reasoningHash, string evidenceCid, string servingModel, string settlementTxHash, uint256 confidence) external returns (uint256)',

    // Views
    'function getRecommendation(uint256 id) view returns (tuple(address user, string action, string targetToken, bytes32 reasoningHash, string evidenceCid, string servingModel, string settlementTxHash, uint256 timestamp, uint256 confidence))',
    'function getUserRecommendationIds(address user) view returns (uint256[])',
    'function getUserRecommendations(address user, uint256 offset, uint256 limit) view returns (tuple(address user, string action, string targetToken, bytes32 reasoningHash, string evidenceCid, string servingModel, string settlementTxHash, uint256 timestamp, uint256 confidence)[] results, uint256 total)',
    'function getUserRecommendationCount(address user) view returns (uint256)',
    'function recommendationExists(uint256 id) view returns (bool)',
] as const;

/**
 * Compute the keccak256 hash used by the on-chain ledger as the reasoning
 * commitment. The full reasoning text lives in 0G Storage; only this hash is
 * stored on-chain.
 */
export function computeReasoningHash(reasoning: string): string {
    return ethers.keccak256(ethers.toUtf8Bytes(reasoning));
}

// ============================================================================
// CHAIN-AWARE CONFIG REGISTRY
// ============================================================================

const CELO_MAINNET_CHAIN_ID = 42220;
const ARBITRUM_MAINNET_CHAIN_ID = 42161;
const ARBITRUM_SEPOLIA_CHAIN_ID = 421614;
const ZERO_G_GALILEO_CHAIN_ID = 16602;
const ZERO_G_MAINNET_CHAIN_ID = 16661;

/**
 * Tokens that settle on Celo (savings / local stablecoins via Mento).
 * Used by `getLedgerChainForAction` to route recommendations.
 * All entries are uppercase — the routing function uppercases the input token.
 */
const CELO_SAVINGS_TOKENS = new Set([
    'CUSD', 'CEUR', 'CREAL', 'KESM', 'COPM', 'PHPM', 'GHSM', 'CKES', 'CCOP',
    'CELO', 'G$', 'GOOD',
]);

/**
 * Registry of supported ledger deployments.
 *
 * Chain-aware: the ledger of record follows the money.
 * - Celo mainnet: savings decisions of record (Mento stablecoins)
 * - Arbitrum mainnet: yield decisions of record (RWA, USDC liquidity)
 * - Arbitrum Sepolia: testnet (retained for backward compatibility)
 * - 0G Galileo: evidence anchor/mirror for cross-chain verification
 *
 * Env vars are read lazily on each access so tests can override them
 * after module load.
 */
function getLedgerRegistry(): Record<number, LedgerConfig> {
    return {
        [CELO_MAINNET_CHAIN_ID]: {
            contractAddress: process.env.CELO_MAINNET_LEDGER_CONTRACT || '',
            rpcUrl: process.env.CELO_RPC_URL || 'https://forno.celo.org',
            chainId: CELO_MAINNET_CHAIN_ID,
        },
        [ARBITRUM_MAINNET_CHAIN_ID]: {
            contractAddress: process.env.ARBITRUM_MAINNET_LEDGER_CONTRACT || '',
            rpcUrl: process.env.ARBITRUM_ONE_RPC_URL || 'https://arb1.arbitrum.io/rpc',
            chainId: ARBITRUM_MAINNET_CHAIN_ID,
        },
        [ARBITRUM_SEPOLIA_CHAIN_ID]: {
            contractAddress: process.env.ARBITRUM_LEDGER_CONTRACT || '',
            rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc',
            chainId: ARBITRUM_SEPOLIA_CHAIN_ID,
        },
        [ZERO_G_GALILEO_CHAIN_ID]: {
            contractAddress: process.env.ZERO_G_LEDGER_CONTRACT || '0xFADc8a7220Fa152eBE3Dfc5f7828Be289559D4ED',
            rpcUrl: process.env.ZERO_G_RPC_URL || 'https://evmrpc-testnet.0g.ai',
            chainId: ZERO_G_GALILEO_CHAIN_ID,
        },
        [ZERO_G_MAINNET_CHAIN_ID]: {
            contractAddress: process.env.ZERO_G_MAINNET_LEDGER_CONTRACT || '',
            rpcUrl: process.env.ZERO_G_MAINNET_RPC_URL || 'https://evmrpc.0g.ai',
            chainId: ZERO_G_MAINNET_CHAIN_ID,
        },
    };
}

/**
 * Mutable override registry for runtime-set contract addresses.
 * Populated by `setLedgerContractAddress` and merged with env-derived config.
 */
const _runtimeOverrides: Record<number, Partial<LedgerConfig>> = {};

function resolveLedgerConfig(chainId: number): LedgerConfig | null {
    const registry = getLedgerRegistry();
    const base = registry[chainId];
    if (!base) return null;
    const override = _runtimeOverrides[chainId];
    return override ? { ...base, ...override } : base;
}

/**
 * Determine the correct ledger chain for a given action based on the
 * target token. The ledger of record follows the money:
 * - Celo savings tokens (cUSD, cREAL, KESm, etc.) → Celo mainnet
 * - Yield/RWA tokens (USDY, PAXG, USDC, etc.) → Arbitrum mainnet
 * - HOLD or unspecified → default chain (Arbitrum mainnet if configured,
 *   else Arbitrum Sepolia for backward compat)
 *
 * Callers can override with an explicit `chainId` parameter.
 */
export function getLedgerChainForAction(action: string, targetToken: string): number {
    const token = (targetToken || '').toUpperCase().trim();

    // Celo savings tokens → Celo mainnet
    if (CELO_SAVINGS_TOKENS.has(token)) {
        const celoConfig = resolveLedgerConfig(CELO_MAINNET_CHAIN_ID);
        if (celoConfig?.contractAddress) return CELO_MAINNET_CHAIN_ID;
    }

    // Everything else (yield, RWA, USDC, BRIDGE) → Arbitrum mainnet
    const arbMainnet = resolveLedgerConfig(ARBITRUM_MAINNET_CHAIN_ID);
    if (arbMainnet?.contractAddress) return ARBITRUM_MAINNET_CHAIN_ID;

    // Fall back to Arbitrum Sepolia for backward compatibility
    return getDefaultLedgerChainId();
}

/**
 * Returns the default chain ID used when callers do not specify one
 * and the action type is not determinable. Prefers Arbitrum mainnet
 * when configured, then Arbitrum Sepolia, then 0G Galileo.
 */
export function getDefaultLedgerChainId(): number {
    const arbMainnet = resolveLedgerConfig(ARBITRUM_MAINNET_CHAIN_ID);
    if (arbMainnet?.contractAddress) {
        return ARBITRUM_MAINNET_CHAIN_ID;
    }
    const arbitrum = resolveLedgerConfig(ARBITRUM_SEPOLIA_CHAIN_ID);
    if (arbitrum?.contractAddress) {
        return ARBITRUM_SEPOLIA_CHAIN_ID;
    }
    const zeroGMainnet = resolveLedgerConfig(ZERO_G_MAINNET_CHAIN_ID);
    if (zeroGMainnet?.contractAddress) {
        return ZERO_G_MAINNET_CHAIN_ID;
    }
    return ZERO_G_GALILEO_CHAIN_ID;
}

export function getLedgerConfig(chainId?: number): LedgerConfig | null {
    const id = chainId ?? getDefaultLedgerChainId();
    return resolveLedgerConfig(id);
}

export function setLedgerContractAddress(address: string, chainId?: number): void {
    const id = chainId ?? getDefaultLedgerChainId();
    const registry = getLedgerRegistry();
    if (!registry[id]) {
        throw new Error(`[RecommendationLedger] Unsupported chainId: ${id}`);
    }
    _runtimeOverrides[id] = { ..._runtimeOverrides[id], contractAddress: address };
    // Reset cached contracts for this chain to force re-initialization
    delete _readOnlyContracts[id];
    delete _writeContracts[id];
}

export function getLedgerContractAddress(chainId?: number): string {
    return getLedgerConfig(chainId)?.contractAddress || '';
}

export function listSupportedLedgerChains(): number[] {
    return Object.keys(getLedgerRegistry()).map(Number);
}

// ============================================================================
// PER-CHAIN PROVIDER / CONTRACT CACHE
// ============================================================================

const _providers: Record<number, ethers.JsonRpcProvider> = {};
const _signers: Record<number, ethers.Wallet> = {};
const _readOnlyContracts: Record<number, ethers.Contract> = {};
const _writeContracts: Record<number, ethers.Contract> = {};

function getProvider(chainId: number): ethers.JsonRpcProvider {
    if (!_providers[chainId]) {
        const config = getLedgerConfig(chainId);
        if (!config) {
            throw new Error(`[RecommendationLedger] Unsupported chainId: ${chainId}`);
        }
        _providers[chainId] = new ethers.JsonRpcProvider(config.rpcUrl);
    }
    return _providers[chainId];
}

function getReadOnlyContract(chainId: number): ethers.Contract {
    if (!_readOnlyContracts[chainId]) {
        const config = getLedgerConfig(chainId);
        if (!config?.contractAddress) {
            throw new Error(`RecommendationLedger contract not deployed for chain ${chainId}. Set ARBITRUM_LEDGER_CONTRACT or ZERO_G_LEDGER_CONTRACT env var.`);
        }
        _readOnlyContracts[chainId] = new ethers.Contract(
            config.contractAddress,
            RECOMMENDATION_LEDGER_ABI,
            getProvider(chainId)
        );
    }
    return _readOnlyContracts[chainId];
}

function getWriteContract(chainId: number): ethers.Contract | null {
    // Prefer LEDGER_PRIVATE_KEY (the ledger signer — typically the deployer
    // wallet that is funded and authorized as an agent on all chains).
    // Fall back to VAULT_PRIVATE_KEY for backward compatibility.
    const privateKey = process.env.LEDGER_PRIVATE_KEY || process.env.VAULT_PRIVATE_KEY;
    if (!privateKey) {
        console.warn('[RecommendationLedger] No LEDGER_PRIVATE_KEY or VAULT_PRIVATE_KEY set — write operations disabled');
        return null;
    }

    if (!_writeContracts[chainId]) {
        const config = getLedgerConfig(chainId);
        if (!config?.contractAddress) {
            console.warn(`[RecommendationLedger] Contract address not set for chain ${chainId} — write operations disabled`);
            return null;
        }
        if (!_signers[chainId]) {
            _signers[chainId] = new ethers.Wallet(privateKey, getProvider(chainId));
        }
        _writeContracts[chainId] = new ethers.Contract(
            config.contractAddress,
            RECOMMENDATION_LEDGER_ABI,
            _signers[chainId]
        );
    }
    return _writeContracts[chainId];
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Record a recommendation on-chain.
 *
 * The return value is the single source of truth for anchor status. Callers
 * must inspect `result.status` and surface it to the user — never ignore
 * `failed` results.
 *
 * Chain-aware routing: if `chainId` is not specified, the service determines
 * the correct chain based on `targetToken` — Celo mainnet for savings tokens
 * (cUSD, cREAL, KESm, etc.), Arbitrum mainnet for yield tokens (USDY, PAXG,
 * USDC, etc.). 0G Galileo is used as an evidence anchor via
 * `mirrorRecommendationToZeroG`.
 *
 * @param params.recommendation data
 * @param params.chainId optional target chain; if omitted, chain-aware routing is used
 */
export async function recordRecommendation(params: {
    user: string;
    action: string;
    targetToken: string;
    /** On-chain keccak256 commitment. Provide either this or `reasoning`. */
    reasoningHash?: string;
    /** Full reasoning text; the service will hash it if `reasoningHash` is omitted. */
    reasoning?: string;
    evidenceCid: string;
    servingModel: string;
    settlementTxHash?: string;
    confidence: number;
    chainId?: number;
}): Promise<AnchorResult> {
    const reasoningHash = params.reasoningHash
        ? params.reasoningHash
        : params.reasoning
            ? computeReasoningHash(params.reasoning)
            : ethers.ZeroHash;
    // Chain-aware routing: determine the correct chain based on the action's
    // target token if the caller didn't specify one explicitly.
    const chainId = params.chainId ?? getLedgerChainForAction(params.action, params.targetToken);
    const config = getLedgerConfig(chainId);
    if (!config) {
        return { status: 'failed', error: `Unsupported ledger chainId: ${chainId}`, chainId };
    }

    const contract = getWriteContract(chainId);
    if (!contract) {
        return {
            status: 'failed',
            error: `RecommendationLedger write contract unavailable for chain ${chainId} (signer or contract address missing)`,
            chainId,
        };
    }

    let tx;
    try {
        tx = await contract.recordRecommendation(
            params.user,
            params.action,
            params.targetToken,
            reasoningHash,
            params.evidenceCid,
            params.servingModel,
            params.settlementTxHash || '',
            params.confidence,
            { gasLimit: 500_000 }
        );
    } catch (error: any) {
        console.error(`[RecommendationLedger] ❌ Failed to broadcast for ${params.user} on chain ${chainId}: ${error.message}`);
        return { status: 'failed', error: error.message || 'Broadcast failed', chainId };
    }

    const explorerUrl = buildLedgerExplorerUrl(tx.hash, chainId);

    let receipt;
    try {
        // Wait for one confirmation so the event can be parsed. If the
        // network is congested this may time out — in that case we return
        // 'pending' rather than failing the whole call, because the tx
        // is still on its way and the user can re-query by txHash.
        receipt = await tx.wait(1, 60_000);
    } catch (error: any) {
        console.warn(`[RecommendationLedger] ⏳ Broadcast but receipt not confirmed for ${params.user} on chain ${chainId}: ${tx.hash} — ${error.message}`);
        return { status: 'pending', txHash: tx.hash, chainId, explorerUrl };
    }

    if (receipt && receipt.status === 0) {
        console.error(`[RecommendationLedger] ❌ Transaction reverted for ${params.user} on chain ${chainId}: ${params.action} → ${params.targetToken} (tx: ${tx.hash})`);
        return { status: 'failed', error: 'On-chain transaction reverted', chainId };
    }

    // Parse the RecommendationRecorded event from the receipt logs.
    let id = -1;
    if (receipt) {
        for (const log of receipt.logs) {
            try {
                const parsed = contract.interface.parseLog({
                    topics: [...log.topics],
                    data: log.data,
                });
                if (!parsed || parsed.name !== 'RecommendationRecorded') continue;
                id = Number(parsed.args.id);
                break;
            } catch {
                // Skip logs that don't match our ABI.
            }
        }
        if (id < 1) {
            try {
                id = Number(await contract.totalRecommendations());
            } catch {
                // Fall through with id = -1; the receipt itself is the
                // ground truth and the caller can re-query by txHash.
            }
        }
    }

    if (id < 1) {
        // Tx was mined but the event was not parseable. Still treat the
        // anchor as resolved — the receipt is on-chain proof.
        return { status: 'anchored', id: -1, txHash: tx.hash, chainId, explorerUrl };
    }

    console.log(`[RecommendationLedger] ✅ Recorded #${id} for ${params.user} on chain ${chainId}: ${params.action} → ${params.targetToken} (tx: ${tx.hash})`);
    return { status: 'anchored', id, txHash: tx.hash, chainId, explorerUrl };
}

/**
 * Mirror a recommendation to the 0G evidence anchor after it has been
 * settled on the chain-aware ledger (Celo or Arbitrum). 0G is the evidence
 * layer — this write creates a cross-chain verifiable reference to the
 * reasoning CID that the settlement ledger entry points to.
 *
 * Prefers 0G mainnet (chain 16661) when ZERO_G_MAINNET_LEDGER_CONTRACT is
 * set, falling back to 0G Galileo testnet (16602) for backward compat.
 */
export async function mirrorRecommendationToZeroG(
    params: Omit<Parameters<typeof recordRecommendation>[0], 'chainId'>
): Promise<AnchorResult> {
    const mainnetConfig = resolveLedgerConfig(ZERO_G_MAINNET_CHAIN_ID);
    const targetChain = mainnetConfig?.contractAddress
        ? ZERO_G_MAINNET_CHAIN_ID
        : ZERO_G_GALILEO_CHAIN_ID;
    return recordRecommendation({ ...params, chainId: targetChain });
}

/**
 * Get a recommendation by ID
 */
export async function getRecommendation(id: number, chainId?: number): Promise<LedgerRecommendation | null> {
    try {
        const resolvedChainId = chainId ?? getDefaultLedgerChainId();
        const contract = getReadOnlyContract(resolvedChainId);
        const result = await contract.getRecommendation(id);

        return {
            id,
            user: result.user,
            action: result.action,
            targetToken: result.targetToken,
            reasoningHash: result.reasoningHash,
            evidenceCid: result.evidenceCid,
            servingModel: result.servingModel,
            settlementTxHash: result.settlementTxHash,
            timestamp: Number(result.timestamp),
            confidence: Number(result.confidence) / 10000,
        };
    } catch (error: any) {
        console.error('[RecommendationLedger] Failed to get recommendation:', error.message);
        return null;
    }
}

/**
 * Get all recommendation IDs for a user
 */
export async function getUserRecommendationIds(user: string, chainId?: number): Promise<number[]> {
    try {
        const resolvedChainId = chainId ?? getDefaultLedgerChainId();
        const contract = getReadOnlyContract(resolvedChainId);
        const ids = await contract.getUserRecommendationIds(user);
        return ids.map((id: any) => Number(id));
    } catch (error: any) {
        console.error('[RecommendationLedger] Failed to get user recommendation IDs:', error.message);
        return [];
    }
}

/**
 * Get paginated recommendations for a user
 */
export async function getUserRecommendations(
    user: string,
    offset: number = 0,
    limit: number = 10,
    chainId?: number
): Promise<{ recommendations: LedgerRecommendation[]; total: number }> {
    try {
        const resolvedChainId = chainId ?? getDefaultLedgerChainId();
        const contract = getReadOnlyContract(resolvedChainId);
        const [results, total] = await contract.getUserRecommendations(user, offset, limit);

        return {
            recommendations: results.map((r: any, i: number) => ({
                id: offset + i + 1,
                user: r.user,
                action: r.action,
                targetToken: r.targetToken,
                reasoningHash: r.reasoningHash,
                evidenceCid: r.evidenceCid,
                servingModel: r.servingModel,
                settlementTxHash: r.settlementTxHash,
                timestamp: Number(r.timestamp),
                confidence: Number(r.confidence) / 10000,
            })),
            total: Number(total),
        };
    } catch (error: any) {
        console.error('[RecommendationLedger] Failed to get user recommendations:', error.message);
        return { recommendations: [], total: 0 };
    }
}

/**
 * Get recommendation ledger stats
 */
export async function getLedgerStats(chainId?: number): Promise<{
    totalRecommendations: number;
    contractAddress: string;
    chainId: number;
    isDeployed: boolean;
}> {
    try {
        const resolvedChainId = chainId ?? getDefaultLedgerChainId();
        const contract = getReadOnlyContract(resolvedChainId);
        const total = await contract.totalRecommendations();
        const actualOwner = await contract.owner();
        const config = getLedgerConfig(resolvedChainId);

        return {
            totalRecommendations: Number(total),
            contractAddress: config?.contractAddress || '',
            chainId: resolvedChainId,
            isDeployed: true,
        };
    } catch (error: any) {
        const resolvedChainId = chainId ?? getDefaultLedgerChainId();
        const config = getLedgerConfig(resolvedChainId);
        console.warn(`[RecommendationLedger] Failed to get stats for chain ${resolvedChainId}:`, error.message);
        return {
            totalRecommendations: 0,
            contractAddress: config?.contractAddress || '',
            chainId: resolvedChainId,
            isDeployed: false,
        };
    }
}

/**
 * Get the total number of recommendations
 */
export async function getTotalRecommendations(chainId?: number): Promise<number> {
    try {
        const resolvedChainId = chainId ?? getDefaultLedgerChainId();
        const contract = getReadOnlyContract(resolvedChainId);
        const total = await contract.totalRecommendations();
        return Number(total);
    } catch {
        return 0;
    }
}

export const recommendationLedgerService = {
    recordRecommendation,
    mirrorRecommendationToZeroG,
    getRecommendation,
    getUserRecommendationIds,
    getUserRecommendations,
    getLedgerStats,
    getTotalRecommendations,
    setLedgerContractAddress,
    getLedgerContractAddress,
    getDefaultLedgerChainId,
    getLedgerChainForAction,
    listSupportedLedgerChains,
    buildLedgerExplorerUrl,
    computeReasoningHash,
};

export default recommendationLedgerService;
