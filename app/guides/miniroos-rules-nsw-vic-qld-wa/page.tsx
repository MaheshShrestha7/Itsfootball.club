import Link from 'next/link';
import GuidePage, { GuideTable } from '@/components/GuidePage';
import { linkStyle } from '@/components/ToolLandingPage';
import { pageMetadata } from '@/lib/seo';
import { SOURCES, guideByPath } from '@/lib/guides';
import { PLAYING_TIME_TOOL, LINEUP_TOOL, toolOgImage } from '@/lib/tool-pages';

const PATH = '/guides/miniroos-rules-nsw-vic-qld-wa';
const guide = guideByPath(PATH);

export const metadata = pageMetadata({
  title: 'MiniRoos Rules by State: NSW, VIC, QLD & WA Compared (2026)',
  description: 'How Football Australia MiniRoos formats apply across Football NSW, Football Victoria, Football Queensland and Football West. Retreat lines, ladders, and rules.',
  path: PATH,
  image: toolOgImage(guide.tool.path),
});

const ANSWER = 'Football Australia sets the MiniRoos formats for the whole country, so NSW, VIC, QLD and WA all play 4v4 at U6–U7, 7v7 at U8–U9 and 9v9 at U10–U11. Each state federation then runs the details itself, such as retreat line distances, who acts as referee or game leader, and the ban on ladders.';

export default function MiniRoosRulesByStatePage() {
  return (
    <GuidePage
      path={PATH}
      badge="JUNIOR FOOTBALL · NSW, VIC, QLD, WA"
      h1="MiniRoos rules by state: NSW, VIC, QLD & WA compared"
      answer={ANSWER}
      answerMore={
        <p>
          Pitch sizes and match lengths are the same in every state. What changes is the local matchday rules on reporting scores, how coaches behave, and where spectators and players have to stand back to.
        </p>
      }
      sections={[
        {
          id: 'state-matrix',
          heading: 'MiniRoos rules in each state',
          body: (
            <div className="guide-body">
              <GuideTable
                caption="MiniRoos rules by state federation"
                head={['State federation', 'Ladders published?', 'Offside', 'Match length (U6–U9 / U10–U11)', 'What\'s different locally']}
                rows={[
                  ['Football NSW / NNSWF', 'No, ladders are banned', 'No offside', '2 × 20 min / 2 × 25 min', 'Retreat lines enforced strictly, at halfway (U6–U7) or the box (U8–U11)'],
                  ['Football Victoria', 'No, ladders are banned', 'No offside', '2 × 20 min / 2 × 25 min', 'The home club supplies the Game Leader, and rotating players is stressed'],
                  ['Football Queensland', 'No, ladders are banned', 'No offside', '2 × 20 min / 2 × 25 min', 'Heat and hydration guidelines you have to follow in every regional zone'],
                  ['Football West', 'No, ladders are banned', 'No offside', '2 × 20 min / 2 × 25 min', 'The junior club development charter requires at least 50% playing time'],
                ]}
              />
              <p>
                No state federation publishes league tables, points ladders or official results for under 12s. The idea is that kids at this age are there to learn skills, not to chase a win.
              </p>
            </div>
          ),
        },
        {
          id: 'retreat-lines',
          heading: 'How the retreat line works',
          body: (
            <div className="guide-body">
              <p>
                The retreat line is there to get young players building attacks from the back instead of kicking it long. It works like this:
              </p>
              <ul>
                <li><strong>Under 6 and 7 (4v4):</strong> When the defending team restarts from its goal line, every opponent drops back into their own half until the ball is in play.</li>
                <li><strong>Under 8 and 9 (7v7):</strong> On goal kicks, opponents drop back 10 metres outside the penalty area.</li>
                <li><strong>Under 10 and 11 (9v9):</strong> The other team goes back behind the retreat marker, often 15m from the goal line, until the keeper has played the ball.</li>
              </ul>
            </div>
          ),
        },
        {
          id: 'game-time',
          heading: 'Equal playing time',
          body: (
            <div className="guide-body">
              <p>
                All four federations back Football Australia&apos;s National Game Time Policy. Every junior who turns up on matchday should get about the same minutes, whatever the score.
              </p>
              <p>
                It&apos;s easier if you work out the subs before you get to the ground, for example with our{' '}
                <Link href="/tools/equal-playing-time-calculator" style={linkStyle}>
                  equal playing time calculator
                </Link>.
              </p>
            </div>
          ),
        },
      ]}
      cta={{
        tool: PLAYING_TIME_TOOL,
        text: 'Work out equal minutes for your junior squad, in line with the national Game Time Policy, with our free calculator.',
        more: [LINEUP_TOOL],
      }}
      questions={[
        {
          q: 'Are MiniRoos scores officially recorded anywhere?',
          a: 'No. Football Australia and the state federations (Football NSW, Football Victoria, Football Queensland and Football West) don\'t allow public scores or tables from Under 6 to Under 11.',
        },
        {
          q: 'Does offside apply in Under 11 football in Australia?',
          a: 'No. There\'s no offside in any MiniRoos age group (Under 6 to Under 11). It comes in when players move up to 11-a-side at Under 12 or Under 13.',
        },
        {
          q: 'Who referees MiniRoos matches?',
          a: 'A "Game Leader" runs the match. It\'s usually a volunteer parent, a coach or an older junior from the club, and their job is to keep it safe, explain the rules in simple words and encourage good behaviour.',
        },
      ]}
      sources={[SOURCES.faMiniRoos, SOURCES.fnswMiniRoos, SOURCES.fvMiniRoos, SOURCES.fqMiniRoos, SOURCES.fwMiniRoos]}
    />
  );
}
