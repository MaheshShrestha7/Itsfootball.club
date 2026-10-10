import Link from 'next/link';
import PlatformNavbar from '@/components/PlatformNavbar';
import Footer from '@/components/Footer';
import { LEGAL_UPDATED } from '@/lib/legal';

export type LegalSection = { id: string; heading: string; body: React.ReactNode };

/** Shared shell for /privacy and /terms: title, summary, contents list and numbered sections */
export default function LegalPage({ title, summary, sections, other }: {
  title: string;
  summary: React.ReactNode;
  sections: LegalSection[];
  /** The sibling legal page, linked under the title */
  other: { label: string; href: string };
}) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PlatformNavbar />
      <main className="container legal-page" style={{ padding: '3.5rem 1rem', flex: 1, maxWidth: '780px' }}>
        <header style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 2.6rem)', fontWeight: 900, lineHeight: 1.1 }}>{title}</h1>
          <p className="text-meta" style={{ marginTop: '0.6rem' }}>
            Last updated {LEGAL_UPDATED} · See also <Link href={other.href} style={{ color: 'var(--club-primary)', fontWeight: 600 }}>{other.label}</Link>
          </p>
          <div style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', lineHeight: 1.65, marginTop: '1.25rem' }}>{summary}</div>
        </header>

        <nav aria-label="Contents" className="glass-panel" style={{ padding: '1.25rem 1.5rem', marginBottom: '2.5rem' }}>
          <p style={{ fontWeight: 800, marginBottom: '0.6rem' }}>Contents</p>
          <ol style={{ margin: 0, paddingLeft: '1.25rem', columns: '2 260px', columnGap: '2rem', lineHeight: 1.9, fontSize: '0.92rem' }}>
            {sections.map(s => (
              <li key={s.id}><a href={`#${s.id}`} style={{ color: 'var(--text-secondary)' }}>{s.heading}</a></li>
            ))}
          </ol>
        </nav>

        {sections.map((s, i) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} style={{ marginBottom: '2.25rem', scrollMarginTop: '90px' }}>
            <h2 id={`${s.id}-h`} style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.75rem' }}>
              {i + 1}. {s.heading}
            </h2>
            <div style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{s.body}</div>
          </section>
        ))}
      </main>
      <Footer />
    </div>
  );
}
