import Link from 'next/link';
import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { ArrowRight } from 'lucide-react';
import PlatformNavbar from '@/components/PlatformNavbar';
import Footer from '@/components/Footer';
import { CONTACT_EMAIL } from '@/lib/faq';
import { CHECKED_ON, COMPARE_ORDER, COMPARE_ROWS, competitorBySlug } from '@/lib/competitors';
import CellView from './CellView';

export const metadata: Metadata = {
  title: 'itsfootball.club vs Pitchero, Heja, Spond and Teamer',
  description: 'How itsfootball.club compares with Pitchero, Heja, Spond and Teamer on price, ads, club website, live match centre, payments and club shop. Every claim sourced.',
  alternates: { canonical: '/vs' },
};

// Every competitor's sources in one numbered list, in column order
const COLUMNS = COMPARE_ORDER.map(slug => competitorBySlug(slug)!);
const OFFSETS = COLUMNS.map((_, i) => COLUMNS.slice(0, i).reduce((n, c) => n + c.sources.length, 0));
const SOURCES = COLUMNS.flatMap(c => c.sources.map(s => ({ ...s, title: `${c.name}: ${s.title.replace(new RegExp(`^${c.name}\\s*`), '')}` })));

const ctaStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.45rem' };

export default function VsIndexPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PlatformNavbar />

      <main className="container" style={{ padding: '3.5rem 1rem', flex: 1, maxWidth: '1180px' }}>
        <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div className="badge badge-primary" style={{ marginBottom: '0.75rem' }}>HONEST COMPARISON</div>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 2.8rem)', fontWeight: 900, lineHeight: 1.1 }}>
            How itsfootball.club compares
          </h1>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '640px', margin: '0.9rem auto 0', fontSize: '1.05rem', lineHeight: 1.6 }}>
            Pitchero, Heja, Spond and Teamer side by side. Every claim about them links to their own website.
          </p>
        </header>

        <section aria-label="Comparison" className="glass-panel vs-grid-wrap">
          <table className="vs-grid">
            <thead>
              <tr>
                <th scope="col"><span className="sr-only">Feature</span></th>
                <th scope="col" className="vs-us">itsfootball.club</th>
                {COLUMNS.map(c => (
                  <th scope="col" key={c.slug}>
                    {c.name}
                    <Link href={`/vs/${c.slug}`} className="vs-more">{c.closed ? 'Moving on' : 'Full comparison'} <ArrowRight size={12} /></Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map(r => (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  <td className="vs-us"><CellView cell={r.us} /></td>
                  {COLUMNS.map((c, i) => (
                    <td key={c.slug}><CellView cell={r.them[c.slug as (typeof COMPARE_ORDER)[number]]} sourceOffset={OFFSETS[i]} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <p className="vs-swipe">Swipe the table sideways to see every app.</p>

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
          <p style={{ fontWeight: 700, marginBottom: '0.35rem' }}>Sources, checked {CHECKED_ON}</p>
          <ol style={{ paddingLeft: '1.2rem' }}>
            {SOURCES.map((s, i) => (
              <li key={s.url} id={`source-${i + 1}`}>
                <a href={s.url} rel="nofollow noopener" target="_blank" style={{ color: 'var(--club-ink)' }}>{s.title}</a>
              </li>
            ))}
          </ol>
          <p style={{ marginTop: '0.5rem' }}>
            Prices and features change. Spotted something out of date? Email{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--club-ink)' }}>{CONTACT_EMAIL}</a> and we&apos;ll fix it.
          </p>
        </footer>
      </main>

      <Footer />
    </div>
  );
}
