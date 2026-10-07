'use client';

import React, { use, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ShoppingBag, Plus, Save, Trash2, ImagePlus, X, PackageCheck, Undo2, CheckCircle2, RefreshCw } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { getAccessToken, getSupabaseClient } from '@/lib/supabase/client';
import { formatMoney, parseMoneyToCents } from '@/lib/finance';
import { MAX_PHOTOS, parseSizes } from '@/lib/shop';
import type { Payment, ShopProduct } from '@/lib/supabase/types';
import { uploadImage } from '@/components/ImageUploadZone';
import { confirmAction, notify } from '@/components/ConfirmDialog';

type Db = NonNullable<ReturnType<typeof getSupabaseClient>>;
// Deletes the stored file behind a photo no product uses any more (the server refuses one still in use).
// A failure only leaves an unused file behind, so it is logged rather than shown.
async function deletePhotoFile(clubId: string, url: string) {
  const token = await getAccessToken();
  const res = await fetch('/api/upload', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ clubId, url }),
  }).catch(() => null);
  if (!res?.ok) console.warn('Shop photo file was not deleted:', url, res?.status);
}

const cell: React.CSSProperties = { padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.84rem', textAlign: 'left', verticalAlign: 'top' };

export default function ShopAdminPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const { clubs, selectClubBySlug } = useClub();
  const club = selectClubBySlug(clubSlug) || clubs[0];
  const db = getSupabaseClient();

  const [products, setProducts] = useState<ShopProduct[] | null>(null);
  const [orders, setOrders] = useState<Payment[]>([]);
  const [currency, setCurrency] = useState('AUD');
  const [cardsOn, setCardsOn] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    if (!db) return setProducts([]);
    const [pr, or, s] = await Promise.all([
      db.from('shop_products').select('*').eq('club_id', club.id).order('sort_order'),
      // Abandoned card checkouts (pending / failed) are not orders
      db.from('payments').select('*').eq('club_id', club.id).eq('kind', 'shop_order')
        .in('status', ['paid', 'refunded']).order('created_at', { ascending: false }),
      db.from('club_payment_settings').select('currency, stripe_charges_enabled').eq('club_id', club.id).maybeSingle(),
    ]);
    setProducts((pr.data || []) as ShopProduct[]);
    setOrders((or.data || []) as Payment[]);
    if (s.data?.currency) setCurrency(s.data.currency);
    setCardsOn(Boolean(s.data?.stripe_charges_enabled));
  }, [db, club.id]);
  useEffect(() => { load(); }, [load]);

  const addProduct = async () => {
    const { error } = await db!.from('shop_products').insert({ club_id: club.id, name: 'New product', is_active: false, sort_order: products?.length || 0 });
    if (error) return notify(error.message);
    load();
  };

  const handOut = async (o: Payment, done: boolean) => {
    const { error } = await db!.from('payments').update({ fulfilled_at: done ? new Date().toISOString() : null }).eq('id', o.id);
    if (error) return notify(error.message);
    load();
  };

  const open = orders.filter(o => o.status !== 'refunded' && !o.fulfilled_at);
  const shownOrders = showAll ? orders : open;

  return (
    <div className="stack">
      <div>
        <span className="badge badge-primary" style={{ marginBottom: '0.4rem', letterSpacing: '0.05em' }}>FINANCE • MERCHANDISE</span>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <ShoppingBag size={30} /> Club Shop
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', maxWidth: '680px', marginTop: '0.2rem' }}>
          Sell club merch online. Buyers pay by card and collect from the club. Public page:{' '}
          <Link href={`/${club.slug}/shop`}>/{club.slug}/shop</Link>
        </p>
      </div>

      {/* Saved state, not unsaved ticks: this is what members actually see */}
      {products && products.length > 0 && !products.some(p => p.is_active) && (
        <div role="status" className="glass-panel" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #F59E0B' }}>
          <strong>Your shop is hidden.</strong> No product is on sale, so members and visitors don&apos;t see the Shop link yet.
          Tick <strong>On sale</strong> on a product and click <strong>Save</strong>.
        </div>
      )}

      {!cardsOn && (
        <div role="status" className="glass-panel" style={{ padding: '1rem 1.25rem', borderLeft: '4px solid #F59E0B' }}>
          The shop takes card payments only, and card payments aren&apos;t set up yet. Connect Stripe in{' '}
          <Link href={`/${club.slug}/admin/finance?tab=settings`}>Finance → Settings</Link> before putting products on sale.
        </div>
      )}

      {/* Orders */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <h2 style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
            Orders {open.length > 0 && <span className="badge" style={{ marginLeft: '0.4rem', background: '#F59E0B', color: '#000' }}>{open.length} open</span>}
          </h2>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}>
            <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} /> Show handed out &amp; refunded
          </label>
        </div>
        <div className="admin-table-container">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Date', 'Buyer', 'Items', 'Amount', 'Status', ''].map(h => <th key={h} style={{ ...cell, color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {shownOrders.length === 0 && <tr><td colSpan={6} style={{ ...cell, color: 'var(--text-muted)' }}>{showAll ? 'No orders yet.' : 'Nothing waiting to be handed out.'}</td></tr>}
              {shownOrders.map(o => (
                <tr key={o.id}>
                  <td style={cell}>{(o.paid_at || o.created_at).slice(0, 10)}</td>
                  <td style={cell}>{o.payer_name}{o.payer_email && <div className="text-meta">{o.payer_email}</div>}{o.reference && <div className="text-meta">Ref {o.reference}</div>}</td>
                  <td style={cell}>
                    {o.items?.length
                      ? o.items.map((i, n) => <div key={n}>{i.quantity}× {i.name}{i.size && ` (${i.size})`}</div>)
                      : o.description}
                  </td>
                  <td style={{ ...cell, fontWeight: 800 }}>{formatMoney(o.amount_cents, o.currency)}</td>
                  <td style={cell}>
                    {o.status === 'refunded' ? (
                      <span style={{ color: '#A855F7', fontWeight: 800, fontSize: '0.78rem' }}>REFUNDED</span>
                    ) : o.fulfilled_at ? (
                      <span style={{ color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.78rem' }}>HANDED OUT {o.fulfilled_at.slice(0, 10)}</span>
                    ) : (
                      <span style={{ color: 'var(--c-green)', fontWeight: 800, fontSize: '0.78rem' }}>PAID</span>
                    )}
                  </td>
                  <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                    {o.status === 'paid' && !o.fulfilled_at && (
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => handOut(o, true)}><PackageCheck size={14} /> Handed out</button>
                    )}
                    {o.fulfilled_at && (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => handOut(o, false)}><Undo2 size={14} /> Undo</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Products */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h2 style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Products</h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={addProduct}><Plus size={14} /> Add product</button>
        </div>
        {products === null ? <p className="text-note">Loading…</p> : products.length === 0 && <p className="text-note">No products yet. Add your first one: the Shop link appears for members once a product is on sale.</p>}
        <div className="stack">
          {products?.map(p => <ProductEditor key={p.id} product={p} db={db!} clubId={club.id} currency={currency} onChange={load} />)}
        </div>
      </div>
    </div>
  );
}

function ProductEditor({ product, db, clubId, currency, onChange }: { product: ShopProduct; db: Db; clubId: string; currency: string; onChange: () => void }) {
  const [draft, setDraft] = useState({
    name: product.name,
    description: product.description || '',
    price: (product.price_cents / 100).toFixed(2),
    sizes: product.sizes.join(', '),
    is_active: product.is_active,
  });
  const [photos, setPhotos] = useState(product.photos);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const id = product.id;

  const save = async () => {
    const cents = parseMoneyToCents(draft.price);
    if (cents === null) return notify('Enter a valid price, e.g. 25 or 24.99');
    if (!draft.name.trim()) return notify('Give the product a name.');
    const { error } = await db.from('shop_products').update({
      name: draft.name.trim().slice(0, 120),
      description: draft.description.trim() || null,
      price_cents: cents,
      sizes: parseSizes(draft.sizes),
      is_active: draft.is_active,
    }).eq('id', id);
    if (error) return notify(error.message);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    onChange();
  };

  // Photos save straight away, so an upload is never lost to a forgotten Save
  const savePhotos = async (next: string[]) => {
    const { error } = await db.from('shop_products').update({ photos: next }).eq('id', id);
    if (error) {
      notify(error.message);
      return false;
    }
    setPhotos(next);
    return true;
  };
  const removePhoto = async (src: string) => {
    if (await savePhotos(photos.filter(p => p !== src))) deletePhotoFile(clubId, src);
  };

  const addPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return notify('Use a JPG, PNG or WebP photo.');
    setUploading(true);
    try {
      // 800px covers a ~300px shop card on a 3x phone screen; bigger only costs buyers data
      const url = await uploadImage(file, { folder: 'shop', clubId, maxDimension: 800 });
      if (!(await savePhotos([...photos, url].slice(0, MAX_PHOTOS)))) deletePhotoFile(clubId, url);
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const remove = async () => {
    if (!(await confirmAction({ title: `Delete ${product.name}?`, message: 'Past orders keep what was bought. Untick "On sale" instead to just hide it.', confirmLabel: 'Delete', danger: true }))) return;
    const { error } = await db.from('shop_products').delete().eq('id', id);
    if (error) return notify(error.message);
    photos.forEach(src => deletePhotoFile(clubId, src));
    onChange();
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {photos.map((src, i) => (
          <div key={src} style={{ position: 'relative', width: 88, height: 88, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
            <img src={src} alt={`${draft.name} photo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            {i === 0 && <span className="badge badge-primary" style={{ position: 'absolute', left: 4, bottom: 4, fontSize: '0.6rem' }}>Main</span>}
            <button type="button" onClick={() => removePhoto(src)} aria-label={`Remove photo ${i + 1}`}
              style={{ position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.7)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={14} />
            </button>
          </div>
        ))}
        {photos.length < MAX_PHOTOS && (
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
            style={{ width: 88, height: 88, borderRadius: 8, border: '2px dashed var(--border-medium)', background: 'transparent', color: 'var(--text-muted)', cursor: uploading ? 'wait' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: '0.7rem' }}>
            {uploading ? <RefreshCw size={18} className="animate-spin" /> : <ImagePlus size={18} />}
            {uploading ? 'Uploading' : `Add photo (${photos.length}/${MAX_PHOTOS})`}
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={addPhoto} aria-label={`Upload a photo of ${draft.name}`} />
      </div>

      <div style={{ flex: '1 1 320px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: '0.5rem', alignContent: 'start' }}>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label" htmlFor={`shop-name-${id}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Name
            {!product.is_active && <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--c-amber)' }}>Hidden from shop</span>}
          </label>
          <input id={`shop-name-${id}`} className="form-input" maxLength={120} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor={`shop-price-${id}`}>Price ({currency})</label>
          <input id={`shop-price-${id}`} className="form-input" inputMode="decimal" value={draft.price} onChange={e => setDraft({ ...draft, price: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor={`shop-sizes-${id}`}>Sizes</label>
          <input id={`shop-sizes-${id}`} className="form-input" placeholder="S, M, L" aria-describedby={`shop-sizes-hint-${id}`} value={draft.sizes} onChange={e => setDraft({ ...draft, sizes: e.target.value })} />
          <div id={`shop-sizes-hint-${id}`} className="text-meta" style={{ marginTop: '0.25rem' }}>Comma separated. Blank = one size.</div>
        </div>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label" htmlFor={`shop-desc-${id}`}>Description</label>
          <textarea id={`shop-desc-${id}`} className="form-textarea" rows={2} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} />
        </div>
        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', marginRight: 'auto' }}>
            <input type="checkbox" checked={draft.is_active} onChange={e => setDraft({ ...draft, is_active: e.target.checked })} /> On sale
          </label>
          <button type="button" className="btn btn-primary btn-sm" onClick={save}>{saved ? <CheckCircle2 size={14} /> : <Save size={14} />} {saved ? 'Saved' : 'Save'}</button>
          <button type="button" className="btn btn-danger btn-sm" onClick={remove} aria-label={`Delete ${product.name}`}><Trash2 size={14} /></button>
        </div>
      </div>
    </div>
  );
}
