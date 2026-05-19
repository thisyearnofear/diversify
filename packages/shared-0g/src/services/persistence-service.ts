import { getOperationMode, areMockFallbacksAllowed, shouldFailLoudly } from "../../../shared/src/utils/environment";
/**
 * 0G DA Persistence Service
 * Stores agent context and state in 0G Storage (serving as a verifiable DA layer).
 */

import { zeroGStorageService } from './storage-service';

export interface AgentContext {
    userId: string;
    preferences: Record<string, any>;
    riskProfile: 'LOW' | 'MEDIUM' | 'HIGH';
    lastStateHash: string;
    timestamp: number;
}

export interface PersistedState {
    context: AgentContext;
    metadata: {
        version: string;
        persistedAt: number;
        checksum: string;
    };
}

export const PERSISTENCE_VERSION = '1.0.0';
export const LATEST_STATE_PREFIX = 'diversifi:agent-state:';

export class ZeroGPersistenceService {
    private readonly indexerUrl: string;
    private readonly evmRpc: string;

    constructor(
        indexerUrl: string = process.env.ZERO_G_INDEXER_URL || 'https://indexer-storage-testnet-turbo.0g.ai',
        evmRpc: string = process.env.ZERO_G_RPC_URL || 'https://evmrpc-testnet.0g.ai'
    ) {
        this.indexerUrl = indexerUrl;
        this.evmRpc = evmRpc;
    }

    /**
     * Get operation mode for fallback behavior
     */
    private getFallbackBehavior(): { allowMock: boolean; failLoud: boolean } {
        const envOverride = process.env.DIVERSIFI_DEV_FALLBACK;
        
        if (envOverride === 'enabled') {
            return { allowMock: true, failLoud: false };
        }
        if (envOverride === 'disabled') {
            return { allowMock: false, failLoud: true };
        }
        
        const isCI = process.env.CI === 'true' || process.env.NODE_ENV === 'test';
        const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
        
        return {
            allowMock: isDev && !isCI,
            failLoud: isCI,
        };
    }

    /**
     * Parse and validate a persisted state string, returning the AgentContext
     * or null if validation fails.
     */
    private parseAndValidatePersistedState(raw: string, userId: string): AgentContext | null {
        try {
            let persisted: PersistedState;
            try {
                persisted = JSON.parse(raw);
            } catch {
                console.error('[0G Persistence] Failed to parse persisted state JSON');
                return null;
            }

            // Validate version compatibility
            if (persisted.metadata?.version !== PERSISTENCE_VERSION) {
                console.warn(`[0G Persistence] Version mismatch: stored=${persisted.metadata?.version}, expected=${PERSISTENCE_VERSION}`);
                return null;
            }

            // Verify checksum
            const computedChecksum = this.simpleChecksum(JSON.stringify(persisted.context));
            if (computedChecksum !== persisted.metadata.checksum) {
                console.error('[0G Persistence] Checksum mismatch — state may be corrupted');
                return null;
            }

            // Validate user ID match
            if (persisted.context.userId !== userId) {
                console.error(`[0G Persistence] User ID mismatch: stored=${persisted.context.userId}, requested=${userId}`);
                return null;
            }

            // Verify timestamp sanity
            if (persisted.context.timestamp > Date.now() + 5000) {
                console.warn('[0G Persistence] State timestamp is in the future — rejecting');
                return null;
            }

            console.log(`[0G Persistence] State restored successfully for user ${userId} (version ${persisted.metadata.version})`);
            return persisted.context;
        } catch {
            console.error('[0G Persistence] Unexpected error during state validation');
            return null;
        }
    }

    /**
     * Simple checksum function for state validation
     */
    private simpleChecksum(data: string): string {
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Persists agent state to 0G Storage
     * Using Storage as a verifiable state anchor (pseudo-DA)
     */
    async persistState(context: AgentContext): Promise<string> {
        const { allowMock, failLoud } = this.getFallbackBehavior();
        const privateKey = process.env.VAULT_PRIVATE_KEY;
        
        if (!privateKey) {
            const msg = '[0G Persistence] VAULT_PRIVATE_KEY missing';
            if (failLoud) {
                throw new Error(`${msg} — CI mode requires real 0G credentials`);
            }
            if (allowMock) {
                console.warn(`${msg}, returning mock persistence ID in development`);
                return 'mock_persistence_id';
            }
            throw new Error(`${msg} — production mode requires real 0G credentials`);
        }

        try {
            console.log(`[0G Persistence] Persisting state for user ${context.userId} to 0G...`);
            
            // Create persisted state wrapper with metadata and checksum
            const persistedState: PersistedState = {
                context: { ...context }, // Copy to avoid mutation issues
                metadata: {
                    version: PERSISTENCE_VERSION,
                    persistedAt: Date.now(),
                    checksum: this.simpleChecksum(JSON.stringify(context)),
                },
            };

            const payload = JSON.stringify(persistedState);

            // Import SDK dynamically
            let SDK: any;
            if (typeof window === 'undefined') {
                SDK = eval('require("@0gfoundation/0g-storage-ts-sdk")');
            } else {
                throw new Error('0G Persistence is not available in the browser.');
            }
            const { Indexer, Blob: ZgBlob } = SDK;
            const ethers6 = eval('require("ethers6")');

            // Setup Ethers v6
            const provider = new ethers6.JsonRpcProvider(this.evmRpc);
            const signer = new ethers6.Wallet(privateKey, provider);
            
            // Setup 0G Indexer
            const indexer = new Indexer(this.indexerUrl);

            // Create and upload blob
            const blob = new ZgBlob(new Uint8Array(Buffer.from(payload)) as any);
            const [tree, treeErr] = await blob.merkleTree();
            if (treeErr || !tree) {
                console.error('[0G Persistence] Merkle Tree generation failed:', treeErr);
                throw treeErr || new Error('Merkle Tree missing');
            }

            const rootHash = tree.rootHash();
            const [tx, upErr] = await indexer.upload(blob, this.evmRpc, signer as any);
            
            if (upErr) {
                console.error('[0G Persistence] Upload failed:', upErr);
                throw upErr;
            }

            console.log(`[0G Persistence] State anchored to 0G. BlobID: ${rootHash}`);

            // Register with storage service so listContent can discover this state
            zeroGStorageService.registerContent(LATEST_STATE_PREFIX + context.userId, String(rootHash));

            return String(rootHash);
        } catch (error: any) {
            console.error('[0G Persistence] Failed to persist state to 0G:', error.message);
            
            const { allowMock, failLoud } = this.getFallbackBehavior();
            if (failLoud) {
                throw error; // Re-throw in CI — no silent errors
            }
            if (allowMock) {
                console.warn('[0G Persistence] Falling back to mock error ID in development');
                return `error_${Date.now()}`;
            }
            throw error;
        }
    }

    /**
     * Look up evidence CIDs from the on-chain RecommendationLedger contract
     * as a persistent fallback when the in-memory content registry is empty
     * (e.g., after a server restart).
     */
    private async lookupCidFromLedger(userId: string): Promise<string | null> {
        try {
            // Dynamic import to avoid hard dependency on @diversifi/shared
            const { recommendationLedgerService } = await import(
                '../../../shared/src/services/recommendation-ledger.service'
            );

            const ids = await recommendationLedgerService.getUserRecommendationIds(userId);
            if (!ids || ids.length === 0) {
                return null;
            }

            // Get the most recent recommendation (highest ID)
            const latestId = ids[ids.length - 1];
            const rec = await recommendationLedgerService.getRecommendation(latestId);

            if (rec?.evidenceCid && rec.evidenceCid.length > 0) {
                console.log(`[0G Persistence] Found evidence CID from on-chain ledger: ${rec.evidenceCid.slice(0, 16)}… (recommendation #${rec.id})`);
                return rec.evidenceCid;
            }

            return null;
        } catch (error: any) {
            console.warn('[0G Persistence] Ledger CID lookup failed (non-fatal):', error.message);
            return null;
        }
    }

    /**
     * Restores latest state from 0G Storage
     * Falls back to on-chain RecommendationLedger for CID discovery
     * when the in-memory content registry is empty (e.g. after restart).
     */
    async restoreState(userId: string): Promise<AgentContext | null> {
        console.log(`[0G Persistence] Restoring state for user ${userId}...`);

        const { allowMock, failLoud } = this.getFallbackBehavior();

        try {
            // Step 1: Discover state blobs for this user
            const entries = await zeroGStorageService.listContent(LATEST_STATE_PREFIX + userId);
            
            // Step 1b: If registry is empty, fall back to on-chain ledger discovery
            if (!entries || entries.length === 0) {
                console.log(`[0G Persistence] In-memory registry empty — querying on-chain RecommendationLedger for user ${userId}...`);
                const ledgerCid = await this.lookupCidFromLedger(userId);
                if (ledgerCid) {
                    console.log(`[0G Persistence] Found CID from on-chain ledger: ${ledgerCid.slice(0, 16)}…`);
                    // Register it so future lookups hit the registry first
                    zeroGStorageService.registerContent(LATEST_STATE_PREFIX + userId, ledgerCid);
                    const raw = await zeroGStorageService.downloadContent(ledgerCid);
                    return this.parseAndValidatePersistedState(raw, userId);
                }
                console.warn(`[0G Persistence] No persisted state found for user ${userId}`);
                return null;
            }

            // Step 2: Pick the latest entry (last element = most recently added)
            const latestCid = entries[entries.length - 1];

            // Step 3: Download the raw content
            const raw = await zeroGStorageService.downloadContent(latestCid);

            return this.parseAndValidatePersistedState(raw, userId);
        } catch (error: any) {
            // If we already handled specific errors above, this is for unexpected ones
            console.error('[0G Persistence] Failed to restore state:', error.message);
            
            const { allowMock, failLoud } = this.getFallbackBehavior();
            if (failLoud) {
                throw error; // Re-throw in CI
            }
            if (allowMock) {
                console.warn('[0G Persistence] Falling back to null in development due to unexpected error');
                return null;
            }
            throw error;
        }
    }
}

export const zeroGPersistenceService = new ZeroGPersistenceService();