import Link from 'next/link';
import type { CSSProperties } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import PlatformNavbar from '@/components/PlatformNavbar';
import Footer from '@/components/Footer';
import JsonLd from '@/components/JsonLd';
import { CONTACT_EMAIL, FAQ } from '@/lib/faq';

const withEmailLink = (text: string) => text.split(CONTACT_EMAIL).flatMap((part, i) =>
  i === 0 ? [part] : [<a key={i} href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--club-primary)', fontWeight: 600 }}>{CONTACT_EMAIL}</a>, part]);

const FREE_POINTS = ['Free to sign up', 'Every feature included', 'No card needed', 'No subscription, ever'];

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.flatMap(s => s.items.map(i => ({
    '@type': 'Question',
    name: i.q,
    acceptedAnswer: { '@type': 'Answer', text: i.a },
  }))),
};

const ctaStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.45rem' };

export default function FaqPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <JsonLd data={faqSchema} />
      <PlatformNavbar />

      <main className="container" style={{ padding: '3.5rem 1rem', flex: 1, maxWidth: '960px' }}>
        {/* Hero */}
        <header style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div className="badge badge-primary" style={{ marginBottom: '0.75rem' }}>FREE FOR EVERY CLUB · EVERY FEATURE</div>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 2.8rem)', fontWeight: 900, lineHeight: 1.1 }}>
            Questions? Here&apos;s why clubs sign up.
          </h1>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0.9rem auto 0', fontSize: '1.05rem', lineHeight: 1.6 }}>
            Club site, matchday tools, member passes, tournaments, finance, sponsors and a club shop. Everything your club needs,
            free to sign up and free to use.
          </p>
          <ul style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.5rem 1.25rem', listStyle: 'none', padding: 0, margin: '1.25rem 0 0' }}>
            {FREE_POINTS.map(p => (
              <li key={p} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.92rem' }}>
                <Check size={16} color="var(--c-green)" /> {p}
              </li>
            ))}
          </ul>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.75rem', marginTop: '1.75rem' }}>
            <Link href="/create-club" className="btn btn-primary btn-lg" style={ctaStyle}>
              Create your club free <ArrowRight size={18} />
            </Link>
            <Link href="/clubs" className="btn btn-secondary btn-lg">Find your club</Link>
          </div>
        </header>

        {/* Role picker */}
        <nav aria-label="FAQ sections" style={{ marginBottom: '3rem' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            I am a…
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            {FAQ.map(({ id, audience, Icon, color, pitch }) => (
              <a key={id} href={`#${id}`} className="glass-panel glass-panel-interactive" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', textDecoration: 'none', borderTop: `3px solid ${color}` }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  <Icon size={18} color={color} /> {audience}
                </span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.45 }}>{pitch}</span>
              </a>
            ))}
          </div>
        </nav>

        {/* Sections */}
        {FAQ.map(({ id, audience, Icon, color, pitch, cta, items }) => (
          <section key={id} id={id} aria-labelledby={`${id}-h`} style={{ marginBottom: '3rem', scrollMarginTop: '90px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '0.75rem 1.5rem', marginBottom: '1rem' }}>
              <div style={{ flex: '1 1 320px' }}>
                <h2 id={`${id}-h`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.45rem', fontWeight: 800 }}>
                  <Icon size={22} color={color} /> {audience}
                </h2>
                <p style={{ color: 'var(--text-secondary)', marginTop: '0.3rem' }}>{pitch}</p>
              </div>
              {cta && (
                <Link href={cta.href} className="btn btn-outline btn-sm" style={ctaStyle}>
                  {cta.label} <ArrowRight size={14} />
                </Link>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {items.map((i, n) => (
                <details key={i.q} open={id === 'pricing' && n === 0} className="glass-panel" style={{ padding: '1rem 1.25rem', borderLeft: `3px solid ${color}` }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--text-primary)' }}>{i.q}</summary>
                  <p style={{ color: 'var(--text-secondary)', marginTop: '0.75rem', lineHeight: 1.65 }}>{withEmailLink(i.a)}</p>
                </details>
              ))}
            </div>
          </section>
        ))}

        {/* Closing CTA */}
        <section className="glass-panel" style={{ padding: '2.25rem 1.5rem', textAlign: 'center', borderTop: '3px solid var(--c-green)' }}>
          <h2 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 900 }}>Ready when you are. It&apos;s free.</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '520px', margin: '0.6rem auto 0', lineHeight: 1.6 }}>
            Sign up in minutes, no card needed, and unlock every feature from day one.
            Still have a question? Ask your club through its page, or email us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--club-primary)', fontWeight: 600 }}>{CONTACT_EMAIL}</a>.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.75rem', marginTop: '1.5rem' }}>
            <Link href="/create-club" className="btn btn-primary btn-lg" style={ctaStyle}>
              Create your club free <ArrowRight size={18} />
            </Link>
            <Link href="/clubs" className="btn btn-secondary btn-lg">Browse clubs</Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
