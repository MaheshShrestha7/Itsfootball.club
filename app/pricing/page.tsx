import Link from 'next/link';
import type { Metadata } from 'next';
import { Check, ArrowRight, ShieldCheck, Zap, Sparkles, CreditCard, Users, Globe, Trophy, HelpCircle } from 'lucide-react';
import PlatformNavbar from '@/components/PlatformNavbar';
import Footer from '@/components/Footer';
import JsonLd from '@/components/JsonLd';
import { fitDescription, pageMetadata, SITE_NAME, SITE_URL } from '@/lib/seo';
import { ORGANIZATION_ID, WEBSITE_ID } from '@/lib/schema';
import { CONTACT_EMAIL, FEE_PHRASE } from '@/lib/faq';
import { bookingFeeText } from '@/lib/finance';
import { COMPARE_ROWS, competitorBySlug } from '@/lib/competitors';
import CellView from '@/app/vs/CellView';

const PATH = '/pricing';

// A few rows of the sourced /compare matrix, so prices here always match the comparison pages
const PRICING_SLUGS = ['pitchero', 'spond', 'teamapp'] as const;
const PRICING_COLUMNS = PRICING_SLUGS.map(slug => ({ ...competitorBySlug(slug)!, slug }));
const PRICING_LABELS = ['Price for the club', 'Ads', 'Public club website', 'Fans need an app?'];
const PRICING_ROWS = COMPARE_ROWS.filter(r => PRICING_LABELS.includes(r.label));
const TITLE = 'Free Football Club Website Pricing | itsfootball.club';
const DESCRIPTION =
  'itsfootball.club is free for football clubs: no monthly subscription, no third-party ads, unlimited teams, custom domains and a live match centre. Every feature included.';

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: fitDescription(
    DESCRIPTION,
    'Card payers pay a booking fee, so the club gets its full price.',
    'Create your club website free today.'
  ),
  path: PATH,
});

const INCLUDED_FEATURES = [
  { title: 'Public club website', desc: 'Your colours, crest and banner, and you can connect your own domain (.club, .com.au, .org.au).' },
  { title: 'Live match centre', desc: 'Goals, cards, lineups, the match clock and the score, live on any phone. Fans don\'t need an app.' },
  { title: 'Availability and lineups', desc: 'Drag players onto the pitch for 5, 7, 9 or 11-a-side, then share the lineup to WhatsApp or Instagram.' },
  { title: 'Digital member passes', desc: 'A member card with the player\'s photo and a QR code. Scan it with a phone camera to check people in.' },
  { title: 'Tournaments', desc: 'Group stages, round robins and knockout cup draws, with tables that update as results come in.' },
  { title: 'Club shop', desc: 'Sell jerseys, scarves and other gear from your club dashboard, with sizes for each item.' },
  { title: 'Sponsors and click counts', desc: 'Sponsor tiers for local businesses, and a count of clicks on each sponsor. No third-party ad networks.' },
  { title: 'Unlimited teams, players and admins', desc: 'Men, Women, Juniors, Reserves, Over 35s and committee roles, all under one club login.' },
  { title: 'Club news and photo gallery', desc: 'Post match reports, club notices and photo albums. Each article gets search engine markup automatically.' },
  { title: 'Stripe payments and a ledger', desc: 'Season registrations and fees go straight into your club\'s Stripe account, and you can download the ledger as a CSV.' },
];

const PRICING_FAQS = [
  {
    q: 'Is itsfootball.club really free for clubs?',
    a: 'Yes. There\'s no subscription, setup cost or hosting fee. Every club gets every feature from day one, including the public club website, the live match centre and the tournament maker.',
  },
  {
    q: 'Are there any limits on teams, players or members?',
    a: 'No. You can create as many teams as you need (Men, Women, Juniors, Reserves, Masters) and register as many players as you like. Some other apps limit their free plan to one team or charge a monthly fee for extra squads.',
  },
  {
    q: 'How does itsfootball.club make money without charging clubs?',
    a: `When a club takes registration fees, ticket sales or shop orders by card, a small booking fee (${bookingFeeText()}) is added at the payer's checkout. The club gets its full price in its own Stripe account, less Stripe's standard processing fee. Nothing else has a fee, including browsing, live scores, availability, passes and free events.`,
  },
  {
    q: 'Do supporters, players or parents need to install an app?',
    a: 'No. It all works in a web browser on a phone or computer, such as Safari, Chrome or Edge. Supporters can see lineups, live scores and club news without downloading an app or making another login.',
  },
  {
    q: 'Can we use our own custom domain name?',
    a: 'Yes. Every club gets an itsfootball.club/yourclub address straight away, and admins can connect a domain the club owns (for example www.yourclub.com.au or fc.club) at no extra cost.',
  },
  {
    q: 'How does it compare with Pitchero or Spond?',
    a: `Pitchero is free for one team, with paid plans at £38 or £99 a month, and its Free and Standard plans show ads. Spond’s club website is A$22 a month after a free trial, and the Spond app shows brand partner ads. itsfootball.club gives your whole club a public website, live scores and digital passes with no subscription and no third-party ads. People paying by card pay ${FEE_PHRASE}. The comparison pages list our sources and when we checked them.`,
  },
];

export default function PricingPage() {
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${SITE_URL}${PATH}#webpage`,
        url: `${SITE_URL}${PATH}`,
        name: TITLE,
        description: DESCRIPTION,
        isPartOf: { '@id': WEBSITE_ID },
        about: { '@id': ORGANIZATION_ID },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${SITE_URL}/#app`,
        name: SITE_NAME,
        url: SITE_URL,
        applicationCategory: 'SportsApplication',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'AUD',
          description: `Free for community football and soccer clubs. Online card payments carry ${FEE_PHRASE}, paid by the payer.`,
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'itsfootball.club', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Pricing', item: `${SITE_URL}${PATH}` },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: PRICING_FAQS.map(item => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      },
    ],
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <JsonLd data={schema} />
      <PlatformNavbar />

      <main className="container" style={{ padding: '3.5rem 1rem 5rem', flex: 1, maxWidth: '1040px' }}>
        {/* Header */}
        <header style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <div className="badge badge-primary" style={{ marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Pricing for grassroots clubs
          </div>
          <h1 style={{ fontSize: 'clamp(2.2rem, 5vw, 3.4rem)', fontWeight: 900, lineHeight: 1.1, letterSpacing: '-0.03em', marginBottom: '1.25rem' }}>
            Free for every <span style={{ color: 'var(--c-amber)' }}>football club</span>
          </h1>
          <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', maxWidth: '680px', margin: '0 auto', lineHeight: 1.55 }}>
            There&apos;s no monthly subscription, every feature comes with every club, and we don&apos;t run third-party ads.
            Community clubs get a website like the big clubs have, without paying for the software.
          </p>
        </header>

        {/* Pricing Hero Card */}
        <div
          className="glass-panel"
          style={{
            position: 'relative',
            padding: 'clamp(1.75rem, 4vw, 3rem)',
            borderRadius: '24px',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4), 0 0 30px rgba(245, 158, 11, 0.08)',
            marginBottom: '3.5rem',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '2rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '2.5rem', marginBottom: '2.5rem' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--c-amber)', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
                <Sparkles size={16} /> Everything included
              </div>
              <h2 style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.25rem)', fontWeight: 900, margin: '0 0 0.5rem 0' }}>
                One plan for every club
              </h2>
              <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '1.05rem' }}>
                What your committee, coaches, players and supporters use to run the season.
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: '0.35rem' }}>
                <span style={{ fontSize: 'clamp(2.8rem, 6vw, 4.2rem)', fontWeight: 900, lineHeight: 1, color: 'var(--text-primary)' }}>$0</span>
                <span style={{ fontSize: '1.1rem', color: 'var(--text-muted)', fontWeight: 700 }}>/ month</span>
              </div>
              <p style={{ margin: '0.35rem 0 1rem 0', fontSize: '0.9rem', color: 'var(--c-green)', fontWeight: 700 }}>
                Free for clubs · No credit card required
              </p>
              <Link href="/create-club" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem', padding: '0.85rem 1.6rem', fontSize: '1.05rem', fontWeight: 800 }}>
                <span>Create your club free</span>
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>

          {/* Feature Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {INCLUDED_FEATURES.map((feat, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--c-green)', borderRadius: '50%', padding: '0.35rem', flexShrink: 0, marginTop: '2px' }}>
                  <Check size={16} strokeWidth={3} />
                </div>
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>
                    {feat.title}
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.45 }}>
                    {feat.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* How Card Payments Work */}
        <section style={{ marginBottom: '4rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 900, marginBottom: '0.6rem' }}>
              How card payments work
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '640px', margin: '0 auto', fontSize: '1rem' }}>
              Who pays what when someone pays your club by card.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            <div className="glass-panel" style={{ padding: '1.75rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--c-amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <ShieldCheck size={22} />
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.5rem' }}>Your club gets its full price</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.55, margin: 0 }}>
                If your club charges $200 for a season&apos;s registration or $40 for a jersey, that full amount goes into the club&apos;s own Stripe account, less Stripe&apos;s standard processing fee.
              </p>
            </div>

            <div className="glass-panel" style={{ padding: '1.75rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.15)', color: 'var(--c-sky)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <CreditCard size={22} />
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.5rem' }}>A small booking fee</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.55, margin: 0 }}>
                A booking fee of {bookingFeeText()} is added to card, Apple Pay and Google Pay payments, and the person checking out pays it. They see it before they pay, the same as when you book cinema or event tickets.
              </p>
            </div>

            <div className="glass-panel" style={{ padding: '1.75rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--c-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <Zap size={22} />
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.5rem' }}>No fee on anything else</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.55, margin: 0 }}>
                Following live matches, marking availability, tracking player stats, scanning passes and making tournament brackets never cost anything.
              </p>
            </div>
          </div>
        </section>

        {/* Competitor Comparison Snapshot */}
        <section style={{ marginBottom: '4rem' }}>
          <div className="glass-panel" style={{ padding: '2rem', borderRadius: '20px' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 900, marginBottom: '1.25rem', textAlign: 'center' }}>
              How we compare with other club software
            </h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Feature</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--c-amber)', fontWeight: 800 }}>itsfootball.club</th>
                    {PRICING_COLUMNS.map(c => (
                      <th key={c.slug} style={{ padding: '0.75rem 1rem' }}>{c.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PRICING_ROWS.map((r, i) => (
                    <tr key={r.label} style={i < PRICING_ROWS.length - 1 ? { borderBottom: '1px solid var(--border-subtle)' } : undefined}>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>{r.label}</td>
                      <td style={{ padding: '0.85rem 1rem' }}><CellView cell={r.us} /></td>
                      {PRICING_COLUMNS.map(c => (
                        <td key={c.slug} style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                          <CellView cell={r.them[c.slug]} sources={c.sources} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
              <Link href="/compare" style={{ color: 'var(--c-amber)', fontSize: '0.9rem', fontWeight: 700, textDecoration: 'underline' }}>
                See the full side-by-side comparisons →
              </Link>
            </div>
          </div>
        </section>

        {/* Pricing FAQs */}
        <section style={{ marginBottom: '4rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.2rem)', fontWeight: 900, marginBottom: '0.5rem' }}>
              Questions about pricing
            </h2>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '1rem' }}>
              Fees, limits and how we make money.
            </p>
          </div>

          <div style={{ display: 'grid', gap: '1rem', maxWidth: '820px', margin: '0 auto' }}>
            {PRICING_FAQS.map((faq, i) => (
              <details key={i} className="glass-panel" style={{ padding: '1.2rem 1.5rem', borderRadius: '14px', cursor: 'pointer' }}>
                <summary style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{faq.q}</span>
                  <span style={{ color: 'var(--c-amber)', fontSize: '1.2rem', marginLeft: '1rem' }}>+</span>
                </summary>
                <p style={{ marginTop: '0.85rem', marginBottom: 0, color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="glass-panel" style={{ padding: '3.5rem 2rem', textAlign: 'center', borderRadius: '24px', background: 'radial-gradient(circle at center, rgba(245, 158, 11, 0.12) 0%, rgba(0,0,0,0.5) 70%)' }}>
          <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: 900, marginBottom: '1rem' }}>
            Ready to Build Your Club Website?
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '540px', margin: '0 auto 2rem', fontSize: '1.1rem', lineHeight: 1.5 }}>
            Join community football clubs across Australia, New Zealand and the UK. Live in under 5 minutes.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/create-club" className="btn btn-primary" style={{ padding: '0.85rem 1.8rem', fontSize: '1.05rem', fontWeight: 800 }}>
              Claim Your Free Club Website
            </Link>
            <Link href="/clubs" className="btn btn-secondary" style={{ padding: '0.85rem 1.8rem', fontSize: '1.05rem', fontWeight: 800 }}>
              Explore Live Clubs
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
