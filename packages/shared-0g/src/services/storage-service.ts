/**
 * 0G Storage Service
 * Interface to upload evidence bundles to 0G Storage.
 */

import { getOperationMode, areMockFallbacksAllowed, shouldFailLoudly } from "../../../shared/src/utils/environment";

export interface StorageResult {
    cid: string;
    url: string;
    txHash?: string;
}

export interface ListContentResult {
    cids: string[];
}

export class ZeroGStorageService {
    private readonly storageUrl: string;
    private readonly indexerUrl: string;
    private readonly evmRpc: string;

    constructor(
        storageUrl: string = process.env.ZERO_G_STORAGE_URL || 'https://storage-testnet.0g.ai',
        indexerUrl: string = process.env.ZERO_G_INDEXER_URL || 'https://indexer-storage-testnet-turbo.0g.ai',
        evmRpc: string = process.env.ZERO_G_RPC_URL || 'https://evmrpc-testnet.0g.ai'
    ) {
        this.storageUrl = storageUrl;
        this.indexerUrl = indexerUrl;
        this.evmRpc = evmRpc;
    }

    async uploadEvidence(data: any, metadata: { agent: string; source: string; timestamp: number }): Promise<StorageResult> {
        let SDK: any;
        if (typeof window === 'undefined') {
            // Use eval to hide the require from Webpack's static analysis
            SDK = eval('require("@0gfoundation/0g-storage-ts-sdk")');
        } else {
            throw new Error('0G Storage is not available in the browser.');
        }

        const { Indexer, Blob: ZgBlob } = SDK;
        const ethers6 = eval('require("ethers6")');

        const privateKey = process.env.VAULT_PRIVATE_KEY;
        if (!privateKey) {
            if (shouldFailLoudly()) {
                throw new Error('VAULT_PRIVATE_KEY missing for 0G Storage upload — CI mode requires real 0G credentials');
            }
            if (areMockFallbacksAllowed()) {
                console.warn('[0G Storage] VAULT_PRIVATE_KEY missing, returning mock CID for development/demo stability');
                const mockCid = `bafybeih${Math.random().toString(36).substring(2, 15)}`;
                return {
                    cid: mockCid,
                    url: `${this.storageUrl}/ipfs/${mockCid}`
                };
            }
            throw new Error('VAULT_PRIVATE_KEY missing for 0G Storage upload — production mode requires real 0G credentials');
        }

        try {
            const payload = JSON.stringify({
                data,
                metadata,
                version: '1.0.0',
                type: 'verifiable-evidence'
            });

            console.log(`[0G Storage] Uploading evidence from ${metadata.source} to ${this.indexerUrl}...`);

            // Setup Ethers v6 Provider and Signer
            const provider = new ethers6.JsonRpcProvider(this.evmRpc);
            const signer = new ethers6.Wallet(privateKey, provider);
            
            // Setup 0G Indexer
            const indexer = new Indexer(this.indexerUrl);

            // Create ZgBlob from payload
            const blob = new ZgBlob(new Uint8Array(Buffer.from(payload)) as any);
            
            // 4. Get Merkle Tree for CID (root hash)
            const [tree, treeErr] = await blob.merkleTree();
            if (treeErr || !tree) {
                console.error('[0G Storage] Merkle Tree generation failed:', treeErr);
                throw treeErr || new Error('Merkle Tree missing');
            }
            
            const rootHash = tree.rootHash();
            console.log(`[0G Storage] Data Root Hash: ${rootHash}`);

            // 5. Upload to 0G Storage
            const [tx, upErr] = await indexer.upload(blob, this.evmRpc, signer as any);
            
            if (upErr) {
                console.error('[0G Storage] Upload interaction failed:', upErr);
                throw upErr;
            }

            console.log(`[0G Storage] Upload successful. Tx: ${JSON.stringify(tx)}`);

            return {
                cid: rootHash || 'unknown',
                url: `${this.storageUrl}/ipfs/${rootHash}`,
                txHash: typeof tx === 'object' ? JSON.stringify(tx) : String(tx)
            };
        } catch (error: any) {
            console.error('[0G Storage] Upload failed:', error.message);
            
            if (shouldFailLoudly()) {
                throw new Error(`[0G Storage] CI mode requires real 0G Storage: ${error.message}`);
            }
            
            if (areMockFallbacksAllowed()) {
                console.warn(`[0G Storage] Falling back to mock CID in development — reason: ${error.message}`);
                const mockCid = `bafybeih${Math.random().toString(36).substring(2, 15)}`;
                return {
                    cid: mockCid,
                    url: `${this.storageUrl}/ipfs/${mockCid}`
                };
            }
            
            throw new Error(`Evidence commit to 0G Storage failed: ${error.message}`);
        }
    }

    /**
     * List content stored under a specific prefix
     */
    async listContent(prefix: string): Promise<string[]> {
        if (shouldFailLoudly()) {
            const privateKey = process.env.VAULT_PRIVATE_KEY;
            if (!privateKey) {
                throw new Error('[0G Storage] VAULT_PRIVATE_KEY missing — CI mode requires real 0G credentials');
            }
        } else if (!areMockFallbacksAllowed()) {
            const privateKey = process.env.VAULT_PRIVATE_KEY;
            if (!privateKey) {
                throw new Error('[0G Storage] VAULT_PRIVATE_KEY missing — production mode requires real 0G credentials');
            }
        }

        try {
            console.log(`[0G Storage] Listing content with prefix: ${prefix}`);
            
            // Import SDK dynamically
            let SDK: any;
            if (typeof window === 'undefined') {
                SDK = eval('require("@0gfoundation/0g-storage-ts-sdk")');
            } else {
                throw new Error('0G Storage is not available in the browser.');
            }
            const { Indexer } = SDK;
            const ethers6 = eval('require("ethers6")');

            // Setup Ethers v6
            const provider = new ethers6.JsonRpcProvider(this.evmRpc);
            const signer = new ethers6.Wallet(process.env.VAULT_PRIVATE_KEY || '', provider);
            
            // Setup 0G Indexer
            const indexer = new Indexer(this.indexerUrl);

            // In a real implementation, we'd use the indexer to list blobs by prefix
            // For now, we'll return an empty array as a placeholder
            // The actual implementation would depend on the 0G SDK's listing capabilities
            console.log(`[0G Storage] List content not fully implemented, returning empty array`);
            return [];
        } catch (error: any) {
            console.error('[0G Storage] Failed to list content:', error.message);
            
            if (shouldFailLoudly()) {
                throw error; // Re-throw in CI
            }
            
            if (areMockFallbacksAllowed()) {
                console.warn('[0G Storage] Falling back to empty list in development');
                return [];
            }
            
            throw error;
        }
    }

    /**
     * Download content by CID
     */
    async downloadContent(cid: string): Promise<string> {
        if (shouldFailLoudly()) {
            const privateKey = process.env.VAULT_PRIVATE_KEY;
            if (!privateKey) {
                throw new Error('[0G Storage] VAULT_PRIVATE_KEY missing — CI mode requires real 0G credentials');
            }
        } else if (!areMockFallbacksAllowed()) {
            const privateKey = process.env.VAULT_PRIVATE_KEY;
            if (!privateKey) {
                throw new Error('[0G Storage] VAULT_PRIVATE_KEY missing — production mode requires real 0G credentials');
            }
        }

        try {
            console.log(`[0G Storage] Downloading content for CID: ${cid}`);
            
            // Import SDK dynamically
            let SDK: any;
            if (typeof window === 'undefined') {
                SDK = eval('require("@0gfoundation/0g-storage-ts-sdk")');
            } else {
                throw new Error('0G Storage is not available in the browser.');
            }
            const { Indexer } = SDK;
            const ethers6 = eval('require("ethers6")');

            // Setup Ethers v6
            const provider = new ethers6.JsonRpcProvider(this.evmRpc);
            const signer = new ethers6.Wallet(process.env.VAULT_PRIVATE_KEY || '', provider);
            
            // Setup 0G Indexer
            const indexer = new Indexer(this.indexerUrl);

            // In a real implementation, we'd use the indexer to download blob by CID
            // For now, we'll return mock content as a placeholder
            console.log(`[0G Storage] Download content not fully implemented, returning mock content`);
            return `mock_downloaded_content_for_${cid}`;
        } catch (error: any) {
            console.error('[0G Storage] Failed to download content:', error.message);
            
            if (shouldFailLoudly()) {
                throw error; // Re-throw in CI
            }
            
            if (areMockFallbacksAllowed()) {
                console.warn('[0G Storage] Falling back to mock content in development');
                return `mock_content_error_${Date.now()}`;
            }
            
            throw error;
        }
    }
}

export const zeroGStorageService = new ZeroGStorageService();