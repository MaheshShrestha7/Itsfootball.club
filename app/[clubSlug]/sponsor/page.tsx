'use client';

import React, { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, AlertCircle, Handshake } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { getSupabaseClient } from '@/lib/supabase/client';
import { formatMoney } from '@/lib/finance';
import type { SponsorshipPackage } from '@/lib/supabase/types';
import PaymentStep from '@/components/PaymentStep';

export default function SponsorSignupPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const { clubs, selectClubBySlug } = useClub();
  const club = selectClubBySlug(clubSlug) || clubs[0];

  const [packages, setPackages] = useState<SponsorshipPackage[] | null>(null);
  const [currency, setCurrency] = useState('AUD');
  const [selected, setSelected] = useState<SponsorshipPackage | null>(null);
  const [form, setForm] = useState({ name: '', contact_name: '', contact_email: '', contact_phone: '', website_url: '', company_website_confirm: '' });
  const [sponsorId, setSponsorId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null);

  useEffect(() => {
    setPaymentNotice(new URLSearchParams(window.location.search).get('payment'));
    const client = getSupabaseClient();
    if (!client) return setPackages([]);
    client.from('sponsorship_packages').select('*').eq('club_id', club.id).eq('is_active', true).order('sort_order')
      .then(({ data }) => setPackages((data || []) as SponsorshipPackage[]));
    client.from('club_payment_settings').select('currency').eq('club_id', club.id).maybeSingle()
      .then(({ data }) => data?.currency && setCurrency(data.currency));
  }, [club.id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/sponsors/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, clubId: club.id, packageId: selected.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not save your details.');
      setSponsorId(json.sponsorId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const field = (key: keyof typeof form, label: string, type = 'text', required = true) => (
    <div className="form-group">
      <label className="form-label" htmlFor={`sponsor-${key}`}>{label}{required ? ' *' : ''}</label>
      <input id={`sponsor-${key}`} className="form-input" type={type} required={required} value={form[key]}
        onChange={e => setForm({ ...form, [key]: e.target.value })} />
    </div>
  );

  return (
    <div style={{ minHeight: '85vh', padding: '3rem 0 5rem 0' }}>
      <div className="container" style={{ maxWidth: '860px' }}>
        <Link href={`/${club.slug}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          <ArrowLeft size={16} /> Back to {club.name}
        </Link>

        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: '#FFFFFF', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Handshake size={30} color="var(--club-primary)" /> Sponsor {club.name}
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          Put your business in front of our players, members and matchday crowd. Choose a package below.
        </p>

        {paymentNotice === 'success' && (
          <div role="status" className="glass-panel" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', borderLeft: '4px solid #10B981', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            <CheckCircle2 size={18} color="#10B981" /> Payment received, thank you! The club will be in touch about your logo and artwork.
          </div>
        )}
        {paymentNotice === 'cancelled' && (
          <div role="status" className="glass-panel" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', borderLeft: '4px solid #F59E0B', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            <AlertCircle size={18} color="#F59E0B" /> Payment was cancelled. Nothing was charged.
          </div>
        )}

        {sponsorId && selected ? (
          <PaymentStep clubId={club.id} kind="sponsorship" sponsorId={sponsorId} packageId={selected.id}
            amountCents={selected.price_cents} label={`${selected.name} sponsorship`} />
        ) : packages === null ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading packages…</p>
        ) : packages.length === 0 ? (
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            The club hasn&apos;t published sponsorship packages yet. Get in touch through the contact form on the club page.
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              {packages.map(p => (
                <button key={p.id} type="button" onClick={() => setSelected(p)} aria-pressed={selected?.id === p.id}
                  className="glass-panel glass-panel-interactive"
                  style={{ padding: '1.25rem', textAlign: 'left', cursor: 'pointer', border: selected?.id === p.id ? '2px solid var(--club-primary)' : undefined }}>
                  <span className="badge badge-gold" style={{ textTransform: 'capitalize' }}>{p.tier}</span>
                  <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#FFFFFF', margin: '0.5rem 0 0.25rem' }}>{p.name}</div>
                  <div style={{ fontWeight: 800, color: 'var(--club-primary)', marginBottom: '0.5rem' }}>{formatMoney(p.price_cents, currency)}</div>
                  {p.benefits && <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{p.benefits}</div>}
                </button>
              ))}
            </div>

            {selected && (
              <form onSubmit={submit} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ fontWeight: 800, color: '#FFFFFF' }}>Your details for {selected.name}</div>
                {field('name', 'Business name')}
                {field('contact_name', 'Contact name')}
                {field('contact_email', 'Email', 'email')}
                {field('contact_phone', 'Phone', 'tel', false)}
                {field('website_url', 'Website', 'url', false)}
                {/* Honeypot: hidden from people, filled in by bots */}
                <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.company_website_confirm}
                  onChange={e => setForm({ ...form, company_website_confirm: e.target.value })}
                  style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }} />
                {error && <p role="alert" style={{ color: '#EF4444', fontSize: '0.85rem' }}>{error}</p>}
                <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Continue to payment'}</button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
