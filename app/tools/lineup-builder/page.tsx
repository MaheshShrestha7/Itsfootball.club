import Link from 'next/link';
import type { CSSProperties } from 'react';
import PlatformNavbar from '@/components/PlatformNavbar';
import Footer from '@/components/Footer';
import JsonLd from '@/components/JsonLd';
import { ToolBreadcrumb, ToolLinks, toolBreadcrumbSchema } from '@/components/ToolLandingPage';
import { LINEUP_FORMAT_PAGES } from '@/lib/tool-pages';
import LineupBuilderTool from '@/components/LineupBuilderTool';
import { SITE_URL, pageMetadata } from '@/lib/seo';
import { ORGANIZATION_ID, WEBSITE_ID, howToSchema } from '@/lib/schema';

const PATH = '/tools/lineup-builder';
const TITLE = 'Free Football Lineup Builder | Soccer Team Sheet Maker';
const DESCRIPTION = 'Build a 5, 7, 9 or 11-a-side football lineup on a pitch and download it as an image for Instagram, Facebook or WhatsApp. Free, no sign-up.';

export const metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const STEPS = [
  { name: 'Pick the format and formation', text: '5-a-side, 7-a-side, 9-a-side or 11-a-side, then one of 28 formations, or free form.' },
  { name: 'Name your players', text: 'Tap a player on the pitch, or use the list, to type their name, shirt number and position, and pick a captain.' },
  { name: 'Move players around', text: 'Drag anyone to where they will actually play. The lineup switches to free form so your exact positions are kept.' },
  { name: 'Choose the look', text: 'Team colour, your badge, player icons (circle, jersey, square, hexagon or triangle) and a pitch or list layout.' },
  { name: 'Download the image', text: 'A post (1080 × 1350) or story (1080 × 1920) PNG, ready for Instagram, Facebook or the team WhatsApp.' },
];

// The shapes the builder offers, by format (kept in step with components/LineupBuilderTool.tsx and TacticalPitch's presets)
const FORMATIONS = [
  { format: '5-a-side', note: 'Futsal and small-sided games', shapes: ['1-2-1', '2-1-1', '2-2', '1-1-2'] },
  { format: '7-a-side', note: 'Junior and mini soccer', shapes: ['2-3-1', '3-2-1', '2-2-2', '3-1-2', '1-3-2', '2-1-2-1'] },
  { format: '9-a-side', note: 'Junior and youth football', shapes: ['3-2-3', '3-3-2', '4-3-1', '3-4-1', '2-4-2', '4-2-2'] },
  { format: '11-a-side', note: 'Full matches', shapes: ['4-3-3', '4-2-3-1', '4-4-2', '3-5-2', '3-2-4-1', '4-1-4-1', '4-4-1-1', '4-1-2-1-2', '4-5-1', '3-4-3', '5-3-2', '5-4-1'] },
];

const QUESTIONS = [
  { q: 'What is the best free football lineup builder?', a: 'itsfootball.club\'s lineup builder is free with no account or ads. It covers 5, 7, 9 and 11-a-side with 28 formations plus free form, and downloads a post or story image for social media and WhatsApp.' },
  { q: 'How do I make a soccer lineup graphic?', a: 'Pick your format and formation, tap each player on the pitch to type their name and number, drag them into position, choose your team colour and badge, then press Download image. It takes about a minute.' },
  { q: 'Do I need to sign up or install an app?', a: 'No. It runs in your phone or computer browser with no login. Your lineup is kept only in your own browser, and the image is drawn on your device, so nothing is uploaded.' },
  { q: 'What is the best formation for 7-a-side?', a: '2-3-1 is the most common 7-a-side formation in junior football, because it gives width in midfield and a clear striker. 3-2-1 is safer at the back, and 2-1-2-1 suits a team that keeps the ball.' },
  { q: 'What is the best formation for 9-a-side?', a: '3-2-3 is a popular 9-a-side shape for attacking width. 3-3-2 adds a midfielder for control, and 4-3-1 is the most defensive of the common shapes.' },
  { q: 'What is the best 5-a-side formation?', a: '1-2-1 (a diamond) is the usual 5-a-side shape: one defender, two wide players and a pivot up front. 2-1-1 is steadier at the back, and 2-2 is simple for casual games.' },
  { q: 'Can I show the lineup as a list instead of a pitch?', a: 'Yes. Choose List under Image style for a numbered team sheet with the captain marked. Pitch is the default.' },
  { q: 'What size is the image?', a: 'Post is 1080 × 1350 for an Instagram or Facebook feed post and WhatsApp chats. Story is 1080 × 1920 for Instagram and Facebook stories and WhatsApp status.' },
  { q: 'Can I see who is available before I pick the team?', a: "Yes, with a free itsfootball.club club site. Players mark themselves available for each fixture, you pick the lineup from that squad, and it publishes to your club's match page with live scores." },
];

const FEATURES = [
  '5, 7, 9 and 11-a-side formats',
  '28 formations plus free form',
  'Tap a player to name them; drag to move',
  'Shirt numbers, positions and captain',
  'Circle, jersey, square, hexagon or triangle player icons',
  'Team colour and your own badge',
  'Pitch or list layout',
  'Post (4:5) and story (9:16) PNG download',
  'No sign-up, nothing uploaded',
];

const schema = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebApplication',
      '@id': `${SITE_URL}${PATH}#app`,
      name: 'Free Football Lineup Builder',
      alternateName: ['Soccer lineup maker', 'Football team sheet maker', 'Starting XI graphic maker'],
      url: `${SITE_URL}${PATH}`,
      description: DESCRIPTION,
      applicationCategory: 'SportsApplication',
      operatingSystem: 'Any (web browser)',
      browserRequirements: 'Requires JavaScript',
      inLanguage: 'en-AU',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'AUD' },
      featureList: FEATURES,
      publisher: { '@id': ORGANIZATION_ID },
      isPartOf: { '@id': WEBSITE_ID },
    },
    toolBreadcrumbSchema(PATH, 'Free football lineup builder'),
    {
      '@type': 'FAQPage',
      mainEntity: QUESTIONS.map(i => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })),
    },
  ],
};

const howTo = howToSchema('How to make a football lineup graphic', PATH, STEPS);

/** The format's own landing page, if it has one */
const page = (format: string) => LINEUP_FORMAT_PAGES.find(p => p.path.includes(`/${format}-`));

const h2Style: CSSProperties = { fontSize: 'clamp(1.3rem, 3.2vw, 1.6rem)', fontWeight: 900, marginBottom: '0.75rem' };
const bodyStyle: CSSProperties = { color: 'var(--text-secondary)', lineHeight: 1.7 };
const linkStyle: CSSProperties = { color: 'var(--club-ink)', fontWeight: 600 };

export default function LineupBuilderPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <JsonLd data={schema} />
      <JsonLd data={howTo} />
      <PlatformNavbar />

      <main className="container" style={{ padding: '3rem 1rem', flex: 1, maxWidth: '1120px' }}>
        <ToolBreadcrumb name="Free football lineup builder" />
        <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div className="badge badge-primary" style={{ marginBottom: '0.75rem' }}>FREE TOOL · NO SIGN-UP</div>
          <h1 style={{ fontSize: 'clamp(1.9rem, 5vw, 2.6rem)', fontWeight: 900, lineHeight: 1.1 }}>
            Free football lineup builder
          </h1>
          {/* Answer first: the sentence search and AI engines lift as the summary */}
          <p style={{ color: 'var(--text-secondary)', maxWidth: '660px', margin: '0.9rem auto 0', fontSize: '1.02rem', lineHeight: 1.6 }}>
            Make your soccer starting lineup for 5, 7, 9 or 11-a-side in a minute: pick a formation, tap players to name
            them, drag them into place and download a team sheet image for Instagram, Facebook or WhatsApp. Free, with no login.
          </p>
        </header>

        <LineupBuilderTool />

        <section className="glass-panel" style={{ padding: '1.6rem', marginTop: '3rem' }} aria-labelledby="how">
          <h2 id="how" style={h2Style}>How to make a lineup graphic</h2>
          <ol className="vs-steps" style={{ maxWidth: 'none', margin: '0' }}>
            {STEPS.map(s => <li key={s.name}><span><strong>{s.name}.</strong> {s.text}</span></li>)}
          </ol>
        </section>

        <section style={{ marginTop: '2.5rem' }} aria-labelledby="formations">
          <h2 id="formations" style={h2Style}>Formations you can use</h2>
          <p style={{ ...bodyStyle, marginBottom: '1rem' }}>
            Every format starts from a common formation, and Free form lets you put players anywhere.
          </p>
          <div className="lineup-formations">
            {FORMATIONS.map(f => (
              <div key={f.format} className="glass-panel" style={{ padding: '1.1rem 1.25rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>{f.format}</h3>
                {page(f.format) && <Link href={page(f.format)!.path} style={{ ...linkStyle, fontSize: '0.82rem' }}>Open the {page(f.format)!.label}</Link>}
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.15rem 0 0.6rem' }}>{f.note}</p>
                <ul className="lineup-formation-list">
                  {f.shapes.map(s => <li key={s}>{s}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section style={{ marginTop: '2.5rem' }} aria-labelledby="features">
          <h2 id="features" style={h2Style}>What it does</h2>
          <ul style={{ ...bodyStyle, paddingLeft: '1.2rem', columns: '2 260px', columnGap: '2rem' }}>
            {FEATURES.map(f => <li key={f} style={{ breakInside: 'avoid', marginBottom: '0.3rem' }}>{f}</li>)}
          </ul>
        </section>

        <section style={{ marginTop: '2.5rem' }} aria-labelledby="faq">
          <h2 id="faq" style={h2Style}>Questions</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {QUESTIONS.map(i => (
              <details key={i.q} className="glass-panel" style={{ padding: '1rem 1.25rem' }}>
                <summary style={{ fontWeight: 700, cursor: 'pointer' }}>{i.q}</summary>
                <p style={{ ...bodyStyle, marginTop: '0.5rem' }}>{i.a}</p>
              </details>
            ))}
          </div>
          <p style={{ ...bodyStyle, marginTop: '1.25rem', textAlign: 'center' }}>
            Running a club? See how the <Link href="/live-scores" style={linkStyle}>free live match centre</Link> works,
            or <Link href="/create-club" style={linkStyle}>launch your free club site</Link>.
          </p>
        </section>

        <ToolLinks path={PATH} heading="Builders for each format" />
      </main>

      <Footer />
    </div>
  );
}
