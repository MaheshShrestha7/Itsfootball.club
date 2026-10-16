import Link from 'next/link';
import PlayerCardTool from '@/components/PlayerCardTool';
import ToolLandingPage, { bodyStyle, linkStyle } from '@/components/ToolLandingPage';
import { pageMetadata } from '@/lib/seo';
import { PLAYER_CARD_TOOL, toolOgImage } from '@/lib/tool-pages';

const PATH = '/tools/goalkeeper-card-maker';
const TITLE = 'Free Goalkeeper Card Maker | Football Keeper Card with Clean Sheets';
const DESCRIPTION = 'Make a football goalkeeper card with your photo, rating, clean sheets, saves and appearances, in your club colours. Download for the team chat, Instagram or TikTok. Free, no sign-up.';

export const metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH, image: toolOgImage(PATH) });

const KEEPER_STATS = [
  { short: 'CS', name: 'Clean sheets', note: 'Games where you didn’t concede. If you shared a game with another keeper, most clubs give it to whoever played longer.' },
  { short: 'SVS', name: 'Saves', note: 'Shots on target you stopped. Count them after each game while you remember, or ask a parent on the sideline.' },
  { short: 'APP', name: 'Appearances', note: 'Games played in goal. The rating divides clean sheets and saves by this, so a keeper isn’t marked down for missing a few games.' },
];

const QUESTIONS = [
  { q: 'How do I make a goalkeeper card?', a: 'This page opens on GK with clean sheets, saves, appearances, Player of the Match, attendance streak and attendance % on the card. Add your photo and name, fill in the numbers, pick a finish and press Download card.' },
  { q: 'How is a goalkeeper’s rating worked out?', a: 'It starts at 55 and adds, per game played: clean sheets × 10, saves × 1, Player of the Match awards × 10, goals × 12 and assists × 8. Then attendance % × 0.1 and 0.25 for each game of the attendance streak (up to 20). It stays between 45 and 95, or you set your own.' },
  { q: 'Can I show goals conceded?', a: 'Not as a stat on the card: it shows clean sheets and saves instead, which read better on a keeper’s card. You can switch any of the six stats for goals, assists or others.' },
  { q: 'Is my photo uploaded?', a: 'No. The photo stays on your device, the background is removed there and the card is drawn there.' },
  { q: 'Is it free?', a: 'Yes, with no account and no ads. The card carries a small “Made at itsfootball.club” line.' },
];

const STEPS = [
  { name: 'Add the photo', text: 'A photo in your keeper kit, gloves on, works best. Tap Remove background so you stand on the card.' },
  { name: 'Fill in the numbers', text: 'Clean sheets, saves and appearances, plus Player of the Match and attendance if you have them.' },
  { name: 'Club and finish', text: 'Add the club name, badge and colour, and pick a finish. Silver and Gold suit a keeper card.' },
  { name: 'Download or share', text: 'Download the card alone, or as a story, post or square.' },
];

export default function GoalkeeperCardMakerPage() {
  return (
    <ToolLandingPage
      path={PATH}
      parent={PLAYER_CARD_TOOL}
      badge="FREE TOOL · GOALKEEPERS"
      h1="Goalkeeper card maker"
      intro="Make a goalkeeper card in a minute: your photo, rating, clean sheets, saves and appearances, with your club badge and colours. It opens on GK with the keeper stats ready to fill in. Free, with no login."
      description={DESCRIPTION}
      appName="Free Goalkeeper Card Maker"
      alternateNames={['Keeper card maker', 'Goalie card maker', 'Football goalkeeper card', 'Soccer goalie card creator']}
      features={[
        'Opens on GK with clean sheets and saves',
        'Rating worked out from keeper stats, or set your own',
        'Photo with on-device background removal',
        'Card (see-through PNG), story, post and square',
        'No sign-up, nothing uploaded',
      ]}
      tool={<PlayerCardTool defaultPosition="GK" defaultFinish="silver" />}
      sections={[
        {
          id: 'keeper-stats',
          heading: 'The keeper stats',
          body: (
            <div className="lineup-formations">
              {KEEPER_STATS.map(s => (
                <div key={s.short} className="glass-panel" style={{ padding: '1.1rem 1.25rem' }}>
                  <h3 style={{ fontSize: '1.02rem', fontWeight: 800, marginBottom: '0.3rem' }}>{s.short}: {s.name}</h3>
                  <p style={{ ...bodyStyle, fontSize: '0.92rem' }}>{s.note}</p>
                </div>
              ))}
            </div>
          ),
        },
        {
          id: 'outfield',
          heading: 'For outfield players',
          body: (
            <p style={bodyStyle}>
              Pick any other position and the card switches to goals, assists and the rest. Or open the{' '}
              <Link href={PLAYER_CARD_TOOL.path} style={linkStyle}>football player card maker</Link>.
            </p>
          ),
        },
      ]}
      howToName="How to make a goalkeeper card"
      steps={STEPS}
      questions={QUESTIONS}
    />
  );
}
