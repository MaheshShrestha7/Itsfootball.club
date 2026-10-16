import Link from 'next/link';
import PlayerCardTool from '@/components/PlayerCardTool';
import ToolLandingPage, { bodyStyle, linkStyle } from '@/components/ToolLandingPage';
import { pageMetadata } from '@/lib/seo';
import { PLAYER_CARD_TOOL, RESULT_FORMAT_PAGES, toolOgImage } from '@/lib/tool-pages';

const PATH = '/tools/player-of-the-month-card-maker';
const TITLE = 'Free Player of the Month Card Maker | Football Award Graphic';
const DESCRIPTION = 'Make a Player of the Month card for your football club: the player’s photo, rating, position, the month and their stats on a blue award card. Download for Instagram, Facebook or the team chat. Free, no sign-up.';

export const metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH, image: toolOgImage(PATH) });

const IDEAS = [
  { title: 'Use the month’s numbers', note: 'Put goals, assists and appearances for that month only, so the card shows why they won.' },
  { title: 'Let the team vote', note: 'A quick poll in the team chat makes the award mean more, and gets everyone looking for the card.' },
  { title: 'A sponsor’s award', note: 'Many clubs name it after a sponsor. Put the sponsor in the post with the card.' },
  { title: 'Every age group', note: 'Juniors love a monthly award. Use first names for junior players.' },
];

const QUESTIONS = [
  { q: 'How do I make a Player of the Month card?', a: 'This page opens on the Player of the Month card type. Add the player’s photo and name, type the month (such as October), fill in their stats, add your club badge and press Download card.' },
  { q: 'What does the card show?', a: 'A “Player of the Month · October” label above the name, the rating and position, the photo, up to six stats, the club badge and the season, on a royal blue card with a sunburst.' },
  { q: 'Should the stats be for the month or the season?', a: 'Either works. Stats for just the month show why they won it. The rating is worked out from whatever stats you put in, or you can set your own.' },
  { q: 'Is my photo uploaded?', a: 'No. Photos stay on your device: the background is removed there and the card is drawn there.' },
  { q: 'Is it free?', a: 'Yes, with no account and no ads. The card carries a small “Made at itsfootball.club” line.' },
];

const STEPS = [
  { name: 'Add the photo', text: 'Add the player’s photo and tap Remove background so they stand on the card.' },
  { name: 'Type the month', text: 'The card opens on Player of the Month. Type the month, such as October.' },
  { name: 'Stats and club', text: 'Fill in their stats, club name, badge and season.' },
  { name: 'Download or share', text: 'Download the card, or a post or story ready for social media.' },
];

export default function PlayerOfTheMonthCardMakerPage() {
  return (
    <ToolLandingPage
      path={PATH}
      parent={PLAYER_CARD_TOOL}
      badge="FREE TOOL · PLAYER OF THE MONTH"
      h1="Player of the Month card maker"
      intro="Make a Player of the Month card for your club’s winner: their photo, rating, position and stats on a blue award card with the month on it. Download for Instagram, Facebook or the team chat. Free, with no login."
      description={DESCRIPTION}
      appName="Free Player of the Month Card Maker"
      alternateNames={['POTM card maker', 'Player of the Month graphic maker', 'Football Player of the Month template', 'Monthly award card for football clubs']}
      features={[
        'Opens on the Player of the Month card type',
        'The month on the card, such as October',
        'Photo with on-device background removal',
        'Post, story, square or see-through card',
        'No sign-up, nothing uploaded',
      ]}
      tool={<PlayerCardTool defaultType="potm" />}
      sections={[
        {
          id: 'ideas',
          heading: 'Running a Player of the Month award',
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
          heading: 'For a single game',
          body: (
            <p style={bodyStyle}>
              For one match, use the <Link href={RESULT_FORMAT_PAGES[0].path} style={linkStyle}>Player of the Match graphic maker</Link>.
              For other cards, such as Team of the Week or Club Legend, open the{' '}
              <Link href={PLAYER_CARD_TOOL.path} style={linkStyle}>football player card maker</Link>.
            </p>
          ),
        },
      ]}
      howToName="How to make a Player of the Month card"
      steps={STEPS}
      questions={QUESTIONS}
    />
  );
}
