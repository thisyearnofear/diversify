import { describe, it, expect } from 'vitest';
import {
    InMemoryClientStore,
    MongoClientStore,
    getClientStore,
    type ClientState,
} from '../client-store';

const sample: ClientState = {
    creditBalanceMicros: 0,
    requestCount: 0,
    windowStart: 0,
    nonces: {},
    usageHistory: {},
};

describe('InMemoryClientStore', () => {
    it('round-trips client state', async () => {
        const store = new InMemoryClientStore();
        expect(await store.get('missing')).toBeNull();
        const state: ClientState = { ...sample, clientKey: 'k1', creditBalanceMicros: 500 };
        await store.set('k1', state);
        const got = await store.get('k1');
        expect(got?.creditBalanceMicros).toBe(500);
        expect(got?.clientKey).toBe('k1');
    });
});

describe('getClientStore factory', () => {
    it('returns an in-memory store by default', () => {
        delete process.env.CLIENT_STATE_STORE;
        const store = getClientStore();
        expect(typeof store.get).toBe('function');
        expect(typeof store.set).toBe('function');
        // memoized across calls
        expect(getClientStore()).toBe(store);
    });

    it('MongoClientStore is constructable and exposes async get/set', () => {
        const mongo = new MongoClientStore();
        expect(typeof mongo.get).toBe('function');
        expect(typeof mongo.set).toBe('function');
    });
});
