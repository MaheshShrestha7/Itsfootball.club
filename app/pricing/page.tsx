import Link from 'next/link';
import type { Metadata } from 'next';
import PlatformNavbar from '@/components/PlatformNavbar';
import Footer from '@/components/Footer';
import JsonLd from '@/components/JsonLd';
import { fitDescription, pageMetadata, SITE_NAME, SITE_URL } from '@/lib/seo';
import { ORGANIZATION_ID, WEBSITE_ID } from '@/lib/schema';
import { FEE_PHRASE } from '@/lib/faq';
import { bookingFeeText } from '@/lib/finance';
import { COMPARE_ROWS, competitorBySlug } from '@/lib/competitors';
import CellView from '@/app/vs/CellView';
import '../home.css';

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

      {/* Same look as the home page below its hero: plain headings, solid green blocks (app/home.css, hm- and pr-) */}
      <main className="lp pr" style={{ flex: 1 }}>
        <section className="container pr-top">
          <p className="pr-crumb"><Link href="/">itsfootball.club</Link> / Pricing</p>
          <h1>Free for every football club.</h1>
          <p className="hm-lede">
            There&apos;s no monthly subscription, every feature comes with every club, and we don&apos;t run third-party ads.
            Community clubs get a website like the big clubs have, without paying for the software.
          </p>
        </section>

        <section className="hm-sec" aria-labelledby="pr-plan-h">
          <div className="container">
            <div className="hm-block pr-price">
              <div>
                <h2 id="pr-plan-h" className="hm-h2">One plan for every club.</h2>
                <p className="pr-zero"><b>$0</b><span>a month</span></p>
                <p className="hm-lede">What your committee, coaches, players and supporters use to run the season.</p>
                <Link href="/create-club" className="hm-block-btn">Create your club</Link>
                <p className="hm-small">Free to set up. No credit card needed.</p>
              </div>
              <ul className="pr-inc">
                {INCLUDED_FEATURES.map(feat => (
                  <li key={feat.title}>
                    <h3>{feat.title}</h3>
                    <p>{feat.desc}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="hm-sec" aria-labelledby="pr-pay-h">
          <div className="container">
            <h2 id="pr-pay-h" className="hm-h2">How card payments work.</h2>
            <p className="hm-lede">Who pays what when someone pays your club by card.</p>
            <div className="pr-cols">
              <div>
                <h3>Your club gets its full price</h3>
                <p>If your club charges $200 for a season&apos;s registration or $40 for a jersey, that full amount goes into the club&apos;s own Stripe account, less Stripe&apos;s standard processing fee.</p>
              </div>
              <div>
                <h3>A small booking fee</h3>
                <p>A booking fee of {bookingFeeText()} is added to card, Apple Pay and Google Pay payments, and the person checking out pays it. They see it before they pay, the same as when you book cinema or event tickets.</p>
              </div>
              <div>
                <h3>No fee on anything else</h3>
                <p>Following live matches, marking availability, tracking player stats, scanning passes and making tournament brackets never cost anything.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="hm-sec" aria-labelledby="pr-compare-h">
          <div className="container">
            <div className="hm-head">
              <h2 id="pr-compare-h" className="hm-h2">How we compare with other club software.</h2>
              <Link href="/compare" className="hm-link">See the full side-by-side comparisons</Link>
            </div>
            <div className="pr-table-wrap">
              <table className="pr-table">
                <thead>
                  <tr>
                    <th scope="col">Feature</th>
                    <th scope="col" className="pr-us">{SITE_NAME}</th>
                    {PRICING_COLUMNS.map(c => (
                      <th scope="col" key={c.slug}>{c.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PRICING_ROWS.map(r => (
                    <tr key={r.label}>
                      <th scope="row">{r.label}</th>
                      <td className="pr-us"><CellView cell={r.us} /></td>
                      {PRICING_COLUMNS.map(c => (
                        <td key={c.slug}><CellView cell={r.them[c.slug]} sources={c.sources} /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="hm-sec" aria-labelledby="pr-faq-h">
          <div className="container hm-faq">
            <div>
              <h2 id="pr-faq-h" className="hm-h2">Questions about pricing.</h2>
              <p className="hm-lede">Fees, limits and how we make money.</p>
              <Link href="/faq" className="hm-link">Read all the FAQs</Link>
            </div>
            <div className="hm-faq-list">
              {PRICING_FAQS.map(faq => (
                <details key={faq.q}>
                  <summary>{faq.q}</summary>
                  <p>{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="hm-sec hm-sec-last" aria-labelledby="pr-close-h">
          <div className="container">
            <div className="hm-block hm-close">
              <div>
                <h2 id="pr-close-h" className="hm-h2">Start your club site today.</h2>
                <p className="hm-lede">Set up your club website, fixtures, squad and member passes, and run your next match live from the touchline.</p>
                <Link href="/create-club" className="hm-block-btn">Create your club</Link>
                <p className="hm-small">Or <Link href="/clubs" className="pr-inline">look at live clubs</Link> first.</p>
              </div>
              <dl className="pr-sum">
                <div><dt>What your club pays</dt><dd>$0</dd></div>
                <div><dt>What a card payer adds</dt><dd>A small booking fee</dd></div>
                <div><dt>What your club receives</dt><dd>Its full price, less Stripe&apos;s fee</dd></div>
              </dl>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
