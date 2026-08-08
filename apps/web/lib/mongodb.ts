/**
 * MongoDB Connection Utility
 * 
 * Uses mongoose for database operations with connection pooling.
 * Follows Next.js best practices for serverless environments.
 */

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

/**
 * Force the database name to `DiversiFiCluster` regardless of what the
 * MONGODB_URI env var says. The Atlas cluster already has a DB under that
 * casing, and MongoDB refuses to create a second one with different casing
 * ("db already exists with different case"). Rewriting here is safer than
 * editing the env var across every deployment slot.
 */
function normalizeDbUri(uri: string): string {
  try {
    const url = new URL(uri);
    url.pathname = '/DiversiFiCluster';
    return url.toString();
  } catch {
    // Fallback: replace the DB segment between the host and the query string.
    return uri.replace(/(mongodb(?:\+srv)?:\/\/[^/]+)\/[^?]+(\?.*)?$/i, '$1/DiversiFiCluster$2');
  }
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongoose: MongooseCache | undefined;
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (!MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
  }

  const normalizedUri = normalizeDbUri(MONGODB_URI);

  if (cached!.conn) {
    return cached!.conn;
  }

  if (!cached!.promise) {
    const opts = {
      bufferCommands: false,
      // Fail fast on Atlas outages instead of hanging the API route.
      serverSelectionTimeoutMS: 5000,
      // Cap socket idle time so dead connections don't accumulate.
      socketTimeoutMS: 45000,
      // Connection pool sized for the cron tick + concurrent API calls.
      maxPoolSize: 10,
      minPoolSize: 1,
    };

    cached!.promise = mongoose.connect(normalizedUri, opts).then((mongoose) => {
      console.log('[MongoDB] Connected successfully');
      return mongoose;
    });
  }

  try {
    cached!.conn = await cached!.promise;
  } catch (e) {
    cached!.promise = null;
    throw e;
  }

  return cached!.conn;
}

export default connectDB;
