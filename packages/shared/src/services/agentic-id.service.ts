/**
 * Agentic ID Service
 *
 * Mints and resolves DiversiFi Guardian identities on 0G mainnet.
 * The AgenticID contract is an ERC-721/ERC-7857-inspired pointer:
 *   - tokenURI / tokenUri points at a public agent doc in 0G Storage
 *   - encryptedTokenUri points at an evidence bundle in 0G Storage
 *   - one ID per user
 *
 * This is intentionally a backend-only service for Wave 3. No consumer
 * mint flow is exposed; the POST is intended for admin/demo minting.
 */

import { ethers } from 'ethers6';
import { withTimeout } from '../utils/promise-utils';
import { ZeroGStorageService } from '@diversifi/shared-0g';

// ============================================================================
// TYPES
// ============================================================================

export interface AgenticIdBundle {
    /** Public agent doc JSON. */
    agent: Record<string, unknown>;
    /** Evidence bundle JSON (access-controlled by the backend). */
    evidence: Record<string, unknown>;
}

export interface AgenticIdMintResult {
    status: 'minted' | 'pending' | 'failed';
    tokenId?: number;
    txHash?: string;
    explorerUrl?: string;
    agentUri?: string;
    encryptedUri?: string;
    agentCid?: string;
    encryptedCid?: string;
    error?: string;
}

export interface AgenticIdInfo {
    tokenId: number;
    owner: string;
    agentUri: string;
    encryptedUri: string;
    agentCid?: string;
    encryptedCid?: string;
}

export interface AgenticIdConfig {
    contractAddress: string;
    rpcUrl: string;
    /** 0G mainnet chain id. */
    chainId: number;
    privateKey: string;
    storageService: ZeroGStorageService;
    /** Defaults to 0G mainnet explorer. */
    explorerBase: string;
}

// ============================================================================
// CONTRACT ABI
// ============================================================================

const AGENTIC_ID_ABI = [
    'function mint(address to, string calldata agentURI, string calldata encryptedURI) external returns (uint256)',
    'function updateAgent(uint256 tokenId, string calldata agentURI, string calldata encryptedURI) external',
    'function tokenOf(address owner) external view returns (uint256)',
    'function ownerOf(uint256 tokenId) external view returns (address)',
    'function tokenURI(uint256 tokenId) external view returns (string memory)',
    'function tokenUri(uint256 tokenId) external view returns (string memory)',
    'function encryptedTokenUri(uint256 tokenId) external view returns (string memory)',
    'function totalAgents() external view returns (uint256)',
    'function balanceOf(address owner) external view returns (uint256)',
    'event AgentMinted(uint256 indexed tokenId, address indexed to, string agentURI, string encryptedURI)',
    'event AgentUpdated(uint256 indexed tokenId, string agentURI, string encryptedURI, uint8 updateType)',
];

// ============================================================================
// ENV RESOLUTION
// ============================================================================

let _cachedConfig: AgenticIdConfig | null = null;

const ZERO_G_MAINNET_CHAIN_ID = 16661;
const ZERO_G_MAINNET_EXPLORER = 'https://chainscan.0g.ai';
const DEFAULT_MAINNET_RPC = 'https://evmrpc.0g.ai';
const DEFAULT_MAINNET_STORAGE = 'https://storage.0g.ai';
const DEFAULT_MAINNET_INDEXER = 'https://indexer-storage.0g.ai';

export function resolveAgenticIdConfig(): AgenticIdConfig {
    if (_cachedConfig) return _cachedConfig;

    const contractAddress = process.env.AGENTIC_ID_CONTRACT_0G;
    if (!contractAddress) {
        throw new Error('AGENTIC_ID_CONTRACT_0G is not configured');
    }

    const privateKey =
        process.env.AGENTIC_ID_PRIVATE_KEY ||
        process.env.LEDGER_PRIVATE_KEY ||
        process.env.PRIVATE_KEY;
    if (!privateKey) {
        throw new Error('No minter private key found; set AGENTIC_ID_PRIVATE_KEY, LEDGER_PRIVATE_KEY, or PRIVATE_KEY');
    }

    _cachedConfig = {
        contractAddress,
        rpcUrl: process.env.ZERO_G_MAINNET_RPC_URL || DEFAULT_MAINNET_RPC,
        chainId: Number(process.env.ZERO_G_MAINNET_CHAIN_ID || ZERO_G_MAINNET_CHAIN_ID),
        privateKey,
        storageService: new ZeroGStorageService(
            process.env.ZERO_G_MAINNET_STORAGE_URL || DEFAULT_MAINNET_STORAGE,
            process.env.ZERO_G_MAINNET_INDEXER_URL || DEFAULT_MAINNET_INDEXER,
            process.env.ZERO_G_MAINNET_RPC_URL || DEFAULT_MAINNET_RPC,
        ),
        explorerBase: process.env.ZERO_G_MAINNET_EXPLORER_BASE || ZERO_G_MAINNET_EXPLORER,
    };
    return _cachedConfig;
}

export function setAgenticIdContractAddress(address: string): void {
    if (_cachedConfig) {
        _cachedConfig.contractAddress = address;
    }
    process.env.AGENTIC_ID_CONTRACT_0G = address;
}

export function getAgenticIdContractAddress(): string | undefined {
    return process.env.AGENTIC_ID_CONTRACT_0G;
}

export function resetAgenticIdConfig(): void {
    _cachedConfig = null;
}

// ============================================================================
// URI / CID HELPERS
// ============================================================================

export function cidFromUrl(url: string): string | undefined {
    // ZeroGStorageService returns `${storageUrl}/ipfs/${cid}`
    const match = url.match(/\/ipfs\/([a-zA-Z0-9]+)/);
    return match ? match[1] : undefined;
}

export function buildExplorerUrl(base: string, txHash: string): string {
    return `${base}/tx/${txHash}`;
}

// ============================================================================
// SERVICE
// ============================================================================

export class AgenticIdService {
    constructor(private readonly config: AgenticIdConfig) {}

    private getContract(readOnly = false): ethers.Contract {
        const provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
        if (readOnly) {
            return new ethers.Contract(this.config.contractAddress, AGENTIC_ID_ABI, provider);
        }
        const wallet = new ethers.Wallet(this.config.privateKey, provider);
        return new ethers.Contract(this.config.contractAddress, AGENTIC_ID_ABI, wallet);
    }

    /**
     * Resolve the Agentic ID (if any) for a wallet address.
     */
    async getAgenticId(user: string): Promise<AgenticIdInfo | null> {
        const contract = this.getContract(true);

        const tokenIdBig = await withTimeout(contract.tokenOf(user), 10_000, 'tokenOf timed out').catch(() => 0n);
        if (!tokenIdBig || tokenIdBig === 0n) {
            return null;
        }

        const tokenId = Number(tokenIdBig);
        const [agentUri, encryptedUri, owner] = await withTimeout(
            Promise.all([
                contract.tokenUri(tokenId),
                contract.encryptedTokenUri(tokenId),
                contract.ownerOf(tokenId),
            ]),
            10_000,
            'getAgenticId views timed out',
        );

        return {
            tokenId,
            owner,
            agentUri,
            encryptedUri,
            agentCid: cidFromUrl(agentUri),
            encryptedCid: cidFromUrl(encryptedUri),
        };
    }

    /**
     * Mint a Guardian Agentic ID for a user. Uploads the public agent doc
     * and encrypted evidence bundle to 0G Storage first, then calls the
     * AgenticID contract. Returns a discriminated result — callers must
     * inspect `status` before using `tokenId`.
     */
    async mintAgenticId(user: string, bundle: AgenticIdBundle): Promise<AgenticIdMintResult> {
        const existing = await this.getAgenticId(user).catch(() => null);
        if (existing) {
            return { status: 'failed', error: `Agentic ID already exists for ${user}: token ${existing.tokenId}` };
        }

        const now = Date.now();

        let agentResult: { cid: string; url: string };
        let evidenceResult: { cid: string; url: string };
        try {
            [agentResult, evidenceResult] = await Promise.all([
                this.config.storageService.uploadEvidence(bundle.agent, {
                    agent: user,
                    source: 'agentic-id',
                    timestamp: now,
                }),
                this.config.storageService.uploadEvidence(bundle.evidence, {
                    agent: user,
                    source: 'agentic-id-encrypted',
                    timestamp: now,
                }),
            ]);
        } catch (err: any) {
            return { status: 'failed', error: `0G Storage upload failed: ${err?.message ?? err}` };
        }

        const contract = this.getContract(false);

        try {
            const tx = await withTimeout(
                contract.mint(user, agentResult.url, evidenceResult.url),
                20_000,
            );

            const receipt = (await withTimeout(tx.wait(1, 60_000), 90_000)) as ethers.TransactionReceipt | null;

            let tokenId: number | undefined;
            if (receipt?.logs) {
                const iface = ethers.Interface.from(AGENTIC_ID_ABI);
                for (const log of receipt.logs) {
                    try {
                        const parsed = iface.parseLog({ topics: log.topics, data: log.data });
                        if (parsed?.name === 'AgentMinted') {
                            tokenId = Number(parsed.args.tokenId);
                        }
                    } catch {
                        // not an AgenticID event
                    }
                }
            }

            const txHash = receipt?.hash ?? tx.hash;
            const explorerUrl = buildExplorerUrl(this.config.explorerBase, txHash);

            return {
                status: 'minted',
                tokenId,
                txHash,
                explorerUrl,
                agentUri: agentResult.url,
                encryptedUri: evidenceResult.url,
                agentCid: agentResult.cid,
                encryptedCid: evidenceResult.cid,
            };
        } catch (err: any) {
            console.error('[AgenticIdService] mint failed:', err?.message ?? err);
            return { status: 'failed', error: err?.message ?? String(err) };
        }
    }
}

// ============================================================================
// SINGLETON
// ============================================================================

let _agenticIdService: AgenticIdService | null = null;

export function getAgenticIdService(): AgenticIdService {
    if (!_agenticIdService) {
        _agenticIdService = new AgenticIdService(resolveAgenticIdConfig());
    }
    return _agenticIdService;
}

/** @deprecated Use `getAgenticIdService()` for lazy resolution. */
export const agenticIdService = getAgenticIdService;

export default getAgenticIdService;
