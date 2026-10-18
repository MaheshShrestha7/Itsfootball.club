import Link from 'next/link';
import PlayerCardTool from '@/components/PlayerCardTool';
import ToolLandingPage, { bodyStyle, linkStyle } from '@/components/ToolLandingPage';
import { pageMetadata } from '@/lib/seo';
import { PLAYER_CARD_TOOL, toolOgImage } from '@/lib/tool-pages';

const PATH = '/tools/soccer-player-card-maker';
const TITLE = 'Free Soccer Player Card Maker | Custom Soccer Card with Your Stats';
const DESCRIPTION = 'Create custom soccer player cards with your photo, team badge, rating and stats. Download ready-to-post cards for Instagram and TikTok. Free, no sign-up.';

export const metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH, image: toolOgImage(PATH) });

const TIPS = [
  { title: 'Rec and travel soccer', note: 'Count every league and tournament game in Appearances so the rating is fair per game.' },
  { title: 'Adult and Sunday league', note: 'Attendance streak is the stat your captain will love: games in a row you showed up for.' },
  { title: 'Team colors', note: 'Pick the Club finish and your team color, and add the team badge so the cards match.' },
  { title: 'Banquet and awards night', note: 'Make a card for every player and print them, or post one a day in the week before.' },
];

const QUESTIONS = [
  { q: 'How do I make a custom soccer card?', a: 'Add your photo and tap Remove background, type your name and position, fill in goals, assists, games played and the rest, add your team badge and color, pick a finish and press Download card.' },
  { q: 'Is soccer the same as football here?', a: 'Yes. Soccer and football are the same game; this is the same free player card maker with tips for rec, travel and adult league soccer.' },
  { q: 'How is the rating worked out?', a: 'It starts at 55 and adds, per game played: goals × 12, assists × 8, Player of the Match awards × 10, clean sheets × 10 (keepers and defenders) and saves × 1, plus attendance % × 0.1 and 0.25 per game of the attendance streak (up to 20). It stays between 45 and 95, or you set your own.' },
  { q: 'Can I print the cards?', a: 'Yes. Download the Card size (1100 × 1325) and print it at about 2.5 × 3 inches or larger.' },
  { q: 'Is my photo uploaded?', a: 'No. The photo stays on your device and the card is drawn there.' },
];

const STEPS = [
  { name: 'Add the photo', text: 'Pick a photo in your uniform and tap Remove background.' },
  { name: 'Name, position and stats', text: 'Type your name, pick your position and fill in the season stats.' },
  { name: 'Team and finish', text: 'Add the team name, badge and color, and pick a finish.' },
  { name: 'Download or share', text: 'Download the card alone, or as a story, post or square.' },
];

export default function SoccerPlayerCardMakerPage() {
  return (
    <ToolLandingPage
      path={PATH}
      parent={PLAYER_CARD_TOOL}
      badge="FREE TOOL · SOCCER"
      h1="Soccer player card maker"
      intro="Make a custom soccer player card in a minute: your photo, rating, position and season stats (goals, assists, games played and attendance) with your team badge and colors. Free, with no login, for rec, travel and adult league soccer."
      description={DESCRIPTION}
      appName="Free Soccer Player Card Maker"
      alternateNames={['Custom soccer card maker', 'Soccer card creator', 'Make your own soccer card', 'Soccer trading card maker']}
      features={[
        'Photo with on-device background removal',
        'Rating worked out from season stats, or set your own',
        'Team badge and colors',
        'Card (see-through PNG), story, post and square',
        'No sign-up, nothing uploaded',
      ]}
      tool={<PlayerCardTool />}
      sections={[
        {
          id: 'tips',
          heading: 'Tips for soccer cards',
          body: (
            <div className="lineup-formations">
              {TIPS.map(t => (
                <div key={t.title} className="glass-panel" style={{ padding: '1.1rem 1.25rem' }}>
                  <h3 style={{ fontSize: '1.02rem', fontWeight: 800, marginBottom: '0.3rem' }}>{t.title}</h3>
                  <p style={{ ...bodyStyle, fontSize: '0.92rem' }}>{t.note}</p>
                </div>
              ))}
            </div>
          ),
        },
        {
          id: 'rating',
          heading: 'How the rating works',
          body: (
            <p style={bodyStyle}>
              The rating comes from your stats per game, so a player who misses a few games isn&apos;t marked down. See the
              worked example on the <Link href={PLAYER_CARD_TOOL.path} style={linkStyle}>football player card maker</Link>.
            </p>
          ),
        },
      ]}
      howToName="How to make a soccer player card"
      steps={STEPS}
      questions={QUESTIONS}
    />
  );
}
