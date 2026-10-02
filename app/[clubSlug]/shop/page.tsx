'use client';

import React, { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, AlertCircle, ShoppingBag, Minus, Plus, Trash2, MapPin } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseClient } from '@/lib/supabase/client';
import { formatMoney } from '@/lib/finance';
import { MAX_QUANTITY, type CartLine } from '@/lib/shop';
import type { ShopProduct } from '@/lib/supabase/types';
import PaymentStep from '@/components/PaymentStep';

export default function ShopPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const { clubs, selectClubBySlug } = useClub();
  const { user } = useAuth();
  const club = selectClubBySlug(clubSlug) || clubs[0];

  const [products, setProducts] = useState<ShopProduct[] | null>(null);
  const [currency, setCurrency] = useState('AUD');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [buyer, setBuyer] = useState({ name: '', email: '' });
  const [checkout, setCheckout] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null);
  // ponytail: the cart lives in memory, so a cancelled card checkout starts over; sessionStorage if buyers mind

  useEffect(() => {
    setPaymentNotice(new URLSearchParams(window.location.search).get('payment'));
    const client = getSupabaseClient();
    if (!client) return setProducts([]);
    client.from('shop_products').select('*').eq('club_id', club.id).eq('is_active', true).order('sort_order')
      .then(({ data }) => setProducts((data || []) as ShopProduct[]));
    client.from('club_payment_settings').select('currency').eq('club_id', club.id).maybeSingle()
      .then(({ data }) => data?.currency && setCurrency(data.currency));
  }, [club.id]);

  useEffect(() => {
    if (user) setBuyer(b => ({ name: b.name || user.full_name || '', email: b.email || user.email || '' }));
  }, [user]);

  const product = (id: string) => products?.find(p => p.id === id);
  const lines = cart.filter(l => product(l.productId));
  const total = lines.reduce((n, l) => n + product(l.productId)!.price_cents * l.quantity, 0);
  const itemCount = lines.reduce((n, l) => n + l.quantity, 0);

  // On phones the order panel sits below every product: a floating bar leads to it while it's off screen
  const orderRef = useRef<HTMLElement>(null);
  const [orderInView, setOrderInView] = useState(true);
  useEffect(() => {
    const el = orderRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setOrderInView(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [products]);
  const showOrder = () => orderRef.current?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  });

  const add = (productId: string, size: string) => setCart(c => {
    const i = c.findIndex(l => l.productId === productId && l.size === size);
    if (i < 0) return [...c, { productId, size, quantity: 1 }];
    return c.map((l, j) => (j === i ? { ...l, quantity: Math.min(MAX_QUANTITY, l.quantity + 1) } : l));
  });
  const setQty = (line: CartLine, quantity: number) => setCart(c =>
    quantity < 1 ? c.filter(l => l !== line) : c.map(l => (l === line ? { ...l, quantity: Math.min(MAX_QUANTITY, quantity) } : l)));

  const notice = (color: string, icon: React.ReactNode, text: string) => (
    <div role="status" className="glass-panel" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', borderLeft: `4px solid ${color}`, display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
      {icon} {text}
    </div>
  );

  return (
    <div style={{ minHeight: '85vh', padding: '3rem 0 5rem 0' }}>
      <div className="container" style={{ maxWidth: '1080px' }}>
        <Link href={`/${club.slug}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          <ArrowLeft size={16} /> Back to {club.name}
        </Link>

        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <ShoppingBag size={30} color="var(--club-primary)" /> {club.name} Shop
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <MapPin size={16} /> Order online, pay by card, collect from the club.
        </p>

        {paymentNotice === 'success' && notice('#10B981', <CheckCircle2 size={18} color="var(--c-green)" />, 'Payment received, thank you! Collect your order from the club.')}
        {paymentNotice === 'cancelled' && notice('#F59E0B', <AlertCircle size={18} color="var(--c-amber)" />, 'Payment was cancelled. Nothing was charged.')}

        {products === null ? (
          <p className="text-muted">Loading shop…</p>
        ) : products.length === 0 ? (
          <div className="glass-panel" style={{ padding: '1.5rem' }}>The club hasn&apos;t put anything in the shop yet. Check back soon.</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'flex-start' }}>
            <div style={{ flex: '3 1 460px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', minWidth: 0 }}>
              {products.map(p => <ProductCard key={p.id} product={p} currency={currency} onAdd={size => { add(p.id, size); setCheckout(false); }} />)}
            </div>

            <aside ref={orderRef} className="glass-panel" style={{ flex: '1 1 300px', padding: '1.25rem', position: 'sticky', top: '6rem', scrollMarginTop: '6rem' }} aria-label="Your order">
              <h2 style={{ fontWeight: 900, fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Your order</h2>
              {lines.length === 0 ? (
                <p className="text-note">Nothing added yet.</p>
              ) : (
                <div className="stack stack-sm">
                  {lines.map(l => {
                    const p = product(l.productId)!;
                    return (
                      <div key={`${l.productId}:${l.size}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.name}{l.size && ` (${l.size})`}</div>
                          <div className="text-meta">{formatMoney(p.price_cents * l.quantity, currency)}</div>
                        </div>
                        {!checkout && (
                          <>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setQty(l, l.quantity - 1)} aria-label={`One less ${p.name}`}>
                              {l.quantity === 1 ? <Trash2 size={13} /> : <Minus size={13} />}
                            </button>
                            <span aria-live="polite" style={{ minWidth: '1.2rem', textAlign: 'center', fontWeight: 800 }}>{l.quantity}</span>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setQty(l, l.quantity + 1)} aria-label={`One more ${p.name}`} disabled={l.quantity >= MAX_QUANTITY}>
                              <Plus size={13} />
                            </button>
                          </>
                        )}
                        {checkout && <span style={{ fontWeight: 800 }}>×{l.quantity}</span>}
                      </div>
                    );
                  })}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem', color: 'var(--text-primary)' }}>
                    <span>Total</span><span>{formatMoney(total, currency)}</span>
                  </div>

                  {checkout ? (
                    <>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCheckout(false)}>Edit order</button>
                      <PaymentStep clubId={club.id} kind="shop_order" amountCents={total} label="Shop order" cardOnly
                        extra={{ items: JSON.stringify(lines), buyerName: buyer.name, buyerEmail: buyer.email }} />
                    </>
                  ) : (
                    <form onSubmit={e => { e.preventDefault(); setCheckout(true); }} className="stack stack-sm">
                      <div className="form-group">
                        <label className="form-label" htmlFor="shop-name">Your name *</label>
                        <input id="shop-name" className="form-input" required maxLength={120} autoComplete="name" value={buyer.name} onChange={e => setBuyer({ ...buyer, name: e.target.value })} />
                      </div>
                      <div className="form-group">
                        <label className="form-label" htmlFor="shop-email">Email *</label>
                        <input id="shop-email" className="form-input" type="email" required autoComplete="email" value={buyer.email} onChange={e => setBuyer({ ...buyer, email: e.target.value })} />
                      </div>
                      <p className="text-note" style={{ margin: 0 }}>Collection only: pick your order up from the club.</p>
                      <button type="submit" className="btn btn-primary">Continue to payment</button>
                    </form>
                  )}
                </div>
              )}
            </aside>
          </div>
        )}
      </div>

      {itemCount > 0 && !orderInView && (
        <button type="button" className="btn btn-primary" onClick={showOrder}
          style={{
            position: 'fixed', zIndex: 40, left: '50%', transform: 'translateX(-50%)', width: 'min(480px, calc(100% - 32px))',
            bottom: 'calc(16px + env(safe-area-inset-bottom))', display: 'flex', justifyContent: 'space-between', boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
          }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><ShoppingBag size={16} /> View order ({itemCount})</span>
          <span>{formatMoney(total, currency)}</span>
        </button>
      )}
    </div>
  );
}

function ProductCard({ product: p, currency, onAdd }: { product: ShopProduct; currency: string; onAdd: (size: string) => void }) {
  const [photo, setPhoto] = useState(0);
  const [size, setSize] = useState('');
  const [added, setAdded] = useState(false);
  const needsSize = p.sizes.length > 0;

  const add = () => {
    onAdd(size);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  return (
    <div className="glass-panel" style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <div style={{ aspectRatio: '1 / 1', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'rgba(var(--shade-rgb), 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {p.photos[photo] ? (
          <img src={p.photos[photo]} alt={p.name} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <ShoppingBag size={40} color="var(--text-muted)" aria-hidden="true" />
        )}
      </div>
      {/* Dots, not thumbnails: only the photo on show is downloaded */}
      {p.photos.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '-0.35rem' }}>
          {p.photos.map((src, i) => (
            <button key={src} type="button" onClick={() => setPhoto(i)} aria-label={`${p.name} photo ${i + 1}`} aria-pressed={photo === i}
              style={{ width: 28, height: 28, padding: 0, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: photo === i ? 'var(--club-primary)' : 'var(--border-medium)' }} />
            </button>
          ))}
        </div>
      )}
      <div>
        <div style={{ fontWeight: 900, color: 'var(--text-primary)' }}>{p.name}</div>
        <div style={{ fontWeight: 800, color: 'var(--club-primary)' }}>{formatMoney(p.price_cents, currency)}</div>
      </div>
      {p.description && <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{p.description}</div>}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
        {needsSize && (
          <select className="form-select" style={{ flex: 1 }} value={size} onChange={e => setSize(e.target.value)} aria-label={`Size for ${p.name}`}>
            <option value="">Size…</option>
            {p.sizes.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        <button type="button" className="btn btn-primary btn-sm" style={{ flex: needsSize ? undefined : 1 }} onClick={add} disabled={needsSize && !size}>
          {added ? <CheckCircle2 size={14} /> : <Plus size={14} />} {added ? 'Added' : 'Add'}
        </button>
      </div>
    </div>
  );
}
