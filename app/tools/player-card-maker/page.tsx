import Link from 'next/link';
import PlayerCardTool from '@/components/PlayerCardTool';
import ToolLandingPage, { bodyStyle, linkStyle } from '@/components/ToolLandingPage';
import { pageMetadata } from '@/lib/seo';
import { PLAYER_CARD_FORMAT_PAGES, RESULT_FORMAT_PAGES, toolOgImage } from '@/lib/tool-pages';
import { CARD_TYPES } from '@/lib/player-card';

const PATH = '/tools/player-card-maker';
const TITLE = 'Free Football Player Card Maker | Make Your Own Soccer Card';
const DESCRIPTION = 'Make your own football player card: your photo, rating, position and Sunday League stats (goals, assists, clean sheets, attendance streak) with your club badge. Download for WhatsApp, Instagram or TikTok. Free, no sign-up.';

export const metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH, image: toolOgImage(PATH) });

const STATS = [
  { short: 'GLS', name: 'Goals', note: 'Goals scored this season, in every competition you count.' },
  { short: 'AST', name: 'Assists', note: 'The last pass before a goal. Most grassroots clubs count it the simple way.' },
  { short: 'APP', name: 'Appearances', note: 'Games played, starting or off the bench. The rating uses it to work out stats per game.' },
  { short: 'MOTM', name: 'Player of the Match', note: 'Times picked as Player of the Match (Man of the Match).' },
  { short: 'STRK', name: 'Attendance streak', note: 'Games in a row turned up for: the stat every coach wishes more players had.' },
  { short: 'ATT', name: 'Attendance %', note: 'Share of the team’s games attended, from 0 to 100.' },
  { short: 'CS', name: 'Clean sheets', note: 'Games without conceding. Shown first for keepers, and it counts for defenders too.' },
  { short: 'SVS', name: 'Saves', note: 'Saves made by a goalkeeper over the season.' },
];

/** What each special card type is for (the looks and labels live in lib/player-card.ts) */
const TYPE_NOTES: Record<string, string> = {
  standard: 'The everyday card in one of six finishes: Black gold, Club colours, Gold, Silver, Bronze or In form.',
  totw: 'Black and gold with stars, and the round on the label. For each player your club picks that week.',
  potm: 'Royal blue with a sunburst, and the month on the label.',
  moment: 'Teal with waves, for one big moment: a hat-trick, a last-minute winner, a first goal.',
  future: 'Pink and purple, for a junior or young player coming through. Put the age group on the label.',
  signing: 'In the club’s own colours, with the club they joined from. For announcing a new player.',
  legend: 'Ivory and gold, for a long-serving player or a retirement. Put a milestone on the label and their years as the season.',
  tots: 'Ice blue and white with stars, for the end-of-season team.',
  upgrade: 'Green with chevrons. Put the rating from before and the card shows the rise, such as +4, under the rating.',
  cup: 'Red and gold, for a cup or grand final win. Put the competition on the label.',
};

const IDEAS = [
  { title: 'End-of-season awards', note: 'Give every player a card at presentation night, with Gold for the award winners.' },
  { title: 'New signings', note: 'Announce a new player with their card in the club colours.' },
  { title: 'Milestones', note: 'A 50th game, a first goal or a 20-game attendance streak.' },
  { title: 'Birthdays', note: 'Post a card in the team chat on the day. It always gets a reaction.' },
];

const QUESTIONS = [
  { q: 'How do I make my own football player card?', a: 'Add your photo and tap Remove background, type the name for the card, pick your position, then fill in your season stats. Add your club badge and colour, choose a finish such as Black gold or Club colours, and press Download card.' },
  { q: 'How is the rating worked out?', a: 'It starts at 55 and adds, per game played: goals × 12, assists × 8, Player of the Match awards × 10, clean sheets × 10 (keepers and defenders) and saves × 1. Then it adds attendance % × 0.1 and 0.25 for every game of the attendance streak, up to 20. The result is kept between 45 and 95. You can also set your own rating from 1 to 99.' },
  { q: 'Is it like the player cards in football video games?', a: 'It is in that style: a big rating and position, the photo, the name and six stats. It is our own design for grassroots players, with real Sunday League stats instead of made-up pace and shooting numbers. It is not linked to any game.' },
  { q: 'What card types are there?', a: 'Standard (in six finishes), Team of the Week, Player of the Month, Moment, Future Star, New Signing, Club Legend, Team of the Season, Levelled Up and Cup Winners. Each special type has its own colours and pattern, and a label above the name with one detail, such as the round or the month.' },
  { q: 'Is my photo uploaded?', a: 'No. Your photo and badge stay on your phone or computer. The background is removed there, and the card is drawn there. Nothing is saved on a server.' },
  { q: 'What size is the player card?', a: 'Card is 1100 × 1325 with a see-through background, for stickers and chats. Story is 1080 × 1920 for Instagram, TikTok and WhatsApp status. Post is 1080 × 1350 and Square is 1080 × 1080.' },
  { q: 'Can I make cards for the whole team?', a: 'Yes. The club name, badge, colour and season are remembered in your browser, so for each player you only change the photo, name, position and stats, then download.' },
  { q: 'Can I make a card for a junior player?', a: 'Yes, with their parent or guardian’s permission for the photo, and following your club and association’s rules on photos of children. Many junior clubs use first names only.' },
  { q: 'Is it free?', a: 'Yes, with no account, no ads and nothing to install. The card carries a small “Made at itsfootball.club” line.' },
];

const STEPS = [
  { name: 'Pick a card type', text: 'Keep Standard, or pick a special card such as Team of the Week or Player of the Month and type its detail.' },
  { name: 'Add the photo', text: 'Pick a photo from the waist or chest up and tap Remove background so the player stands on the card. Drag the preview and use Zoom to place them.' },
  { name: 'Name and position', text: 'Type the name for the card and pick a position. Add other positions, preferred foot, shirt number and a nation tag if you like.' },
  { name: 'Season stats', text: 'Fill in goals, assists, appearances and the rest, and pick up to six to show. The rating works itself out, or set your own.' },
  { name: 'Club and finish', text: 'Add the club name, season, badge and colour, then choose a finish.' },
  { name: 'Download or share', text: 'Choose Card, Story, Post or Square and press Download, or Share on a phone to send it straight to the team chat.' },
];

export default function PlayerCardMakerPage() {
  return (
    <ToolLandingPage
      path={PATH}
      badge="FREE TOOL · NO SIGN-UP"
      h1="Free football player card maker"
      intro="Make your own football player card in a minute: your photo, rating, position and Sunday League stats (goals, assists, clean sheets and attendance streak) with your club badge and colours. Keep it Standard or pick a special card such as Team of the Week, Player of the Month or Levelled Up. Download it for the team chat, Instagram or TikTok. Free, with no login."
      description={DESCRIPTION}
      appName="Free Football Player Card Maker"
      alternateNames={['Soccer player card maker', 'Make your own football card', 'Football card creator', 'Player rating card maker', 'Custom football card generator']}
      features={[
        'Player photo with on-device background removal',
        'Rating worked out from season stats, or set your own',
        'Up to six stats: goals, assists, appearances, Player of the Match, attendance, clean sheets, saves',
        'Nine special card types, such as Team of the Week and Player of the Month',
        'Six finishes, including club colours',
        'Card (see-through PNG), story, post and square',
        'No sign-up, nothing uploaded',
      ]}
      tool={<PlayerCardTool />}
      sections={[
        {
          id: 'rating',
          heading: 'How the rating works',
          body: (
            <>
              <p style={bodyStyle}>
                The rating starts at 55 and rewards what a grassroots player actually does each week. Per game played it
                adds goals × 12, assists × 8, Player of the Match awards × 10, clean sheets × 10 (keepers and defenders) and
                saves × 1. Then it adds attendance % × 0.1, and 0.25 for each game of the attendance streak, up to 20 games.
                It stays between 45 and 95, so a 96 to 99 has to be set by hand.
              </p>
              <p style={{ ...bodyStyle, marginTop: '0.75rem' }}>
                For example, a striker with 18 goals, 11 assists and 6 Player of the Match awards in 22 games, with 95%
                attendance and a 14-game streak, gets 55 + 9.8 + 4 + 2.7 + 9.5 + 3.5 = <strong>84.5</strong>, shown as 85.
              </p>
            </>
          ),
        },
        {
          id: 'card-types',
          heading: 'Card types',
          body: (
            <div className="lineup-formations">
              {CARD_TYPES.map(t => (
                <div key={t.key} className="glass-panel" style={{ padding: '1.1rem 1.25rem' }}>
                  <h3 style={{ fontSize: '1.02rem', fontWeight: 800, marginBottom: '0.3rem' }}>{t.label}</h3>
                  <p style={{ ...bodyStyle, fontSize: '0.92rem' }}>{TYPE_NOTES[t.key]}</p>
                </div>
              ))}
            </div>
          ),
        },
        {
          id: 'stats',
          heading: 'What the stats on the card mean',
          body: (
            <div className="lineup-formations">
              {STATS.map(s => (
                <div key={s.short} className="glass-panel" style={{ padding: '1.1rem 1.25rem' }}>
                  <h3 style={{ fontSize: '1.02rem', fontWeight: 800, marginBottom: '0.3rem' }}>{s.short}: {s.name}</h3>
                  <p style={{ ...bodyStyle, fontSize: '0.92rem' }}>{s.note}</p>
                </div>
              ))}
            </div>
          ),
        },
        {
          id: 'ideas',
          heading: 'When clubs make player cards',
          body: (
            <div className="lineup-formations">
              {IDEAS.map(i => (
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
          heading: 'Keepers, weekly awards and match days',
          body: (
            <p style={bodyStyle}>
              The <Link href={PLAYER_CARD_FORMAT_PAGES[0].path} style={linkStyle}>goalkeeper card maker</Link> opens on a
              keeper with clean sheets and saves, and the{' '}
              <Link href={PLAYER_CARD_FORMAT_PAGES[1].path} style={linkStyle}>soccer player card maker</Link> has tips for
              rec and travel soccer. The{' '}
              <Link href={PLAYER_CARD_FORMAT_PAGES[2].path} style={linkStyle}>Team of the Week card maker</Link> and{' '}
              <Link href={PLAYER_CARD_FORMAT_PAGES[3].path} style={linkStyle}>Player of the Month card maker</Link> open on
              those cards. For a single game, use the{' '}
              <Link href={RESULT_FORMAT_PAGES[0].path} style={linkStyle}>Player of the Match graphic maker</Link>.
            </p>
          ),
        },
      ]}
      howToName="How to make a football player card"
      steps={STEPS}
      questions={QUESTIONS}
    />
  );
}
