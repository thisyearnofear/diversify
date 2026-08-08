import connectDB from './mongodb';
import mongoose from 'mongoose';
import type { SettlementCapStore } from '@diversifi/shared';

/**
 * MongoDB-backed implementation of SettlementCapStore.
 *
 * This is intentionally defined in the Next.js app rather than @diversifi/shared
 * so that the shared package stays free of server-only dependencies like
 * mongoose, which break the client bundle.
 */

const COLLECTION_NAME = 'settlement_daily_caps';

function normalizeDbUri(uri: string): string {
    try {
        const url = new URL(uri);
        url.pathname = '/DiversiFiCluster';
        return url.toString();
    } catch {
        return uri.replace(/(mongodb(?:\+srv)?:\/\/[^/]+)\/[^?]+(\?.*)?$/i, '$1/DiversiFiCluster$2');
    }
}

async function ensureConnection(): Promise<boolean> {
    const uri = process.env.MONGODB_URI;
    if (!uri) return false;

    if (!mongoose.connection.readyState) {
        await mongoose.connect(normalizeDbUri(uri), {
            bufferCommands: false,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            maxPoolSize: 5,
            minPoolSize: 0,
        });
    }

    return true;
}

export const mongoSettlementCapStore: SettlementCapStore = {
    async recordSpendAtomic(date, network, amountUSDC, capUSDC) {
        const connected = await ensureConnection();
        if (!connected) {
            throw new Error('MONGODB_URI not configured — cannot persist settlement cap');
        }

        const collection = mongoose.connection.db!.collection<{ date: string; network: string; spent: number }>(COLLECTION_NAME);

        // Ensure a document exists.
        await collection.updateOne(
            { date, network },
            { $setOnInsert: { spent: 0 } },
            { upsert: true },
        );

        // Pre-check to avoid a no-op atomic update when already over cap.
        const current = await collection.findOne({ date, network });
        if (current && current.spent + amountUSDC > capUSDC + 1e-9) {
            return { allowed: false, newTotal: current.spent };
        }

        // Atomic increment guarded by remaining cap.
        const updated = await collection.findOneAndUpdate(
            { date, network, spent: { $lte: capUSDC - amountUSDC + 1e-9 } },
            { $inc: { spent: amountUSDC } },
            { returnDocument: 'after', upsert: true },
        );

        if (!updated) {
            const afterRace = await collection.findOne({ date, network });
            return { allowed: false, newTotal: afterRace?.spent ?? 0 };
        }

        return { allowed: true, newTotal: updated.spent };
    },

    async getSpendTotal(date, network) {
        const connected = await ensureConnection();
        if (!connected) return 0;

        const collection = mongoose.connection.db!.collection<{ date: string; network: string; spent: number }>(COLLECTION_NAME);
        const doc = await collection.findOne({ date, network });
        return doc?.spent ?? 0;
    },
};
