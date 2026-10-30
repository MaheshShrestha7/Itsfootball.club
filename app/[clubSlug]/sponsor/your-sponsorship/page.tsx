'use client';

import React, { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, AlertCircle, Hourglass, Upload, FileText, Printer, ArrowRight } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { formatMoney } from '@/lib/finance';
import { formatDate } from '@/lib/dates';
import { PACKAGE_INCLUDES, TIER_BADGE, formatEndDate, isPastEndDate, sponsorHref, sponsorLabel, typedWebsite } from '@/lib/sponsors';
import SponsorLogo from '@/components/SponsorLogo';
import type { PortalData } from '@/lib/sponsor-portal-server';

// A sponsor's own private page (SP-F1, SP-F3, SP-F4): their logo and website (changes go to the
// club to check), how often their logo was seen, and their payments with invoices. The link's secret
// (?k=) unlocks it; the club emails it and the admin can copy it from the sponsor's card.

const MAX_LOGO_MB = 2;

const sectionTitle: React.CSSProperties = { fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 1rem' };

export default function SponsorPortalPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const { clubs, selectClubBySlug } = useClub();
  const router = useRouter();
  const club = selectClubBySlug(clubSlug) || clubs[0];

  const [key, setKey] = useState<string | null>(null);
  const [data, setData] = useState<PortalData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [website, setWebsite] = useState('');
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [invoicing, setInvoicing] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  // SPP-2: an invoice due in 14 days, emailed to them too; it opens straight away
  const askForInvoice = async () => {
    if (!key) return;
    setInvoicing(true);
    setInvoiceError(null);
    try {
      const res = await fetch('/api/sponsors/invoice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ k: key }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.paymentId) throw new Error(json.error || 'The invoice could not be made. Please try again.');
      router.push(`/${club.slug}/sponsor/invoice/${json.paymentId}?k=${encodeURIComponent(key)}`);
    } catch (err) {
      setInvoiceError((err as Error).message);
      setInvoicing(false);
    }
  };

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const k = query.get('k');
    setPaid(query.get('payment') === 'success');
    setKey(k);
    if (!k) return setLoadError('This link is missing its key. Use the link from the club\'s email.');
    fetch(`/api/sponsors/portal?k=${encodeURIComponent(k)}`)
      .then(async res => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'This page could not be loaded.');
        setData(json as PortalData);
        setWebsite((json as PortalData).sponsor.pending_website_url || (json as PortalData).sponsor.website_url || '');
      })
      .catch(err => setLoadError((err as Error).message));
  }, []);

  useEffect(() => {
    if (!logo) return setLogoPreview(null);
    const url = URL.createObjectURL(logo);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logo]);

  const pickLogo = (file: File | undefined) => {
    setSendError(null);
    setSent(false);
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) return setSendError('Please pick a PNG, JPG, WebP or GIF image.');
    if (file.size > MAX_LOGO_MB * 1024 * 1024) return setSendError(`The logo must be ${MAX_LOGO_MB} MB or smaller.`);
    setLogo(file);
  };

  // Compared with what the club last heard: a website already sent and waiting counts as sent
  const currentWebsite = data ? data.sponsor.pending_website_url || data.sponsor.website_url || '' : '';
  const websiteChanged = !!data && !!website.trim() && website.trim() !== currentWebsite && typedWebsite(website) !== currentWebsite;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key || !data || (!logo && !websiteChanged)) return;
    if (website.trim() && !typedWebsite(website)) return setSendError('That website address doesn\'t look right.');
    setSending(true);
    setSendError(null);
    try {
      const body = new FormData();
      body.set('k', key);
      if (logo) body.set('logo', logo);
      if (websiteChanged) body.set('website', website.trim());
      const res = await fetch('/api/sponsors/portal', { method: 'POST', body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not send that to the club.');
      setData({ ...data, sponsor: { ...data.sponsor, pending_logo_url: json.pending_logo_url, pending_website_url: json.pending_website_url, pending_sent_at: json.pending_sent_at } });
      setLogo(null);
      if (json.pending_website_url) setWebsite(json.pending_website_url);
      if (fileInput.current) fileInput.current.value = '';
      setSent(true);
    } catch (err) {
      setSendError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  if (loadError || !data) {
    return (
      <div style={{ minHeight: '70vh', padding: '3rem 0 5rem' }}>
        <div className="container" style={{ maxWidth: '720px' }}>
          {loadError ? (
            <div role="alert" className="glass-panel" style={{ padding: '1.25rem', borderLeft: '4px solid #F59E0B', display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
              <AlertCircle size={18} color="var(--c-amber)" style={{ flexShrink: 0, marginTop: 2 }} />
              <span className="text-body">{loadError} You can also contact the club from <Link href={`/${club.slug}`} style={{ color: 'var(--club-ink)', fontWeight: 700 }}>{club.name}&apos;s site</Link>.</span>
            </div>
          ) : (
            <p className="text-muted" role="status">Loading your sponsorship…</p>
          )}
        </div>
      </div>
    );
  }

  const { sponsor, results, payments } = data;
  // Older servers (before OSE-9) send no atGround
  const atGround = data.atGround ?? { places: [], checkins: null, tickets: null, passMembers: null, posterPrints: null, posterScans: null };
  const groundCounts = ([
    [atGround.checkins, 'Check-ins at the gate, with your logo on the poster or screen'],
    [atGround.tickets, 'Event tickets issued with your logo'],
    [atGround.passMembers, 'Members with your logo on their pass'],
    [atGround.posterPrints, 'Times a poster or flyer with your logo was printed'],
    [atGround.posterScans, 'Scans of the QR code on those posters and flyers'],
  ] as const).filter(([value]) => value !== null && value !== undefined);
  const maxSeen = Math.max(1, ...results.byPlacement.map(p => p.seen));
  const pendingNote = sponsor.pending_sent_at && (sponsor.pending_logo_url || sponsor.pending_website_url);
  const sentWhat = [sponsor.pending_logo_url && 'New logo', sponsor.pending_website_url && (sponsor.pending_logo_url ? 'website' : 'New website')].filter(Boolean).join(' and ');

  return (
    <div style={{ minHeight: '85vh', padding: '2.5rem 0 5rem' }}>
      <style>{`
        .sponsor-print-only { display: none; }
        @media print {
          html, body { background: #fff !important; }
          body::before, body::after { display: none !important; }
          header, nav, footer, .club-tabbar, .club-tabbar-spacer { display: none !important; }
          body * { visibility: hidden; }
          .sponsor-print, .sponsor-print * { visibility: visible; color: #111 !important; border-color: #ddd !important; box-shadow: none !important; }
          .sponsor-print { position: absolute; left: 0; top: 0; width: 100%; background: #fff !important; backdrop-filter: none !important; }
          .sponsor-print .sponsor-print-only { display: block; }
          .sponsor-print .sponsor-no-print { display: none !important; }
          .sponsor-print .sponsor-bar { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `}</style>
      <div className="container" style={{ maxWidth: '720px' }}>
        <Link href={`/${club.slug}`} style={{ display: 'flex', width: 'fit-content', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
          <ArrowLeft size={16} /> {data.club.name}
        </Link>

        <span className="badge" style={TIER_BADGE[sponsor.tier]}>{sponsorLabel(sponsor)}</span>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.6rem 0 0.4rem', overflowWrap: 'anywhere' }}>{sponsor.name}</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          Your sponsorship page with {data.club.name}. Keep this link private: anyone with it can see this page.
        </p>

        {paid && (
          <div role="status" className="glass-panel" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem', borderLeft: '4px solid #10B981', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            <CheckCircle2 size={18} color="var(--c-green)" style={{ flexShrink: 0 }} /> Payment received, thank you! Bookmark this page: it&apos;s where you send your logo and see your results.
          </div>
        )}

        <div className="stack">
          {/* SP-F1: logo and website */}
          <form onSubmit={send} className="glass-panel" style={{ padding: '1.5rem' }}>
            <h2 style={sectionTitle}>Your logo and website</h2>
            <p className="text-meta" style={{ margin: '-0.6rem 0 1rem' }}>
              {sponsor.on_site
                ? `Your logo is on the club's site${sponsor.ends_on ? ` until ${formatEndDate(sponsor.ends_on)}` : ''}.`
                : 'Your logo isn\'t on the club\'s site right now. The club puts it on once everything is ready.'}
            </p>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
              {/* White behind a logo, like most sponsors' artwork expects; their initials show on the panel itself */}
              <div style={{ width: 150, height: 96, borderRadius: 12, background: logoPreview || sponsor.pending_logo_url || sponsor.logo_url ? '#fff' : 'rgba(var(--tint-rgb), 0.05)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.6rem', flexShrink: 0 }}>
                {logoPreview || sponsor.pending_logo_url
                  ? <img src={logoPreview || sponsor.pending_logo_url!} alt="Your new logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  : <SponsorLogo src={sponsor.logo_url} name={sponsor.name} height={64} style={{ maxWidth: '100%' }} loading="eager" />}
              </div>
              {data.canSend && (
                <div style={{ flex: '1 1 180px' }}>
                  <label className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                    <Upload size={15} /> {logo ? 'Pick a different logo' : 'Upload a new logo'}
                    <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only"
                      onChange={e => pickLogo(e.target.files?.[0])} />
                  </label>
                  <p className="text-meta" style={{ margin: '0.4rem 0 0' }}>PNG, ideally on a clear background. Up to {MAX_LOGO_MB} MB.</p>
                </div>
              )}
            </div>

            {data.canSend ? (
              <>
                <div className="form-group">
                  <label className="form-label" htmlFor="sponsor-website">Website</label>
                  <input id="sponsor-website" className="form-input" type="text" inputMode="url" autoComplete="url" placeholder="yourbusiness.com.au"
                    value={website} onChange={e => { setWebsite(e.target.value); setSent(false); }} />
                </div>
                {sendError && <p role="alert" style={{ color: 'var(--c-red)', fontSize: '0.85rem', margin: '0.5rem 0 0' }}>{sendError}</p>}
                {(logo || websiteChanged) && (
                  <button type="submit" className="btn btn-primary" disabled={sending} style={{ marginTop: '0.75rem' }}>
                    {sending ? 'Sending…' : 'Send to the club'}
                  </button>
                )}
                {pendingNote && (
                  <p role="status" style={{ display: 'flex', gap: '0.45rem', alignItems: 'flex-start', color: 'var(--c-amber)', fontSize: '0.88rem', margin: '0.9rem 0 0' }}>
                    <Hourglass size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>{sent ? 'Sent. ' : ''}{sentWhat} sent {formatDate(sponsor.pending_sent_at)}. The club will check it before it goes on the site.</span>
                  </p>
                )}
                {/* SPE-17: what the club did with what they last sent */}
                {!pendingNote && !sent && sponsor.change_reviewed && sponsor.change_reviewed_at && (
                  <p role="status" style={{ display: 'flex', gap: '0.45rem', alignItems: 'flex-start', color: sponsor.change_reviewed === 'used' ? 'var(--c-green)' : 'var(--text-secondary)', fontSize: '0.88rem', margin: '0.9rem 0 0' }}>
                    {sponsor.change_reviewed === 'used' ? <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 2 }} /> : <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />}
                    <span>{sponsor.change_reviewed === 'used'
                      ? `The club put what you sent on their site on ${formatDate(sponsor.change_reviewed_at)}.`
                      : `On ${formatDate(sponsor.change_reviewed_at)} the club kept what was already on their site. Contact them if you'd like to know why, or send a different one.`}</span>
                  </p>
                )}
              </>
            ) : (
              <p className="text-body" style={{ margin: 0 }}>
                {sponsor.website_url && <>Website: <a href={sponsorHref(sponsor.website_url)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--club-ink)' }}>{sponsor.website_url}</a>. </>}
                To change your logo or website, {data.club.contact_email ? <a href={`mailto:${data.club.contact_email}`} style={{ color: 'var(--club-ink)', fontWeight: 700 }}>email the club</a> : 'contact the club'}.
              </p>
            )}
          </form>

          {/* SP-F3: results */}
          <section className="glass-panel sponsor-print" style={{ padding: '1.5rem' }} aria-labelledby="sponsor-results">
            <div className="sponsor-print-only" style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 900 }}>{sponsor.name}</div>
              <div>Sponsor of {data.club.name}</div>
            </div>
            <h2 id="sponsor-results" style={{ ...sectionTitle, marginBottom: '0.25rem' }}>Your results this season</h2>
            <p className="text-meta" style={{ margin: '0 0 1rem' }}>Since {formatDate(results.since)}, on {data.club.name}&apos;s website.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
              {[
                [results.seen, 'Times your logo was seen'],
                [results.people, 'People who saw it (estimate)'],
                [results.clicks, 'Clicks to your website'],
              ].map(([value, label]) => (
                <div key={label} className="glass-panel" style={{ padding: '1rem' }}>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.7rem', fontWeight: 900, color: 'var(--text-primary)' }}>{Number(value).toLocaleString('en-AU')}</div>
                  <div className="text-meta">{label}</div>
                </div>
              ))}
            </div>
            {results.byPlacement.length > 0 ? (
              <>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.75rem' }}>Where people saw you</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginBottom: '1rem' }}>
                  {results.byPlacement.map(p => (
                    <div key={p.placement}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.88rem', marginBottom: '0.3rem' }}>
                        <span className="text-secondary">{p.label}</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
                          {p.seen.toLocaleString('en-AU')}{p.clicks > 0 && <span className="text-muted" style={{ fontWeight: 500 }}> · {p.clicks.toLocaleString('en-AU')} {p.clicks === 1 ? 'click' : 'clicks'}</span>}
                        </span>
                      </div>
                      <div style={{ height: 8, background: 'rgba(var(--tint-rgb), 0.08)', borderRadius: 4, overflow: 'hidden' }}>
                        <div className="sponsor-bar" style={{ width: `${Math.max(3, Math.round((p.seen / maxSeen) * 100))}%`, height: '100%', background: 'var(--club-primary)', borderRadius: 4 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-body" style={{ marginBottom: '1rem' }}>No views yet. They show here once your logo is on the club&apos;s site.</p>
            )}
            <p className="text-note" style={{ margin: '0 0 1rem' }}>
              People are counted by device, so someone on their phone and laptop counts twice.
            </p>

            {/* OSE-9: at the ground and in print, only the places their package includes now */}
            {atGround.places.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.25rem' }}>At the ground and in print</h3>
                <p className="text-meta" style={{ margin: '0 0 0.75rem' }}>Your logo is on:</p>
                <ul style={{ margin: '0 0 1rem', paddingLeft: '1.2rem', display: 'grid', gap: '0.3rem' }} className="text-body">
                  {atGround.places.map(place => (
                    <li key={place}>{PACKAGE_INCLUDES.find(i => i.key === place)?.card ?? place}</li>
                  ))}
                </ul>
                {groundCounts.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    {groundCounts.map(([value, label]) => (
                      <div key={label} className="glass-panel" style={{ padding: '1rem' }}>
                        <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.7rem', fontWeight: 900, color: 'var(--text-primary)' }}>{Number(value).toLocaleString('en-AU')}</div>
                        <div className="text-meta">{label}</div>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-note" style={{ margin: 0 }}>
                  {groundCounts.some(([value, label]) => value !== null && !label.startsWith('Members')) && <>Counts are since {formatDate(results.since)}. </>}
                  {atGround.places.some(p => p === 'event_tickets' || p === 'member_pass' || p === 'checkin_screen') && <>Times your logo was seen on tickets, passes and the check-in screen are counted in &quot;Where people saw you&quot; above. </>}
                  {atGround.places.some(p => p === 'checkin_posters' || p === 'thanks_poster' || p === 'event_flyers') && <>For posters and flyers we count prints and QR scans only, because nobody can tell how many people walked past them. </>}
                  {atGround.places.includes('potm_graphic') && <>Shared Player of the Match graphics aren&apos;t counted.</>}
                </p>
              </div>
            )}
            <button type="button" className="btn btn-secondary sponsor-no-print" onClick={() => window.print()} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <Printer size={15} /> Save as PDF
            </button>
          </section>

          {/* SP-F4: payments and invoices */}
          <section className="glass-panel" style={{ padding: '1.5rem' }} aria-labelledby="sponsor-payments">
            <h2 id="sponsor-payments" style={sectionTitle}>Payments</h2>
            {payments.length === 0 ? (
              <p className="text-body" style={{ margin: 0 }}>No payments yet. Paid the club in person or by direct deposit? Your invoice shows here once they record it.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                {payments.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.packageName ? `${p.packageName}${p.renewal ? ' renewal' : ''}` : p.description || 'Sponsorship'}</div>
                      {p.period && <div className="text-meta">Covers {p.period}</div>}
                      <div className="text-meta" style={p.status === 'pending' ? { color: 'var(--c-amber)' } : undefined}>
                        {p.status === 'paid'
                          ? `Paid ${formatDate(p.paid_at || p.created_at)} · ${formatMoney(p.amount_cents, p.currency)}`
                          : p.status === 'pending'
                            ? `${formatMoney(p.amount_cents, p.currency)} due${p.due_on ? ` by ${formatEndDate(p.due_on)}` : ''}`
                            : `${formatMoney(p.amount_cents, p.currency)} · the club is checking your bank transfer`}
                      </div>
                    </div>
                    {/* SPP-2: an invoice sent before payment opens too, with how to pay it */}
                    {(p.status === 'paid' || p.due_on) && key && (
                      <Link href={`/${club.slug}/sponsor/invoice/${p.id}?k=${encodeURIComponent(key)}`} className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <FileText size={14} /> {p.taxInvoice ? 'Tax invoice' : 'Invoice'}
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
            {/* SPP-2: their bookkeeper needs an invoice before paying */}
            {data.canInvoice && key && (
              <div style={{ marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary btn-sm" disabled={invoicing} onClick={askForInvoice}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <FileText size={14} /> {invoicing ? 'Making your invoice…' : 'Get an invoice to pay later'}
                </button>
                {invoiceError && <p role="alert" style={{ color: 'var(--c-red)', fontSize: '0.85rem', margin: '0.5rem 0 0' }}>{invoiceError}</p>}
              </div>
            )}
            {sponsor.ends_on && (
              <p className="text-body" style={{ margin: '1rem 0 0' }}>
                {data.renewLink ? (
                  <>
                    {isPastEndDate(sponsor) ? 'Ended' : 'Ends'} on {formatEndDate(sponsor.ends_on)}.{' '}
                    <a href={data.renewLink} style={{ color: 'var(--club-ink)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      Renew for another year <ArrowRight size={14} />
                    </a>
                  </>
                ) : `Your sponsorship runs until ${formatEndDate(sponsor.ends_on)}.`}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
