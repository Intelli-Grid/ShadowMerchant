'use client';

import { useMemo } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Sparkles } from 'lucide-react';

import Link from 'next/link';

interface PriceHistoryChartProps {
  data: { date: string | Date; price: number }[];
  platformColor?: string;
  isUserPro?: boolean;
}

export function PriceHistoryChart({ data, platformColor = '#C9A84C', isUserPro = false }: PriceHistoryChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
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

  if (!isUserPro) {
    return (
      <div className="w-full h-[320px] rounded-2xl border p-4 sm:p-6 relative overflow-hidden flex flex-col items-center justify-center text-center" style={{ background: 'var(--bg-surface)', borderColor: 'var(--sm-border)' }}>
        <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'linear-gradient(to right, #222 1px, transparent 1px), linear-gradient(to bottom, #222 1px, transparent 1px)', backgroundSize: '30px 30px', filter: 'blur(2px)' }} />
        
        <div className="relative z-10 p-6 flex flex-col items-center justify-center max-w-sm rounded-[24px] shadow-2xl backdrop-blur-md" style={{ background: 'rgba(20, 20, 24, 0.7)', border: '1px solid var(--gold-border)' }}>
          <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: 'var(--gold-dim)' }}>
            <Sparkles className="w-6 h-6" style={{ color: 'var(--gold)' }} />
          </div>
          <h3 className="text-xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-display)' }}>Pro Feature</h3>
          <p className="text-sm text-gray-400 mb-6">Upgrade to see 30-day historical price volatility and never buy at the wrong time.</p>
          <Link href="/pro" className="px-8 py-3 rounded-xl font-bold w-full text-center hover:scale-105 active:scale-95 transition-all" style={{ background: 'var(--gold)', color: '#0A0A0A' }}>
            Unlock Analytics
          </Link>
        </div>
      </div>
    );
  }

  if (chartData.length < 2) {
    return (
      <div className="w-full h-48 flex items-center justify-center rounded-2xl border" style={{ background: 'var(--bg-raised)', borderColor: 'var(--sm-border)' }}>
        <p className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
          <Sparkles className="w-4 h-4 opacity-70" /> ShadowMerchant hasn&apos;t tracked enough price drops yet.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-[320px] rounded-2xl border p-4 sm:p-6 relative overflow-hidden" style={{ background: 'var(--bg-surface)', borderColor: 'var(--sm-border)' }}>
      {/* Background glow that matches the platform color */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] blur-[100px] opacity-[0.05] pointer-events-none rounded-full"
        style={{ background: platformColor }}
      />
      
      <div className="flex justify-between items-center mb-6 pl-2 z-10 relative">
        <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
          Price Volatility Tracker
        </h3>
        <span className="text-xs px-2 py-1 rounded font-semibold" style={{ background: 'var(--bg-raised)', color: 'var(--text-secondary)' }}>
          30 Days
        </span>
      </div>

      <ResponsiveContainer width="100%" height="80%" className="z-10 relative">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorPriceDynamic" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={platformColor} stopOpacity={0.4}/>
              <stop offset="95%" stopColor={platformColor} stopOpacity={0}/>
            </linearGradient>
          </defs>
          
          <CartesianGrid strokeDasharray="4 4" stroke="var(--sm-border)" vertical={false} opacity={0.6} />
          
          <XAxis 
            dataKey="date" 
            stroke="var(--text-muted)" 
            fontSize={12}
            fontFamily="var(--font-sans)"
            tickLine={false}
            axisLine={false}
            dy={10}
            minTickGap={30}
          />
          
          <YAxis 
            domain={['auto', 'auto']}
            stroke="var(--text-muted)" 
            fontSize={12}
            fontFamily="var(--font-sans)"
            tickFormatter={formatYAxis}
            tickLine={false}
            axisLine={false}
            dx={-10}
          />
          
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'rgba(10,10,11,0.95)', 
              backdropFilter: 'blur(10px)',
              border: '1px solid var(--sm-border)', 
              borderRadius: '12px',
              fontFamily: 'var(--font-sans)',
              boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)'
            }}
            itemStyle={{ color: platformColor, fontWeight: '900', fontSize: '1.2rem', fontFamily: 'var(--font-display)' }}
            labelStyle={{ color: 'var(--text-secondary)', marginBottom: '8px', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Drop Price']}
            cursor={{ stroke: platformColor, strokeWidth: 1, strokeDasharray: '4 4' }}
          />
          
          <Area 
            type="monotone" 
            dataKey="price" 
            stroke={platformColor}
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorPriceDynamic)"
            activeDot={{ r: 6, strokeWidth: 0, fill: '#fff', style: { filter: `drop-shadow(0 0 8px ${platformColor})` } }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
