import { describe, it, expect, vi, beforeEach } from 'vitest';
import { anchorIntelligence } from '../intelligence-anchor.service';
import { zeroGStorageService } from '@diversifi/shared-0g/src/services/storage-service';

vi.mock('@diversifi/shared-0g/src/services/storage-service', () => ({
    zeroGStorageService: { uploadEvidence: vi.fn() },
}));

describe('anchorIntelligence', () => {
    beforeEach(() => {
        vi.mocked(zeroGStorageService.uploadEvidence).mockReset();
    });

    it('returns the CID on a successful upload', async () => {
        vi.mocked(zeroGStorageService.uploadEvidence).mockResolvedValue({
            cid: 'bafyTestCid',
            url: 'https://0g.example/x',
        } as any);
        const cid = await anchorIntelligence({ sourceId: 'macro_analysis', data: { analysis: 'x' } });
        expect(cid).toBe('bafyTestCid');
        expect(zeroGStorageService.uploadEvidence).toHaveBeenCalledOnce();
    });

    it('returns null when 0G returns no CID', async () => {
        vi.mocked(zeroGStorageService.uploadEvidence).mockResolvedValue({} as any);
        expect(await anchorIntelligence({ sourceId: 'm', data: {} })).toBeNull();
    });

    it('returns null when the upload throws', async () => {
        vi.mocked(zeroGStorageService.uploadEvidence).mockRejectedValue(new Error('network'));
        expect(await anchorIntelligence({ sourceId: 'm', data: {} })).toBeNull();
    });
});
