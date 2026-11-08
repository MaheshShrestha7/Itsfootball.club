import Link from 'next/link';
import GuidePage, { GuideTable } from '@/components/GuidePage';
import { linkStyle } from '@/components/ToolLandingPage';
import { pageMetadata } from '@/lib/seo';
import { SOURCES, guideByPath } from '@/lib/guides';
import { PLAYING_TIME_FORMAT_PAGES, PLAYING_TIME_TOOL, toolOgImage } from '@/lib/tool-pages';

const PATH = '/guides/how-many-subs-in-7-a-side';
const guide = guideByPath(PATH);
const [SUBS_9, SUBS_7] = PLAYING_TIME_FORMAT_PAGES;

export const metadata = pageMetadata({
  title: 'How Many Subs in 7-a-Side Football? Rules & Rotations',
  description: 'Under Football Australia MiniRoos rules, 7-a-side teams can have up to 4 substitutes on the bench (11 squad). Full guide on rolling subs and fair minutes.',
  path: PATH,
  image: toolOgImage(guide.tool.path),
});

const ANSWER = 'Under Football Australia’s MiniRoos rules, a 7-a-side team can have up to 4 substitutes on the bench, so the most you can bring on matchday is 11 players. Subs are rolling and can happen at any time, and coaches have to give every player equal playing time across the season.';

export default function SubsIn7ASidePage() {
  return (
    <GuidePage
      path={PATH}
      badge="7-A-SIDE · MINIROOS UNDER 8 & UNDER 9"
      h1="How many substitutes are allowed in 7-a-side football?"
      answer={ANSWER}
      answerMore={
        <p>
          A game is 2 × 20-minute halves, 40 minutes in all. With 7 players on the field at a time, that&apos;s 280 player-minutes to share out across your squad.
        </p>
      }
      sections={[
        {
          id: 'bench-rules',
          heading: 'Bench limits and squad size',
          body: (
            <div className="guide-body">
              <GuideTable
                caption="Football Australia MiniRoos 7-a-side playing rules"
                head={['Rule', 'What the rules say', 'Worth knowing']}
                rows={[
                  ['Onfield players', '7 players (including 1 goalkeeper)', 'Minimum 5 players to start'],
                  ['Maximum substitutes', 'Up to 4 substitutes on the bench', '11 registered matchday players max'],
                  ['Substitution type', 'Rolling substitutions', 'Unlimited entries and re-entries'],
                  ['Match duration', '2 × 20 minutes', 'Minimum 5 minute half-time break'],
                  ['Ball & goal size', 'Size 3 ball, 3m × 2m goals', 'Penalty box is 5m deep × 12m wide'],
                ]}
              />
              <p>
                In senior 11-a-side football, subs are limited and a player who comes off stays off. In junior 7-a-side, players can come off and go back on as many times as you like.
              </p>
            </div>
          ),
        },
        {
          id: 'sub-mechanics',
          heading: 'How rolling substitutions work during play',
          body: (
            <div className="guide-body">
              <p>
                Football Australia lets you make rolling subs while the ball is in play or at a stoppage, as long as you stick to a few safety rules:
              </p>
              <ul>
                <li>The player coming off has to cross the touchline before their replacement goes on.</li>
                <li>Make the swap near halfway, on your bench side.</li>
                <li>Only change the goalkeeper at a stoppage, and tell the referee or game leader first.</li>
              </ul>
            </div>
          ),
        },
        {
          id: 'maths',
          heading: 'Working out equal minutes in 7-a-side',
          body: (
            <div className="guide-body">
              <p>
                Every Australian state requires equal playing time in junior grassroots football. This is how the 280 minutes split depending on how many players turn up:
              </p>
              <GuideTable
                caption="7-a-side minutes per player across 40 minutes (280 total player-minutes)"
                head={['Players there', 'Subs on the bench', 'Minutes each', 'A rotation that works']}
                rows={[
                  ['7 players', '0 subs', '40.0 minutes each', 'Full game for all players'],
                  ['8 players', '1 sub', '35.0 minutes each', 'Rotate 1 player every 5 minutes'],
                  ['9 players', '2 subs', '31.1 minutes each', 'Rotate 2 players every 8–10 minutes'],
                  ['10 players', '3 subs', '28.0 minutes each', 'Rotate 3 players every 7 minutes'],
                  ['11 players (full bench)', '4 subs', '25.5 minutes each', 'Rotate 2 players at 10m, 20m, 30m'],
                ]}
              />
              <p>
                The{' '}
                <Link href={SUBS_7?.path || '/tools/equal-playing-time-calculator'} style={linkStyle}>
                  7-a-side substitution planner
                </Link>{' '}
                works out when each swap happens, so you can sort it before kick-off.
              </p>
            </div>
          ),
        },
      ]}
      cta={{
        tool: SUBS_7 || PLAYING_TIME_TOOL,
        text: 'Put in your players and bench size and get a minute-by-minute sub plan for your next 7-a-side game.',
        more: [PLAYING_TIME_TOOL, SUBS_9],
      }}
      questions={[
        {
          q: 'Can a player who was subbed off come back on in 7-a-side?',
          a: 'Yes. Subs in MiniRoos 7-a-side are rolling and unlimited, so a player can come off and go back on as often as the coach likes.',
        },
        {
          q: 'What is the minimum number of players needed for 7-a-side?',
          a: 'Five. Under Football Australia\'s guidelines a team needs at least 5 players on the pitch to start or carry on a game.',
        },
        {
          q: 'Do 7-a-side goalkeepers have to rotate?',
          a: 'They don\'t have to, but Football Australia encourages Under 8 and Under 9 coaches to let several players have a go in goal over the season.',
        },
      ]}
      sources={[SOURCES.faMiniRoos, SOURCES.faGameTime]}
    />
  );
}
