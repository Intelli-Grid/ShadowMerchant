import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Deal from '@/models/Deal';

// Re-use existing connection logic or connect directly
const MONGODB_URI = process.env.MONGODB_URI;

export async function GET() {
  try {
    if (!mongoose.connection.readyState) {
      if (!MONGODB_URI) {
        throw new Error('MONGODB_URI is not defined');
      }
      await mongoose.connect(MONGODB_URI);
    }

    const aggregationResult = await Deal.aggregate([
      { $match: { is_active: true } },
      {
        $group: {
          _id: null,
          totalSavings: { 
            $sum: { $subtract: ["$original_price", "$discounted_price"] } 
          },
          dealCount: { $sum: 1 }
        }
      }
    ]);

    let totalSavings = 0;
    let dealCount = 0;

    if (aggregationResult.length > 0) {
      totalSavings = aggregationResult[0].totalSavings;
      dealCount = aggregationResult[0].dealCount;
    }

    return NextResponse.json({
      success: true,
      totalSavings,
      dealCount,
    });
  } catch (error) {
    console.error('Error fetching global stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
