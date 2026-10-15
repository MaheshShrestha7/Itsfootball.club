import LineupBuilderTool from '@/components/LineupBuilderTool';
import ToolLandingPage, { bodyStyle } from '@/components/ToolLandingPage';
import { pageMetadata } from '@/lib/seo';
import { LINEUP_TOOL } from '@/lib/tool-pages';

const PATH = '/tools/7-a-side-lineup-builder';
const TITLE = 'Free 7-a-Side Lineup Builder | 2-3-1 Formation Tool';
const DESCRIPTION = 'Make a 7-a-side football or junior soccer lineup in a 2-3-1 or five other shapes, then download it as an image for the team chat. Free, no sign-up.';

export const metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const SHAPES = [
  { shape: '2-3-1', note: 'Two at the back, a midfield three and a striker. The default here.' },
  { shape: '3-2-1', note: 'An extra defender for teams still learning to hold their shape.' },
  { shape: '2-2-2', note: 'Two lines of two plus two strikers, simple to explain at half-time.' },
  { shape: '3-1-2', note: 'Three defenders behind a single midfielder and twin strikers.' },
  { shape: '1-3-2', note: 'One defender, a midfield three and two up front. Very attacking.' },
  { shape: '2-1-2-1', note: 'A diamond midfield for teams that like to keep the ball.' },
];

const QUESTIONS = [
  { q: 'What is the best 7-a-side formation?', a: '2-3-1 is the most common 7-a-side formation. Two centre backs protect the goal, three midfielders give width and a link player, and one striker leads the line. 3-2-1 is safer, and 2-1-2-1 suits teams that pass well.' },
  { q: 'What does 2-3-1 mean?', a: 'The numbers count outfield players from the back: two defenders, three midfielders and one striker. The goalkeeper is not counted, so 2 + 3 + 1 makes six outfield players plus the keeper for seven.' },
  { q: 'Which age groups play 7-a-side?', a: 'In Australian junior soccer, 7-a-side is usually played in the MiniRoos years, typically around under 8 and under 9, before moving up to 9-a-side. Adults also play 7-a-side in social and futsal-style leagues. Check your association\'s rules for your age group.' },
  { q: 'How do I share a 7-a-side lineup with parents?', a: 'Name your players in the builder, press Download image and send the picture to the team WhatsApp or Facebook group. The story size suits WhatsApp status and Instagram stories.' },
  { q: 'Can I rotate players and keep fair minutes?', a: 'The builder shows one lineup at a time, so many coaches download one image per half or quarter. A free itsfootball.club club site also tracks availability and lineups for every fixture.' },
  { q: 'Is it free?', a: 'Yes. There is no account, no ads and nothing to install, and the image is drawn on your phone or computer so nothing is uploaded.' },
];

export default function SevenASideLineupBuilderPage() {
  return (
    <ToolLandingPage
      path={PATH}
      parent={LINEUP_TOOL}
      badge="FREE TOOL · 7-A-SIDE"
      h1="7-a-side lineup builder"
      intro="Build your 7-a-side soccer lineup in a 2-3-1, the standard shape for junior football, or try 3-2-1, 2-2-2 and more. Name your players, drag them into position and download a team sheet image in a minute. Free, with no login."
      description={DESCRIPTION}
      appName="Free 7-a-Side Lineup Builder"
      alternateNames={['7 a side formation tool', '7v7 lineup maker', 'MiniRoos team sheet maker']}
      features={['Opens on 7-a-side in a 2-3-1', '6 seven-a-side formations plus free form', 'Names, shirt numbers, positions and captain', 'Team colour and your own badge', 'Pitch or list layout', 'Post and story PNG download', 'No sign-up, nothing uploaded']}
      tool={<LineupBuilderTool defaultFormat="7v7" defaultShape="2-3-1" />}
      sections={[
        {
          id: 'two-three-one',
          heading: 'Why 2-3-1 works for 7-a-side',
          body: (
            <>
              <p style={bodyStyle}>
                On a small pitch, the midfield is where games are won. A 2-3-1 puts three players there: two wide midfielders who
                attack and track back, and a central playmaker who links the defence to the striker. Two centre backs are enough
                to cover a 7-a-side goal, and the keeper can step out as a sweeper.
              </p>
              <p style={{ ...bodyStyle, marginTop: '0.75rem' }}>
                For junior teams it also gives every player a clear job and a lot of touches, which is why most coaches start
                here. If your team keeps conceding, drop a midfielder back for 3-2-1; if you need a goal, push to 2-2-2.
              </p>
            </>
          ),
        },
        {
          id: 'formations',
          heading: '7-a-side formations in the builder',
          body: (
            <div className="lineup-formations">
              {SHAPES.map(s => (
                <div key={s.shape} className="glass-panel" style={{ padding: '1rem 1.2rem' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{s.shape}</h3>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '0.25rem', lineHeight: 1.5 }}>{s.note}</p>
                </div>
              ))}
            </div>
          ),
        },
      ]}
      howToName="How to make a 7-a-side team sheet"
      steps={[
        { name: 'Start from 2-3-1', text: 'The builder opens on 7-a-side in a 2-3-1. Choose another shape from the Formation menu if you like.' },
        { name: 'Name your seven', text: 'Tap each player to type their name and shirt number, and pick a captain.' },
        { name: 'Drag into place', text: 'Move players to where they will actually play. Free form keeps your exact positions.' },
        { name: 'Pick the look', text: 'Team colour, your badge, player icons and a pitch or list layout.' },
        { name: 'Download the image', text: 'Save a post or story image for the team chat or social media.' },
      ]}
      questions={QUESTIONS}
    />
  );
}
