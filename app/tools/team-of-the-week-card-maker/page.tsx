import Link from 'next/link';
import PlayerCardTool from '@/components/PlayerCardTool';
import ToolLandingPage, { bodyStyle, linkStyle } from '@/components/ToolLandingPage';
import { pageMetadata } from '@/lib/seo';
import { LINEUP_TOOL, PLAYER_CARD_TOOL, toolOgImage } from '@/lib/tool-pages';

const PATH = '/tools/team-of-the-week-card-maker';
const TITLE = 'Free Team of the Week Card Maker | Football Player Cards';
const DESCRIPTION = 'Make Team of the Week cards for your football club: each player’s photo, rating, position and stats on a black and gold card with the round. Download for Instagram, Facebook or the team chat. Free, no sign-up.';

export const metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH, image: toolOgImage(PATH) });

const PICKING = [
  { title: 'Pick on the weekend’s games', note: 'Choose after the round is played, from every team in the club or the league. One standout from each game keeps it fair.' },
  { title: 'Make it a full team', note: 'A keeper, defenders, midfielders and forwards, so players in every position have a chance.' },
  { title: 'Say why', note: 'Put one line in the post for each player: a goal, a save, a big tackle. It’s what parents and players share.' },
  { title: 'Post on the same day', note: 'Monday or Tuesday every week. A regular slot gets people checking for it.' },
];

const QUESTIONS = [
  { q: 'How do I make a Team of the Week card?', a: 'This page opens on the Team of the Week card type. Add the player’s photo and name, type the round (such as Round 7), fill in their stats, add your club badge and press Download card. Then change the photo, name and stats for the next player.' },
  { q: 'Can I make cards for the whole Team of the Week?', a: 'Yes. The club, badge, colour, season and round are remembered in your browser, so for each player you only change the photo, name, position and stats.' },
  { q: 'What does the card show?', a: 'A “Team of the Week · Round 7” label above the name, the rating and position, the photo, up to six season stats, the club badge and the season. It has its own black and gold look with stars.' },
  { q: 'Which size should I use?', a: 'Post (1080 × 1350) for Instagram and Facebook, Story (1080 × 1920) for stories and WhatsApp status, and Card for a see-through PNG you can put on your own graphic.' },
  { q: 'Is my photo uploaded?', a: 'No. Photos stay on your device: the background is removed there and the card is drawn there.' },
  { q: 'Is it free?', a: 'Yes, with no account and no ads. The card carries a small “Made at itsfootball.club” line.' },
];

const STEPS = [
  { name: 'Add the photo', text: 'Add the player’s photo and tap Remove background so they stand on the card.' },
  { name: 'Type the round', text: 'The card opens on Team of the Week. Type the week or round, such as Round 7.' },
  { name: 'Name, position and stats', text: 'Fill in the name, position and season stats. The rating works itself out, or set your own.' },
  { name: 'Download, then the next player', text: 'Download the card or post, then change the photo, name and stats for the next player.' },
];

export default function TeamOfTheWeekCardMakerPage() {
  return (
    <ToolLandingPage
      path={PATH}
      parent={PLAYER_CARD_TOOL}
      badge="FREE TOOL · TEAM OF THE WEEK"
      h1="Team of the Week card maker"
      intro="Make a Team of the Week card for each player your club picks: their photo, rating, position and stats on a black and gold card with the round on it. Download for Instagram, Facebook or the team chat. Free, with no login."
      description={DESCRIPTION}
      appName="Free Team of the Week Card Maker"
      alternateNames={['TOTW card maker', 'Team of the Week graphic maker', 'Football Team of the Week template', 'Grassroots Team of the Week cards']}
      features={[
        'Opens on the Team of the Week card type',
        'The round on the card, such as Round 7',
        'Photo with on-device background removal',
        'Post, story, square or see-through card',
        'No sign-up, nothing uploaded',
      ]}
      tool={<PlayerCardTool defaultType="totw" />}
      sections={[
        {
          id: 'picking',
          heading: 'Picking a Team of the Week',
          body: (
            <div className="lineup-formations">
              {PICKING.map(i => (
                <div key={i.title} className="glass-panel" style={{ padding: '1.1rem 1.25rem' }}>
                  <h3 style={{ fontSize: '1.02rem', fontWeight: 800, marginBottom: '0.3rem' }}>{i.title}</h3>
                  <p style={{ ...bodyStyle, fontSize: '0.92rem' }}>{i.note}</p>
                </div>
              ))}
            </div>
          ),
        },
        {
          id: 'more',
          heading: 'The whole team on one graphic',
          body: (
            <p style={bodyStyle}>
              To show the Team of the Week as an XI on a pitch, use the free{' '}
              <Link href={LINEUP_TOOL.path} style={linkStyle}>lineup builder</Link>. For other cards, such as Player of
              the Month or Levelled Up, open the <Link href={PLAYER_CARD_TOOL.path} style={linkStyle}>football player card maker</Link>.
            </p>
          ),
        },
      ]}
      howToName="How to make a Team of the Week card"
      steps={STEPS}
      questions={QUESTIONS}
    />
  );
}
