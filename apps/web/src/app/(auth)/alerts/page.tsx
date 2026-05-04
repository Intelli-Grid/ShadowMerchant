"use client";

import { useState, useEffect } from 'react';
import { Bell, Plus, Trash2, Tag, TrendingDown, Search, Package, Loader2, Target, ExternalLink } from 'lucide-react';
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

interface PriceAlert {
  _id: string;
  type: 'target_price';
  criteria: {
    deal_id: string;
    product_title: string;
    platform: string;
    target_price: number;
    current_price: number;
  };
  is_active: boolean;
  created_at: string;
}

const ALERT_TYPES = [
  { value: 'category',   label: 'Category Drop', icon: Package,     desc: 'Alert when deals appear in a category' },
  { value: 'brand',      label: 'Brand Deal',    icon: Tag,         desc: 'Alert for deals from a specific brand' },
  { value: 'price_drop', label: 'Price Drop',    icon: TrendingDown, desc: 'Alert below a target price' },
  { value: 'keyword',    label: 'Keyword Match', icon: Search,      desc: 'Alert when title matches a keyword' },
];

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-raised)',
  border: '1px solid var(--sm-border)',
  color: 'var(--text-primary)',
  borderRadius: '8px',
  padding: '0 12px',
  height: '40px',
  width: '100%',
  fontSize: '14px',
  outline: 'none',
  flex: 1,
};

export default function AlertsPage() {
  const [activeTab, setActiveTab] = useState<'pro' | 'price'>('price');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [form, setForm] = useState({ type: 'keyword', keyword: '', brand: '', category: '', max_price: '', min_discount: '30' });
  const [telegramLinked, setTelegramLinked] = useState(false);

  useEffect(() => {
    // Fetch Pro alerts
    fetch('/api/alerts')
      .then(r => r.json())
      .then(data => {
        if (data.error === 'Pro subscription required') {
          setIsPro(false);
        } else {
          setAlerts(data.alerts || []);
          setIsPro(true);
          setTelegramLinked(!!data.telegramLinked);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Fetch Target Price Alerts (available to all logged-in users)
    fetch('/api/alerts/target-price?deal_id=__all__')
      .then(r => r.json())
      .then(data => {
        // The route returns hasAlert when queried for a specific deal.
        // We query the user's full list via /api/user/price-alerts instead.
      })
      .catch(() => {});

    // Fetch all user price alerts from a dedicated list endpoint
    fetch('/api/alerts/target-price/list')
      .then(r => r.json())
      .then(data => setPriceAlerts(data.alerts || []))
      .catch(() => {});
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

  const handleRemovePriceAlert = async (id: string) => {
    await fetch('/api/alerts/target-price', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alert_id: id }),
    });
    setPriceAlerts(prev => prev.filter(a => a._id !== id));
  };

  // Loading spinner
  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--gold)' }} />
    </div>
  );

  function AlertMockCard({ type, value, status }: { type: string, value: string, status: string }) {
    return (
      <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg-raised)', border: '1px solid var(--sm-border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded shrink-0 flex items-center justify-center" style={{ background: 'var(--gold-dim)' }}>
            <Bell className="w-4 h-4" style={{ color: 'var(--gold)' }} />
          </div>
          <div className="text-left leading-tight">
            <p className="text-sm font-semibold text-white">{type}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{value}</p>
          </div>
        </div>
        <span className="text-[10px] font-bold tracking-wide uppercase px-2 py-1 rounded-full" style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80' }}>
          {status}
        </span>
      </div>
    );
  }

  // Pro gate
  if (!isPro) return (
    <main className="flex-1 flex items-center justify-center px-4 py-20">
      <div
        className="max-w-md w-full text-center rounded-2xl p-8"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--gold-border)' }}
      >
        <div className="mb-6 space-y-2 opacity-40 pointer-events-none" style={{ filter: 'grayscale(0.5)' }}>
          <AlertMockCard type="Keyword" value="boAt headphones" status="3 deals today" />
          <AlertMockCard type="Category" value="Electronics" status="12 in last 24h" />
          <AlertMockCard type="Price Drop" value="Under ₹1,500" status="5 this week" />
        </div>

        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: 'var(--gold-dim)', border: '1px solid var(--gold-border)' }}
        >
          <Bell className="w-7 h-7" style={{ color: 'var(--gold)' }} />
        </div>
        <h2 className="text-2xl font-black text-white mb-2" style={{ fontFamily: 'var(--font-display)' }}>Never Miss a Deal Again</h2>
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
          Set alerts for keywords, brands, or price thresholds. Get notified on Telegram the moment a matching deal is found.
        </p>
        <Button
          asChild
          className="w-full font-bold h-12 hover:scale-105 active:scale-95 transition-all"
          style={{ background: 'var(--gold)', color: '#0A0A0A' }}
        >
          <Link href="/pro">Unlock with Pro — ₹99/month →</Link>
        </Button>
      </div>
    </main>
  );

  return (
    <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3 section-heading" style={{ fontFamily: 'var(--font-display)' }}>
            Deal Alerts
          </h1>
          <p className="mt-1" style={{ color: 'var(--text-muted)' }}>
            {priceAlerts.length} price watch{priceAlerts.length !== 1 ? 'es' : ''} · {alerts.length} rule alert{alerts.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* ── Tab switcher ── */}
      <div className="flex gap-1 p-1 rounded-xl mb-6" style={{ background: 'var(--bg-surface)', border: '1px solid var(--sm-border)' }}>
        <button
          onClick={() => setActiveTab('price')}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all"
          style={{
            background: activeTab === 'price' ? 'var(--gold)' : 'transparent',
            color: activeTab === 'price' ? '#0A0A0A' : 'var(--text-muted)',
          }}
        >
          <Target className="w-4 h-4" />
          My Price Alerts
          {priceAlerts.length > 0 && (
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
              style={{ background: activeTab === 'price' ? '#0A0A0A22' : 'var(--gold)', color: activeTab === 'price' ? '#0A0A0A' : '#0A0A0A' }}>
              {priceAlerts.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('pro')}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all"
          style={{
            background: activeTab === 'pro' ? 'var(--gold)' : 'transparent',
            color: activeTab === 'pro' ? '#0A0A0A' : 'var(--text-muted)',
          }}
        >
          <Bell className="w-4 h-4" />
          Pro Rule Alerts
          {!isPro && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)' }}>Pro</span>
          )}
        </button>
      </div>

      {/* ── PRICE ALERTS TAB ── */}
      {activeTab === 'price' && (
        <div>
          {priceAlerts.length === 0 ? (
            <div
              className="rounded-2xl p-10 text-center flex flex-col items-center gap-4"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--sm-border)' }}
            >
              <Target className="w-10 h-10 opacity-30" style={{ color: 'var(--gold)' }} />
              <div>
                <p className="text-white font-bold mb-1">No price alerts set yet</p>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Browse deals and tap &quot;Alert me when price drops&quot; on any product page.
                </p>
              </div>
              <Link
                href="/deals"
                className="px-5 py-2.5 rounded-xl font-bold text-sm transition-all hover:opacity-90"
                style={{ background: 'var(--gold)', color: '#0A0A0A' }}
              >
                Browse Deals →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {priceAlerts.map(alert => {
                const fmt = (n: number) => `₹${n?.toLocaleString('en-IN')}`;
                const savings = alert.criteria.current_price - alert.criteria.target_price;
                const savingsPct = Math.round((savings / alert.criteria.current_price) * 100);
                return (
                  <div
                    key={alert._id}
                    className="rounded-xl p-4 flex items-center gap-4"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--sm-border)' }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid var(--gold-border)' }}
                    >
                      <Target className="w-5 h-5" style={{ color: 'var(--gold)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold line-clamp-1">
                        {alert.criteria.product_title || 'Unknown product'}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[11px] capitalize" style={{ color: 'var(--text-muted)' }}>
                          {alert.criteria.platform}
                        </span>
                        <span className="text-[11px] font-bold" style={{ color: 'var(--gold)' }}>
                          Target: {fmt(alert.criteria.target_price)}
                        </span>
                        {alert.criteria.current_price > 0 && (
                          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            Now: {fmt(alert.criteria.current_price)}
                          </span>
                        )}
                        {savingsPct > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80' }}>
                            -{savingsPct}% below current
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {alert.criteria.deal_id && (
                        <Link
                          href={`/deals/${alert.criteria.deal_id}`}
                          className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:opacity-80"
                          style={{ color: 'var(--text-muted)', background: 'var(--bg-raised)' }}
                          title="View deal"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      )}
                      <button
                        onClick={() => handleRemovePriceAlert(alert._id)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-red-500/10"
                        style={{ color: 'var(--text-muted)' }}
                        title="Remove alert"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── PRO ALERTS TAB ── */}
      {activeTab === 'pro' && (
        <div>

      <div
        className="rounded-xl p-5 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        style={{ background: telegramLinked ? 'rgba(34,158,217,0.08)' : 'var(--bg-surface)', border: `1px solid ${telegramLinked ? 'rgba(34,158,217,0.3)' : 'var(--sm-border)'}` }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xl"
            style={{ background: 'rgba(34,158,217,0.15)' }}
          >
            ✈️
          </div>
          <div>
            <p className="font-bold text-white text-sm flex items-center gap-2">
              Get Alerts on Telegram
              {telegramLinked && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>
                  ✓ Connected
                </span>
              )}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {telegramLinked
                ? 'Deal alerts will be delivered to your Telegram DM instantly.'
                : 'Instant deal alerts delivered to your Telegram DM — faster than email.'}
            </p>
          </div>
        </div>
        {!telegramLinked && (
          <a
            href="https://t.me/Shadow_Merchant_Bot?start=link"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap shrink-0 transition-opacity hover:opacity-80"
            style={{ background: '#229ED9', color: '#fff' }}
          >
            🔗 Connect Telegram
          </a>
        )}
      </div>


      <div
        className="rounded-xl p-6 mb-8"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--sm-border)' }}
      >
        <h2 className="text-white font-bold mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4" style={{ color: 'var(--gold)' }} />
          Create New Alert
        </h2>

        {/* Type selection */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {ALERT_TYPES.map(({ value, label, icon: Icon }) => {
            const active = form.type === value;
            return (
              <button
                key={value}
                onClick={() => setForm(f => ({ ...f, type: value }))}
                className="flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs font-semibold transition-all"
                style={{
                  borderColor: active ? 'var(--gold)' : 'var(--sm-border)',
                  background: active ? 'var(--gold-dim)' : 'transparent',
                  color: active ? 'var(--gold)' : 'var(--text-muted)',
                }}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            );
          })}
        </div>

        {/* Dynamic input */}
        <div className="flex flex-col sm:flex-row gap-3">
          {form.type === 'keyword' && (
            <input
              placeholder="e.g. boAt headphone"
              value={form.keyword}
              onChange={e => setForm(f => ({ ...f, keyword: e.target.value }))}
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = 'var(--gold)')}
              onBlur={e => (e.target.style.borderColor = 'var(--sm-border)')}
            />
          )}
          {form.type === 'brand' && (
            <input
              placeholder="Brand name e.g. Sony"
              value={form.brand}
              onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = 'var(--gold)')}
              onBlur={e => (e.target.style.borderColor = 'var(--sm-border)')}
            />
          )}
          {form.type === 'category' && (
            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              style={{ ...inputStyle }}
              onFocus={e => (e.target.style.borderColor = 'var(--gold)')}
              onBlur={e => (e.target.style.borderColor = 'var(--sm-border)')}
            >
              {['electronics', 'fashion', 'beauty', 'home', 'sports', 'books'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
          {form.type === 'price_drop' && (
            <input
              type="number"
              placeholder="Max price (₹)"
              value={form.max_price}
              onChange={e => setForm(f => ({ ...f, max_price: e.target.value }))}
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = 'var(--gold)')}
              onBlur={e => (e.target.style.borderColor = 'var(--sm-border)')}
            />
          )}
          <Button
            onClick={handleCreate}
            disabled={creating}
            className="font-bold h-10 px-6 shrink-0"
            style={{ background: 'var(--gold)', color: '#0A0A0A' }}
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Alert'}
          </Button>
        </div>
      </div>

      {/* Alert list */}
      {alerts.length === 0 ? (
        <p className="text-center py-10" style={{ color: 'var(--text-muted)' }}>
          No alerts yet. Create your first one above.
        </p>
      ) : (
        <div className="space-y-3">
          {alerts.map(alert => (
            <div
              key={alert._id}
              className="rounded-xl p-4 flex items-center justify-between"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--sm-border)' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--gold-dim)' }}>
                  <Bell className="w-4 h-4" style={{ color: 'var(--gold)' }} />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm capitalize">
                    {alert.type.replace('_', ' ')} Alert
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {JSON.stringify(alert.criteria).replace(/[{}"]/g, '').replace(/:/g, ': ').replace(/,/g, ' · ')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDelete(alert._id)}
                className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-red-500/10"
                style={{ color: 'var(--text-muted)' }}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
        </div>
      )}
    </main>
  );
}
