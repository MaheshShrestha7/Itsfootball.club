// The guides index (/guides): short, sourced answers to the questions coaches, organisers and treasurers ask,
// each leading into a free tool. Built from lib/guides.ts, like the sitemap and llms.txt.
import Link from 'next/link';
import { ArrowRight, BookOpen } from 'lucide-react';
import PlatformNavbar from '@/components/PlatformNavbar';
import Footer from '@/components/Footer';
import JsonLd from '@/components/JsonLd';
import { h2Style, bodyStyle, linkStyle } from '@/components/ToolLandingPage';
import { SITE_URL, pageMetadata } from '@/lib/seo';
import { ORGANIZATION_ID, WEBSITE_ID } from '@/lib/schema';
import { GUIDES, GUIDES_HUB, GUIDES_UPDATED } from '@/lib/guides';
import { TOOLS_HUB, formatUpdated, toolOgImage } from '@/lib/tool-pages';

const TITLE = 'Grassroots Football Guides: Junior Rules, Game Time, Fixtures & Fees';
const DESCRIPTION = 'Short, sourced answers for Australian grassroots football: MiniRoos rules by age, equal playing time, round robin match counts and how much to charge for registration.';
const H1 = 'Guides for coaches, organisers and treasurers';

export const metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: GUIDES_HUB.path, image: toolOgImage(TOOLS_HUB.path) });

const schema = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'CollectionPage',
      '@id': `${SITE_URL}${GUIDES_HUB.path}#page`,
      url: `${SITE_URL}${GUIDES_HUB.path}`,
      name: H1,
      description: DESCRIPTION,
      inLanguage: 'en-AU',
      dateModified: GUIDES_UPDATED,
      isPartOf: { '@id': WEBSITE_ID },
      publisher: { '@id': ORGANIZATION_ID },
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: GUIDES.length,
        itemListElement: GUIDES.map((g, i) => ({ '@type': 'ListItem', position: i + 1, name: g.label, description: g.question, url: `${SITE_URL}${g.path}` })),
      },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'itsfootball.club', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: GUIDES_HUB.label, item: `${SITE_URL}${GUIDES_HUB.path}` },
      ],
    },
  ],
};

export default function GuidesIndexPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <JsonLd data={schema} />
      <PlatformNavbar />

      <main className="container" style={{ padding: '3rem 1rem', flex: 1, maxWidth: '1120px' }}>
        <header style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div className="badge badge-primary" style={{ marginBottom: '0.75rem' }}>GUIDES · AUSTRALIA FIRST</div>
          <h1 style={{ fontSize: 'clamp(1.9rem, 5vw, 2.6rem)', fontWeight: 900, lineHeight: 1.1 }}>{H1}</h1>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '680px', margin: '0.9rem auto 0', fontSize: '1.02rem', lineHeight: 1.6 }}>
            Short answers to the questions that come up every season, checked against Football Australia, state federations
            and the Reserve Bank, with the numbers worked out. Each one ends in a free tool that does the job for you.
          </p>
          <p className="tool-updated">Updated <time dateTime={GUIDES_UPDATED}>{formatUpdated(GUIDES_UPDATED)}</time></p>
        </header>

        <ul className="tool-links tool-links-main">
          {GUIDES.map(g => (
            <li key={g.path}>
              <Link href={g.path} className="glass-panel tool-link tool-link-main">
                <strong><BookOpen size={16} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 6 }} />{g.label}</strong>
                <span>{g.question}</span>
                <em>Read the guide <ArrowRight size={14} aria-hidden="true" /></em>
              </Link>
            </li>
          ))}
        </ul>

        <section style={{ marginTop: '2.5rem' }} aria-labelledby="tools">
          <h2 id="tools" style={h2Style}>The free tools</h2>
          <p style={bodyStyle}>
            Every guide links to a tool: sub planners, lineup builders, a round robin generator and a season fee calculator.
            See them all on the <Link href={TOOLS_HUB.path} style={linkStyle}>free football tools</Link> page. No sign-up.
          </p>
        </section>
      </main>

      <Footer />
    </div>
  );
}
