/**
 * Pluggable client state store for the x402 Data Hub gateway.
 *
 * The gateway tracks per-client rate-limit windows, credit balances, usage
 * history, and payment nonces. For the prototype these lived only in an
 * in-memory Map (lost on restart, not shared across serverless instances).
 * This module extracts that state behind a `ClientStateStore` interface so
 * production can back it with MongoDB (via CLIENT_STATE_STORE=mongo) without
 * touching the request path.
 *
 * Design: UserManager keeps an in-memory cache for low-latency reads/writes
 * and fire-and-forget persists to the backing store. The default store is
 * in-memory (behavior-preserving); Mongo is opt-in via env.
 */

import connectDB from './mongodb';
import mongoose from 'mongoose';

export interface ClientState {
    creditBalanceMicros: number;
    requestCount: number;
    windowStart: number;
    nonces: Record<string, number>;
    usageHistory: Record<string, { count: number; lastReset: number }>;
    /** Global free-tier request counter (per-client-key, per-day). */
    freeUsageToday?: { count: number; lastReset: number };
    enterprise?: boolean;
    rateLimitMax?: number;
    clientKey?: string;
}

export interface ClientStateStore {
    get(key: string): Promise<ClientState | null>;
    set(key: string, state: ClientState): Promise<void>;
}

export class InMemoryClientStore implements ClientStateStore {
    private map = new Map<string, ClientState>();

    async get(key: string): Promise<ClientState | null> {
        return this.map.get(key) ?? null;
    }

    async set(key: string, state: ClientState): Promise<void> {
        this.map.set(key, state);
    }
}

export class MongoClientStore implements ClientStateStore {
    private async collection() {
        await connectDB();
        const db = mongoose.connection.db;
        if (!db) throw new Error('MongoDB not connected');
        return db.collection('client_states');
    }

    async get(key: string): Promise<ClientState | null> {
        const doc = await (await this.collection()).findOne({ _id: key } as any);
        return doc && (doc as any).state ? ((doc as any).state as ClientState) : null;
    }

    async set(key: string, state: ClientState): Promise<void> {
        await (await this.collection()).updateOne(
            { _id: key } as any,
            { $set: { state, updatedAt: new Date() } },
            { upsert: true },
        );
    }
}

let store: ClientStateStore | null = null;

export function getClientStore(): ClientStateStore {
    if (!store) {
        store =
            process.env.CLIENT_STATE_STORE === 'mongo'
                ? new MongoClientStore()
                : new InMemoryClientStore();
    }
    return store;
}
