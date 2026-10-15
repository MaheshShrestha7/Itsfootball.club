// The free tools hub (/tools): every tool and format page, grouped by job, so people, search engines and
// AI assistants have one page to land on and cite. Built from lib/tool-pages.ts, like the sitemap and llms.txt.
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { ArrowRight, ClipboardList, Timer, Trophy, Wallet, type LucideIcon } from 'lucide-react';
import PlatformNavbar from '@/components/PlatformNavbar';
import Footer from '@/components/Footer';
import JsonLd from '@/components/JsonLd';
import { h2Style, bodyStyle, linkStyle } from '@/components/ToolLandingPage';
import { SITE_URL, pageMetadata } from '@/lib/seo';
import { ORGANIZATION_ID, WEBSITE_ID } from '@/lib/schema';
import { LINEUP_TOOL, PLAYING_TIME_TOOL, RESULT_TOOL, SEASON_FEE_TOOL, TOOL_GROUPS, TOOLS_HUB, TOURNAMENT_TOOL, type ToolPageLink } from '@/lib/tool-pages';

const TITLE = 'Free Football Tools for Coaches and Clubs | No Sign-up';
const DESCRIPTION =
  'Free soccer tools for grassroots coaches, clubs and organisers: lineup builder, equal playing time calculator, tournament maker, result graphics and a season fee calculator. No sign-up.';
const H1 = 'Free football tools for coaches, clubs and organisers';

export const metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: TOOLS_HUB.path });

const GROUP_ICONS: Record<string, { Icon: LucideIcon; color: string }> = {
  'team-sheets': { Icon: ClipboardList, color: 'var(--c-blue)' },
  matchday: { Icon: Timer, color: 'var(--c-green)' },
  tournaments: { Icon: Trophy, color: 'var(--c-amber)' },
  'club-money': { Icon: Wallet, color: 'var(--c-red)' },
};

// "Which tool do I need?": the job someone has in mind, and the tool that does it
const NEEDS: { need: string; tool: ToolPageLink; answer: string }[] = [
  { need: 'Posting the team for Saturday?', tool: LINEUP_TOOL, answer: 'pick a formation, name your players and download a team sheet image.' },
  { need: 'Want every kid to get the same minutes?', tool: PLAYING_TIME_TOOL, answer: 'enter the squad and match length and get a substitution schedule.' },
  { need: 'Sharing the score after full time?', tool: RESULT_TOOL, answer: 'add both badges, the score and the scorers, and download a story or post.' },
  { need: 'Running a gala day or end-of-season cup?', tool: TOURNAMENT_TOOL, answer: 'draw the fixtures and share a live page with tables and a bracket.' },
  { need: "Setting this season's rego fee?", tool: SEASON_FEE_TOOL, answer: 'add up the costs and see the fee each player pays to break even.' },
];

const ALL_TOOLS = TOOL_GROUPS.flatMap(g => [...g.main, ...g.formats]);

const schema = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'CollectionPage',
      '@id': `${SITE_URL}${TOOLS_HUB.path}#page`,
      url: `${SITE_URL}${TOOLS_HUB.path}`,
      name: H1,
      description: DESCRIPTION,
      inLanguage: 'en-AU',
      isPartOf: { '@id': WEBSITE_ID },
      publisher: { '@id': ORGANIZATION_ID },
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: ALL_TOOLS.length,
        itemListElement: ALL_TOOLS.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.label, description: t.blurb, url: `${SITE_URL}${t.path}` })),
      },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'itsfootball.club', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: TOOLS_HUB.label, item: `${SITE_URL}${TOOLS_HUB.path}` },
      ],
    },
  ],
};

const iconStyle = (color: string): CSSProperties => ({
  width: 38, height: 38, borderRadius: 11, display: 'grid', placeItems: 'center', flexShrink: 0,
  background: `color-mix(in srgb, ${color} 16%, transparent)`, color,
});

export default function ToolsHubPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <JsonLd data={schema} />
      <PlatformNavbar />

      <main className="container" style={{ padding: '3rem 1rem', flex: 1, maxWidth: '1120px' }}>
        <header style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div className="badge badge-primary" style={{ marginBottom: '0.75rem' }}>FREE TOOLS · NO SIGN-UP</div>
          <h1 style={{ fontSize: 'clamp(1.9rem, 5vw, 2.6rem)', fontWeight: 900, lineHeight: 1.1 }}>{H1}</h1>
          {/* Answer first: the sentence search and AI engines lift as the summary */}
          <p style={{ color: 'var(--text-secondary)', maxWidth: '680px', margin: '0.9rem auto 0', fontSize: '1.02rem', lineHeight: 1.6 }}>
            Free soccer tools for grassroots football: build a lineup, plan fair substitutions, post your full-time result,
            run a tournament with a live bracket and set the season&apos;s fees. They work in the browser on a phone or
            computer, with no sign-up and nothing to install.
          </p>
        </header>

        {TOOL_GROUPS.map(g => {
          const { Icon, color } = GROUP_ICONS[g.id];
          return (
            <section key={g.id} id={g.id} style={{ marginTop: '2.5rem' }} aria-labelledby={`${g.id}-h`}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem', marginBottom: '1rem' }}>
                <span style={iconStyle(color)} aria-hidden="true"><Icon size={19} /></span>
                <div>
                  <h2 id={`${g.id}-h`} style={{ ...h2Style, marginBottom: '0.25rem' }}>{g.heading}</h2>
                  <p style={{ ...bodyStyle, margin: 0 }}>{g.blurb}</p>
                </div>
              </div>
              <ul className="tool-links tool-links-main">
                {g.main.map(t => (
                  <li key={t.path}>
                    <Link href={t.path} className="glass-panel tool-link tool-link-main" style={{ '--tc': color } as CSSProperties}>
                      <strong>{t.label}</strong>
                      <span>{t.blurb}</span>
                      <em>Open the tool <ArrowRight size={14} aria-hidden="true" /></em>
                    </Link>
                  </li>
                ))}
              </ul>
              {g.formats.length > 0 && (
                <ul className="tool-links" style={{ marginTop: '0.75rem' }}>
                  {g.formats.map(t => (
                    <li key={t.path}>
                      <Link href={t.path} className="glass-panel tool-link">
                        <strong>{t.label}</strong>
                        <span>{t.blurb}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}

        <section className="glass-panel" style={{ padding: '1.6rem', marginTop: '3rem' }} aria-labelledby="which">
          <h2 id="which" style={h2Style}>Which tool do I need?</h2>
          <ul className="tool-needs">
            {NEEDS.map(n => (
              <li key={n.need}>
                <strong>{n.need}</strong>{' '}
                <span>Use the <Link href={n.tool.path} style={linkStyle}>{n.tool.label.toLowerCase()}</Link>: {n.answer}</span>
              </li>
            ))}
          </ul>
        </section>

        <section style={{ marginTop: '2.5rem' }} aria-labelledby="why-free">
          <h2 id="why-free" style={h2Style}>Why are they free?</h2>
          <p style={bodyStyle}>
            The tools are made by itsfootball.club, which gives grassroots and community clubs their own website for free.
            Clubs on itsfootball.club get the same lineups, results graphics and tournaments built in, connected to their
            squad and fixtures, plus a <Link href="/live-scores" style={linkStyle}>live match centre</Link> supporters follow
            in the browser. If that sounds useful, <Link href="/create-club" style={linkStyle}>launch your free club site</Link>.
          </p>
        </section>
      </main>

      <Footer />
    </div>
  );
}
