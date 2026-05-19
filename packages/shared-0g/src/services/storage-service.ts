/**
 * 0G Storage Service
 * Interface to upload evidence bundles to 0G Storage.
 */

import { areMockFallbacksAllowed, shouldFailLoudly } from "../../../shared/src/utils/environment";

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
    /**
     * In-memory content registry mapping prefix → list of CIDs.
     * Content-addressed storage (like 0G) has no native "list by prefix" API,
     * so we maintain this registry to enable listing content uploaded during
     * the current session. Entries are added on upload via registerContent().
     */
    private readonly contentRegistry: Map<string, string[]> = new Map();

    constructor(
        storageUrl: string = process.env.ZERO_G_STORAGE_URL || 'https://storage-testnet.0g.ai',
        indexerUrl: string = process.env.ZERO_G_INDEXER_URL || 'https://indexer-storage-testnet-turbo.0g.ai',
        evmRpc: string = process.env.ZERO_G_RPC_URL || 'https://evmrpc-testnet.0g.ai'
    ) {
        this.storageUrl = storageUrl;
        this.indexerUrl = indexerUrl;
        this.evmRpc = evmRpc;
    }

    /**
     * Register a CID under a prefix so it can be discovered via listContent().
     * Called automatically after each successful uploadEvidence or persistState call.
     */
    registerContent(prefix: string, cid: string): void {
        const existing = this.contentRegistry.get(prefix) || [];
        // Avoid duplicate entries for the same CID
        if (!existing.includes(cid)) {
            existing.push(cid);
            this.contentRegistry.set(prefix, existing);
            console.log(`[0G Storage] Registered CID ${cid.slice(0, 16)}… under prefix "${prefix}"`);
        }
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

            // Auto-register CID in content registry for later discovery via listContent
            const cid = rootHash || 'unknown';
            this.registerContent(`evidence:${metadata.agent}`, cid);
            this.registerContent(`evidence:${metadata.source}`, cid);

            return {
                cid: cid,
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
     * List content stored under a specific prefix.
     *
     * Since 0G Storage is content-addressed with no native "list by prefix" API,
     * this reads from the in-memory content registry populated on every upload.
     *
     * For persistent discoverability across sessions, implement a side index
     * (e.g., maintain a KV store mapping prefix → CIDs on each upload).
     */
    async listContent(prefix: string): Promise<string[]> {
        const entries = this.contentRegistry.get(prefix);
        if (entries && entries.length > 0) {
            console.log(`[0G Storage] Found ${entries.length} content entries for prefix "${prefix}"`);
            return [...entries];
        }

        console.log(`[0G Storage] No entries in registry for prefix "${prefix}" — returning empty`);
        return [];
    }

    /**
     * Download content by CID (root hash) from 0G Storage.
     * Uses the 0G Storage SDK's Downloader to retrieve the blob data from indexer nodes.
     */
    async downloadContent(cid: string): Promise<string> {
        // Validate the CID looks plausible before attempting download
        // Reject known mock/error CIDs to avoid confusing SDK errors
        if (!cid || cid === 'mock_persistence_id' || cid.startsWith('error_') || cid.startsWith('mock_content') || cid.startsWith('bafybeih')) {
            if (areMockFallbacksAllowed()) {
                console.warn(`[0G Storage] Skipping real download for mock CID: ${cid}`);
                return `mock_content_for_${cid}`;
            }
            console.warn(`[0G Storage] Rejecting non-0G CID: ${cid}`);
            throw new Error(`Invalid 0G Storage CID: ${cid}`);
        }

        try {
            console.log(`[0G Storage] Downloading content for CID: ${cid.slice(0, 16)}…`);
            
            // Import SDK dynamically
            let SDK: any;
            if (typeof window === 'undefined') {
                SDK = eval('require("@0gfoundation/0g-storage-ts-sdk")');
            } else {
                throw new Error('0G Storage is not available in the browser.');
            }
            const { Downloader } = SDK;

            // Create Downloader pointing at the indexer nodes
            // The Downloader constructor accepts an array of node URLs
            const downloader = new Downloader([this.indexerUrl]);

            // Download the blob by its root hash (CID)
            // downloadToBlob returns [blobBytes, error] tuple
            const [blob, downloadErr] = await downloader.downloadToBlob(cid);
            
            if (downloadErr) {
                console.error('[0G Storage] Download failed:', downloadErr);
                throw new Error(`0G Storage download failed for CID ${cid.slice(0, 16)}…: ${downloadErr.message || downloadErr}`);
            }

            // Convert blob to UTF-8 string.
            // The SDK's downloadToBlob returns a 0G Blob instance wrapping a web Blob in .blob.
            let text: string;
            if (blob && typeof blob === 'object' && blob.blob && typeof blob.blob.text === 'function') {
                // 0G Blob instance with underlying web Blob
                text = await blob.blob.text();
            } else if (blob instanceof Uint8Array) {
                text = new TextDecoder().decode(blob);
            } else if (blob && typeof blob === 'object' && blob.data) {
                // Handle { data: Uint8Array } wrapper
                text = new TextDecoder().decode(
                    blob.data instanceof Uint8Array ? blob.data : new Uint8Array(blob.data)
                );
            } else {
                // Fallback: try toString()
                text = String(blob);
            }

            console.log(`[0G Storage] Successfully downloaded ${text.length} bytes for CID ${cid.slice(0, 16)}…`);
            return text;
        } catch (error: any) {
            console.error('[0G Storage] Failed to download content:', error.message);
            
            if (shouldFailLoudly()) {
                throw error; // Re-throw in CI — no silent fallbacks
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