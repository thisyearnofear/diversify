/**
 * 0G DA Persistence Service
 * Stores agent context and state in 0G Storage (serving as a verifiable DA layer).
 */

import { Indexer, Blob as ZgBlob } from '@0gfoundation/0g-storage-ts-sdk';
import * as ethers6 from 'ethers6';

export interface AgentContext {
    userId: string;
    preferences: Record<string, any>;
    riskProfile: 'LOW' | 'MEDIUM' | 'HIGH';
    lastStateHash: string;
    timestamp: number;
}

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
     * Persists agent state to 0G Storage
     * Using Storage as a verifiable state anchor (pseudo-DA)
     */
    async persistState(context: AgentContext): Promise<string> {
        const privateKey = process.env.VAULT_PRIVATE_KEY;
        if (!privateKey) {
            console.warn('[0G Persistence] VAULT_PRIVATE_KEY missing, skipping real persistence');
            return 'mock_persistence_id';
        }

        try {
            console.log(`[0G Persistence] Persisting state for user ${context.userId} to 0G...`);
            
            const payload = JSON.stringify({
                ...context,
                persistenceType: 'agent-state-anchor',
                appId: 'diversifi'
            });

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
            return String(rootHash);
        } catch (error: any) {
            console.error('[0G Persistence] Failed to persist state to 0G:', error.message);
            // Non-blocking fallback
            return `error_${Date.now()}`;
        }
    }

    /**
     * Restores latest state from 0G (Simulated via resolution)
     */
    async restoreState(userId: string): Promise<AgentContext | null> {
        console.log(`[0G Persistence] Restoring state for user ${userId} (Querying 0G Storage)...`);
        
        // In a full implementation, we would query the indexer for the latest blob 
        // associated with this user's identity or a known root hash.
        return null; 
    }
}

export const zeroGPersistenceService = new ZeroGPersistenceService();
