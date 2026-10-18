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

const PATH = '/pricing';
const TITLE = 'Free Football Club Website & Match Centre Pricing | itsfootball.club';
const DESCRIPTION =
  'itsfootball.club is 100% free for football clubs. Zero monthly subscriptions, zero ads, unlimited teams, custom domains and live match centre. Every feature included.';

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: fitDescription(
    DESCRIPTION,
    'Clubs keep 100% of registrations and player fees.',
    'Create your club website free today.'
  ),
  path: PATH,
});

const INCLUDED_FEATURES = [
  { title: 'Official Public Club Website', desc: 'Custom club colours, emblem, banner and custom domain connection (.club, .com.au, .org.au).' },
  { title: 'Live Match Centre (Web Browser)', desc: 'Goals, cards, lineups, live timer and real-time scores accessible to fans on any phone without app downloads.' },
  { title: 'Player Availability & Squad Lineups', desc: 'Drag-and-drop tactical pitch lineup builder for 5, 7, 9 and 11-a-side formats with instant WhatsApp/Instagram export.' },
  { title: 'Digital Member Passes with QR Terminal', desc: 'Photo-backed dynamic member cards with instant phone camera QR scanning for attendance and turnstiles.' },
  { title: 'Tournament Maker & Bracket Engine', desc: 'Create group stages, round robins and single-elimination knockout cup draws with automated table standings.' },
  { title: 'Online Club Merchandise Shop', desc: 'Sell jerseys, scarves and gear online directly from your club dashboard with size variants and inventory control.' },
  { title: 'Sponsor Showcase & Click Analytics', desc: 'High-visibility sponsor tiers and click tracking for local businesses with zero competing commercial network ads.' },
  { title: 'Unlimited Teams, Players & Admins', desc: 'Men, Women, Juniors, Reserves, Over 35s and committee roles under a single club management portal.' },
  { title: 'Club News & Photo Gallery', desc: 'Publish match reports, club notices and high-res photo albums with automatic SEO article markup.' },
  { title: 'Direct Stripe Payments & Ledger', desc: 'Collect season registrations and dues straight into your club Stripe account with downloadable CSV accounting.' },
];

const PRICING_FAQS = [
  {
    q: 'Is itsfootball.club really free for clubs?',
    a: 'Yes. itsfootball.club charges zero subscription fees, zero setup costs, and zero monthly hosting fees. Every feature—from the public club website to the live match centre and tournament generator—is unlocked for all clubs from day one.',
  },
  {
    q: 'Are there any limits on teams, players or members?',
    a: 'No limits. Unlike competitors that restrict free plans to one team or charge monthly add-on fees for extra squads, you can create unlimited teams (Men, Women, Juniors, Reserves, Masters) and register unlimited players.',
  },
  {
    q: 'How does itsfootball.club make money without charging clubs?',
    a: `When a club chooses to collect player registration fees, ticket sales or shop orders via online card payments, a small transparent booking fee (${bookingFeeText()}) is added to the payer's checkout. The club receives 100% of its requested price directly into its own Stripe account (less standard Stripe processing). There are zero fees on anything else: browsing, live scores, availability, passes, or free events.`,
  },
  {
    q: 'Do supporters, players or parents need to install an app?',
    a: 'No. Everything works directly in any mobile or desktop web browser (Safari, Chrome, Edge). Supporters can view lineups, live scores, and club news instantly without downloading an app or remembering another login.',
  },
  {
    q: 'Can we use our own custom domain name?',
    a: 'Yes. Every club receives a fast itsfootball.club/yourclub address automatically, and club admins can connect their own registered domain (e.g. www.yourclub.com.au or fc.club) at no additional charge.',
  },
  {
    q: 'How does it compare with Pitchero or Spond?',
    a: 'Pitchero charges £38 to £99 a month to remove ads, unlock extra teams, and get custom domains. Spond requires a paid monthly subscription for club websites after a trial, and features sponsored partner ads in-app. itsfootball.club gives your whole club an ad-free public website, live scores, and digital passes completely free.',
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
          description: `100% free for community football and soccer clubs. Online card payments carry ${FEE_PHRASE}, paid by the payer.`,
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
            Transparent Grassroots Pricing
          </div>
          <h1 style={{ fontSize: 'clamp(2.2rem, 5vw, 3.4rem)', fontWeight: 900, lineHeight: 1.1, letterSpacing: '-0.03em', marginBottom: '1.25rem' }}>
            Free for Every <span style={{ color: 'var(--c-amber)' }}>Football Club</span>
          </h1>
          <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', maxWidth: '680px', margin: '0 auto', lineHeight: 1.55 }}>
            No monthly subscriptions. No tier restrictions. No third-party network ads.
            Built to give community clubs a big-club web presence without the software price tag.
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
                <Sparkles size={16} /> Complete Grassroots Platform
              </div>
              <h2 style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.25rem)', fontWeight: 900, margin: '0 0 0.5rem 0' }}>
                All-In-One Club Tier
              </h2>
              <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '1.05rem' }}>
                Everything your committee, coaches, players, and supporters need to run the season.
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: '0.35rem' }}>
                <span style={{ fontSize: 'clamp(2.8rem, 6vw, 4.2rem)', fontWeight: 900, lineHeight: 1, color: 'var(--text-primary)' }}>$0</span>
                <span style={{ fontSize: '1.1rem', color: 'var(--text-muted)', fontWeight: 700 }}>/ month</span>
              </div>
              <p style={{ margin: '0.35rem 0 1rem 0', fontSize: '0.9rem', color: 'var(--c-green)', fontWeight: 700 }}>
                Forever free · No credit card required
              </p>
              <Link href="/create-club" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem', padding: '0.85rem 1.6rem', fontSize: '1.05rem', fontWeight: 800 }}>
                <span>Create Your Club Free</span>
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
              How Online Card Payments Work
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '640px', margin: '0 auto', fontSize: '1rem' }}>
              Transparent, fair pricing that protects your club budget.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            <div className="glass-panel" style={{ padding: '1.75rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--c-amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <ShieldCheck size={22} />
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.5rem' }}>Club Keeps 100% of Price</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.55, margin: 0 }}>
                When your club charges $200 for annual player registration or $40 for a jersey, your club receives exactly that full amount straight into its own Stripe account (less standard Stripe processing).
              </p>
            </div>

            <div className="glass-panel" style={{ padding: '1.75rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.15)', color: 'var(--c-sky)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <CreditCard size={22} />
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.5rem' }}>Transparent Booking Fee</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.55, margin: 0 }}>
                A small booking fee ({bookingFeeText()}) is added to card, Apple Pay, and Google Pay transactions, paid by the person checking out. It is displayed transparently before they pay—just like booking cinema or event tickets.
              </p>
            </div>

            <div className="glass-panel" style={{ padding: '1.75rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--c-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <Zap size={22} />
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.5rem' }}>Zero Fee on Non-Card Use</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.55, margin: 0 }}>
                Following live matches, marking availability, tracking player stats, digital pass scanning, and generating tournament brackets are always completely fee-free.
              </p>
            </div>
          </div>
        </section>

        {/* Competitor Comparison Snapshot */}
        <section style={{ marginBottom: '4rem' }}>
          <div className="glass-panel" style={{ padding: '2rem', borderRadius: '20px' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 900, marginBottom: '1.25rem', textAlign: 'center' }}>
              How We Compare with Legacy Club Software
            </h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Feature</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--c-amber)', fontWeight: 800 }}>itsfootball.club</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Pitchero</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Spond</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Stack Team App</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Monthly Subscription</td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--c-green)', fontWeight: 800 }}>$0 free forever</td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>£38–£99 / month</td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>Paid website add-on</td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>$5–$10/mo per team</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Third-Party Ads</td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--c-green)', fontWeight: 800 }}>Zero ads, ever</td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>Commercial banners on free</td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>In-app partner ads</td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>Banner &amp; video popups</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Public Live Match Centre</td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--c-green)', fontWeight: 800 }}>Open in any browser</td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>Nudges to native app</td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>App only</td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>App only</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Teams &amp; Squads Included</td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--c-green)', fontWeight: 800 }}>Unlimited teams</td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>1 team on free plan</td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>Chat groups</td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>Charged per team</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
              <Link href="/compare" style={{ color: 'var(--c-amber)', fontSize: '0.9rem', fontWeight: 700, textDecoration: 'underline' }}>
                View complete head-to-head comparison guides →
              </Link>
            </div>
          </div>
        </section>

        {/* Pricing FAQs */}
        <section style={{ marginBottom: '4rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.2rem)', fontWeight: 900, marginBottom: '0.5rem' }}>
              Frequently Asked Questions
            </h2>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '1rem' }}>
              Have questions about pricing or fees? Here are the facts.
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
