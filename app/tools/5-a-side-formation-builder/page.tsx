import LineupBuilderTool from '@/components/LineupBuilderTool';
import ToolLandingPage, { bodyStyle } from '@/components/ToolLandingPage';
import { pageMetadata } from '@/lib/seo';
import { LINEUP_TOOL, toolOgImage } from '@/lib/tool-pages';

const PATH = '/tools/5-a-side-formation-builder';
const TITLE = 'Free 5-a-Side Formation Builder | 1-2-1 Diamond & Futsal';
const DESCRIPTION = 'Set up your 5-a-side or futsal team in the 1-2-1 diamond, 2-1-1, 2-2 or 1-1-2, add names and download the lineup image. Free, no sign-up.';

export const metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH, image: toolOgImage(PATH) });

const SHAPES = [
  { shape: '1-2-1', note: 'The diamond: a last defender, two wide players and a pivot up front. The default here.' },
  { shape: '2-1-1', note: 'A pyramid with two at the back, steadier against quick counter-attacks.' },
  { shape: '2-2', note: 'A box of two defenders and two attackers, simple for social games.' },
  { shape: '1-1-2', note: 'Twin strikers in front of a holding player, for chasing a goal.' },
];

const QUESTIONS = [
  { q: 'What is the best 5-a-side formation?', a: 'The 1-2-1 diamond is the most popular 5-a-side formation. One player sits back, two cover the wings and one plays as the pivot up front, so every outfield player has space and a passing angle. 2-1-1 is safer at the back and 2-2 suits casual games.' },
  { q: 'What is a 1-2-1 diamond in futsal?', a: 'In futsal the positions are often called the fixo (last defender), two alas (wingers) and the pivot (target player). Together with the goalkeeper they form a diamond that rotates as players swap positions.' },
  { q: 'How do I make a 5-a-side lineup graphic?', a: 'This page opens the builder on 5-a-side in a 1-2-1. Tap each player to type a name, drag them around the pitch, choose your team colour and press Download image.' },
  { q: 'Can I use it for indoor soccer and social leagues?', a: 'Yes. The 5-a-side shapes work for futsal, indoor soccer and social 5-a-side leagues. Use Free form if your team plays a rotating or unusual shape.' },
  { q: 'Do I need to sign up?', a: 'No. The builder runs in your browser with no login or ads. Your lineup stays on your device and nothing is uploaded.' },
];

export default function FiveASideFormationBuilderPage() {
  return (
    <ToolLandingPage
      path={PATH}
      parent={LINEUP_TOOL}
      badge="FREE TOOL · 5-A-SIDE & FUTSAL"
      h1="5-a-side formation builder"
      intro="Plan 5-a-side and futsal lineups using 4 preset formations including the 1-2-1 diamond, 2-1-1, 2-2, and 1-1-2 shapes plus free form. Position outfield players and your goalkeeper, assign shirt numbers, and customize club colours and badges. Export high-resolution PNG graphics (1080 × 1350 post or 1080 × 1920 story) instantly without signing up."
      description={DESCRIPTION}
      appName="Free 5-a-Side Formation Builder"
      alternateNames={['5 a side lineup builder', 'Futsal formation maker', '1-2-1 diamond formation tool']}
      features={['Opens on 5-a-side in the 1-2-1 diamond', '4 five-a-side formations plus free form', 'Names, shirt numbers, positions and captain', 'Team colour and your own badge', 'Pitch or list layout', 'Post and story PNG download', 'No sign-up, nothing uploaded']}
      tool={<LineupBuilderTool defaultFormat="5v5" defaultShape="1-2-1" />}
      sections={[
        {
          id: 'diamond',
          heading: 'How the 1-2-1 diamond works',
          body: (
            <>
              <p style={bodyStyle}>
                With only four outfield players, spacing matters more than in any other format. The diamond spreads them across
                the pitch: the last defender stays central and covers, the two wide players stretch the opposition and get up and
                down, and the pivot holds the ball up so the others can join the attack.
              </p>
              <p style={{ ...bodyStyle, marginTop: '0.75rem' }}>
                Because the shape rotates, a winger who goes forward is covered by the defender stepping across. If your team
                keeps getting caught on the break, move to a 2-1-1 so two players always stay back.
              </p>
            </>
          ),
        },
        {
          id: 'formations',
          heading: '5-a-side formations in the builder',
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
      howToName="How to set up a 5-a-side formation"
      steps={[
        { name: 'Start from the diamond', text: 'The builder opens on 5-a-side in a 1-2-1. Pick 2-1-1, 2-2 or 1-1-2 from the Formation menu if you prefer.' },
        { name: 'Name your five', text: 'Tap each player to add their name and number, and choose a captain.' },
        { name: 'Move players', text: 'Drag players to show rotations or set pieces. Free form keeps your exact positions.' },
        { name: 'Style it', text: 'Choose your team colour, badge, player icons and a pitch or list layout.' },
        { name: 'Download', text: 'Save a post or story image and share it before kick-off.' },
      ]}
      questions={QUESTIONS}
    />
  );
}
