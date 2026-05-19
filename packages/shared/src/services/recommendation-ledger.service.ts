/**
 * Recommendation Ledger Service
 *
 * Records and queries AI recommendations on-chain via the RecommendationLedger
 * contract deployed on 0G Galileo Testnet.
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
    reasoning: string;
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

// ============================================================================
// ABI
// ============================================================================

const RECOMMENDATION_LEDGER_ABI = [
    // Events
    'event RecommendationRecorded(uint256 indexed id, address indexed user, string action, string targetToken, string evidenceCid, string servingModel, uint256 confidence, uint256 timestamp)',
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
    'function recordRecommendation(address user, string action, string targetToken, string reasoning, string evidenceCid, string servingModel, string settlementTxHash, uint256 confidence) external returns (uint256)',

    // Views
    'function getRecommendation(uint256 id) view returns (tuple(address user, string action, string targetToken, string reasoning, string evidenceCid, string servingModel, string settlementTxHash, uint256 timestamp, uint256 confidence))',
    'function getUserRecommendationIds(address user) view returns (uint256[])',
    'function getUserRecommendations(address user, uint256 offset, uint256 limit) view returns (tuple(address user, string action, string targetToken, string reasoning, string evidenceCid, string servingModel, string settlementTxHash, uint256 timestamp, uint256 confidence)[] results, uint256 total)',
    'function getUserRecommendationCount(address user) view returns (uint256)',
    'function recommendationExists(uint256 id) view returns (bool)',
] as const;

// ============================================================================
// SERVICE
// ============================================================================

// Default config for 0G Galileo Testnet
const DEFAULT_CONFIG: LedgerConfig = {
    contractAddress: process.env.ZERO_G_LEDGER_CONTRACT || '0x8b8528dE95178b77d46CF5A9612C1C9FCc53740f',
    rpcUrl: process.env.ZERO_G_RPC_URL || 'https://evmrpc-testnet.0g.ai',
    chainId: 16602,
};

// Lazily initialised provider, signer, and contract
let _provider: ethers.JsonRpcProvider | null = null;
let _signer: ethers.Wallet | null = null;
let _readOnlyContract: ethers.Contract | null = null;
let _writeContract: ethers.Contract | null = null;

function getProvider(): ethers.JsonRpcProvider {
    if (!_provider) {
        _provider = new ethers.JsonRpcProvider(DEFAULT_CONFIG.rpcUrl);
    }
    return _provider;
}

function getReadOnlyContract(): ethers.Contract {
    if (!_readOnlyContract) {
        if (!DEFAULT_CONFIG.contractAddress) {
            throw new Error('RecommendationLedger contract not deployed. Set ZERO_G_LEDGER_CONTRACT env var.');
        }
        _readOnlyContract = new ethers.Contract(
            DEFAULT_CONFIG.contractAddress,
            RECOMMENDATION_LEDGER_ABI,
            getProvider()
        );
    }
    return _readOnlyContract;
}

function getWriteContract(): ethers.Contract | null {
    const privateKey = process.env.VAULT_PRIVATE_KEY;
    if (!privateKey) {
        console.warn('[RecommendationLedger] VAULT_PRIVATE_KEY not set — write operations disabled');
        return null;
    }

    if (!_writeContract) {
        if (!DEFAULT_CONFIG.contractAddress) {
            console.warn('[RecommendationLedger] Contract address not set — write operations disabled');
            return null;
        }
        if (!_signer) {
            _signer = new ethers.Wallet(privateKey, getProvider());
        }
        _writeContract = new ethers.Contract(
            DEFAULT_CONFIG.contractAddress,
            RECOMMENDATION_LEDGER_ABI,
            _signer
        );
    }
    return _writeContract;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Update the contract address (called after deployment or from config)
 */
export function setLedgerContractAddress(address: string): void {
    DEFAULT_CONFIG.contractAddress = address;
    // Reset cached contracts to force re-initialization
    _readOnlyContract = null;
    _writeContract = null;
}

/**
 * Get the current contract address
 */
export function getLedgerContractAddress(): string {
    return DEFAULT_CONFIG.contractAddress;
}

/**
 * Record a recommendation on-chain
 */
export async function recordRecommendation(params: {
    user: string;
    action: string;
    targetToken: string;
    reasoning: string;
    evidenceCid: string;
    servingModel: string;
    settlementTxHash?: string;
    confidence: number;
}): Promise<{ id: number; txHash: string } | null> {
    try {
        const contract = getWriteContract();
        if (!contract) {
            console.warn('[RecommendationLedger] Write contract not available, skipping on-chain record');
            return null;
        }

        const tx = await contract.recordRecommendation(
            params.user,
            params.action,
            params.targetToken,
            params.reasoning,
            params.evidenceCid,
            params.servingModel,
            params.settlementTxHash || '',
            params.confidence,
            { gasLimit: 300_000 }
        );

        const receipt = await tx.wait();

        // Check if the transaction reverted
        if (receipt && receipt.status === 0) {
            console.error(`[RecommendationLedger] ❌ Transaction reverted for ${params.user}: ${params.action} → ${params.targetToken} (tx: ${tx.hash})`);
            return null;
        }

        // ethers v6: parse the RecommendationRecorded event from receipt logs
        let id = -1;
        if (receipt) {
            for (const log of receipt.logs) {
                try {
                    const parsed = contract.interface.parseLog({
                        topics: [...log.topics],
                        data: log.data
                    });
                    if (!parsed || parsed.name !== 'RecommendationRecorded') continue;
                    id = Number(parsed.args.id);
                    break;
                } catch {
                    // Skip logs that don't match our ABI
                }
            }
            // Fallback: read totalRecommendations stat if event parsing didn't yield an ID
            if (id < 1) {
                try {
                    id = Number(await contract.totalRecommendations());
                } catch {}
            }
        }

        console.log(`[RecommendationLedger] ✅ Recorded #${id} for ${params.user}: ${params.action} → ${params.targetToken} (tx: ${tx.hash})`);

        return { id, txHash: tx.hash };
    } catch (error: any) {
        console.error('[RecommendationLedger] Failed to record recommendation:', error.message);
        return null;
    }
}

/**
 * Get a recommendation by ID
 */
export async function getRecommendation(id: number): Promise<LedgerRecommendation | null> {
    try {
        const contract = getReadOnlyContract();
        const result = await contract.getRecommendation(id);

        return {
            id,
            user: result.user,
            action: result.action,
            targetToken: result.targetToken,
            reasoning: result.reasoning,
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
export async function getUserRecommendationIds(user: string): Promise<number[]> {
    try {
        const contract = getReadOnlyContract();
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
    limit: number = 10
): Promise<{ recommendations: LedgerRecommendation[]; total: number }> {
    try {
        const contract = getReadOnlyContract();
        const [results, total] = await contract.getUserRecommendations(user, offset, limit);

        return {
            recommendations: results.map((r: any, i: number) => ({
                id: offset + i + 1,
                user: r.user,
                action: r.action,
                targetToken: r.targetToken,
                reasoning: r.reasoning,
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
export async function getLedgerStats(): Promise<{
    totalRecommendations: number;
    contractAddress: string;
    chainId: number;
    isDeployed: boolean;
}> {
    try {
        const contract = getReadOnlyContract();
        const total = await contract.totalRecommendations();
        const actualOwner = await contract.owner();

        return {
            totalRecommendations: Number(total),
            contractAddress: DEFAULT_CONFIG.contractAddress,
            chainId: DEFAULT_CONFIG.chainId,
            isDeployed: true,
        };
    } catch (error: any) {
        console.warn('[RecommendationLedger] Failed to get stats:', error.message);
        return {
            totalRecommendations: 0,
            contractAddress: DEFAULT_CONFIG.contractAddress,
            chainId: DEFAULT_CONFIG.chainId,
            isDeployed: false,
        };
    }
}

/**
 * Get the total number of recommendations
 */
export async function getTotalRecommendations(): Promise<number> {
    try {
        const contract = getReadOnlyContract();
        const total = await contract.totalRecommendations();
        return Number(total);
    } catch {
        return 0;
    }
}

export const recommendationLedgerService = {
    recordRecommendation,
    getRecommendation,
    getUserRecommendationIds,
    getUserRecommendations,
    getLedgerStats,
    getTotalRecommendations,
    setLedgerContractAddress,
    getLedgerContractAddress,
};

export default recommendationLedgerService;
