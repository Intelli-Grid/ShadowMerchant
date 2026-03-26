"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Laptop, Shirt, Sparkles, Home, Dumbbell, BookOpen, Smartphone } from 'lucide-react';

const CATEGORY_META: Record<string, { icon: any; color: string; gradient: string }> = {
  electronics: { icon: Laptop,    color: '#3B82F6', gradient: 'from-blue-900/40 to-blue-800/10' },
  fashion:     { icon: Shirt,     color: '#F43397', gradient: 'from-pink-900/40 to-pink-800/10' },
  beauty:      { icon: Sparkles,  color: '#A855F7', gradient: 'from-purple-900/40 to-purple-800/10' },
  home:        { icon: Home,      color: '#10B981', gradient: 'from-emerald-900/40 to-emerald-800/10' },
  sports:      { icon: Dumbbell,  color: '#F59E0B', gradient: 'from-amber-900/40 to-amber-800/10' },
  books:       { icon: BookOpen,  color: '#6366F1', gradient: 'from-indigo-900/40 to-indigo-800/10' },
  toys:        { icon: Laptop,    color: '#EC4899', gradient: 'from-pink-900/40 to-pink-800/10' }, 
  health:      { icon: Sparkles,  color: '#14B8A6', gradient: 'from-teal-900/40 to-teal-800/10' },
  automotive:  { icon: Smartphone,color: '#64748B', gradient: 'from-slate-900/40 to-slate-800/10' },
  grocery:     { icon: Home,      color: '#84CC16', gradient: 'from-lime-900/40 to-lime-800/10' },
  travel:      { icon: BookOpen,  color: '#06B6D4', gradient: 'from-cyan-900/40 to-cyan-800/10' },
  gaming:      { icon: Laptop,    color: '#8B5CF6', gradient: 'from-violet-900/40 to-violet-800/10' },
};

// The 12 universal categories defined in ShadowMerchant Blueprint
const UNIVERSAL_CATEGORIES = [
  'electronics', 'fashion', 'beauty', 'home', 'sports', 'books', 
  'toys', 'health', 'automotive', 'grocery', 'travel', 'gaming'
];

interface Category {
  category: string;
  count: number;
  avg_discount: number;
}

export function CategoryBrowser() {
  const [dbCategories, setDbCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.json())
      .then(data => Array.isArray(data) && setDbCategories(data))
      .catch(() => {});
  }, []);

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black text-white">
          <span className="text-[#FF6B00]">|</span> Shop by Category
        </h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {UNIVERSAL_CATEGORIES.map((category) => {
          const meta = CATEGORY_META[category] || { icon: Laptop, color: '#FF6B00', gradient: 'from-orange-900/40 to-orange-800/10' };
          const Icon = meta.icon;
          
          // Find if we have live DB stats for this category
          const dbStat = dbCategories.find(c => c.category === category);
          const count = dbStat ? dbStat.count : 0;
          const avg_discount = dbStat ? dbStat.avg_discount : 0;

          return (
            <Link
              key={category}
              href={`/category/${category}`}
              className={`group relative bg-gradient-to-br ${meta.gradient} border border-white/5 hover:border-white/20 rounded-xl p-4 flex flex-col items-center text-center transition-all hover:scale-[1.04] hover:shadow-lg`}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110"
                style={{ background: `${meta.color}20`, boxShadow: `0 0 18px ${meta.color}30` }}
              >
                <Icon className="w-5 h-5" style={{ color: meta.color }} />
              </div>
              <p className="text-white font-bold text-sm capitalize">{category}</p>
              
              {count > 0 ? (
                <>
                  <p className="text-gray-500 text-xs mt-0.5">{count} deals</p>
                  {avg_discount > 0 && (
                    <span className="mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${meta.color}20`, color: meta.color }}>
                      avg {avg_discount}% off
                    </span>
                  )}
                </>
              ) : (
                <p className="text-gray-600 text-xs mt-0.5 font-mono italic tracking-tighter">— Scanning —</p>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
