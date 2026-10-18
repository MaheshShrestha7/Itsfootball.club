import Link from 'next/link';
import type { CSSProperties } from 'react';
import PlatformNavbar from '@/components/PlatformNavbar';
import Footer from '@/components/Footer';
import JsonLd from '@/components/JsonLd';
import { GuideLinks, ToolBreadcrumb, ToolExampleFigure, ToolLinks, ToolUpdated, toolBreadcrumbSchema, toolSchemaExtras } from '@/components/ToolLandingPage';
import TournamentMakerTool from '@/components/TournamentMakerTool';
import { SITE_URL, pageMetadata } from '@/lib/seo';
import { ORGANIZATION_ID, WEBSITE_ID, howToSchema } from '@/lib/schema';
import { MAKER_PATH } from '@/lib/public-tournaments';
import { toolOgImage } from '@/lib/tool-pages';

const TITLE = 'Free Soccer Tournament Maker | Live Bracket & Fixtures';
const DESCRIPTION = 'Create live soccer tournament brackets, round robins and knockout cups. Fixtures and group tables update live as you enter scores. Free, no sign-up.';

export const metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: MAKER_PATH, image: toolOgImage(MAKER_PATH) });

const STEPS = [
  { name: 'Name your tournament', text: 'Add the date and kick-off, the venue, the team size and who is organising it.' },
  { name: 'Pick the format', text: 'Knockout, a league where everyone plays everyone, or groups followed by a knockout.' },
  { name: 'Paste your teams', text: 'One team per line. The groups, fixtures and bracket are worked out for you, and you can shuffle the draw.' },
  { name: 'Publish and share the link', text: 'Sign in once to publish. You get a link like itsfootball.club/tournaments/your-cup to share with teams, families and local news.' },
  { name: 'Enter scores on the day', text: 'Tables, the bracket and the next round fill in by themselves as you enter each result, live for everyone following.' },
];

const FEATURES = [
  'Knockout, league, or groups + knockout',
  'Up to 32 teams and 8 groups',
  'Penalties and a 3rd place match',
  'Tables and the bracket update as scores come in',
  'Live scores for everyone with the link',
  'Embed the live bracket on a club website or news page',
  'Share button for WhatsApp and Facebook',
  'Change kick-off times and pitches after publishing',
  'Free, with no ads',
];

// Match counts per format, worked out the way the maker draws them (each group plays a round robin,
// then the qualifiers play a knockout; byes are not matches). No 3rd place match.
const roundRobinMatches = (teams: number) => (teams * (teams - 1)) / 2;
const MATCH_COUNTS = [[4, 1], [6, 2], [8, 2], [12, 4], [16, 4], [24, 8], [32, 8]].map(([teams, groups]) => {
  const sizes = Array.from({ length: groups }, (_, i) => Math.floor(teams / groups) + (i < teams % groups ? 1 : 0));
  return {
    teams,
    knockout: teams - 1,
    league: roundRobinMatches(teams),
    groups: sizes.reduce((sum, n) => sum + roundRobinMatches(n), 0) + groups * 2 - 1,
    groupLabel: groups === 1 ? '1 group of 4, top 2 play a final' : `${groups} groups of ${teams / groups}, top 2 go through`,
  };
});

const QUESTIONS = [
  { q: 'What is the best free soccer tournament maker?', a: "itsfootball.club's tournament maker is free with no ads. It handles knockouts, leagues, and group stages followed by a knockout, with live scores, tables and a bracket that update as you enter results, all at one link you can share." },
  { q: 'How do I make a tournament bracket?', a: 'Type the tournament name, pick a format, paste your teams one per line and press Publish. The bracket and fixtures are drawn for you. As you enter scores, winners move into the next round on their own.' },
  { q: 'Do teams or spectators need an account?', a: 'No. Anyone with the link can follow fixtures, results, tables and the bracket in their browser. Only the organiser signs in, so only they can enter scores.' },
  { q: 'Can I run a 6-a-side or 5-a-side gala day?', a: 'Yes. Pick "One day" and the team size, then change kick-off times and pitches for each match after publishing. It works for any team size from 5-a-side to 11-a-side.' },
  { q: 'How do groups and knockouts work?', a: 'Teams are dealt into groups and play each other once. The top teams from each group (you choose how many) go into a knockout bracket, which fills in automatically when the groups finish.' },
  { q: 'Can I put the bracket on our club website?', a: 'Yes. The Embed button on your tournament page gives you a short code to paste into any website or news article. It shows the live bracket, tables or fixtures and updates by itself.' },
  { q: 'How many matches are in a knockout tournament?', a: 'One fewer than the number of teams, because every match knocks one team out: 8 teams play 7 matches and 16 teams play 15. A 3rd place match adds one more. If the number of teams is not a power of two, some teams get a bye into round 2.' },
  { q: 'How many matches are in a round robin league?', a: 'Every team plays every other team once, so n teams play n × (n − 1) ÷ 2 matches: 6 teams play 15 matches, 8 teams play 28 and 10 teams play 45. For a one-day event with more than 6 teams, groups followed by a knockout keep the day shorter.' },
  { q: 'Is it really free?', a: 'Yes. Tournaments are free, with no ads and no paid tier. If you run a club, the full club website with a live match centre, member passes and payments is free too.' },
];

const schema = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebApplication',
      '@id': `${SITE_URL}${MAKER_PATH}#app`,
      name: 'Free Soccer Tournament Maker',
      alternateName: ['Tournament bracket generator', 'Cup draw maker', 'Football tournament organiser'],
      url: `${SITE_URL}${MAKER_PATH}`,
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
      ...toolSchemaExtras(MAKER_PATH),
    },
    toolBreadcrumbSchema(MAKER_PATH, 'Free soccer tournament maker'),
    {
      '@type': 'FAQPage',
      mainEntity: QUESTIONS.map(i => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })),
    },
  ],
};

const howTo = howToSchema('How to make a soccer tournament bracket', MAKER_PATH, STEPS);

const h2Style: CSSProperties = { fontSize: 'clamp(1.3rem, 3.2vw, 1.6rem)', fontWeight: 900, marginBottom: '0.75rem' };
const bodyStyle: CSSProperties = { color: 'var(--text-secondary)', lineHeight: 1.7 };
const linkStyle: CSSProperties = { color: 'var(--club-ink)', fontWeight: 600 };

export default function TournamentMakerPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <JsonLd data={schema} />
      <JsonLd data={howTo} />
      <PlatformNavbar />

      <main className="container" style={{ padding: '3rem 1rem', flex: 1, maxWidth: '1180px' }}>
        <ToolBreadcrumb name="Free soccer tournament maker" />
        <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div className="badge badge-primary" style={{ marginBottom: '0.75rem' }}>FREE TOOL · LIVE BRACKET LINK</div>
          <h1 style={{ fontSize: 'clamp(1.9rem, 5vw, 2.6rem)', fontWeight: 900, lineHeight: 1.1 }}>
            Free soccer tournament maker
          </h1>
          {/* Answer first: the sentence search and AI engines lift as the summary */}
          <div
            className="glass-panel"
            style={{
              maxWidth: '740px',
              margin: '1.25rem auto 0',
              padding: '1rem 1.4rem',
              textAlign: 'left',
              borderLeft: '4px solid var(--club-green, #10b981)',
              background: 'rgba(255, 255, 255, 0.03)',
            }}
          >
            <p style={{ color: 'var(--text-primary)', margin: 0, fontSize: '1.02rem', lineHeight: 1.65, fontWeight: 500 }}>
              Run soccer tournaments across knockout, round robin league, or group stage formats for up to 32 teams. A knockout bracket requires N − 1 matches (e.g. 16 teams = 15 matches), while a round robin requires N × (N − 1) ÷ 2 matches (e.g. 8 teams = 28 matches). Generate your live updating tournament schedule below.
            </p>
          </div>
          <ToolUpdated />
        </header>

        <TournamentMakerTool />

        <section className="glass-panel" style={{ padding: '1.6rem', marginTop: '3rem' }} aria-labelledby="how">
          <h2 id="how" style={h2Style}>How to run a tournament</h2>
          <ol className="vs-steps" style={{ maxWidth: 'none', margin: '0' }}>
            {STEPS.map(s => <li key={s.name}><span><strong>{s.name}.</strong> {s.text}</span></li>)}
          </ol>
        </section>

        <ToolExampleFigure path={MAKER_PATH} />

        <section style={{ marginTop: '2.5rem' }} aria-labelledby="features">
          <h2 id="features" style={h2Style}>What it does</h2>
          <ul style={{ ...bodyStyle, paddingLeft: '1.2rem', columns: '2 260px', columnGap: '2rem' }}>
            {FEATURES.map(f => <li key={f} style={{ breakInside: 'avoid', marginBottom: '0.3rem' }}>{f}</li>)}
          </ul>
        </section>

        <section style={{ marginTop: '2.5rem' }} aria-labelledby="counts">
          <h2 id="counts" style={h2Style}>How many matches will you play?</h2>
          <p style={bodyStyle}>
            A knockout has one fewer match than teams. A league where everyone plays everyone once has n × (n − 1) ÷ 2 matches.
            Groups followed by a knockout sit in between, which is why most one-day cups and gala days use them.
          </p>
          <div className="glass-panel" style={{ marginTop: '1rem', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <caption style={{ textAlign: 'left', padding: '0.9rem 0.8rem 0.4rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Matches by format and number of teams (no 3rd place match)</caption>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-primary)' }}>
                  {['Teams', 'Knockout', 'League', 'Groups + knockout'].map(h => <th key={h} scope="col" style={{ padding: '0.6rem 0.8rem', fontWeight: 800 }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {MATCH_COUNTS.map(r => (
                  <tr key={r.teams} style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                    <th scope="row" style={{ padding: '0.6rem 0.8rem', textAlign: 'left', color: 'var(--text-primary)' }}>{r.teams}</th>
                    <td style={{ padding: '0.6rem 0.8rem' }}>{r.knockout}</td>
                    <td style={{ padding: '0.6rem 0.8rem' }}>{r.league}</td>
                    <td style={{ padding: '0.6rem 0.8rem' }}>{r.groups} <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.78rem' }}>{r.groupLabel}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
            Picking the team for a match? Try the <Link href="/tools/lineup-builder" style={linkStyle}>free lineup builder</Link>.
            Running a club? <Link href="/create-club" style={linkStyle}>Launch your free club site</Link>.
          </p>
        </section>

        <GuideLinks path={MAKER_PATH} />
        <ToolLinks path={MAKER_PATH} heading="Builders for each format" />
      </main>

      <Footer />
    </div>
  );
}
