"use client";

import { useState, useEffect } from 'react';
import { Bell, Plus, Trash2, Lock, Tag, TrendingDown, Search, Package } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface Alert {
  _id: string;
  type: 'category' | 'brand' | 'price_drop' | 'keyword';
  criteria: {
    category?: string;
    brand?: string;
    keyword?: string;
    max_price?: number;
    min_discount?: number;
  };
  is_active: boolean;
  created_at: string;
}

const ALERT_TYPES = [
  { value: 'category', label: 'Category Drop', icon: Package, desc: 'Alert when deals appear in a category' },
  { value: 'brand', label: 'Brand Deal', icon: Tag, desc: 'Alert for deals from a specific brand' },
  { value: 'price_drop', label: 'Price Drop', icon: TrendingDown, desc: 'Alert below a target price' },
  { value: 'keyword', label: 'Keyword Match', icon: Search, desc: 'Alert when title matches a keyword' },
];

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [form, setForm] = useState({ type: 'keyword', keyword: '', brand: '', category: '', max_price: '', min_discount: '30' });

  useEffect(() => {
    fetch('/api/alerts')
      .then(r => r.json())
      .then(data => {
        if (data.error === 'Pro subscription required') {
          setIsPro(false);
        } else {
          setAlerts(data.alerts || []);
          setIsPro(true);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    const criteria: Record<string, any> = { min_discount: Number(form.min_discount) };
    if (form.type === 'keyword') criteria.keyword = form.keyword;
    if (form.type === 'brand') criteria.brand = form.brand;
    if (form.type === 'category') criteria.category = form.category;
    if (form.type === 'price_drop') criteria.max_price = Number(form.max_price);

    const res = await fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: form.type, criteria }),
    });
    const data = await res.json();
    if (res.ok) setAlerts(prev => [data.alert, ...prev]);
    setCreating(false);
  };

  const handleDelete = async (id: string) => {
    await fetch('/api/alerts', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alert_id: id }) });
    setAlerts(prev => prev.filter(a => a._id !== id));
  };

  if (loading) return <div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#FF6B00] border-t-transparent rounded-full animate-spin" /></div>;

  // ---- Pro gate ----
  if (!isPro) return (
    <main className="flex-1 flex items-center justify-center px-4 py-20">
      <div className="max-w-md w-full text-center bg-[#13131A] border border-[#2A2A35] rounded-2xl p-10">
        <div className="w-16 h-16 bg-[#7C3AED]/20 rounded-full flex items-center justify-center mx-auto mb-5">
          <Bell className="w-8 h-8 text-[#7C3AED]" />
        </div>
        <h1 className="text-2xl font-black text-white mb-2">Deal Alerts</h1>
        <p className="text-gray-400 mb-6 text-sm">Get notified instantly when deals match your criteria. Pro members only.</p>
        <Button asChild className="bg-[#7C3AED] hover:bg-[#6D28D9] w-full font-bold text-white h-12">
          <Link href="/pro">Unlock with Pro →</Link>
        </Button>
      </div>
    </main>
  );

  return (
    <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <Bell className="w-7 h-7 text-[#FF6B00]" /> Deal Alerts
          </h1>
          <p className="text-gray-500 mt-1">{alerts.length} active alert{alerts.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Create Alert */}
      <div className="bg-[#13131A] border border-[#2A2A35] rounded-xl p-6 mb-8">
        <h2 className="text-white font-bold mb-4 flex items-center gap-2"><Plus className="w-4 h-4 text-[#FF6B00]" /> Create New Alert</h2>

        {/* Type selection */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {ALERT_TYPES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setForm(f => ({ ...f, type: value }))}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs font-semibold transition-all ${
                form.type === value
                  ? 'border-[#FF6B00] bg-[#FF6B00]/10 text-[#FF6B00]'
                  : 'border-[#2A2A35] text-gray-400 hover:border-gray-600'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Dynamic input */}
        <div className="flex flex-col sm:flex-row gap-3">
          {form.type === 'keyword' && (
            <input placeholder="e.g. boAt headphone" value={form.keyword} onChange={e => setForm(f => ({ ...f, keyword: e.target.value }))}
              className="flex-1 h-10 bg-[#0A0A0F] border border-[#2A2A35] rounded-lg px-3 text-white text-sm focus:border-[#FF6B00] outline-none" />
          )}
          {form.type === 'brand' && (
            <input placeholder="Brand name e.g. Sony" value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}
              className="flex-1 h-10 bg-[#0A0A0F] border border-[#2A2A35] rounded-lg px-3 text-white text-sm focus:border-[#FF6B00] outline-none" />
          )}
          {form.type === 'category' && (
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="flex-1 h-10 bg-[#0A0A0F] border border-[#2A2A35] rounded-lg px-3 text-white text-sm focus:border-[#FF6B00] outline-none">
              {['electronics', 'fashion', 'beauty', 'home', 'sports', 'books'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          {form.type === 'price_drop' && (
            <input type="number" placeholder="Max price (₹)" value={form.max_price} onChange={e => setForm(f => ({ ...f, max_price: e.target.value }))}
              className="flex-1 h-10 bg-[#0A0A0F] border border-[#2A2A35] rounded-lg px-3 text-white text-sm focus:border-[#FF6B00] outline-none" />
          )}
          <Button onClick={handleCreate} disabled={creating} className="bg-[#FF6B00] hover:bg-[#E66000] text-white font-bold h-10 px-6 shrink-0">
            {creating ? 'Creating...' : 'Create Alert'}
          </Button>
        </div>
      </div>

      {/* Alert list */}
      {alerts.length === 0 ? (
        <p className="text-gray-500 text-center py-10">No alerts yet. Create your first one above.</p>
      ) : (
        <div className="space-y-3">
          {alerts.map(alert => (
            <div key={alert._id} className="bg-[#13131A] border border-[#2A2A35] rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[#FF6B00]/10 rounded-lg flex items-center justify-center">
                  <Bell className="w-4 h-4 text-[#FF6B00]" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm capitalize">{alert.type.replace('_', ' ')} Alert</p>
                  <p className="text-gray-500 text-xs">{JSON.stringify(alert.criteria).replace(/[{}"]/g, '').replace(/:/g, ': ').replace(/,/g, ' · ')}</p>
                </div>
              </div>
              <button onClick={() => handleDelete(alert._id)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-gray-600 hover:text-red-400 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
