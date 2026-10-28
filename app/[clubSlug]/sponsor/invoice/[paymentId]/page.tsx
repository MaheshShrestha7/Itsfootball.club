'use client';

import React, { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertCircle, Printer } from 'lucide-react';
import { bookingFeeCents, formatMoney } from '@/lib/finance';
import { formatDate } from '@/lib/dates';
import { formatAbn, invoiceLabel } from '@/lib/invoice';

// A sponsorship invoice (SP-F4), on white paper that prints or saves as PDF. GST-registered clubs
// with an ABN issue a "Tax invoice" showing the GST included; other clubs an "Invoice" with no GST.

interface InvoiceData {
  number: number;
  taxInvoice: boolean;
  club: { name: string; logo_url: string | null; primary_color: string | null; contact_email: string | null; address: string | null; abn: string | null; site: string };
  billedTo: { name: string; contact_name: string | null; contact_email: string | null };
  line: { description: string; detail: string | null };
  amount_cents: number;
  gst_cents: number;
  currency: string;
  method: string;
  date: string;
}

const METHOD: Record<string, string> = { stripe: 'card', bank_transfer: 'bank transfer', cash: 'cash', other: 'payment' };

const ink = '#0f172a';
const muted = '#64748b';
const rule = '1px solid #e2e8f0';

export default function SponsorInvoicePage({ params }: { params: Promise<{ clubSlug: string; paymentId: string }> }) {
  const { clubSlug, paymentId } = use(params);
  const [key, setKey] = useState<string | null>(null);
  const [data, setData] = useState<InvoiceData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const k = new URLSearchParams(window.location.search).get('k');
    setKey(k);
    if (!k) return setError('This invoice link is missing its key.');
    fetch(`/api/sponsors/portal/invoice?k=${encodeURIComponent(k)}&payment=${encodeURIComponent(paymentId)}`)
      .then(async res => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'This invoice could not be loaded.');
        setData(json as InvoiceData);
      })
      .catch(err => setError((err as Error).message));
  }, [paymentId]);

  const backHref = `/${clubSlug}/sponsor/your-sponsorship${key ? `?k=${encodeURIComponent(key)}` : ''}`;

  return (
    <div style={{ minHeight: '85vh', padding: '2rem 0 5rem' }}>
      <style>{`
        @media print {
          @page { margin: 14mm; }
          html, body { background: #fff !important; }
          body::before, body::after { display: none !important; }
          header, nav, footer, .club-tabbar, .club-tabbar-spacer { display: none !important; }
          body * { visibility: hidden; }
          .invoice-paper, .invoice-paper * { visibility: visible; }
          .invoice-paper { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; border: none !important; padding: 0 !important; }
        }
      `}</style>
      <div className="container" style={{ maxWidth: '820px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          <Link href={backHref} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <ArrowLeft size={16} /> Your sponsorship
          </Link>
          {data && (
            <button type="button" className="btn btn-primary" onClick={() => window.print()} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <Printer size={15} /> Print or save as PDF
            </button>
          )}
        </div>

        {error ? (
          <div role="alert" className="glass-panel" style={{ padding: '1.25rem', borderLeft: '4px solid #F59E0B', display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
            <AlertCircle size={18} color="var(--c-amber)" style={{ flexShrink: 0, marginTop: 2 }} />
            <span className="text-body">{error}</span>
          </div>
        ) : !data ? (
          <p className="text-muted" role="status">Loading the invoice…</p>
        ) : (
          <article className="invoice-paper" style={{ background: '#fff', color: ink, borderRadius: 14, padding: 'clamp(1.25rem, 5vw, 3rem)', boxShadow: '0 20px 50px rgba(0,0,0,0.35)', fontSize: '0.92rem', lineHeight: 1.5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1.25rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center', minWidth: 0 }}>
                {data.club.logo_url && (
                  <img src={data.club.logo_url} alt="" style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 10, flexShrink: 0 }} />
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: '1.15rem', overflowWrap: 'anywhere' }}>{data.club.name}</div>
                  {data.club.abn && <div style={{ color: muted, fontSize: '0.82rem' }}>ABN {formatAbn(data.club.abn)}</div>}
                  {data.club.address && <div style={{ color: muted, fontSize: '0.82rem' }}>{data.club.address}</div>}
                  {data.club.contact_email && <div style={{ color: muted, fontSize: '0.82rem' }}>{data.club.contact_email}</div>}
                </div>
              </div>
              <div style={{ textAlign: 'right', marginLeft: 'auto' }}>
                <h1 style={{ fontSize: '1.8rem', fontWeight: 900, margin: 0, color: ink }}>{data.taxInvoice ? 'Tax invoice' : 'Invoice'}</h1>
                <div style={{ color: muted, fontSize: '0.85rem' }}>No. {invoiceLabel(data.number)}</div>
                <div style={{ color: muted, fontSize: '0.85rem' }}>Date {formatDate(data.date)}</div>
              </div>
            </div>

            <div style={{ marginBottom: '1.75rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: muted }}>BILLED TO</div>
              <div style={{ fontWeight: 600 }}>{data.billedTo.name}</div>
              {(data.billedTo.contact_name || data.billedTo.contact_email) && (
                <div style={{ color: '#334155', overflowWrap: 'anywhere' }}>{[data.billedTo.contact_name, data.billedTo.contact_email].filter(Boolean).join(' · ')}</div>
              )}
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ fontSize: '0.72rem', letterSpacing: '0.06em', color: muted, textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem 0.5rem 0.5rem 0', borderBottom: rule, fontWeight: 700 }}>DESCRIPTION</th>
                  <th style={{ padding: '0.5rem 0', borderBottom: rule, fontWeight: 700, textAlign: 'right' }}>AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '0.85rem 0.5rem 0.85rem 0', borderBottom: rule }}>
                    {data.line.description}
                    {data.line.detail && <div style={{ color: muted, fontSize: '0.8rem' }}>{data.line.detail}</div>}
                  </td>
                  <td style={{ padding: '0.85rem 0', borderBottom: rule, textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'top' }}>{formatMoney(data.amount_cents, data.currency)}</td>
                </tr>
                <tr>
                  <td style={{ padding: '0.85rem 0.5rem 0.25rem 0', textAlign: 'right', color: '#334155' }}>{data.taxInvoice ? 'Total (includes GST)' : 'Total'}</td>
                  <td style={{ padding: '0.85rem 0 0.25rem', textAlign: 'right', fontWeight: 800, fontSize: '1.05rem', whiteSpace: 'nowrap' }}>{formatMoney(data.amount_cents, data.currency)}</td>
                </tr>
                {data.taxInvoice && (
                  <tr>
                    <td style={{ padding: '0.25rem 0.5rem 0.25rem 0', textAlign: 'right', color: '#334155' }}>GST included</td>
                    <td style={{ padding: '0.25rem 0', textAlign: 'right', whiteSpace: 'nowrap' }}>{formatMoney(data.gst_cents, data.currency)}</td>
                  </tr>
                )}
                <tr>
                  <td style={{ padding: '0.25rem 0.5rem 0.25rem 0', textAlign: 'right', color: '#334155' }}>Paid by {METHOD[data.method] || 'payment'}, {formatDate(data.date)}</td>
                  <td style={{ padding: '0.25rem 0', textAlign: 'right', fontWeight: 800, color: '#059669' }}>PAID</td>
                </tr>
              </tbody>
            </table>

            {!data.taxInvoice && <p style={{ margin: '1.25rem 0 0', color: '#334155' }}>No GST has been charged.</p>}
            {data.method === 'stripe' && bookingFeeCents(data.amount_cents) > 0 && (
              <p style={{ margin: '0.75rem 0 0', color: muted, fontSize: '0.8rem' }}>
                The card booking fee was paid to itsfootball.club, not to the club, so it isn&apos;t part of this invoice.
              </p>
            )}

            <div style={{ marginTop: '2.5rem', paddingTop: '1rem', borderTop: rule, textAlign: 'center', color: '#94a3b8', fontSize: '0.78rem' }}>
              {data.club.name} · {data.club.site}
            </div>
          </article>
        )}
      </div>
    </div>
  );
}
