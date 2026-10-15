import TournamentMakerTool from '@/components/TournamentMakerTool';
import ToolLandingPage, { bodyStyle } from '@/components/ToolLandingPage';
import { pageMetadata } from '@/lib/seo';
import { TOURNAMENT_TOOL } from '@/lib/tool-pages';

const PATH = '/tools/knockout-cup-bracket-maker';
const TITLE = 'Free Knockout Cup Bracket Maker | Soccer Cup Draw';
const DESCRIPTION = 'Make a single-elimination soccer cup bracket for up to 32 teams, with byes worked out for you and winners moving through as you enter scores. Free, live link.';

export const metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

// The maker's bracket: the next power of two, with byes to the top seeds (byes are not matches)
const ROWS = [4, 6, 8, 12, 16, 24, 32].map(teams => {
  const rounds = Math.ceil(Math.log2(teams));
  return { teams, rounds, byes: 2 ** rounds - teams, matches: teams - 1 };
});

const cell = { padding: '0.6rem 0.8rem' };

const QUESTIONS = [
  { q: 'How do I make a knockout cup bracket?', a: 'Name your cup, keep Knockout selected, paste your teams one per line and the bracket is drawn for you. Press Shuffle for a random draw. After publishing, winners move into the next round as you enter scores.' },
  { q: 'How many matches are in a knockout tournament?', a: 'One fewer than the number of teams, because every match knocks out one team: 8 teams play 7 matches, 16 teams play 15 and 32 teams play 31. A 3rd place match adds one more.' },
  { q: 'What happens if the number of teams is not 4, 8, 16 or 32?', a: 'Some teams get a bye into round 2 so the bracket works out. The number of byes is the gap to the next power of two: 12 teams need 4 byes and 6 teams need 2. Byes go to the top seeds, which are the teams listed first.' },
  { q: 'Can I seed the draw?', a: 'Yes. Teams are seeded in the order you paste them, so put your strongest teams first and they are kept apart until the later rounds. Use Shuffle for an open draw instead.' },
  { q: 'Does it handle draws and penalties?', a: 'Yes. A knockout match needs a winner, so if it finishes level you enter the penalty shoot-out score and the winner goes through.' },
  { q: 'Can I add a 3rd place play-off?', a: 'Yes. Tick the 3rd place match option and the two losing semi-finalists play each other.' },
  { q: 'Is it free?', a: 'Yes, with no ads. Players and families follow the live bracket without an account, and only the organiser signs in to enter scores.' },
];

export default function KnockoutCupBracketMakerPage() {
  return (
    <ToolLandingPage
      path={PATH}
      parent={TOURNAMENT_TOOL}
      badge="FREE TOOL · KNOCKOUT CUP"
      h1="Knockout cup bracket maker"
      intro="Draw a single-elimination soccer cup for up to 32 teams. Byes are worked out for you, and once you publish, winners move into the next round as you enter scores, live at one link for players, families and local news. Free."
      description={DESCRIPTION}
      appName="Free Knockout Cup Bracket Maker"
      alternateNames={['Single elimination bracket generator', 'Soccer cup draw maker', 'Knockout tournament bracket']}
      features={['Opens on Knockout format', '2 to 32 teams with automatic byes', 'Seeded or shuffled draw', 'Penalties and an optional 3rd place match', 'Winners move through as scores go in', 'Embed the live bracket on a club website', 'Free, with no ads']}
      tool={<TournamentMakerTool defaultFormat="knockout" />}
      maxWidth="1180px"
      sections={[
        {
          id: 'how-it-works',
          heading: 'How a knockout cup works',
          body: (
            <>
              <p style={bodyStyle}>
                In a knockout, or single-elimination, cup the winner of each match goes through and the loser is out, until two
                teams meet in the final. It is the quickest format to run on a single day and gives every game a cup-tie feel.
              </p>
              <p style={{ ...bodyStyle, marginTop: '0.75rem' }}>
                A bracket only splits evenly for 4, 8, 16 or 32 teams. For any other number the maker gives the top seeds a bye
                into round 2, so the rest of the bracket lines up. If you want every team to play more than once, try groups
                followed by a knockout in the same tool.
              </p>
            </>
          ),
        },
        {
          id: 'byes',
          heading: 'Rounds, byes and matches by number of teams',
          body: (
            <div className="glass-panel" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <caption style={{ textAlign: 'left', padding: '0.9rem 0.8rem 0.4rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Single elimination, no 3rd place match</caption>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--text-primary)' }}>
                    {['Teams', 'Rounds', 'Byes', 'Matches'].map(h => <th key={h} scope="col" style={{ ...cell, fontWeight: 800 }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map(r => (
                    <tr key={r.teams} style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                      <th scope="row" style={{ ...cell, textAlign: 'left', color: 'var(--text-primary)' }}>{r.teams}</th>
                      <td style={cell}>{r.rounds}</td>
                      <td style={cell}>{r.byes}</td>
                      <td style={cell}>{r.matches}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ),
        },
      ]}
      howToName="How to make a knockout cup bracket"
      steps={[
        { name: 'Name your cup', text: 'Add the name, date and kick-off, the venue and the team size.' },
        { name: 'Keep Knockout selected', text: 'This page opens on Knockout. Tick the 3rd place match if you want one.' },
        { name: 'Paste your teams', text: 'One per line, strongest first for a seeded draw, or press Shuffle for an open draw.' },
        { name: 'Publish the bracket', text: 'Sign in once to publish and share the link with teams and families.' },
        { name: 'Enter results', text: 'Winners move into the next round by themselves, all the way to the final.' },
      ]}
      questions={QUESTIONS}
    />
  );
}
