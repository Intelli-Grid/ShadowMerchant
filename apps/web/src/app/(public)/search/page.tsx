"use client";

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search as SearchIcon, Loader2 } from 'lucide-react';
import { DealCard } from '@/components/deals/DealCard';
import { Deal } from '@/types';

function SearchPageInner() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQ);
  const [results, setResults] = useState<Deal[]>([]);
  const [nbHits, setNbHits] = useState(0);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Trigger search immediately if URL has a ?q= param on mount
  useEffect(() => {
    if (initialQ.trim().length >= 2) {
      setLoading(true);
      fetch(`/api/search?q=${encodeURIComponent(initialQ)}`)
        .then(r => r.json())
        .then(data => { setResults(data.hits || []); setNbHits(data.nbHits || 0); })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.hits || []);
        setNbHits(data.nbHits || 0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
  }, [query]);

  return (
    <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Search Input */}
      <div className="max-w-2xl mx-auto mb-10">
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            autoFocus
            placeholder="Search deals, brands, categories..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-14 pl-12 pr-4 rounded-xl text-lg outline-none transition-all"
            style={{
              background: 'var(--bg-raised)',
              border: '1px solid var(--sm-border)',
              color: 'var(--text-primary)',
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--gold)')}
            onBlur={e => (e.target.style.borderColor = 'var(--sm-border)')}
          />
          {loading && (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin" style={{ color: 'var(--gold)' }} />
          )}
        </div>
        {query.length >= 2 && (
          <p className="text-gray-500 text-sm mt-3 ml-1">
            {loading ? 'Searching...' : `${nbHits} results for "${query}"`}
          </p>
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {results.map((deal) => (
            <DealCard key={deal._id} deal={deal} />
          ))}
        </div>
      )}

      {/* Empty / Initial state */}
      {!loading && query.length >= 2 && results.length === 0 && (
        <div className="py-20 text-center">
          <span className="text-5xl mb-4 block">🔍</span>
          <h2 className="text-xl font-bold text-white mb-2">No results found</h2>
          <p className="text-gray-500">Try a different search term or browse all deals.</p>
        </div>
      )}

      {query.length < 2 && (
        <div className="py-20 text-center">
          <span className="text-5xl mb-4 block">🛒</span>
          <p className="text-gray-500">Start typing to search across thousands of deals</p>
        </div>
      )}
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-2xl mx-auto mb-10">
          <div className="w-full h-14 rounded-xl animate-pulse" style={{ background: 'var(--bg-raised)' }} />
        </div>
      </main>
    }>
      <SearchPageInner />
    </Suspense>
  );
}

