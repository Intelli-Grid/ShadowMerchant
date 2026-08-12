import mongoose from 'mongoose';

const cached: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null } =
  (global as any).mongoose || { conn: null, promise: null };

export async function connectDB() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) throw new Error('MONGODB_URI is not defined in environment variables.');

  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      dbName: 'shadowmerchant',
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 30000,
      maxPoolSize: 10,
      minPoolSize: 2,   // pre-warm 2 connections to reduce cold-start latency
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    // CRITICAL FIX: reset the cached promise on failure.
    // Without this, a rejected promise is cached permanently — every subsequent
    // connectDB() call awaits the already-rejected promise and throws forever
    // until the Vercel function cold-starts. With this, the next call retries.
    cached.promise = null;
    throw err;
  }

  (global as any).mongoose = cached;
  return cached.conn;
}

