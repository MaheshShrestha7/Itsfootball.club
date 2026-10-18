import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import CellView, { SourceLink } from '../CellView';
import PlatformNavbar from '@/components/PlatformNavbar';
import Footer from '@/components/Footer';
import { CONTACT_EMAIL } from '@/lib/faq';
import { CHECKED_ON, COMPETITORS, competitorBySlug, type Competitor } from '@/lib/competitors';
import JsonLd from '@/components/JsonLd';
import { ORGANIZATION_ID } from '@/lib/schema';
import { SITE_NAME, SITE_URL, fitDescription, fitTitle, pageMetadata } from '@/lib/seo';

export const dynamicParams = false;
export const generateStaticParams = () => COMPETITORS.map(c => ({ competitor: c.slug }));

type Props = { params: Promise<{ competitor: string }> };

// Leads with "<name> alternative", the query people switching actually search
const titleFor = (c: Competitor) =>
  c.closed ? fitTitle(`${c.name} Alternative After ${c.name} Closed`, SITE_NAME) : fitTitle(`${c.name} Alternative: ${SITE_NAME} vs ${c.name}`);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = competitorBySlug((await params).competitor);
  if (!c) return {};
  return pageMetadata({ title: titleFor(c), description: fitDescription(c.summary), path: `/vs/${c.slug}` });
}

// Ties the page to the platform entity, the same way the /vs hub does
const schemaFor = (c: Competitor) => ({
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: titleFor(c),
  description: c.summary,
  url: `${SITE_URL}/vs/${c.slug}`,
  about: { '@id': ORGANIZATION_ID },
  mentions: { '@type': 'SoftwareApplication', name: c.name },
  isPartOf: { '@type': 'WebPage', url: `${SITE_URL}/vs` },
});

const ctaStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.45rem' };

export default async function VsPage({ params }: Props) {
  const c = competitorBySlug((await params).competitor);
  if (!c) notFound();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <JsonLd data={schemaFor(c)} />
      <PlatformNavbar />

      <main className="container" style={{ padding: '3.5rem 1rem', flex: 1, maxWidth: '960px' }}>
        <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div className={`badge ${c.closed ? 'badge-gold' : 'badge-primary'}`} style={{ marginBottom: '0.75rem' }}>
            {c.closed ? `${c.name.toUpperCase()} HAS CLOSED` : 'HONEST COMPARISON'}
          </div>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 2.8rem)', fontWeight: 900, lineHeight: 1.1 }}>
            {c.closed ? <>Moving on from {c.name}?</> : <>itsfootball.club <span style={{ color: 'var(--text-muted)' }}>vs</span> {c.name}</>}
          </h1>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '640px', margin: '0.9rem auto 0', fontSize: '1.05rem', lineHeight: 1.6 }}>
            {c.summary}
          </p>
          <p className="tool-updated" style={{ marginTop: '0.85rem' }}>
            Last reviewed &amp; verified: <time dateTime="2026-10-18">{CHECKED_ON}</time>
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.75rem', marginTop: '1.5rem' }}>
            <Link href="/create-club" className="btn btn-primary btn-lg" style={ctaStyle}>
              Create your club free <ArrowRight size={18} />
            </Link>
            <Link href="/faq" className="btn btn-secondary btn-lg">Read the FAQ</Link>
          </div>
        </header>

        {c.closed && (
          <div className="glass-panel" role="note" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start', borderLeft: '3px solid var(--c-amber)' }}>
            <AlertTriangle size={20} color="var(--c-amber)" style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text-primary)' }}>{c.name} closed on {c.closed.on}.</strong> {c.closed.note}
              <SourceLink source={c.sources[0]} />
            </p>
          </div>
        )}

        <section aria-label="Comparison" className="glass-panel vs-table">
          <div className="vs-row vs-head">
            <span />
            <span className="vs-us">itsfootball.club</span>
            <span>{c.name}</span>
          </div>
          {c.rows.map(r => (
            <div key={r.label} className="vs-row">
              <span className="vs-label">{r.label}</span>
              <span className="vs-us" data-col="itsfootball.club"><CellView cell={r.us} /></span>
              <span data-col={c.name}><CellView cell={r.them} sources={c.sources} /></span>
            </div>
          ))}
        </section>

        {c.theirStrengths.length > 0 && (
          <section className="glass-panel" style={{ padding: '1.25rem 1.5rem', marginTop: '1.5rem', borderTop: '3px solid var(--c-blue)' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.6rem' }}>Where {c.name} is stronger</h2>
            <ul style={{ color: 'var(--text-secondary)', lineHeight: 1.7, paddingLeft: '1.1rem' }}>
              {c.theirStrengths.map(s => <li key={s}>{s}</li>)}
            </ul>
          </section>
        )}

        <section className="glass-panel" style={{ padding: '2.25rem 1.5rem', marginTop: '1.5rem', textAlign: 'center', borderTop: '3px solid var(--c-green)' }}>
          <h2 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 900 }}>Switch in an afternoon. It&apos;s free.</h2>
          <ol className="vs-steps">
            <li><span><strong>Create your club</strong> with just an email.</span></li>
            <li><span><strong>Add your teams and squad</strong>, or invite players to join.</span></li>
            <li><span><strong>Share your club link</strong>. Fans follow in the browser, no app.</span></li>
          </ol>
          <Link href="/create-club" className="btn btn-primary btn-lg" style={ctaStyle}>
            Create your club free <ArrowRight size={18} />
          </Link>
        </section>

        <footer style={{ marginTop: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.6 }}>
          <p>
            Prices and features change. Spotted something out of date? Email{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--club-ink)' }}>{CONTACT_EMAIL}</a> and we&apos;ll fix it.
          </p>
        </footer>
      </main>

      <Footer />
    </div>
  );
}
