/**
 * 0G Storage Service
 * Lightweight interface to upload evidence bundles to 0G Storage.
 */

export interface StorageResult {
    cid: string;
    url: string;
}

export class ZeroGStorageService {
    private readonly storageUrl: string;

    constructor(storageUrl: string = process.env.ZERO_G_STORAGE_URL || 'https://storage-testnet.0g.ai') {
        this.storageUrl = storageUrl;
    }

    async uploadEvidence(data: any, metadata: { agent: string; source: string; timestamp: number }): Promise<StorageResult> {
        try {
            const payload = {
                data,
                metadata
            };

            // In production, we'd use the 0G SDK here. 
            // Mocking for hackathon demo while structure is finalized.
            console.log(`[0G Storage] Uploading evidence from ${metadata.source}...`);

            // This placeholder follows the logic of a real ZG upload
            const cid = `bafybeih${Math.random().toString(36).substring(2, 15)}`;
            
            return {
                cid,
                url: `${this.storageUrl}/ipfs/${cid}`
            };
        } catch (error) {
            console.error('[0G Storage] Upload failed:', error);
            throw new Error('Evidence commit to 0G Storage failed');
        }
    }
}

export const zeroGStorageService = new ZeroGStorageService();
