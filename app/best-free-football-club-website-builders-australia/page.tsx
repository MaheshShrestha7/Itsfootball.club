import Link from 'next/link';
import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Info,
  Shield,
  Smartphone,
  Radio,
  DollarSign,
  ChevronRight,
} from 'lucide-react';
import PlatformNavbar from '@/components/PlatformNavbar';
import Footer from '@/components/Footer';
import JsonLd from '@/components/JsonLd';
import { SourceLink } from '@/app/vs/CellView';
import type { Source } from '@/lib/competitors';
import { CONTACT_EMAIL, FEE_PHRASE } from '@/lib/faq';
import { SITE_URL, fitDescription, pageMetadata } from '@/lib/seo';
import { ORGANIZATION_ID, WEBSITE_ID } from '@/lib/schema';
import { formatUpdated } from '@/lib/tool-pages';

// Every fact about another platform links to that platform's own page (or its app store / Capterra
// listing where it publishes nothing itself), checked on LAST_REVIEWED. Re-check before changing a
// price or claim, and say "not published" rather than guess.

const PATH = '/best-free-football-club-website-builders-australia';
const PUBLISHED = '2026-10-18';
const LAST_REVIEWED = '2026-10-22';
const TITLE = 'Free Football Club Website Builders in Australia (2026)';

export const metadata: Metadata = pageMetadata({
  title: TITLE,
  description: fitDescription(
    'Six club website builders for Australian football and soccer clubs, compared on price, ads, website, own domain and live scores.',
    'Written by itsfootball.club, with every fact linked to its source.'
  ),
  path: PATH,
});

const S = {
  ourFaq: { title: 'itsfootball.club FAQ', url: `${SITE_URL}/faq` },
  ourLive: { title: 'itsfootball.club live scores', url: `${SITE_URL}/live-scores` },
  teamAppCost: { title: 'Team App Support: Cost of Team App', url: 'https://support.teamapp.com/en/knowledgebase/5-general-faqs/docs/97-cost-of-team-app' },
  teamAppAds: { title: 'Team App Support: Advertising information', url: 'https://support.teamapp.com/en/knowledgebase/5-general-faqs/docs/3-advertising-information' },
  teamAppStore: { title: 'Stack Team App on the App Store', url: 'https://apps.apple.com/us/app/team-app-your-team-your-app/id625607532' },
  pitcheroPricing: { title: 'Pitchero pricing', url: 'https://www.pitchero.com/pricing' },
  pitcheroScores: { title: 'Pitchero help: Manage scores and events in the Club app', url: 'https://help.pitchero.com/knowledge/club-app/scores-match-events' },
  spondFree: { title: 'Spond help: Spond is free to download and use', url: 'https://help.spond.com/en/articles/25998-spond-is-free-to-download-and-use' },
  spondWebsite: { title: 'Spond club website', url: 'https://www.spond.com/club-website/' },
  spondTrial: { title: 'Spond help: Set up your club website', url: 'https://help.spond.com/club/en/articles/148773-set-up-your-club-website' },
  spondFees: { title: 'Spond help: Transaction fees in Spond Club', url: 'https://help.spond.com/club/en/articles/58192-what-is-the-transaction-fee-in-spond-club' },
  spondPartners: { title: 'Spond: Brand partnerships', url: 'https://www.spond.com/news-and-blog/spond-brand-partnerships/' },
  playpassPricing: { title: 'Playpass pricing', url: 'https://playpass.com/pricing' },
  clubhelixCapterra: { title: 'ClubHelix on Capterra Australia', url: 'https://www.capterra.com.au/software/1111404/ClubHelix' },
} satisfies Record<string, Source>;

interface Fact { text: string; source?: Source }

interface Builder {
  name: string;
  ours?: boolean;
  bestFor: string;
  price: Fact;
  ads: Fact;
  website: Fact;
  domain: Fact;
  scores: Fact;
  strengths: Fact[];
  watchOuts: Fact[];
  link?: { href: string; text: string };
}

const BUILDERS: Builder[] = [
  {
    name: 'itsfootball.club',
    ours: true,
    bestFor: 'Football (soccer) clubs that want a free public website with live match scores, lineups and member passes, and don’t need other sports.',
    price: { text: `Free for clubs, every feature, no paid plan. Card payments carry ${FEE_PHRASE}, paid by the person paying`, source: S.ourFaq },
    ads: { text: 'No third-party ads. Club sponsors are shown instead', source: S.ourFaq },
    website: { text: 'Included, in the club’s own colours and crest' },
    domain: { text: 'A club can connect its own domain from its branding settings' },
    scores: { text: 'Live match centre in any phone browser: goals, cards, subs and lineups', source: S.ourLive },
    strengths: [
      { text: 'Built for football only: lineups on a pitch, availability, rolling subs, tournaments with group tables and knockout brackets.' },
      { text: 'Supporters follow live scores in the browser without installing anything.', source: S.ourLive },
      { text: 'Digital member passes with QR check-in.' },
    ],
    watchOuts: [
      { text: 'New, and used by only a few clubs so far, so there are no independent reviews yet.' },
      { text: 'Football only. A multi-sport club would need something else for its other sports.' },
      { text: 'No App Store or Google Play app yet. It runs in the browser and can be added to a phone’s home screen.' },
      { text: `People paying by card pay ${FEE_PHRASE} on top of the club’s price.`, source: S.ourFaq },
    ],
    link: { href: '/create-club', text: 'Create your club free' },
  },
  {
    name: 'Stack Team App',
    bestFor: 'Multi-sport clubs whose members already use the Team App app, and who are happy for it to be ad-funded.',
    price: { text: '“Completely free to create and use”, with no setup fees', source: S.teamAppCost },
    ads: { text: 'Funded by mobile ads. A member can remove them for AUD $4.49 a year; a club can remove them for all members, price not published', source: S.teamAppStore },
    website: { text: 'Free website that updates with the app', source: S.teamAppStore },
    domain: { text: 'Not stated on its support or App Store pages' },
    scores: { text: 'Ladders, schedules, results and live scores', source: S.teamAppStore },
    strengths: [
      { text: 'Free for clubs, with no setup or usage fees.', source: S.teamAppCost },
      { text: 'Works for many sports, not just football.', source: S.teamAppStore },
      { text: 'Clubs can replace the ads with their own sponsor banners.', source: S.teamAppAds },
    ],
    watchOuts: [
      { text: 'Members see ads unless they, or the club, pay to remove them.', source: S.teamAppAds },
      { text: 'Store payments carry transaction fees; the rate isn’t on the support page.', source: S.teamAppCost },
    ],
    link: { href: '/compare/teamapp-alternative', text: 'itsfootball.club vs Team App' },
  },
  {
    name: 'Pitchero',
    bestFor: 'Established multi-team clubs, mostly in the UK, that want club email accounts and are prepared to pay a monthly subscription.',
    price: { text: 'Free for 1 team. Standard £38 a month (up to 20 teams, +£2.50 per extra team). Pro £99 a month, unlimited teams', source: S.pitcheroPricing },
    ads: { text: 'Third-party ads on Free, “limited advertising” on Standard, none on Pro', source: S.pitcheroPricing },
    website: { text: 'Included on every plan', source: S.pitcheroPricing },
    domain: { text: 'One custom domain on Standard and Pro', source: S.pitcheroPricing },
    scores: { text: 'Scores entered in the Pitchero Club app, shown on the club website', source: S.pitcheroScores },
    strengths: [
      { text: 'Club email accounts: 10 on Standard, 50 on Pro.', source: S.pitcheroPricing },
      { text: 'Supporters can see live scores on the website without the app.', source: S.pitcheroScores },
    ],
    watchOuts: [
      { text: 'Priced in pounds; the pricing page shows no Australian dollar prices.', source: S.pitcheroPricing },
      { text: 'No online payments on Free. From 2.42% + 17p on Standard and 1.67% + 15p on Pro.', source: S.pitcheroPricing },
    ],
    link: { href: '/compare/pitchero-alternative', text: 'itsfootball.club vs Pitchero' },
  },
  {
    name: 'Spond',
    bestFor: 'Teams whose main job is availability, events and collecting payments in an app, with a website as an optional extra.',
    price: { text: 'App free to download and use. Club website A$22 a month after a free trial (12 months in Australia)', source: S.spondWebsite },
    ads: { text: 'Brand partner content in the app', source: S.spondPartners },
    website: { text: 'Paid add-on after the trial, linked to events, payments and memberships', source: S.spondTrial },
    domain: { text: 'Custom domain supported on the club website', source: S.spondWebsite },
    scores: { text: 'Not listed on Spond’s club website pages', source: S.spondWebsite },
    strengths: [
      { text: 'The app is free for teams and members.', source: S.spondFree },
      { text: 'Events, payments and memberships in one place.', source: S.spondWebsite },
    ],
    watchOuts: [
      { text: 'Card payments: AUD 2.5% + $0.30, charged to the club by default.', source: S.spondFees },
      { text: 'The website is a monthly cost once the trial ends.', source: S.spondTrial },
    ],
    link: { href: '/compare/spond-alternative', text: 'itsfootball.club vs Spond' },
  },
  {
    name: 'Playpass',
    bestFor: 'Social leagues and tournament organisers who mainly need online registration, scheduling and standings.',
    price: { text: 'Free (3% platform fee on payments), Plus $9, Pro $19 or Max $99 a month (fee falls to 2.5%, 2% or 1%). Currency not named on the page; 50% off for non-profits', source: S.playpassPricing },
    ads: { text: 'Not mentioned on the pricing page', source: S.playpassPricing },
    website: { text: '1 custom page on Free, 3 on Plus, 10 on Pro, unlimited on Max', source: S.playpassPricing },
    domain: { text: '$99 a year add-on on paid plans', source: S.playpassPricing },
    scores: { text: 'Online scoring and standings on every plan', source: S.playpassPricing },
    strengths: [
      { text: 'Scoring and standings are included even on the free plan.', source: S.playpassPricing },
      { text: 'Discount for non-profit organisations.', source: S.playpassPricing },
    ],
    watchOuts: [
      { text: 'A platform fee of 1–3% on payments, on every plan.', source: S.playpassPricing },
      { text: 'Not football-specific.' },
    ],
    link: { href: '/compare/playpass-alternative', text: 'itsfootball.club vs Playpass' },
  },
  {
    name: 'ClubHelix',
    bestFor: 'Clubs and associations that want members, payments, events, competitions and a website builder in one system.',
    price: { text: 'Free version and free trial listed; paid plans billed every 4 weeks, prices not published there', source: S.clubhelixCapterra },
    ads: { text: 'Not stated', source: S.clubhelixCapterra },
    website: { text: 'Club website builder included', source: S.clubhelixCapterra },
    domain: { text: 'Own domain described on its listing', source: S.clubhelixCapterra },
    scores: { text: 'Fixtures, results and ladders; live scores not mentioned', source: S.clubhelixCapterra },
    strengths: [
      { text: 'Aimed at clubs and governing bodies, with competitions built in.', source: S.clubhelixCapterra },
    ],
    watchOuts: [
      { text: 'Paid plan prices aren’t published on its Capterra listing, so ask for a quote.', source: S.clubhelixCapterra },
    ],
    link: { href: '/compare/clubhelix-alternative', text: 'itsfootball.club vs ClubHelix' },
  },
];

const FAQS = [
  {
    q: 'Which free club website builder is best for an Australian football club?',
    a: 'It depends on what the club needs. For a free public website with live scores and lineups, built only for football, that is what itsfootball.club does (we make it, so weigh that). Multi-sport clubs whose members already use Team App get a free, ad-funded app and website. Pitchero suits clubs that want club email and will pay £38–£99 a month. Spond suits teams that mostly need availability and payments, with a website at A$22 a month after the trial.',
  },
  {
    q: 'Are these platforms really free?',
    a: `itsfootball.club is free for clubs, with ${FEE_PHRASE} on card payments paid by the person paying. Team App is free and funded by ads. Pitchero is free for one team with third-party ads. The Spond app is free, but its club website costs A$22 a month after the trial. Playpass has a free plan with a 3% platform fee on payments.`,
  },
  {
    q: 'Do supporters need an app to follow live scores?',
    a: 'Not with itsfootball.club: the live match centre opens in any phone browser. Pitchero also shows scores entered in its Club app on the club website. Team App says its free website updates with the app. Spond doesn’t list live scores on its club website pages.',
  },
  {
    q: 'Can a club use its own .com.au domain?',
    a: 'itsfootball.club lets a club connect its own domain from its branding settings. Pitchero includes one custom domain on its Standard and Pro plans, Spond supports one on its paid club website, and Playpass sells it as a $99 a year add-on on paid plans.',
  },
  {
    q: 'Why should I trust a comparison written by itsfootball.club?',
    a: `You shouldn’t take our word for it, which is why every fact about another platform links to that platform’s own page, and we list where we fall short. Prices change, so check the linked page before you decide. If something here is wrong or out of date, email ${CONTACT_EMAIL} and we’ll fix it.`,
  },
];

const schema = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Article',
      '@id': `${SITE_URL}${PATH}#article`,
      headline: TITLE,
      description: 'A comparison of six club website builders for Australian football clubs, written by itsfootball.club, with every fact about other platforms linked to its source.',
      url: `${SITE_URL}${PATH}`,
      mainEntityOfPage: `${SITE_URL}${PATH}`,
      inLanguage: 'en-AU',
      datePublished: PUBLISHED,
      dateModified: LAST_REVIEWED,
      author: {
        '@type': 'Person',
        name: 'Mahesh Shrestha',
        jobTitle: 'Founder, itsfootball.club',
        url: `${SITE_URL}/about`,
      },
      publisher: { '@id': ORGANIZATION_ID },
      isPartOf: { '@id': WEBSITE_ID },
      about: 'Football club website builders in Australia',
    },
    {
      '@type': 'ItemList',
      '@id': `${SITE_URL}${PATH}#platforms`,
      name: 'Football club website builders compared',
      numberOfItems: BUILDERS.length,
      itemListElement: BUILDERS.map((b, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: b.name,
        description: `Best for: ${b.bestFor}`,
      })),
    },
    {
      '@type': 'FAQPage',
      '@id': `${SITE_URL}${PATH}#faq`,
      mainEntity: FAQS.map(f => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'itsfootball.club', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Compare', item: `${SITE_URL}/compare` },
        { '@type': 'ListItem', position: 3, name: 'Club website builders in Australia', item: `${SITE_URL}${PATH}` },
      ],
    },
  ],
};

const ctaStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.45rem' };
const cell: CSSProperties = { padding: '0.75rem 0.5rem', verticalAlign: 'top' };

function FactText({ fact }: { fact: Fact }) {
  return (
    <>
      {fact.text}
      {fact.source && <SourceLink source={fact.source} />}
    </>
  );
}

const CRITERIA = [
  { Icon: DollarSign, color: 'var(--c-green)', title: 'What the club pays', text: 'Monthly fees, paid tiers, per-team charges, and who pays the card fees.' },
  { Icon: Shield, color: 'var(--c-sky)', title: 'Ads', text: 'Whether players, parents and supporters see third-party ads, and what it costs to remove them.' },
  { Icon: Smartphone, color: 'var(--c-amber)', title: 'Website and app', text: 'Whether there is a public website, whether it can use the club’s own domain, and whether supporters need an app.' },
  { Icon: Radio, color: 'var(--c-purple)', title: 'Live scores', text: 'Whether a supporter at home can follow the match as it happens.' },
];

export default function BestWebsiteBuildersAustraliaPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <JsonLd data={schema} />
      <PlatformNavbar />

      <nav aria-label="Breadcrumb" className="container" style={{ padding: '1rem 1rem 0', maxWidth: '1040px' }}>
        <ol style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem', listStyle: 'none', padding: 0, margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <li><Link href="/" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Home</Link></li>
          <li><ChevronRight size={13} /></li>
          <li><Link href="/compare" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Compare</Link></li>
          <li><ChevronRight size={13} /></li>
          <li style={{ color: 'var(--club-ink)', fontWeight: 600 }}>Club website builders in Australia</li>
        </ol>
      </nav>

      <main className="container" style={{ padding: '2rem 1rem 4rem', flex: 1, maxWidth: '1040px' }}>
        <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div className="badge badge-primary" style={{ marginBottom: '0.85rem' }}>
            AUSTRALIAN GRASSROOTS FOOTBALL · 2026
          </div>
          <h1 style={{ fontSize: 'clamp(2.1rem, 5.5vw, 3.2rem)', fontWeight: 900, lineHeight: 1.15, letterSpacing: '-0.02em', maxWidth: '900px', margin: '0 auto' }}>
            Free football club website builders in Australia, compared
          </h1>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '720px', margin: '1.1rem auto 0', fontSize: '1.1rem', lineHeight: 1.65 }}>
            Six platforms a community soccer club might use for its website, compared on what the club pays, ads, its own domain and live scores.
          </p>
          <p className="tool-updated" style={{ marginTop: '0.85rem' }}>
            By Mahesh Shrestha, founder of itsfootball.club • Facts checked <time dateTime={LAST_REVIEWED}>{formatUpdated(LAST_REVIEWED)}</time>
          </p>
        </header>

        <section aria-label="About this comparison" className="glass-panel" style={{ padding: '1.4rem 1.6rem', marginBottom: '1.5rem', display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
          <Info size={20} color="var(--club-ink)" style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
            <strong style={{ color: 'var(--text-primary)' }}>We make itsfootball.club, so weigh this page with that in mind.</strong>{' '}
            Every fact about another platform links to that platform&apos;s own page (the <span style={{ whiteSpace: 'nowrap' }}>↗</span> icons), or to its App Store or Capterra listing where it publishes nothing itself.
            Where a platform doesn&apos;t publish something, we say so rather than guess. We list where we fall short too.
            Spotted something wrong or out of date? Email <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--club-ink)' }}>{CONTACT_EMAIL}</a>.
          </p>
        </section>

        <section aria-label="Short answer" className="glass-panel" style={{ padding: '1.6rem', marginBottom: '2.5rem', border: '1px solid rgba(var(--club-primary-rgb), 0.25)', background: 'linear-gradient(135deg, rgba(var(--club-primary-rgb), 0.05) 0%, rgba(var(--club-primary-rgb), 0.01) 100%)', borderRadius: 'var(--radius-lg)' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 0.6rem', color: 'var(--club-ink)' }}>The short answer</h2>
          <p style={{ fontSize: '1.05rem', lineHeight: 1.7, color: 'var(--text-primary)', margin: 0 }}>
            The free options for an Australian football club are itsfootball.club (free for clubs, no ads, live scores in the browser, football only), Stack Team App (free, ad-funded, multi-sport) and Pitchero&apos;s one-team free plan (with ads).
            Spond&apos;s app is free but its club website is A$22 a month after a 12-month trial, and Playpass&apos;s free plan takes 3% of payments.
            The right one depends on whether you play other sports, whether you mind ads, and who pays the card fees.
          </p>
        </section>

        <section aria-labelledby="criteria-heading" style={{ marginBottom: '3rem' }}>
          <h2 id="criteria-heading" style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1.25rem' }}>
            What we compared
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            {CRITERIA.map(({ Icon, color, title, text }) => (
              <div key={title} className="glass-panel" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, marginBottom: '0.5rem', color }}>
                  <Icon size={18} /> {title}
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6, margin: 0 }}>{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="matrix-heading" style={{ marginBottom: '3.5rem' }}>
          <h2 id="matrix-heading" style={{ fontSize: '1.65rem', fontWeight: 900, marginBottom: '1.25rem' }}>
            Side by side
          </h2>
          <div className="glass-panel" style={{ overflowX: 'auto', padding: '1rem' }}>
            <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-subtle)', textAlign: 'left' }}>
                  <th style={{ ...cell, fontWeight: 800 }}>Platform</th>
                  <th style={{ ...cell, fontWeight: 800 }}>What the club pays</th>
                  <th style={{ ...cell, fontWeight: 800 }}>Ads</th>
                  <th style={{ ...cell, fontWeight: 800 }}>Own domain</th>
                  <th style={{ ...cell, fontWeight: 800 }}>Live scores</th>
                </tr>
              </thead>
              <tbody>
                {BUILDERS.map(b => (
                  <tr key={b.name} style={{ borderBottom: '1px solid var(--border-subtle)', background: b.ours ? 'rgba(var(--club-primary-rgb), 0.06)' : undefined }}>
                    <td style={{ ...cell, fontWeight: 800, color: b.ours ? 'var(--club-ink)' : undefined }}>
                      {b.name}{b.ours && <div style={{ fontWeight: 500, fontSize: '0.75rem', color: 'var(--text-muted)' }}>(ours)</div>}
                    </td>
                    <td style={cell}><FactText fact={b.price} /></td>
                    <td style={cell}><FactText fact={b.ads} /></td>
                    <td style={cell}><FactText fact={b.domain} /></td>
                    <td style={cell}><FactText fact={b.scores} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="platforms-heading" style={{ marginBottom: '3.5rem' }}>
          <h2 id="platforms-heading" style={{ fontSize: '1.65rem', fontWeight: 900, marginBottom: '0.5rem' }}>
            Each platform in detail
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.75rem' }}>
            Ours first because it&apos;s our page, then the others. There are no scores: what suits a club depends on what it needs.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {BUILDERS.map(b => (
              <article
                key={b.name}
                id={b.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}
                className="glass-panel"
                style={{ padding: '2rem', borderRadius: 'var(--radius-lg)', borderTop: b.ours ? '4px solid var(--club-ink)' : '2px solid var(--border-subtle)' }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.6rem', fontWeight: 900, margin: 0 }}>{b.name}</h3>
                  {b.ours && <span className="badge badge-primary" style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem' }}>OURS</span>}
                </div>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.65, fontSize: '0.98rem', margin: '0 0 1.1rem' }}>
                  <strong>Best for:</strong> {b.bestFor}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
                  <div><strong>Price:</strong> <FactText fact={b.price} /></div>
                  <div><strong>Ads:</strong> <FactText fact={b.ads} /></div>
                  <div><strong>Website:</strong> <FactText fact={b.website} /></div>
                  <div><strong>Live scores:</strong> <FactText fact={b.scores} /></div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: b.link ? '1.5rem' : 0 }}>
                  <div>
                    <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--c-green)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Good at
                    </h4>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {b.strengths.map(f => (
                        <li key={f.text} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                          <CheckCircle2 size={15} color="var(--c-green)" style={{ flexShrink: 0, marginTop: 3 }} />
                          <span><FactText fact={f} /></span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--c-amber)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Worth knowing
                    </h4>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {b.watchOuts.map(f => (
                        <li key={f.text} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                          <AlertCircle size={15} color="var(--c-amber)" style={{ flexShrink: 0, marginTop: 3 }} />
                          <span><FactText fact={f} /></span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {b.link && (
                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.1rem' }}>
                    <Link href={b.link.href} className={`btn ${b.ours ? 'btn-primary' : 'btn-secondary'}`} style={ctaStyle}>
                      {b.link.text} <ArrowRight size={15} />
                    </Link>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="faq-heading" style={{ marginBottom: '3.5rem' }}>
          <h2 id="faq-heading" style={{ fontSize: '1.65rem', fontWeight: 900, marginBottom: '1.25rem' }}>
            Questions clubs ask
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {FAQS.map(f => (
              <details key={f.q} className="glass-panel" style={{ padding: '1.15rem 1.4rem', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
                <summary style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{f.q}</span>
                  <span style={{ color: 'var(--club-ink)', fontSize: '1.2rem', fontWeight: 300 }}>+</span>
                </summary>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.65, marginTop: '0.85rem', fontSize: '0.98rem' }}>
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        <section className="glass-panel" style={{ padding: '2.5rem 1.5rem', textAlign: 'center', borderRadius: 'var(--radius-lg)', borderTop: '3px solid var(--club-ink)' }}>
          <h2 style={{ fontSize: 'clamp(1.6rem, 4.5vw, 2.2rem)', fontWeight: 900, margin: 0 }}>
            Try itsfootball.club for your club
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0.85rem auto 1.75rem', fontSize: '1.05rem', lineHeight: 1.6 }}>
            Set up your crest, colours, fixtures, live match centre and member passes. Free for clubs, every feature.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.85rem' }}>
            <Link href="/create-club" className="btn btn-primary btn-lg" style={ctaStyle}>
              Create your club free <ArrowRight size={18} />
            </Link>
            <Link href="/compare" className="btn btn-secondary btn-lg">
              All comparisons
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
