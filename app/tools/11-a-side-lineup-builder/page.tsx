import LineupBuilderTool from '@/components/LineupBuilderTool';
import ToolLandingPage, { bodyStyle } from '@/components/ToolLandingPage';
import { pageMetadata } from '@/lib/seo';
import { LINEUP_TOOL } from '@/lib/tool-pages';

const PATH = '/tools/11-a-side-lineup-builder';
const TITLE = 'Free 11-a-Side Lineup Builder | 4-3-3 Starting XI Maker';
const DESCRIPTION = 'Pick your senior or amateur soccer starting XI in a 4-3-3, 4-4-2, 4-2-3-1 or nine other shapes and download a matchday team sheet image. Free, no sign-up.';

export const metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const SHAPES = [
  { shape: '4-3-3', note: 'A back four, a midfield three and a front three. The default here.' },
  { shape: '4-4-2', note: 'Two banks of four and a strike pair. Simple, hard-working and easy to organise.' },
  { shape: '4-2-3-1', note: 'Two holding midfielders shield the defence behind a No. 10 and a lone striker.' },
  { shape: '3-5-2', note: 'Three centre backs and wing-backs, for teams with fit wide players.' },
  { shape: '4-1-4-1', note: 'A single holding midfielder, compact against stronger sides.' },
  { shape: '5-3-2', note: 'Wing-backs and a back five, for holding a lead away from home.' },
];

const QUESTIONS = [
  { q: 'What is the best 11-a-side formation for an amateur team?', a: '4-4-2 is the easiest shape to organise when training time is short, because every player has a clear partner. 4-3-3 suits teams with mobile wingers and a midfielder who can cover, and 4-2-3-1 adds protection in front of the back four.' },
  { q: 'What is the difference between 4-3-3 and 4-4-2?', a: '4-3-3 plays three central midfielders and three forwards, so it controls the middle and presses high, but the wingers must track back. 4-4-2 has two wide midfielders and two strikers, which gives more cover on the flanks and a partner for the main striker.' },
  { q: 'How do I post our starting XI before kick-off?', a: 'Pick the formation, tap each player to type their name and shirt number, mark the captain, add your badge and opponent, then press Download image. The story size suits Instagram and Facebook stories and WhatsApp status.' },
  { q: 'Can I add the opponent and competition?', a: 'Yes. Type the opponent and the competition, such as your league or cup round, and they appear on the image with your team name.' },
  { q: 'Can I show the team as a list?', a: 'Yes. Choose List under Image style for a numbered team sheet with the captain marked, which many clubs prefer for match-day posts.' },
  { q: 'Is it free for clubs?', a: 'Yes, with no account, no ads and nothing to install. If you want availability, lineups and live scores for every fixture, a full itsfootball.club club site is free too.' },
];

export default function ElevenASideLineupBuilderPage() {
  return (
    <ToolLandingPage
      path={PATH}
      parent={LINEUP_TOOL}
      badge="FREE TOOL · 11-A-SIDE"
      h1="11-a-side lineup builder"
      intro="Pick your senior or amateur soccer starting XI in a 4-3-3, or switch to 4-4-2, 4-2-3-1, 3-5-2 and eight more. Name your players, mark the captain, add the opponent and download a matchday team sheet for Instagram, Facebook or the club WhatsApp. Free, with no login."
      description={DESCRIPTION}
      appName="Free 11-a-Side Lineup Builder"
      alternateNames={['Starting XI maker', '11v11 formation builder', 'Matchday team sheet maker']}
      features={['Opens on 11-a-side in a 4-3-3', '12 eleven-a-side formations plus free form', 'Names, shirt numbers, positions and captain', 'Opponent and competition on the image', 'Team colour and your own badge', 'Pitch or list layout', 'Post and story PNG download', 'No sign-up, nothing uploaded']}
      tool={<LineupBuilderTool defaultFormat="11v11" defaultShape="4-3-3" />}
      sections={[
        {
          id: 'four-three-three',
          heading: 'Why start from 4-3-3?',
          body: (
            <>
              <p style={bodyStyle}>
                4-3-3 is the most common shape in senior football. A back four gives cover across the pitch, a midfield three
                keeps the ball in the middle, and two wingers either side of a striker stretch the opposition and press their
                full-backs.
              </p>
              <p style={{ ...bodyStyle, marginTop: '0.75rem' }}>
                It asks a lot of the wingers and the midfield, so in amateur and Sunday league football many teams switch during
                the game: drop a winger into midfield for 4-4-2 when you need to defend, or push a midfielder up for 4-2-3-1.
                Use the Formation menu to try each one before you post the team.
              </p>
            </>
          ),
        },
        {
          id: 'formations',
          heading: 'Popular 11-a-side formations in the builder',
          body: (
            <>
              <div className="lineup-formations">
                {SHAPES.map(s => (
                  <div key={s.shape} className="glass-panel" style={{ padding: '1rem 1.2rem' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{s.shape}</h3>
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '0.25rem', lineHeight: 1.5 }}>{s.note}</p>
                  </div>
                ))}
              </div>
              <p style={{ ...bodyStyle, marginTop: '0.9rem' }}>
                Also in the builder: 3-2-4-1, 4-4-1-1, 4-1-2-1-2, 4-5-1, 3-4-3 and 5-4-1, plus Free form.
              </p>
            </>
          ),
        },
      ]}
      howToName="How to make an 11-a-side team sheet"
      steps={[
        { name: 'Start from 4-3-3', text: 'The builder opens on 11-a-side in a 4-3-3. Pick another shape from the Formation menu if you prefer.' },
        { name: 'Name your XI', text: 'Tap each player to type their name and shirt number, and mark your captain.' },
        { name: 'Add the fixture', text: 'Type your team name, the opponent and the competition.' },
        { name: 'Match your club', text: 'Pick the team colour, add your badge and choose a pitch or list layout.' },
        { name: 'Post it', text: 'Download a post or story image and share it before kick-off.' },
      ]}
      questions={QUESTIONS}
    />
  );
}
