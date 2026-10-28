'use client';

import React, { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import ClubContactSection from '@/components/ClubContactSection';
import { ArrowLeft, CheckCircle2, AlertCircle, Check } from 'lucide-react';
import SponsorLogo from '@/components/SponsorLogo';
import { useClub } from '@/lib/club-context';
import { getSupabaseClient } from '@/lib/supabase/client';
import { formatMoney } from '@/lib/finance';
import type { SponsorshipPackage } from '@/lib/supabase/types';
import PaymentStep from '@/components/PaymentStep';
import Captcha, { captchaError, type CaptchaHandle } from '@/components/Captcha';
import { TIER_BADGE, isSponsorOnSite, packageIncludeLines, sortSponsorsByTier, sponsorTierLabel } from '@/lib/sponsors';

/** A package priced 0 has no online payment: the business tells the club what they'd like to offer */
const isOnRequest = (p: SponsorshipPackage) => !(p.price_cents > 0);

export default function SponsorSignupPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const { clubs, selectClubBySlug, sponsors } = useClub();
  const club = selectClubBySlug(clubSlug) || clubs[0];
  // "Join Acme Plumbing, Corner Cafe and 3 other local businesses": the club's sponsors on the site now
  const current = sortSponsorsByTier(sponsors.filter(s => s.club_id === club.id && !s.event_id && isSponsorOnSite(s)));

  const [packages, setPackages] = useState<SponsorshipPackage[] | null>(null);
  const [currency, setCurrency] = useState('AUD');
  const [selected, setSelected] = useState<SponsorshipPackage | null>(null);
  const [form, setForm] = useState({ name: '', contact_name: '', contact_email: '', contact_phone: '', website_url: '', message: '', company_website_confirm: '' });
  const [sponsorId, setSponsorId] = useState<string | null>(null);
  // Their own page's secret, for the link under the payment step
  const [portalKey, setPortalKey] = useState<string | null>(null);
  const [sentToClub, setSentToClub] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null);
  // A payment or renewal link the club emailed: ?pay={sponsor}&package={package}&k={secret}
  const [payLink, setPayLink] = useState<{ sponsorId: string; packageId: string; key: string | null } | null>(null);
  // What the emailed link can do now (SPE-1): undefined while checking, null if it couldn't be checked
  const [linkState, setLinkState] = useState<{ canPay: boolean; receiptWaiting: boolean } | null | undefined>(undefined);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captcha = useRef<CaptchaHandle>(null);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setPaymentNotice(query.get('payment'));
    const pay = query.get('pay');
    const packageId = query.get('package');
    if (pay && packageId) {
      const key = query.get('k');
      setPayLink({ sponsorId: pay, packageId, key });
      // Already paid, or a receipt waiting? Then the link shows that instead of a second payment
      if (key) fetch(`/api/sponsors/portal?k=${encodeURIComponent(key)}`)
        .then(res => (res.ok ? res.json() : null))
        .then(json => setLinkState(json ? { canPay: json.canPay !== false, receiptWaiting: !!json.receiptWaiting } : null))
        .catch(() => setLinkState(null));
      else setLinkState(null);
    }
    const client = getSupabaseClient();
    if (!client) return setPackages([]);
    client.from('sponsorship_packages').select('*').eq('club_id', club.id).eq('is_active', true).order('sort_order')
      .then(({ data }) => setPackages((data || []) as SponsorshipPackage[]));
    client.from('club_payment_settings').select('currency').eq('club_id', club.id).maybeSingle()
      .then(({ data }) => data?.currency && setCurrency(data.currency));
  }, [club.id]);

  // The emailed link has nothing to pay right now
  const linkDone = !!linkState && (!linkState.canPay || linkState.receiptWaiting);
  // The emailed link's package, while it's still offered and priced
  const payLinkPackage = payLink ? packages?.find(p => p.id === payLink.packageId && !isOnRequest(p)) : undefined;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const notReady = captchaError(captchaToken);
    if (notReady) return setError(notReady);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/sponsors/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, clubId: club.id, packageId: selected.id, captchaToken }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not save your details.');
      if (json.onRequest) setSentToClub(true);
      else {
        setSponsorId(json.sponsorId);
        setPortalKey(json.portalKey || null);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      captcha.current?.reset();
    }
  };

  const field = (key: keyof typeof form, label: string, type = 'text', required = true) => (
    <div className="form-group">
      <label className="form-label" htmlFor={`sponsor-${key}`}>{label}{required ? ' *' : ''}</label>
      {/* A website box is plain text, so "www.acme.com.au" is accepted (type="url" insists on https://, SPE-4);
          the server adds the https:// */}
      <input id={`sponsor-${key}`} className="form-input" type={type === 'url' ? 'text' : type} required={required} value={form[key]}
        {...(type === 'url' ? { inputMode: 'url' as const, autoComplete: 'url', placeholder: 'yourbusiness.com.au' } : {})}
        onChange={e => setForm({ ...form, [key]: e.target.value })} />
    </div>
  );

  return (
    <div style={{ minHeight: '85vh', padding: '3rem 0 5rem 0' }}>
      <div className="container" style={{ maxWidth: '860px' }}>
        <Link href={`/${club.slug}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          <ArrowLeft size={16} /> Back to {club.name}
        </Link>

        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          {club.logo_url && (
            <img src={club.logo_url} alt="" width={84} height={84} style={{ width: 84, height: 84, objectFit: 'contain', margin: '0 auto 0.85rem', display: 'block' }} />
          )}
          <h1 style={{ fontSize: 'clamp(1.6rem, 6vw, 2.1rem)', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            Sponsor {club.name}
          </h1>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 560, margin: '0 auto' }}>
            {payLinkPackage && paymentNotice !== 'success' && !linkDone
              ? 'Thanks for supporting the club. Pay for your package below, by card or bank transfer.'
              : 'Put your business in front of our players, families and matchday crowd. Choose a package below.'}
          </p>
        </div>

        {/* SP-U6: the businesses already backing the club */}
        {current.length > 0 && !payLink && !sponsorId && !sentToClub && (
          <div className="glass-panel" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
            <p className="text-body" style={{ margin: '0 0 0.75rem' }}>
              Join {current.slice(0, 2).map((s, i) => <React.Fragment key={s.id}>{i > 0 && (current.length === 2 ? ' and ' : ', ')}<strong className="text-primary">{s.name}</strong></React.Fragment>)}
              {current.length > 2 && <> and {current.length - 2} other local {current.length - 2 === 1 ? 'business' : 'businesses'}</>}
              {current.length <= 2 && <> {current.length === 1 ? 'as a club sponsor' : 'as club sponsors'}</>}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
              {current.slice(0, 6).map(s => (
                <span key={s.id} title={s.name} style={{ width: 96, height: 52, borderRadius: 10, background: s.logo_url ? '#fff' : 'rgba(var(--tint-rgb), 0.06)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.4rem' }}>
                  <SponsorLogo src={s.logo_url} name={s.name} height={36} style={{ maxWidth: '100%' }} />
                </span>
              ))}
            </div>
          </div>
        )}

        {paymentNotice === 'success' && (
          <div role="status" className="glass-panel" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', borderLeft: '4px solid #10B981', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            <CheckCircle2 size={18} color="var(--c-green)" /> Payment received, thank you! The club will email you a link to your own sponsor page, where you can send your logo.
          </div>
        )}
        {payLink && packages && !payLinkPackage && (
          <div role="status" className="glass-panel" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', borderLeft: '4px solid #F59E0B', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            <AlertCircle size={18} color="var(--c-amber)" /> That payment link&apos;s package isn&apos;t offered any more. Please contact the club, or pick a package below.
          </div>
        )}
        {paymentNotice === 'cancelled' && (
          <div role="status" className="glass-panel" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', borderLeft: '4px solid #F59E0B', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            <AlertCircle size={18} color="var(--c-amber)" /> Payment was cancelled. Nothing was charged.
          </div>
        )}

        {payLinkPackage && paymentNotice !== 'success' && payLink && linkState === undefined ? (
          <p className="text-muted">Checking your link…</p>
        ) : payLinkPackage && paymentNotice !== 'success' && payLink && linkDone && linkState ? (
          <div role="status" className="glass-panel" style={{ padding: '1.5rem', borderLeft: '4px solid #10B981' }}>
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
              <CheckCircle2 size={18} color="var(--c-green)" /> {linkState.receiptWaiting ? 'Your receipt is with the club' : 'This sponsorship is already paid'}
            </div>
            <p className="text-body" style={{ margin: '0 0 0.75rem' }}>
              {linkState.receiptWaiting
                ? 'There is nothing more to pay until the club has checked your bank transfer.'
                : `Thank you for supporting ${club.name}. There is nothing to pay. Your sponsor page has your invoice, and offers renewal nearer the end date.`}
            </p>
            {payLink.key && (
              <Link href={`/${club.slug}/sponsor/your-sponsorship?k=${payLink.key}`} className="btn btn-primary">Open my sponsor page</Link>
            )}
          </div>
        ) : payLinkPackage && paymentNotice !== 'success' && payLink ? (
          <div className="stack">
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <span className="badge" style={TIER_BADGE[payLinkPackage.tier]}>{sponsorTierLabel(payLinkPackage.tier)}</span>
              <div style={{ fontWeight: 900, fontSize: '1.1rem', color: 'var(--text-primary)', margin: '0.5rem 0 0.25rem' }}>{payLinkPackage.name}</div>
              <div style={{ fontWeight: 800, color: 'var(--club-ink)', marginBottom: '0.5rem' }}>{formatMoney(payLinkPackage.price_cents, currency)}</div>
              {payLinkPackage.benefits && <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{payLinkPackage.benefits}</div>}
            </div>
            <PaymentStep clubId={club.id} kind="sponsorship" sponsorId={payLink.sponsorId} packageId={payLinkPackage.id}
              amountCents={payLinkPackage.price_cents} label={`${payLinkPackage.name} sponsorship`}
              extra={payLink.key ? { sponsorKey: payLink.key } : undefined} />
            <p className="text-note" style={{ margin: 0 }}>Want a different package? Reply to the club&apos;s email or use the contact form on the club site.</p>
          </div>
        ) : sentToClub && selected ? (
          <div role="status" className="glass-panel" style={{ padding: '1.5rem', borderLeft: '4px solid #10B981' }}>
            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
              <CheckCircle2 size={18} color="var(--c-green)" /> Thanks, your details are with {club.name}
            </div>
            <p className="text-body" style={{ margin: 0 }}>Nothing to pay now. The club will reply to {form.contact_email} about the {selected.name} package.</p>
          </div>
        ) : sponsorId && selected ? (
          <div className="stack">
            <PaymentStep clubId={club.id} kind="sponsorship" sponsorId={sponsorId} packageId={selected.id}
              amountCents={selected.price_cents} label={`${selected.name} sponsorship`} />
            {portalKey && (
              <p className="text-note" style={{ margin: 0 }}>
                Your own sponsor page, to send your logo and later see your results and invoice:{' '}
                <Link href={`/${club.slug}/sponsor/your-sponsorship?k=${portalKey}`} style={{ color: 'var(--club-ink)', fontWeight: 700 }}>open and bookmark it</Link>.
                Keep the link private.
              </p>
            )}
          </div>
        ) : packages === null ? (
          <p className="text-muted">Loading packages…</p>
        ) : packages.length === 0 ? (
          <>
            <p className="text-body" style={{ marginBottom: '1rem' }}>The club hasn&apos;t published sponsorship packages yet. Send them a message and they&apos;ll get back to you.</p>
            <ClubContactSection club={club} defaultType="Sponsorship" heading="Ask about sponsoring" />
          </>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              {packages.map(p => (
                <button key={p.id} type="button" onClick={() => setSelected(p)} aria-pressed={selected?.id === p.id}
                  className="glass-panel glass-panel-interactive"
                  style={{ padding: '1.25rem', textAlign: 'left', cursor: 'pointer', border: selected?.id === p.id ? '2px solid var(--club-primary)' : undefined }}>
                  <span className="badge" style={TIER_BADGE[p.tier]}>{sponsorTierLabel(p.tier)}</span>
                  <div style={{ fontWeight: 900, fontSize: '1.1rem', color: 'var(--text-primary)', margin: '0.5rem 0 0.25rem' }}>{p.name}</div>
                  <div style={{ fontWeight: 800, color: 'var(--club-ink)', marginBottom: '0.5rem' }}>{isOnRequest(p) ? 'Price on request' : formatMoney(p.price_cents, currency)}</div>
                  {packageIncludeLines(p.includes).length > 0 && (
                    <>
                      <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.05em', color: 'var(--text-muted)', margin: '0.25rem 0 0.4rem' }}>WHAT&apos;S INCLUDED</div>
                      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        {packageIncludeLines(p.includes).map(line => (
                          <li key={line} style={{ display: 'flex', gap: '0.45rem', alignItems: 'flex-start', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            <Check size={15} color="var(--c-green)" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" /> {line}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {p.benefits && <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{p.benefits}</div>}
                </button>
              ))}
            </div>

            {/* SP-U6: what happens after they pick a package */}
            {!selected && (
              <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.85rem' }}>What happens next</h2>
                <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                  {['Pick a package and pay online', 'Send us your logo from your own sponsor page', 'The club checks it and puts you on the site'].map((step, i) => (
                    <li key={step} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', color: 'var(--text-secondary)' }}>
                      <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-primary)', border: '1px solid var(--club-primary)', background: 'rgba(var(--club-primary-rgb), 0.15)' }}>{i + 1}</span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {selected && (
              <form onSubmit={submit} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>Your details for {selected.name}</div>
                {field('name', 'Business name')}
                {field('contact_name', 'Contact name')}
                {field('contact_email', 'Email', 'email')}
                {field('contact_phone', 'Phone', 'tel', false)}
                {field('website_url', 'Website', 'url', false)}
                {isOnRequest(selected) && (
                  <div className="form-group">
                    <label className="form-label" htmlFor="sponsor-message">What would you like to offer?</label>
                    <textarea id="sponsor-message" className="form-textarea" rows={3} maxLength={2000} value={form.message}
                      placeholder="For example: goods or services, or the budget you have in mind"
                      onChange={e => setForm({ ...form, message: e.target.value })} />
                  </div>
                )}
                {/* Honeypot: hidden from people, filled in by bots */}
                <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.company_website_confirm}
                  onChange={e => setForm({ ...form, company_website_confirm: e.target.value })}
                  style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }} />
                <Captcha ref={captcha} onToken={setCaptchaToken} />
                {error && <p role="alert" style={{ color: 'var(--c-red)', fontSize: '0.85rem' }}>{error}</p>}
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? 'Saving…' : isOnRequest(selected) ? 'Send to the club' : 'Continue to payment'}
                </button>
                {isOnRequest(selected) && <p className="text-note" style={{ margin: 0, textAlign: 'center' }}>No payment now. The club gets your details in their Inbox and replies by email.</p>}
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
