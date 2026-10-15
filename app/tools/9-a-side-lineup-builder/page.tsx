import LineupBuilderTool from '@/components/LineupBuilderTool';
import ToolLandingPage, { bodyStyle } from '@/components/ToolLandingPage';
import { pageMetadata } from '@/lib/seo';
import { LINEUP_TOOL } from '@/lib/tool-pages';

const PATH = '/tools/9-a-side-lineup-builder';
const TITLE = 'Free 9-a-Side Lineup Builder | 3-3-2 Soccer Formation Maker';
const DESCRIPTION = 'Plan your 9-a-side football team on a pitch: start from 3-3-2, try 3-2-3 or 4-3-1, name your players and download the team sheet image. Free, no sign-up.';

export const metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

const SHAPES = [
  { shape: '3-3-2', note: 'Balanced: three at the back, a midfield three and two strikers. The default here.' },
  { shape: '3-2-3', note: 'Attacking width with two wingers either side of a striker.' },
  { shape: '4-3-1', note: 'The most defensive common shape, with a lone striker.' },
  { shape: '3-4-1', note: 'A flat midfield four to win the middle of the park.' },
  { shape: '2-4-2', note: 'Two up front and two at the back, for teams that press high.' },
  { shape: '4-2-2', note: 'A flat back four for teams moving up to 11-a-side.' },
];

const QUESTIONS = [
  { q: 'What is the best 9-a-side formation?', a: '3-3-2 is the most balanced 9-a-side formation: three defenders, three midfielders and two strikers, with a goalkeeper. 3-2-3 suits a team with quick wingers, and 4-3-1 is safer if you are conceding a lot.' },
  { q: 'How do I set up a 9-a-side lineup online?', a: 'This page opens the free lineup builder on 9-a-side in a 3-3-2. Tap each player on the pitch to type their name and shirt number, drag anyone into position, then download the image for the team WhatsApp.' },
  { q: 'Which age groups play 9-a-side?', a: 'In Australian junior soccer, 9-a-side is usually the step between 7-a-side and the full 11-a-side game, typically around under 10 and under 11. Check your association\'s junior format rules, as ages vary between states and competitions.' },
  { q: 'How many players are on a 9-a-side team?', a: 'Nine on the field: a goalkeeper and eight outfield players. Most junior competitions allow rolling substitutes, so a squad of 11 to 13 gives everyone fair minutes.' },
  { q: 'Can I change to 7-a-side or 11-a-side later?', a: 'Yes. Use the Format dropdown in the builder to switch to 5, 7 or 11-a-side at any time. Player names you have typed carry across.' },
  { q: 'Is the 9-a-side lineup builder free?', a: 'Yes, with no account, no ads and nothing to install. Your lineup is kept only in your own browser and the image is drawn on your device.' },
];

export default function NineASideLineupBuilderPage() {
  return (
    <ToolLandingPage
      path={PATH}
      parent={LINEUP_TOOL}
      badge="FREE TOOL · 9-A-SIDE"
      h1="9-a-side lineup builder"
      intro="Set out your 9-a-side soccer team in a 3-3-2, or switch to 3-2-3, 4-3-1 and more. Tap players to name them, drag them into place and download a team sheet image for Instagram, Facebook or the team WhatsApp. Free, with no login."
      description={DESCRIPTION}
      appName="Free 9-a-Side Lineup Builder"
      alternateNames={['9v9 formation maker', '9-a-side team sheet maker', '9 a side football lineup tool']}
      features={['Opens on 9-a-side in a 3-3-2', '6 nine-a-side formations plus free form', 'Names, shirt numbers, positions and captain', 'Team colour and your own badge', 'Pitch or list layout', 'Post and story PNG download', 'No sign-up, nothing uploaded']}
      tool={<LineupBuilderTool defaultFormat="9v9" defaultShape="3-3-2" />}
      sections={[
        {
          id: 'three-three-two',
          heading: 'Why start from 3-3-2?',
          body: (
            <>
              <p style={bodyStyle}>
                A 3-3-2 puts a player in every key area of a 9-a-side pitch. The left, centre and right defenders cover the width
                of the box, the wide midfielders get up and down the line, the centre midfielder links play, and two strikers
                share the pressing so neither is left isolated.
              </p>
              <p style={{ ...bodyStyle, marginTop: '0.75rem' }}>
                It is also an easy shape to teach young players, because every position has a clear partner: defender to wide
                midfielder, midfielder to striker. When your team is ready for more width, move to 3-2-3; when you need to hold
                a lead, drop a striker into midfield for 3-4-1.
              </p>
            </>
          ),
        },
        {
          id: 'formations',
          heading: '9-a-side formations in the builder',
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
      howToName="How to make a 9-a-side team sheet"
      steps={[
        { name: 'Check the format', text: 'The builder opens on 9-a-side in a 3-3-2. Pick another 9-a-side shape from the Formation menu if you prefer.' },
        { name: 'Name your nine', text: 'Tap each player on the pitch to type their name and shirt number, and mark your captain.' },
        { name: 'Fine-tune positions', text: 'Drag anyone to where they will actually play. The lineup switches to free form and keeps your positions.' },
        { name: 'Add your colours', text: 'Pick the team colour and add your badge, then choose a pitch or list layout.' },
        { name: 'Download and share', text: 'Save a post or story image and send it to parents and players before the game.' },
      ]}
      questions={QUESTIONS}
    />
  );
}
