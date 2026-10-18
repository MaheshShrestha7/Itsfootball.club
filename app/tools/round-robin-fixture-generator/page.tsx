import TournamentMakerTool from '@/components/TournamentMakerTool';
import ToolLandingPage, { bodyStyle } from '@/components/ToolLandingPage';
import { pageMetadata } from '@/lib/seo';
import { TOURNAMENT_TOOL, toolOgImage } from '@/lib/tool-pages';

const PATH = '/tools/round-robin-fixture-generator';
const TITLE = 'Free Round Robin Fixture Generator | Soccer League Draw';
const DESCRIPTION = 'Generate round robin soccer fixtures where every team plays once. Includes live league tables that update as scores are entered. Free, no sign-up.';

export const metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH, image: toolOgImage(PATH) });

// Worked out the way the maker draws a league (circle method, one bye a round when the count is odd)
const ROWS = [4, 5, 6, 8, 10, 12, 16].map(teams => ({
  teams,
  matches: (teams * (teams - 1)) / 2,
  rounds: teams % 2 ? teams : teams - 1,
  perTeam: teams - 1,
}));

const cell = { padding: '0.6rem 0.8rem' };

const QUESTIONS = [
  { q: 'What is a round robin fixture?', a: 'A round robin is a league format where every team plays every other team once. Points decide the table, usually 3 for a win and 1 for a draw, so no team is knocked out after one bad game.' },
  { q: 'How many matches are in a round robin?', a: 'n teams play n × (n − 1) ÷ 2 matches. 6 teams play 15 matches, 8 teams play 28 and 10 teams play 45. Each team plays n − 1 games.' },
  { q: 'How many rounds does a round robin need?', a: 'With an even number of teams it takes n − 1 rounds, with every team playing once each round. With an odd number it takes n rounds, and one team has a bye in each round.' },
  { q: 'How does the generator make the fixtures?', a: 'It uses the circle method: one team stays fixed while the others rotate, so every pair meets exactly once and home and away alternate. Paste your teams, choose League and the full fixture list appears straight away.' },
  { q: 'Can I run a round robin on one day?', a: 'Yes, for small groups. Up to 6 teams (15 matches) fits a gala day on two or three pitches. With more teams, groups followed by a knockout keep the day shorter. You can switch format in the same tool.' },
  { q: 'Does the league table update by itself?', a: 'Yes. Once you publish, enter each score and the table, goal difference and positions update live for everyone with the link. Players and families do not need an account to follow it.' },
  { q: 'Is it free?', a: 'Yes, with no ads and no paid tier. You only sign in once to publish, so that only you can enter scores.' },
];

export default function RoundRobinFixtureGeneratorPage() {
  return (
    <ToolLandingPage
      path={PATH}
      parent={TOURNAMENT_TOOL}
      badge="FREE TOOL · ROUND ROBIN"
      h1="Round robin fixture generator"
      intro="Paste your teams and get a round robin fixture list where every team plays every other team once, round by round. Publish it as a live soccer league with a table that updates as you enter scores, at one link for players, families and local news. Free."
      description={DESCRIPTION}
      appName="Free Round Robin Fixture Generator"
      alternateNames={['Round robin schedule maker', 'Soccer league fixture generator', 'League draw generator']}
      features={['Opens on League (round robin) format', 'Up to 32 teams', 'Circle-method fixtures, one bye a round for odd numbers', 'Live league table with goal difference', 'Change kick-off times and pitches after publishing', 'Embed the table on a club website', 'Free, with no ads']}
      tool={<TournamentMakerTool defaultFormat="league" />}
      maxWidth="1180px"
      sections={[
        {
          id: 'how-it-works',
          heading: 'How a round robin works',
          body: (
            <>
              <p style={bodyStyle}>
                In a round robin, every team plays every other team once and the league table decides the winner. It is the
                fairest format for a small competition: a team that loses its first game still plays everyone else, and the
                final standings reflect the whole event rather than one result.
              </p>
              <p style={{ ...bodyStyle, marginTop: '0.75rem' }}>
                The generator draws the fixtures round by round, so no team plays twice in the same round. With an odd number of
                teams, one team rests each round. Ties on points are separated by goal difference, then goals scored.
              </p>
            </>
          ),
        },
        {
          id: 'counts',
          heading: 'Round robin matches and rounds by number of teams',
          body: (
            <div className="glass-panel" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <caption style={{ textAlign: 'left', padding: '0.9rem 0.8rem 0.4rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Every team plays every other team once</caption>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--text-primary)' }}>
                    {['Teams', 'Matches', 'Rounds', 'Games per team'].map(h => <th key={h} scope="col" style={{ ...cell, fontWeight: 800 }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map(r => (
                    <tr key={r.teams} style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                      <th scope="row" style={{ ...cell, textAlign: 'left', color: 'var(--text-primary)' }}>{r.teams}</th>
                      <td style={cell}>{r.matches}</td>
                      <td style={cell}>{r.rounds}{r.teams % 2 ? ' (one bye each round)' : ''}</td>
                      <td style={cell}>{r.perTeam}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ),
        },
      ]}
      howToName="How to generate round robin fixtures"
      steps={[
        { name: 'Name the competition', text: 'Add the name, date and kick-off, the venue and the team size.' },
        { name: 'Keep League selected', text: 'This page opens on League, where everyone plays everyone once.' },
        { name: 'Paste your teams', text: 'One team per line. The fixture list and an empty table appear straight away.' },
        { name: 'Publish and share', text: 'Sign in once to publish and share the link with every team.' },
        { name: 'Enter scores', text: 'The table updates live as each result goes in.' },
      ]}
      questions={QUESTIONS}
    />
  );
}
