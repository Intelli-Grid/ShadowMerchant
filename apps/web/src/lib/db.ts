import mongoose from 'mongoose';

const cached = (global as any).mongoose || { conn: null, promise: null };

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
    });
  }
  cached.conn = await cached.promise;
  (global as any).mongoose = cached;
  return cached.conn;
}
