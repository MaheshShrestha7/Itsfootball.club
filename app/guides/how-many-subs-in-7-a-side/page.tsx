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
  title: 'How Many Subs in 7-a-Side Football? Rules, Bench Limits & Rotations',
  description: 'Under Football Australia MiniRoos rules, 7-a-side teams can have up to 4 substitutes on the bench (11 squad). Full guide on rolling subs and fair minutes.',
  path: PATH,
  image: toolOgImage(guide.tool.path),
});

const ANSWER = 'Under Football Australia’s official MiniRoos rules, a 7-a-side team is allowed up to 4 substitutes on the bench, for a maximum matchday squad of 11 players. Substitutions are rolling and can take place at any time, with coaches required to give every player equal playing time across the season.';

export default function SubsIn7ASidePage() {
  return (
    <GuidePage
      path={PATH}
      badge="7-A-SIDE · MINIROOS UNDER 8 & UNDER 9"
      h1="How many substitutes are allowed in 7-a-side football?"
      answer={ANSWER}
      answerMore={
        <p>
          Matches consist of 2 × 20-minute halves (40 minutes total). With 7 players on the field, that creates 280 total player-minutes to divide fairly among your squad.
        </p>
      }
      sections={[
        {
          id: 'bench-rules',
          heading: 'Official bench limits and squad sizes',
          body: (
            <div className="guide-body">
              <GuideTable
                caption="Football Australia MiniRoos 7-a-side playing rules"
                head={['Rule', 'Official Standard', 'Coach Note']}
                rows={[
                  ['Onfield players', '7 players (including 1 goalkeeper)', 'Minimum 5 players to start'],
                  ['Maximum substitutes', 'Up to 4 substitutes on the bench', '11 registered matchday players max'],
                  ['Substitution type', 'Rolling substitutions', 'Unlimited entries and re-entries'],
                  ['Match duration', '2 × 20 minutes', 'Minimum 5 minute half-time break'],
                  ['Ball & goal size', 'Size 3 ball, 3m × 2m goals', 'Penalty box is 5m deep × 12m wide'],
                ]}
              />
              <p>
                Unlike senior 11-a-side football where substitutions are limited and permanent, 7-a-side junior soccer operates on an open rotation policy. Players who come off can re-enter multiple times throughout the game.
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
                Football Australia allows rolling substitutions to happen while the ball is in play or at any stoppage, provided the following safety rules are respected:
              </p>
              <ul>
                <li><strong>Exit first:</strong> The player leaving the pitch must cross the touchline before the replacement steps onto the field.</li>
                <li><strong>Interchange zone:</strong> Swaps should occur near the halfway line on your team&apos;s bench side.</li>
                <li><strong>Goalkeeper changes:</strong> Goalkeeper swaps should only take place during a stoppage in play with the referee or game leader notified.</li>
              </ul>
            </div>
          ),
        },
        {
          id: 'maths',
          heading: 'The equal playing time formula for 7-a-side',
          body: (
            <div className="guide-body">
              <p>
                Junior grassroots regulations in every Australian state mandate equal playing time. Here is how the minutes divide based on your bench attendance on matchday:
              </p>
              <GuideTable
                caption="7-a-side minutes per player across 40 minutes (280 total player-minutes)"
                head={['Squad present', 'Subs on bench', 'Target minutes per player', 'Suggested sub rotation']}
                rows={[
                  ['7 players', '0 subs', '40.0 minutes each', 'Full game for all players'],
                  ['8 players', '1 sub', '35.0 minutes each', 'Rotate 1 player every 5 minutes'],
                  ['9 players', '2 subs', '31.1 minutes each', 'Rotate 2 players every 8–10 minutes'],
                  ['10 players', '3 subs', '28.0 minutes each', 'Rotate 3 players every 7 minutes'],
                  ['11 players (full bench)', '4 subs', '25.5 minutes each', 'Rotate 2 players at 10m, 20m, 30m'],
                ]}
              />
              <p>
                Use the{' '}
                <Link href={SUBS_7?.path || '/tools/equal-playing-time-calculator'} style={linkStyle}>
                  7-a-side substitution planner
                </Link>{' '}
                to automatically generate your rotation intervals before kick-off.
              </p>
            </div>
          ),
        },
      ]}
      cta={{
        tool: SUBS_7 || PLAYING_TIME_TOOL,
        text: 'Enter your player names and bench size to calculate exact minute-by-minute substitution rotations for your next 7-a-side match.',
        more: [PLAYING_TIME_TOOL, SUBS_9],
      }}
      questions={[
        {
          q: 'Can a player who was subbed off come back on in 7-a-side?',
          a: 'Yes. In MiniRoos 7-a-side soccer, substitutions are rolling and unlimited. A player can be rotated off and return to the pitch as many times as the coach decides.',
        },
        {
          q: 'What is the minimum number of players needed for 7-a-side?',
          a: 'Under Football Australia guidelines, a team can begin or continue a match with a minimum of 5 players on the pitch.',
        },
        {
          q: 'Do 7-a-side goalkeepers have to rotate?',
          a: 'While not mandatory by the laws of the game, Football Australia encourages coaches in Under 8 and Under 9 to give multiple players experience in goal across the season.',
        },
      ]}
      sources={[SOURCES.faMiniRoos, SOURCES.faGameTime]}
    />
  );
}
