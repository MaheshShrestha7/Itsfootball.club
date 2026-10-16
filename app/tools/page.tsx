// The free tools hub (/tools): every tool and format page, grouped by job, so people, search engines and
// AI assistants have one page to land on and cite. Built from lib/tool-pages.ts, like the sitemap and llms.txt.
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { ArrowRight, BookOpen, MapPin, type LucideIcon } from 'lucide-react';
import { TOOL_GROUP_ICONS } from '@/components/tool-group-icons';
import PlatformNavbar from '@/components/PlatformNavbar';
import Footer from '@/components/Footer';
import JsonLd from '@/components/JsonLd';
import { ToolUpdated, h2Style, bodyStyle, linkStyle } from '@/components/ToolLandingPage';
import { SITE_URL, pageMetadata } from '@/lib/seo';
import { GUIDES, GUIDES_HUB } from '@/lib/guides';
import { ORGANIZATION_ID, WEBSITE_ID } from '@/lib/schema';
import { GROUNDS_LINK, LINEUP_TOOL, PLAYER_CARD_TOOL, PLAYING_TIME_TOOL, RESULT_TOOL, SEASON_FEE_TOOL, TOOL_FORMATS, TOOL_GROUPS, TOOLS_HUB, TOURNAMENT_TOOL, TOOLS_UPDATED, type ToolPageLink, toolExample, toolOgImage } from '@/lib/tool-pages';

const TITLE = 'Free Football Tools for Coaches and Clubs | No Sign-up';
const DESCRIPTION =
  'Free soccer tools for grassroots coaches, clubs and organisers: lineup builder, equal playing time calculator, tournament maker, result graphics, a player card maker and a season fee calculator. No sign-up.';
const H1 = 'Free football tools for coaches, clubs and organisers';

export const metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: TOOLS_HUB.path, image: toolOgImage(TOOLS_HUB.path) });

const GROUP_ICONS = TOOL_GROUP_ICONS;
const MORE = { id: 'guides-and-grounds', short: 'Guides & grounds', color: 'var(--c-purple)' };

// "Which tool do I need?": the job someone has in mind, and the tool that does it
const NEEDS: { need: string; tool: ToolPageLink; answer: string }[] = [
  { need: 'Posting the team for Saturday?', tool: LINEUP_TOOL, answer: 'pick a formation, name your players and download a team sheet image.' },
  { need: 'Want every kid to get the same minutes?', tool: PLAYING_TIME_TOOL, answer: 'enter the squad and match length and get a substitution schedule.' },
  { need: 'Sharing the score after full time?', tool: RESULT_TOOL, answer: 'add both badges, the score and the scorers, and download a story or post.' },
  { need: 'Making a card for a player?', tool: PLAYER_CARD_TOOL, answer: 'add their photo, position and season stats and download a player card, or a Team of the Week or Player of the Month card.' },
  { need: 'Running a gala day or end-of-season cup?', tool: TOURNAMENT_TOOL, answer: 'draw the fixtures and share a live page with tables and a bracket.' },
  { need: "Setting this season's rego fee?", tool: SEASON_FEE_TOOL, answer: 'add up the costs and see the fee each player pays to break even.' },
];

// Each main tool followed by its format pages, group by group, as the cards show them
const ALL_TOOLS = TOOL_GROUPS.flatMap(g => g.main.flatMap(t => [t, ...(TOOL_FORMATS[t.path] ?? [])]));

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
      dateModified: TOOLS_UPDATED,
      image: `${SITE_URL}${toolOgImage(TOOLS_HUB.path)}`,
      isPartOf: { '@id': WEBSITE_ID },
      publisher: { '@id': ORGANIZATION_ID },
      // Every tool page, in the order the page shows them, plus one list per group so the structure matches the page
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: ALL_TOOLS.length,
        itemListElement: ALL_TOOLS.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.label, description: t.blurb, url: `${SITE_URL}${t.path}` })),
      },
      hasPart: TOOL_GROUPS.map(g => ({
        '@type': 'ItemList',
        '@id': `${SITE_URL}${TOOLS_HUB.path}#${g.id}`,
        name: g.heading,
        description: g.blurb,
        numberOfItems: g.main.length + g.formats.length,
        itemListElement: [...g.main, ...g.formats].map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.label, url: `${SITE_URL}${t.path}` })),
      })),
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

function GroupHeading({ id, heading, blurb, Icon, color }: { id: string; heading: string; blurb: string; Icon: LucideIcon; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem', marginBottom: '1rem' }}>
      <span style={iconStyle(color)} aria-hidden="true"><Icon size={19} /></span>
      <div>
        <h2 id={`${id}-h`} style={{ ...h2Style, marginBottom: '0.2rem' }}>{heading}</h2>
        <p style={{ ...bodyStyle, margin: 0 }}>{blurb}</p>
      </div>
    </div>
  );
}

/** One main tool: its example output, what it does, and its format pages as "Start with" buttons */
function ToolCard({ tool, color }: { tool: ToolPageLink; color: string }) {
  const example = toolExample(tool.path);
  const formats = TOOL_FORMATS[tool.path] ?? [];
  return (
    <article className="glass-panel tool-card" style={{ '--tc': color } as CSSProperties}>
      {example && (
        <Link href={tool.path} className="tool-card-thumb" tabIndex={-1} aria-hidden="true">
          <img src={example.src} width={example.width} height={example.height} alt="" loading="lazy" decoding="async" />
        </Link>
      )}
      <div className="tool-card-body">
        <h3><Link href={tool.path}>{tool.label}</Link></h3>
        <p>{tool.blurb}.</p>
        {formats.length > 0 && (
          <div className="tool-card-formats">
            <span>Start with</span>
            {/* The button shows the start of the name; the rest stays in the link text for search engines and screen readers */}
            {formats.map(f => {
              const short = f.short && f.label.startsWith(f.short) ? f.short : f.label;
              return (
                <Link key={f.path} href={f.path} className="tool-chip" title={f.label}>
                  {short}<span className="sr-only">{f.label.slice(short.length)}</span>
                </Link>
              );
            })}
          </div>
        )}
        <Link href={tool.path} className="tool-card-open">Open <ArrowRight size={14} aria-hidden="true" /><span className="sr-only"> the {tool.label.toLowerCase()}</span></Link>
      </div>
    </article>
  );
}

function GroupSection({ index }: { index: number }) {
  const g = TOOL_GROUPS[index];
  const { Icon, color } = GROUP_ICONS[g.id];
  return (
    <section id={g.id} className="tools-group" aria-labelledby={`${g.id}-h`}>
      <GroupHeading id={g.id} heading={g.heading} blurb={g.blurb} Icon={Icon} color={color} />
      <div className="tool-cards">
        {g.main.map(t => <ToolCard key={t.path} tool={t} color={color} />)}
      </div>
    </section>
  );
}

export default function ToolsHubPage() {
  // Groups with one tool share a row on wide screens so no card sits alone on a half-empty row
  const singles = TOOL_GROUPS.map((g, i) => (g.main.length === 1 ? i : -1)).filter(i => i >= 0);
  const pairs = TOOL_GROUPS.map((_, i) => i).filter(i => !singles.includes(i));
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <JsonLd data={schema} />
      <PlatformNavbar />

      <main className="container" style={{ padding: '2.6rem 1rem 3rem', flex: 1, maxWidth: '1120px' }}>
        <header style={{ textAlign: 'center', marginBottom: '1.4rem' }}>
          <div className="badge badge-primary" style={{ marginBottom: '0.75rem' }}>FREE TOOLS · NO SIGN-UP</div>
          <h1 style={{ fontSize: 'clamp(1.9rem, 5vw, 2.6rem)', fontWeight: 900, lineHeight: 1.1 }}>{H1}</h1>
          {/* Answer first: the sentence search and AI engines lift as the summary */}
          <p style={{ color: 'var(--text-secondary)', maxWidth: '680px', margin: '0.9rem auto 0', fontSize: '1.02rem', lineHeight: 1.6 }}>
            Free soccer tools for grassroots football: build a lineup, plan fair substitutions, post your full-time result, make a player card,
            run a tournament with a live bracket and set the season&apos;s fees. They work in the browser on a phone or
            computer, with no sign-up and nothing to install.
          </p>
          <ToolUpdated />
        </header>

        <nav className="tools-jump" aria-label="Jump to a group of tools">
          {TOOL_GROUPS.map(g => (
            <a key={g.id} href={`#${g.id}`}><i style={{ background: GROUP_ICONS[g.id].color }} aria-hidden="true" />{g.short}</a>
          ))}
          <a href={`#${MORE.id}`}><i style={{ background: MORE.color }} aria-hidden="true" />{MORE.short}</a>
        </nav>

        {pairs.map(i => <GroupSection key={i} index={i} />)}
        <div className="tools-group-pair">
          {singles.map(i => <GroupSection key={i} index={i} />)}
        </div>

        <section id={MORE.id} className="tools-group" aria-labelledby={`${MORE.id}-h`}>
          <GroupHeading id={MORE.id} heading="Guides and grounds" Icon={BookOpen} color={MORE.color}
            blurb="Short, sourced answers to the rules and numbers behind the tools, and where to find the ground." />
          <ul className="tool-links tool-resources">
            {GUIDES.map(g => (
              <li key={g.path}>
                <Link href={g.path} className="glass-panel tool-link">
                  <BookOpen size={18} aria-hidden="true" />
                  <span><strong>{g.label}</strong><span>{g.blurb}</span></span>
                </Link>
              </li>
            ))}
            <li>
              <Link href={GROUNDS_LINK.path} className="glass-panel tool-link">
                <MapPin size={18} aria-hidden="true" />
                <span><strong>{GROUNDS_LINK.label}</strong><span>{GROUNDS_LINK.blurb}</span></span>
              </Link>
            </li>
          </ul>
          <p style={{ ...bodyStyle, marginTop: '0.8rem', fontSize: '0.92rem' }}>
            <Link href={GUIDES_HUB.path} style={linkStyle}>All guides</Link>
          </p>
        </section>

        <section className="glass-panel" style={{ padding: '1.6rem', marginTop: '2.6rem' }} aria-labelledby="which">
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
