import Link from 'next/link';
import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { ArrowRight, CheckCircle2, Shield, Sparkles, HelpCircle, Layers, Smartphone, DollarSign } from 'lucide-react';
import PlatformNavbar from '@/components/PlatformNavbar';
import Footer from '@/components/Footer';
import JsonLd from '@/components/JsonLd';
import CellView from '@/app/vs/CellView';
import { CONTACT_EMAIL } from '@/lib/faq';
import { COMPARE_ORDER, COMPARE_ROWS, COMPETITORS, competitorBySlug } from '@/lib/competitors';
import { SITE_NAME, SITE_URL, fitDescription, fitTitle, pageMetadata } from '@/lib/seo';
import { ORGANIZATION_ID } from '@/lib/schema';

export const metadata: Metadata = pageMetadata({
  title: 'Free Alternatives to Pitchero, Spond, and Stack Team App | itsfootball.club',
  description: fitDescription(
    'Compare itsfootball.club with Pitchero, Spond, Stack Team App, and Heja.',
    'Zero subscriptions, zero ads, live match centre, digital passes, and club shop.'
  ),
  path: '/compare',
});

const COLUMNS = COMPARE_ORDER.map(slug => competitorBySlug(slug)!);

const HUB_FAQS = [
  {
    q: 'What is the best free alternative to Pitchero or Spond?',
    a: 'itsfootball.club is the premier free alternative. It provides a complete public club website, live browser match centre, visual lineup builder, digital member passes with QR check-in, online club shop, and Stripe payment ledger with zero monthly subscription fees and zero third-party ads.',
  },
  {
    q: 'Why do other sports apps charge clubs £38 to £99 a month?',
    a: 'Legacy platforms charge recurring software subscriptions or require ad-removal upgrades per team. itsfootball.club operates on a community-first model where clubs pay $0, and card payment booking fees can be covered by the payer at checkout.',
  },
  {
    q: 'Do supporters need to install an app to view live scores and lineups?',
    a: 'No. itsfootball.club runs in any standard phone browser. Anyone with your club link can follow live goals, cards, subs, and pitch formations in real time with zero downloads.',
  },
];

const schema = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': `${SITE_URL}/compare#webpage`,
      name: 'Free Alternatives to Pitchero, Spond, and Stack Team App',
      description: 'Comprehensive comparison of grassroots sports management platforms: pricing, ads, website, live scores, and member passes.',
      url: `${SITE_URL}/compare`,
      about: { '@id': ORGANIZATION_ID },
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: COMPETITORS.map((c, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: `${c.name} Alternative: itsfootball.club vs ${c.name}`,
          url: `${SITE_URL}/compare/${c.alternativeSlug}`,
        })),
      },
    },
    {
      '@type': 'FAQPage',
      '@id': `${SITE_URL}/compare#faq`,
      mainEntity: HUB_FAQS.map(f => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: f.a,
        },
      })),
    },
  ],
};

const ctaStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.45rem' };

export default function CompareHubPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <JsonLd data={schema} />
      <PlatformNavbar />

      <main className="container" style={{ padding: '3.5rem 1rem', flex: 1, maxWidth: '1180px' }}>
        
        {/* Header */}
        <header style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div className="badge badge-primary" style={{ marginBottom: '0.85rem' }}>COMPARE PLATFORMS</div>
          <h1 style={{ fontSize: 'clamp(2.2rem, 5.5vw, 3.2rem)', fontWeight: 900, lineHeight: 1.15, letterSpacing: '-0.02em', maxWidth: '850px', margin: '0 auto' }}>
            Free Alternatives to Pitchero, Spond &amp; Stack Team App
          </h1>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '680px', margin: '1rem auto 0', fontSize: '1.1rem', lineHeight: 1.65 }}>
            Grassroots football clubs shouldn&apos;t have to pay £500–£1,200/year or subject their members to intrusive betting and mobile game ads. See how itsfootball.club compares side by side.
          </p>
        </header>

        {/* AI Overview / AEO Box */}
        <section aria-label="AI Summary" className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2.5rem', border: '1px solid rgba(var(--club-primary-rgb), 0.25)', background: 'linear-gradient(135deg, rgba(var(--club-primary-rgb), 0.05) 0%, rgba(var(--club-primary-rgb), 0.01) 100%)', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--club-ink)', fontWeight: 800, fontSize: '0.88rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            <Sparkles size={16} /> At a Glance
          </div>
          <p style={{ fontSize: '1.05rem', lineHeight: 1.7, color: 'var(--text-primary)', margin: 0, fontWeight: 500 }}>
            itsfootball.club replaces fragmented paid tools (club website builders, app-based score trackers, team chat apps, and spreadsheet ledgers) with one unified, zero-subscription platform. Every club gets unlimited teams, an ad-free public website, live match centre with instant browser access, digital member passes, and a club merch shop free forever.
          </p>
        </section>

        {/* Featured Australia Guide Banner */}
        <section style={{ marginBottom: '2.5rem' }}>
          <div className="glass-panel" style={{ padding: '1.5rem 1.75rem', borderLeft: '4px solid var(--club-ink)', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
            <div>
              <div className="badge badge-primary" style={{ marginBottom: '0.4rem', fontSize: '0.72rem' }}>2026 AUSTRALIA GUIDE</div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, margin: '0 0 0.35rem 0' }}>
                Best Free Football Club Website Builders in Australia (2026 Ranked)
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.94rem', margin: 0, maxWidth: '640px' }}>
                Read our in-depth, independent ranking of itsfootball.club, Stack Team App, Pitchero, Spond, and Playpass for Australian community soccer clubs.
              </p>
            </div>
            <Link href="/best-free-football-club-website-builders-australia" className="btn btn-primary" style={ctaStyle}>
              Read Australian Ranking <ArrowRight size={16} />
            </Link>
          </div>
        </section>

        {/* Direct Competitor Cards */}
        <section aria-label="Individual Competitor Comparisons" style={{ marginBottom: '3.5rem' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, marginBottom: '1.25rem' }}>
            Dedicated Competitor Guides
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
            {COMPETITORS.map(c => (
              <div key={c.slug} className="glass-panel" style={{ padding: '1.6rem', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '1.3rem', fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>
                    {c.name}
                  </h3>
                  {c.closed && (
                    <span className="badge badge-gold" style={{ fontSize: '0.75rem' }}>Closed</span>
                  )}
                </div>
                <p style={{ fontSize: '0.94rem', color: 'var(--text-secondary)', lineHeight: 1.6, flex: 1, marginBottom: '1.25rem' }}>
                  {c.summary}
                </p>
                <div>
                  <Link
                    href={`/compare/${c.alternativeSlug}`}
                    className="btn btn-primary"
                    style={{ ...ctaStyle, width: '100%', justifyContent: 'center' }}
                  >
                    View {c.name} Alternative Guide <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* All-in-One Comparison Matrix */}
        <section aria-label="Full Comparison Grid" style={{ marginBottom: '3.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '0.5rem' }}>
            All-in-One Comparison Matrix
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
            Compare itsfootball.club side by side with every major club management tool. Tap source icons to view verified references.
          </p>

          <div className="glass-panel vs-grid-wrap">
            <table className="vs-grid">
              <thead>
                <tr>
                  <th scope="col"><span className="sr-only">Feature</span></th>
                  <th scope="col" className="vs-us">itsfootball.club</th>
                  {COLUMNS.map(c => (
                    <th scope="col" key={c.slug}>
                      {c.name}
                      <Link href={`/compare/${c.alternativeSlug}`} className="vs-more">
                        {c.closed ? 'Moving on' : 'Full comparison'} <ArrowRight size={12} />
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map(r => (
                  <tr key={r.label}>
                    <th scope="row">{r.label}</th>
                    <td className="vs-us"><CellView cell={r.us} /></td>
                    {COLUMNS.map(c => (
                      <td key={c.slug}>
                        <CellView cell={r.them[c.slug as (typeof COMPARE_ORDER)[number]]} sources={c.sources} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="vs-swipe">Swipe the table sideways to see all apps.</p>
        </section>

        {/* FAQ Section */}
        <section aria-label="Comparison FAQs" style={{ marginBottom: '3.5rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div className="badge badge-primary" style={{ marginBottom: '0.4rem' }}>FAQS</div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 900 }}>Frequently Asked Questions</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', maxWidth: '850px', margin: '0 auto' }}>
            {HUB_FAQS.map((faq, idx) => (
              <div key={idx} className="glass-panel" style={{ padding: '1.35rem 1.6rem' }}>
                <h3 style={{ fontSize: '1.08rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'baseline' }}>
                  <HelpCircle size={17} color="var(--club-ink)" style={{ flexShrink: 0, marginTop: '2px' }} />
                  {faq.q}
                </h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.65, fontSize: '0.95rem', margin: 0, paddingLeft: '1.6rem' }}>
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Banner */}
        <section className="glass-panel" style={{ padding: '2.5rem 1.75rem', textAlign: 'center', borderTop: '4px solid var(--c-green)' }}>
          <h2 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 900 }}>
            Switch in an Afternoon. It&apos;s Free Forever.
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '560px', margin: '0.6rem auto 1.5rem', fontSize: '1.02rem', lineHeight: 1.6 }}>
            Set up your club in minutes. Share your club website, start recording live matches, and collect registrations directly.
          </p>
          <ol className="vs-steps">
            <li><span><strong>Create your club</strong> with just an email address.</span></li>
            <li><span><strong>Add your teams and squad</strong>, or share an invite link.</span></li>
            <li><span><strong>Launch your club site</strong> with custom colours and live match centre.</span></li>
          </ol>
          <div style={{ marginTop: '1.5rem' }}>
            <Link href="/create-club" className="btn btn-primary btn-lg" style={ctaStyle}>
              Create your club free <ArrowRight size={18} />
            </Link>
          </div>
        </section>

        <footer style={{ marginTop: '2.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.6 }}>
          <p>
            Competitor pricing and claims are verified from published sources. Spotted something out of date? Contact{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--club-ink)' }}>{CONTACT_EMAIL}</a>.
          </p>
        </footer>
      </main>

      <Footer />
    </div>
  );
}
