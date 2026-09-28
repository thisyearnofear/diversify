/**
 * Tests for the Cognee Cloud HTTP API surface — the wire contract:
 * tenant base URL, `/api/v1` paths, X-Api-Key / X-Tenant-Id headers,
 * multipart `add` (datasetName + raw_data), and dataset/data endpoints.
 *
 * The singleton is enabled per test by stubbing its private fields, the
 * same pattern as cognee-memory-decay.test.ts.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cogneeMemoryService } from '../cognee-memory-service';

const URL_BASE = 'https://tenant.aws.cognee.ai';
const originalFetch = global.fetch;

const calls: Array<{ url: string; init: RequestInit }> = [];

function mockFetch(handler: (url: string, init: RequestInit) => any) {
  global.fetch = vi.fn(async (input: any, init?: any) => {
    const url = typeof input === 'string' ? input : input.url;
    const merged = init ?? {};
    calls.push({ url, init: merged });
    return handler(url, merged);
  }) as any;
}

const okJson = (body: unknown) => ({ ok: true, status: 200, json: async () => body, text: async () => '' }) as any;

beforeEach(() => {
  calls.length = 0;
  (cogneeMemoryService as any).enabled = true;
  (cogneeMemoryService as any).apiUrl = URL_BASE;
  (cogneeMemoryService as any).apiKey = 'test-key';
  (cogneeMemoryService as any).tenantId = 'tenant-1';
});

afterEach(() => {
  global.fetch = originalFetch;
  (cogneeMemoryService as any).enabled = false;
  (cogneeMemoryService as any).apiUrl = '';
  (cogneeMemoryService as any).apiKey = '';
  (cogneeMemoryService as any).tenantId = '';
  vi.restoreAllMocks();
});

describe('Cognee Cloud wire contract', () => {
  it('add posts multipart to /api/v1/add with datasetName + raw_data', async () => {
    mockFetch(() => okJson({ id: 'data-1' }));
    const result = await cogneeMemoryService.addData('guardian_facts_x', ['You save in USD']);
    expect(result.success).toBe(true);
    expect(result.ids).toEqual(['data-1']);

    const call = calls[0];
    expect(call.url).toBe(`${URL_BASE}/api/v1/add`);
    expect(call.init.method).toBe('POST');
    const headers = call.init.headers as Record<string, string>;
    expect(headers['X-Api-Key']).toBe('test-key');
    expect(headers['X-Tenant-Id']).toBe('tenant-1');
    expect(headers['Content-Type']).toBeUndefined(); // multipart boundary is fetch's job

    const form = call.init.body as FormData;
    expect(form.get('datasetName')).toBe('guardian_facts_x');
    expect(form.getAll('raw_data')).toEqual(['You save in USD']);
  });

  it('sends multiple facts as repeated raw_data fields', async () => {
    mockFetch(() => okJson({ data: [{ id: 'a' }, { id: 'b' }] }));
    const result = await cogneeMemoryService.addData('ds', ['one', 'two']);
    const form = calls[0].init.body as FormData;
    expect(form.getAll('raw_data')).toEqual(['one', 'two']);
    expect(result.ids).toEqual(['a', 'b']);
  });

  it('lists datasets via GET /api/v1/datasets/ (the health probe)', async () => {
    mockFetch(() => okJson([{ id: 'ds-1', name: 'guardian_facts_x' }]));
    const datasets = await cogneeMemoryService.listDatasets();
    expect(calls[0].url).toBe(`${URL_BASE}/api/v1/datasets/`);
    expect(datasets).toEqual([{ id: 'ds-1', name: 'guardian_facts_x' }]);
  });

  it('creates a dataset by name when missing', async () => {
    let n = 0;
    mockFetch((url, init) => {
      n++;
      if (init.method === 'POST' && url.endsWith('/api/v1/datasets/')) {
        return okJson({ id: 'ds-new' });
      }
      return okJson([]); // list
    });
    const id = await cogneeMemoryService.datasetIdFor('guardian_facts_x', true);
    expect(id).toBe('ds-new');
    const create = calls.find((c) => c.init.method === 'POST')!;
    expect(JSON.parse(create.init.body as string)).toEqual({ name: 'guardian_facts_x' });
    expect(n).toBe(2);
  });

  it('lists data items under /datasets/{id}/data and reads /raw', async () => {
    mockFetch((url) => {
      if (url.includes('/data?')) return okJson([{ id: 'd1' }]);
      if (url.endsWith('/data/d1/raw')) return { ok: true, status: 200, text: async () => 'You save in USD' } as any;
      return okJson([]);
    });
    const items = await cogneeMemoryService.listDataItems('ds-1', 12);
    expect(calls[0].url).toBe(`${URL_BASE}/api/v1/datasets/ds-1/data?limit=12&offset=0`);
    expect(items).toEqual([{ id: 'd1', text: '', raw: { id: 'd1' } }]);
    const text = await cogneeMemoryService.dataItemText('ds-1', 'd1');
    expect(calls[1].url).toBe(`${URL_BASE}/api/v1/datasets/ds-1/data/d1/raw`);
    expect(text).toBe('You save in USD');
  });

  it('deletes a data item and a dataset via DELETE', async () => {
    mockFetch(() => ({ ok: true, status: 200 }) as any);
    expect(await cogneeMemoryService.deleteDataItem('ds-1', 'd1')).toBe(true);
    expect(calls[0].url).toBe(`${URL_BASE}/api/v1/datasets/ds-1/data/d1`);
    expect(calls[0].init.method).toBe('DELETE');
    expect(await cogneeMemoryService.deleteDataset('ds-1')).toBe(true);
    expect(calls[1].url).toBe(`${URL_BASE}/api/v1/datasets/ds-1`);
    expect(calls[1].init.method).toBe('DELETE');
  });

  it('fails soft on non-2xx and logs 402 once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockFetch(() => ({ ok: false, status: 402 }) as any);
    expect(await cogneeMemoryService.listDatasets()).toBeNull();
    expect(await cogneeMemoryService.listDatasets()).toBeNull();
    expect(warn.mock.calls.filter((c) => String(c[0]).includes('402'))).toHaveLength(1);
  });
});
