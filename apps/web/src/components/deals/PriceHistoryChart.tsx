"use client";

import { useMemo } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';

interface PriceHistoryChartProps {
  data: { date: string | Date; price: number }[];
}

export function PriceHistoryChart({ data }: PriceHistoryChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    // Sort chronologically and format dates for the X-axis
    return [...data]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((item) => {
        const d = new Date(item.date);
        return {
          date: d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
          rawDate: d.getTime(),
          price: item.price
        };
      });
  }, [data]);

  const formatYAxis = (tickItem: number) => {
    return '₹' + (tickItem >= 1000 ? (tickItem / 1000).toFixed(1) + 'k' : tickItem);
  };

  if (chartData.length < 2) {
    return (
      <div className="w-full h-48 flex items-center justify-center bg-[#13131A] rounded-xl border border-[#2A2A35]">
        <p className="text-gray-500 text-sm">Not enough price tracking data yet.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-64 bg-[#13131A] rounded-xl border border-[#2A2A35] p-4 relative overflow-hidden">
      <h3 className="text-sm font-bold text-gray-300 mb-4 ml-2 uppercase tracking-wide">
        Price Tracker
      </h3>
      <ResponsiveContainer width="100%" height="80%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#FF6B00" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#FF6B00" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#2A2A35" vertical={false} />
          
          <XAxis 
            dataKey="date" 
            stroke="#6B7280" 
            fontSize={12}
            tickLine={false}
            axisLine={false}
            dy={10}
          />
          
          <YAxis 
            domain={['auto', 'auto']}
            stroke="#6B7280" 
            fontSize={12}
            tickFormatter={formatYAxis}
            tickLine={false}
            axisLine={false}
            dx={-10}
          />
          
          <Tooltip 
            contentStyle={{ backgroundColor: '#1A1A24', border: '1px solid #7C3AED', borderRadius: '8px' }}
            itemStyle={{ color: '#FF6B00', fontWeight: 'bold' }}
            labelStyle={{ color: '#F0F0F0', marginBottom: '4px' }}
            formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'Price']}
          />
          
          <Area 
            type="monotone" 
            dataKey="price" 
            stroke="#FF6B00" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorPrice)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
