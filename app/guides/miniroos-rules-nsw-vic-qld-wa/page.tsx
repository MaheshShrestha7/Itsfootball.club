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

const ANSWER = 'MiniRoos formats (4v4 for U6–U7, 7v7 for U8–U9, and 9v9 for U10–U11) are standardized nationally by Football Australia across NSW, VIC, QLD, and WA. However, state federations manage local execution, including retreat line distances, refereeing/game leader appointments, and competition ladder bans.';

export default function MiniRoosRulesByStatePage() {
  return (
    <GuidePage
      path={PATH}
      badge="NATIONAL COMPARISON · NSW, VIC, QLD, WA"
      h1="MiniRoos rules by state: NSW, VIC, QLD & WA compared"
      answer={ANSWER}
      answerMore={
        <p>
          While the core field dimensions and match lengths are identical across all member federations, associations enforce specific matchday guidelines for score reporting, coaching conduct, and spectator retreat boundaries.
        </p>
      }
      sections={[
        {
          id: 'state-matrix',
          heading: 'State-by-state MiniRoos policies at a glance',
          body: (
            <div className="guide-body">
              <GuideTable
                caption="State federation MiniRoos policy comparison"
                head={['State Federation', 'Published Ladders?', 'Offside Rule', 'Match Duration (U6–U9 / U10–U11)', 'Local Distinctions']}
                rows={[
                  ['Football NSW / NNSWF', 'Prohibited (No ladders)', 'No offside', '2 × 20 min / 2 × 25 min', 'Strict retreat line enforcement at halfway (U6–U7) or box (U8–U11)'],
                  ['Football Victoria', 'Prohibited (No ladders)', 'No offside', '2 × 20 min / 2 × 25 min', 'Game Leaders supplied by home club; emphasis on player rotation'],
                  ['Football Queensland', 'Prohibited (No ladders)', 'No offside', '2 × 20 min / 2 × 25 min', 'Mandatory heat and hydration guidelines across regional zones'],
                  ['Football West', 'Prohibited (No ladders)', 'No offside', '2 × 20 min / 2 × 25 min', 'Junior club development charter mandates 50%+ minimum playing time'],
                ]}
              />
              <p>
                Every state federation prohibits the publication of league tables, points ladders, or official match results for ages under 12 to prioritize skill development over winning at all costs.
              </p>
            </div>
          ),
        },
        {
          id: 'retreat-lines',
          heading: 'The retreat line rule across states',
          body: (
            <div className="guide-body">
              <p>
                The retreat line is a critical tactical rule designed to teach young players to build attacks from the back rather than kicking the ball long:
              </p>
              <ul>
                <li><strong>Under 6 and 7 (4v4):</strong> When the goalkeeper or defending team restarts from the goal line, all opponents must drop back into their own half until the ball is in play.</li>
                <li><strong>Under 8 and 9 (7v7):</strong> Opponents must drop back 10 metres outside the penalty area on all goal kicks.</li>
                <li><strong>Under 10 and 11 (9v9):</strong> Defending teams must retreat behind the designated retreat marker (often 15m from the goal line) until the goalkeeper distributes the ball.</li>
              </ul>
            </div>
          ),
        },
        {
          id: 'game-time',
          heading: 'Equal playing time compliance',
          body: (
            <div className="guide-body">
              <p>
                All four major federations endorse Football Australia&apos;s National Game Time Policy: every junior player who attends matchday must receive approximately equal minutes, regardless of the match score or tactical situation.
              </p>
              <p>
                Coaches should use a dedicated tool like the{' '}
                <Link href="/tools/equal-playing-time-calculator" style={linkStyle}>
                  equal playing time calculator
                </Link>{' '}
                to plan their substitutions before arriving at the ground.
              </p>
            </div>
          ),
        },
      ]}
      cta={{
        tool: PLAYING_TIME_TOOL,
        text: 'Calculate fair and equal minutes for your junior squad according to official national guidelines with our free calculator.',
        more: [LINEUP_TOOL],
      }}
      questions={[
        {
          q: 'Are MiniRoos scores officially recorded anywhere?',
          a: 'No. Football Australia and state federations (Football NSW, Football Victoria, Football Queensland, and Football West) strictly ban the public recording of scores or championship tables for ages Under 6 through Under 11.',
        },
        {
          q: 'Does offside apply in Under 11 football in Australia?',
          a: 'No. The offside rule is not enforced in any MiniRoos age group (Under 6 to Under 11). Offside is introduced only when players transition to full 11-a-side football in Under 12 or Under 13.',
        },
        {
          q: 'Who referees MiniRoos matches?',
          a: 'Matches are facilitated by a "Game Leader" (usually a volunteer parent, coach, or club junior) whose primary role is to keep the game safe, explain rules simply, and encourage positive sporting behavior.',
        },
      ]}
      sources={[SOURCES.faMiniRoos, SOURCES.fnswMiniRoos, SOURCES.fvMiniRoos, SOURCES.fqMiniRoos, SOURCES.fwMiniRoos]}
    />
  );
}
