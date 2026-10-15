import Link from 'next/link';
import GuidePage, { GuideTable } from '@/components/GuidePage';
import { linkStyle } from '@/components/ToolLandingPage';
import { pageMetadata } from '@/lib/seo';
import { SOURCES, guideByPath } from '@/lib/guides';
import { LINEUP_FORMAT_PAGES, PLAYING_TIME_FORMAT_PAGES, PLAYING_TIME_TOOL, toolOgImage } from '@/lib/tool-pages';

const PATH = '/guides/miniroos-rules-by-age';
const guide = guideByPath(PATH);
const [LINEUP_9, LINEUP_7] = [LINEUP_FORMAT_PAGES[1], LINEUP_FORMAT_PAGES[2]];
const [SUBS_9, SUBS_7] = PLAYING_TIME_FORMAT_PAGES;

export const metadata = pageMetadata({
  title: 'MiniRoos Rules by Age: Players, Subs, Match Length & Pitch Size',
  description: 'Football Australia MiniRoos formats for under 6 to under 11: 4-a-side, 7-a-side and 9-a-side, substitutes, half lengths, pitch, ball and goal sizes, with the official sources.',
  path: PATH,
  image: toolOgImage(guide.tool.path),
});

// From Football Australia's MiniRoos National Playing Formats (sources below), checked 15 October 2026
const FORMATS = [
  { age: 'Under 6 and 7', players: '4 v 4, no goalkeeper', subs: 'Up to 3', length: '2 × 20 min', pitch: '30 × 20 m', ball: 'Size 3', goals: '2 × 1 m' },
  { age: 'Under 8 and 9', players: '7 v 7, including a goalkeeper', subs: 'Up to 4', length: '2 × 20 min', pitch: '45 × 35 m (40 × 30 to 50 × 40)', ball: 'Size 3', goals: '3 × 2 m' },
  { age: 'Under 10 and 11', players: '9 v 9, including a goalkeeper', subs: 'Up to 5', length: '2 × 25 min', pitch: '65 × 45 m (60 × 40 to 70 × 50)', ball: 'Size 4', goals: 'Up to 5 × 2 m' },
];

const ANSWER = 'Under Football Australia’s MiniRoos formats, under 6s and 7s play 4-a-side with no goalkeeper, under 8s and 9s play 7-a-side and under 10s and 11s play 9-a-side. Matches are 2 × 20 minutes up to under 9 and 2 × 25 minutes for under 10 and 11, with rolling substitutions, no offside and no published scores or ladders.';

export default function MiniRoosRulesPage() {
  return (
    <GuidePage
      path={PATH}
      badge="MINIROOS · UNDER 6 TO UNDER 11"
      h1="MiniRoos rules by age: players, subs, match length and pitch size"
      answer={ANSWER}
      answerMore={<p>Every age plays with at least a 5 minute half-time break. The rules are national, and state federations such as Football Victoria apply the same formats.</p>}
      sections={[
        {
          id: 'table',
          heading: 'MiniRoos formats at a glance',
          body: (
            <div className="guide-body">
              <GuideTable
                caption="Football Australia MiniRoos National Playing Formats"
                head={['Age group', 'Players a side', 'Substitutes', 'Match length', 'Pitch (best size)', 'Ball', 'Goals']}
                rows={FORMATS.map(f => [f.age, f.players, f.subs, f.length, f.pitch, f.ball, f.goals])}
              />
              <p>
                Pitch sizes for 7-a-side and 9-a-side are given as a best size with a smallest and largest allowed, shown in
                brackets. The 7-a-side penalty area is 5 m deep and 12 m wide, and the 9-a-side one is 10 m deep and 20 m wide.
                4-a-side has no penalty area.
              </p>
            </div>
          ),
        },
        {
          id: 'subs',
          heading: 'Substitutions: rolling, at any time',
          body: (
            <div className="guide-body">
              <p>
                MiniRoos uses rolling substitutions: a player who comes off can go back on later, and changes can be made while the
                ball is in play, as long as the player is off the field before the substitute goes on. The substitutes column above
                is the most players you can have on the bench.
              </p>
              <blockquote>
                Players may be rotated on and off the field at any time during the game.
                <cite>MiniRoos National Playing Formats, Football Australia</cite>
              </blockquote>
              <p>
                Football Australia also asks coaches to make equal playing time a priority for every player, whatever their age,
                gender or ability. The <Link href={guideByPath('/guides/equal-playing-time-junior-football').path} style={linkStyle}>equal
                playing time guide</Link> covers what that means in practice.
              </p>
            </div>
          ),
        },
        {
          id: 'restarts',
          heading: 'No offside, and a retreat line',
          body: (
            <div className="guide-body">
              <ul>
                <li><strong>No offside</strong> at any MiniRoos age.</li>
                <li><strong>Under 6 and 7:</strong> when the ball is restarted from the goal line, the other team drops back to halfway.</li>
                <li><strong>Under 8 to 11:</strong> on a goal kick, the other team stays outside the penalty area, 10 m back, until the ball is in play.</li>
                <li><strong>No scores or ladders are published.</strong> Football Victoria puts it simply: &ldquo;No results are recorded in MiniRoos.&rdquo;</li>
              </ul>
            </div>
          ),
        },
        {
          id: 'plan',
          heading: 'Planning a MiniRoos game day',
          body: (
            <div className="guide-body">
              <p>
                With a full bench, a 9-a-side team of 14 has 9 players on for 50 minutes, which is 450 player-minutes to share:
                about 32 minutes each. A 7-a-side team of 11 shares 280 minutes, about 25 each. The{' '}
                <Link href={SUBS_9.path} style={linkStyle}>9-a-side substitution planner</Link> and{' '}
                <Link href={SUBS_7.path} style={linkStyle}>7-a-side substitution planner</Link> turn that into a minute-by-minute
                list of who comes on for whom. Set the halves to match your age group (2 × 20 or 2 × 25 minutes).
              </p>
              <p>
                For the team sheet, the <Link href={LINEUP_9.path} style={linkStyle}>9-a-side lineup builder</Link> opens on a
                3-3-2 and the <Link href={LINEUP_7.path} style={linkStyle}>7-a-side lineup builder</Link> on a 2-3-1. For
                4-a-side, pick 4-a-side with no keeper in the{' '}
                <Link href={PLAYING_TIME_TOOL.path} style={linkStyle}>equal playing time calculator</Link>.
              </p>
            </div>
          ),
        },
      ]}
      cta={{
        tool: SUBS_9,
        text: 'Enter your squad and the match length and get fair minutes for everyone, with a sub list you can print or share.',
        more: [SUBS_7, LINEUP_9, LINEUP_7],
      }}
      questions={[
        { q: 'How many players are on the field in MiniRoos?', a: 'Under 6 and 7 play 4 v 4 with no goalkeeper, under 8 and 9 play 7 v 7 including a goalkeeper, and under 10 and 11 play 9 v 9 including a goalkeeper.' },
        { q: 'How many subs are allowed in MiniRoos 9-a-side?', a: 'Up to 5 substitutes for under 10 and under 11 (9-a-side), up to 4 for under 8 and 9 (7-a-side) and up to 3 for under 6 and 7 (4-a-side). Substitutions are rolling, so players can come on and off at any time.' },
        { q: 'How long is a MiniRoos game?', a: 'Two halves of 20 minutes for under 6 to under 9, and two halves of 25 minutes for under 10 and 11, with a half-time break of at least 5 minutes.' },
        { q: 'Is there offside in MiniRoos?', a: 'No. There is no offside at any MiniRoos age. Instead, the other team retreats on restarts: to halfway for under 6 and 7, and 10 m outside the penalty area on goal kicks for under 8 to 11.' },
        { q: 'What size ball is used in MiniRoos?', a: 'A size 3 ball from under 6 to under 9, and a size 4 ball for under 10 and 11.' },
        { q: 'Are scores kept in MiniRoos?', a: 'No results tables or ladders are published at MiniRoos ages, and Football Victoria’s guidelines say no results are recorded.' },
      ]}
      sources={[SOURCES.faMiniRoos, SOURCES.fvMiniRoos]}
    />
  );
}
