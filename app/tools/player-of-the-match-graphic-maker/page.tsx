import Link from 'next/link';
import ResultGraphicTool from '@/components/ResultGraphicTool';
import ToolLandingPage, { bodyStyle, linkStyle } from '@/components/ToolLandingPage';
import { pageMetadata } from '@/lib/seo';
import { RESULT_TOOL, toolOgImage } from '@/lib/tool-pages';

const PATH = '/tools/player-of-the-match-graphic-maker';
const TITLE = 'Free Player of the Match Graphic Maker | MOTM Template for Football';
const DESCRIPTION = 'Create Player of the Match graphics for your soccer club with photos, scores and club colours. Download for Instagram and WhatsApp. Free, no sign-up.';

export const metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH, image: toolOgImage(PATH) });

const PHOTO_TIPS = [
  'From the chest up, in their match kit, with the badge showing.',
  'Taken in good light, ideally with the sun or floodlights in front of them, not behind.',
  'A plain or blurred background (a wall, the sky or the far side of the pitch) keeps the focus on them.',
  'Portrait (tall) photos work best. Drag the preview up or down to choose which part shows.',
];

const WHO_PICKS = [
  { who: 'The coach or manager', note: 'The usual choice in senior grassroots football, announced in the sheds after the game.' },
  { who: 'The opposition', note: 'Common in junior football and a good look for the club: the other coach picks one of your players.' },
  { who: 'A team or parent vote', note: 'Quick to run in the team chat, and it gets more people talking about the game.' },
  { who: 'The match sponsor', note: 'A natural fit when a local business sponsors the game: thank them in the caption.' },
];

const QUESTIONS = [
  { q: 'How do I make a Player of the Match graphic?', a: 'Choose Player of the Match at the top, add their photo and name and a short line like “2 goals · 1 assist”, then enter both teams and the score. Pick Story, Post or Square and press Download image.' },
  { q: 'Is Player of the Match the same as Man of the Match?', a: 'Yes. Player of the Match (POTM or MOTM) is the same award; many clubs now say Player of the Match because it suits every team, including women’s and junior football.' },
  { q: 'What if I don’t have a photo of the player?', a: 'The card still works: it shows their initials in a ring of your team colour above their name. You can add a photo later and download it again.' },
  { q: 'Can I use a photo of a junior player?', a: 'Only with their parent or guardian’s permission, and follow your club and association’s rules on photos of children. For junior teams many clubs use first names only.' },
  { q: 'Is the photo uploaded anywhere?', a: 'No. The photo stays on your phone or computer and the graphic is drawn there. Nothing is saved on a server.' },
  { q: 'What size is the Player of the Match graphic?', a: 'Story is 1080 × 1920 for Instagram and Facebook stories and WhatsApp status, Post is 1080 × 1350 for the Instagram feed, and Square is 1080 × 1080 for Facebook pages and websites.' },
  { q: 'Is it free?', a: 'Yes, with no account, no ads and nothing to install. The image carries a small “Made at itsfootball.club” line.' },
];

const STEPS = [
  { name: 'Choose Player of the Match', text: 'It opens on the Player of the Match card. Pick Story, Post or Square.' },
  { name: 'Add the player', text: 'Add their photo, type their name and, if you like, a short line about their game.' },
  { name: 'Add the result', text: 'Type both team names, add the badges and set the final score. It shows in a strip under the player.' },
  { name: 'Download or share', text: 'Press Download image, or Share on a phone to post it straight to Instagram, Facebook or WhatsApp.' },
];

export default function PlayerOfTheMatchGraphicMakerPage() {
  return (
    <ToolLandingPage
      path={PATH}
      parent={RESULT_TOOL}
      badge="FREE TOOL · PLAYER OF THE MATCH"
      h1="Player of the Match graphic maker"
      intro="Design a Player of the Match graphic in 60 seconds: upload their action photo, add their name, highlight key stats or match performance, and include the final scoreline with club crests. Download high-resolution PNG images formatted for 9:16 stories (1080 × 1920), 4:5 feed posts (1080 × 1350), or 1:1 squares (1080 × 1080) free without an account."
      description={DESCRIPTION}
      appName="Free Player of the Match Graphic Maker"
      alternateNames={['Man of the Match graphic maker', 'MOTM graphic template', 'POTM graphic maker', 'Player of the Match template']}
      features={[
        'Player photo, name and a line about their game',
        'Final score with both badges',
        'Story (9:16), post (4:5) and square (1:1) PNG',
        'Team colours and badge',
        'No sign-up, nothing uploaded',
      ]}
      tool={<ResultGraphicTool defaultGraphic="motm" />}
      sections={[
        {
          id: 'photo',
          heading: 'What makes a good Player of the Match photo',
          body: (
            <ul style={{ ...bodyStyle, paddingLeft: '1.2rem' }}>
              {PHOTO_TIPS.map(t => <li key={t} style={{ marginBottom: '0.3rem' }}>{t}</li>)}
            </ul>
          ),
        },
        {
          id: 'who',
          heading: 'Who picks the Player of the Match?',
          body: (
            <div className="lineup-formations">
              {WHO_PICKS.map(w => (
                <div key={w.who} className="glass-panel" style={{ padding: '1.1rem 1.25rem' }}>
                  <h3 style={{ fontSize: '1.02rem', fontWeight: 800, marginBottom: '0.3rem' }}>{w.who}</h3>
                  <p style={{ ...bodyStyle, fontSize: '0.92rem' }}>{w.note}</p>
                </div>
              ))}
            </div>
          ),
        },
        {
          id: 'result',
          heading: 'The full-time result too',
          body: (
            <p style={bodyStyle}>
              Switch to Full time at the top for the result graphic, with both badges, the score and goalscorers, and the
              Player of the Match as a row underneath. See the{' '}
              <Link href={RESULT_TOOL.path} style={linkStyle}>match result graphic maker</Link>.
            </p>
          ),
        },
      ]}
      howToName="How to make a Player of the Match graphic"
      steps={STEPS}
      questions={QUESTIONS}
    />
  );
}
