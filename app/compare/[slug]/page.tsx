import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  Shield,
  Sparkles,
  Zap,
  ExternalLink,
  ChevronRight,
  Smartphone,
  CreditCard,
  QrCode,
  Trophy,
} from 'lucide-react';
import PlatformNavbar from '@/components/PlatformNavbar';
import Footer from '@/components/Footer';
import JsonLd from '@/components/JsonLd';
import CellView, { SourceLink } from '@/app/vs/CellView';
import { CONTACT_EMAIL } from '@/lib/faq';
import {
  COMPETITORS,
  competitorBySlugOrAlternative,
  ALL_COMPARE_SLUGS,
  type Competitor,
} from '@/lib/competitors';
import { ORGANIZATION_ID } from '@/lib/schema';
import { SITE_NAME, SITE_URL, fitDescription, fitTitle, pageMetadata } from '@/lib/seo';

export const dynamicParams = false;
export const generateStaticParams = () => ALL_COMPARE_SLUGS.map(slug => ({ slug }));

type Props = { params: Promise<{ slug: string }> };

const titleFor = (c: Competitor) =>
  c.closed
    ? fitTitle(`${c.name} Alternative After ${c.name} Closed`, SITE_NAME)
    : fitTitle(`Free ${c.name} Alternative: ${SITE_NAME} vs ${c.name}`);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = competitorBySlugOrAlternative((await params).slug);
  if (!c) return {};
  const canonicalPath = `/compare/${c.alternativeSlug}`;
  return pageMetadata({
    title: titleFor(c),
    description: fitDescription(
      c.aiOverview,
      c.summary,
      'Compare pricing, ads, match centre, and digital passes.'
    ),
    path: canonicalPath,
  });
}

function schemaFor(c: Competitor) {
  const pageUrl = `${SITE_URL}/compare/${c.alternativeSlug}`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: titleFor(c),
        description: c.aiOverview,
        about: { '@id': ORGANIZATION_ID },
        mentions: { '@type': 'SoftwareApplication', name: c.name },
        breadcrumb: { '@id': `${pageUrl}#breadcrumb` },
        isPartOf: { '@type': 'WebSite', url: SITE_URL, name: SITE_NAME },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${pageUrl}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Compare Alternatives', item: `${SITE_URL}/compare` },
          { '@type': 'ListItem', position: 3, name: `${c.name} Alternative`, item: pageUrl },
        ],
      },
      {
        '@type': 'FAQPage',
        '@id': `${pageUrl}#faq`,
        mainEntity: c.faqs.map(f => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: {
            '@type': 'Answer',
            text: f.a,
          },
        })),
      },
      {
        '@type': 'SoftwareApplication',
        name: SITE_NAME,
        url: SITE_URL,
        applicationCategory: 'SportsApplication',
        operatingSystem: 'Any (Web browser on iPhone, Android, Tablet, Desktop)',
        description: 'Zero-subscription football & soccer club management platform with an ad-free public club website, live match centre, digital passes, and club shop.',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'AUD',
          description: 'Free for clubs with every feature included.',
        },
      },
    ],
  };
}

const ctaStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.45rem' };

export default async function CompareAlternativePage({ params }: Props) {
  const { slug } = await params;
  const c = competitorBySlugOrAlternative(slug);
  if (!c) notFound();

  const otherCompetitors = COMPETITORS.filter(comp => comp.slug !== c.slug);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <JsonLd data={schemaFor(c)} />
      <PlatformNavbar />

      {/* Breadcrumb Navigation for SEO & Users */}
      <nav aria-label="Breadcrumb" className="container" style={{ padding: '1rem 1rem 0', maxWidth: '1040px' }}>
        <ol style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem', listStyle: 'none', padding: 0, margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <li><Link href="/" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Home</Link></li>
          <li><ChevronRight size={13} /></li>
          <li><Link href="/compare" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Compare</Link></li>
          <li><ChevronRight size={13} /></li>
          <li style={{ color: 'var(--club-ink)', fontWeight: 600 }}>{c.name} Alternative</li>
        </ol>
      </nav>

      <main className="container" style={{ padding: '2rem 1rem 4rem', flex: 1, maxWidth: '1040px' }}>
        
        {/* Hero Section */}
        <header style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div className={`badge ${c.closed ? 'badge-gold' : 'badge-primary'}`} style={{ marginBottom: '0.85rem' }}>
            {c.closed ? `${c.name.toUpperCase()} HAS CLOSED` : `FREE ${c.name.toUpperCase()} ALTERNATIVE`}
          </div>
          <h1 style={{ fontSize: 'clamp(2.1rem, 5.5vw, 3.1rem)', fontWeight: 900, lineHeight: 1.15, letterSpacing: '-0.02em', maxWidth: '880px', margin: '0 auto' }}>
            {c.closed ? (
              <>Looking for a Free Alternative to <span style={{ color: 'var(--c-amber)' }}>{c.name}</span>?</>
            ) : (
              <>The 100% Free <span style={{ color: 'var(--club-ink)' }}>{c.name}</span> Alternative for Football Clubs</>
            )}
          </h1>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '680px', margin: '1.1rem auto 0', fontSize: '1.1rem', lineHeight: 1.65 }}>
            {c.summary}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.85rem', marginTop: '1.75rem' }}>
            <Link href="/create-club" className="btn btn-primary btn-lg" style={ctaStyle}>
              Create your club free <ArrowRight size={18} />
            </Link>
            <Link href="/faq" className="btn btn-secondary btn-lg">Read FAQs</Link>
          </div>
        </header>

        {/* Closed competitor banner */}
        {c.closed && (
          <div className="glass-panel" role="note" style={{ padding: '1.1rem 1.4rem', marginBottom: '2rem', display: 'flex', gap: '0.85rem', alignItems: 'flex-start', borderLeft: '4px solid var(--c-amber)' }}>
            <AlertTriangle size={22} color="var(--c-amber)" style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              <strong style={{ color: 'var(--text-primary)' }}>{c.name} officially shut down on {c.closed.on}.</strong> {c.closed.note}{' '}
              <SourceLink source={c.sources[0]} />
            </p>
          </div>
        )}

        {/* AI Overview / AEO Quotable Summary Box */}
        <section aria-label="AI Summary" className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2.5rem', border: '1px solid rgba(var(--club-primary-rgb), 0.25)', background: 'linear-gradient(135deg, rgba(var(--club-primary-rgb), 0.05) 0%, rgba(var(--club-primary-rgb), 0.01) 100%)', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem', color: 'var(--club-ink)', fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            <Sparkles size={16} /> Quick Answer / Overview
          </div>
          <p style={{ fontSize: '1.05rem', lineHeight: 1.7, color: 'var(--text-primary)', margin: 0, fontWeight: 500 }}>
            {c.aiOverview}
          </p>
        </section>

        {/* Key Takeaways Grid */}
        <section aria-label="Key Takeaways" style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, marginBottom: '1.25rem' }}>
            Key Differences at a Glance
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {c.keyTakeaways.map((takeaway, idx) => (
              <div key={idx} className="glass-panel" style={{ padding: '1.25rem', display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                <CheckCircle2 size={20} color="var(--c-green)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                  {takeaway}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Side-by-Side Structured Comparison Table */}
        <section aria-label="Full Comparison Table" style={{ marginBottom: '3.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0 }}>
                Feature Comparison: itsfootball.club vs {c.name}
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '0.25rem 0 0' }}>
                Every competitor claim is verified against their published pricing and documentation.
              </p>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Verified October 2026</span>
          </div>

          <div className="glass-panel vs-table">
            <div className="vs-row vs-head">
              <span>Feature</span>
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
          </div>
        </section>

        {/* Deep Dive Pillars: Subscriptions, Ads, Match Centre, Stripe Ledger */}
        {c.featureHighlights && c.featureHighlights.length > 0 && (
          <section aria-label="Feature Deep Dive" style={{ marginBottom: '3.5rem' }}>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 900, marginBottom: '1.5rem' }}>
              Why Football Clubs Choose itsfootball.club over {c.name}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '1.25rem' }}>
              {c.featureHighlights.map((feat, idx) => (
                <div key={idx} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                    {feat.title}
                  </h3>
                  <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.6, flex: 1 }}>
                    {feat.description}
                  </p>
                  <div style={{ marginTop: '1rem', padding: '0.75rem 0.9rem', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--border-medium)', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    <strong style={{ color: 'var(--text-secondary)' }}>Contrast:</strong> {feat.comparison}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Transparent Assessment: Where Competitor is Stronger */}
        {c.theirStrengths.length > 0 && (
          <section aria-label="Objective Review" className="glass-panel" style={{ padding: '1.5rem 1.75rem', marginBottom: '3.5rem', borderTop: '3px solid var(--c-blue)' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.75rem' }}>
              Honest Assessment: Where {c.name} is stronger
            </h2>
            <p style={{ fontSize: '0.92rem', color: 'var(--text-muted)', marginBottom: '0.85rem' }}>
              We believe in honest, fair comparisons. Here are areas where {c.name} holds advantages:
            </p>
            <ul style={{ color: 'var(--text-secondary)', lineHeight: 1.7, paddingLeft: '1.2rem', margin: 0 }}>
              {c.theirStrengths.map((s, idx) => <li key={idx}>{s}</li>)}
            </ul>
          </section>
        )}

        {/* High-Intent FAQ Section (AEO / GEO Schema) */}
        {c.faqs && c.faqs.length > 0 && (
          <section aria-label="Frequently Asked Questions" style={{ marginBottom: '3.5rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
              <div className="badge badge-primary" style={{ marginBottom: '0.5rem' }}>FAQ</div>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 900 }}>
                Frequently Asked Questions: itsfootball.club vs {c.name}
              </h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              {c.faqs.map((faq, idx) => (
                <div key={idx} className="glass-panel" style={{ padding: '1.35rem 1.6rem' }}>
                  <h3 style={{ fontSize: '1.08rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.6rem', display: 'flex', gap: '0.5rem', alignItems: 'baseline' }}>
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
        )}

        {/* Switch in an Afternoon CTA Box */}
        <section className="glass-panel" style={{ padding: '2.5rem 1.75rem', textAlign: 'center', borderTop: '4px solid var(--c-green)', marginBottom: '3.5rem' }}>
          <h2 style={{ fontSize: 'clamp(1.6rem, 4.5vw, 2.2rem)', fontWeight: 900 }}>
            Switch from {c.name} in an Afternoon. It&apos;s Free.
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '560px', margin: '0.6rem auto 1.5rem', fontSize: '1.02rem', lineHeight: 1.6 }}>
            No credit card required. No contract. Set up your club, add your squads, and enjoy zero software fees.
          </p>
          <ol className="vs-steps">
            <li><span><strong>Create your club</strong> in 60 seconds with just an email.</span></li>
            <li><span><strong>Add your teams and players</strong> or invite squad members to claim passes.</span></li>
            <li><span><strong>Share your club link</strong>. Supporters follow scores in the browser, no app download.</span></li>
          </ol>
          <div style={{ marginTop: '1.5rem' }}>
            <Link href="/create-club" className="btn btn-primary btn-lg" style={ctaStyle}>
              Create your club free <ArrowRight size={18} />
            </Link>
          </div>
        </section>

        {/* Other Comparisons Navigation */}
        <section style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '2rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Explore Other Competitor Comparisons
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
            {otherCompetitors.map(other => (
              <Link
                key={other.slug}
                href={`/compare/${other.alternativeSlug}`}
                className="glass-panel"
                style={{ padding: '0.6rem 1rem', fontSize: '0.88rem', color: 'var(--text-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                vs {other.name} Alternative <ArrowRight size={13} />
              </Link>
            ))}
            <Link
              href="/compare"
              className="glass-panel"
              style={{ padding: '0.6rem 1rem', fontSize: '0.88rem', color: 'var(--club-ink)', textDecoration: 'none', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              All-in-one Matrix <ArrowRight size={13} />
            </Link>
          </div>
        </section>

        <footer style={{ marginTop: '2.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.6 }}>
          <p>
            Competitor pricing and features verified as of October 2026. Spotted something that has changed? Email{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--club-ink)' }}>{CONTACT_EMAIL}</a> and we will verify and update it.
          </p>
        </footer>
      </main>

      <Footer />
    </div>
  );
}
