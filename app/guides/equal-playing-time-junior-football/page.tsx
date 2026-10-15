import Link from 'next/link';
import GuidePage, { GuideTable } from '@/components/GuidePage';
import { linkStyle } from '@/components/ToolLandingPage';
import { pageMetadata } from '@/lib/seo';
import { SOURCES, guideByPath } from '@/lib/guides';
import { PLAYING_TIME_FORMAT_PAGES, PLAYING_TIME_TOOL, toolOgImage } from '@/lib/tool-pages';

const PATH = '/guides/equal-playing-time-junior-football';
const guide = guideByPath(PATH);
const [SUBS_9, SUBS_7, SUBS_5] = PLAYING_TIME_FORMAT_PAGES;

export const metadata = pageMetadata({
  title: 'Equal Playing Time in Junior Football: What the Rules Say (Australia)',
  description: 'Football Australia’s game time policy: equal game time for MiniRoos (under 6 to 11) and at least half a game for youth (under 12 to 18), with minutes per player worked out by squad size.',
  path: PATH,
  image: toolOgImage(guide.tool.path),
});

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
// Minutes each when everyone, the keeper included, shares the time: players on the field × match length ÷ squad
const ROWS = [
  { label: '9-a-side, 2 × 25 min', onField: 9, minutes: 50, squads: [10, 11, 12, 13, 14] },
  { label: '7-a-side, 2 × 20 min', onField: 7, minutes: 40, squads: [8, 9, 10, 11] },
  { label: '4-a-side, 2 × 20 min', onField: 4, minutes: 40, squads: [5, 6, 7] },
];

const ANSWER = 'In Australia, Football Australia’s Game Time Policy template gives every MiniRoos player (under 6 to under 11) equal game time in each game, and every youth player (under 12 to under 18) at least half of each game. To share the minutes evenly, multiply the players on the field by the match length and divide by the squad size: 9 players × 50 minutes ÷ 12 players = 37.5 minutes each.';

export default function EqualPlayingTimeGuidePage() {
  return (
    <GuidePage
      path={PATH}
      badge="JUNIOR FOOTBALL · GAME TIME"
      h1="Equal playing time in junior football: what the rules say"
      answer={ANSWER}
      answerMore={<p>The template is a policy clubs adopt and adapt, so your own club&apos;s game time policy is the one that applies. Football Victoria&apos;s MiniRoos guidelines allow equal time to be reached week by week or over the season.</p>}
      sections={[
        {
          id: 'policy',
          heading: 'What Football Australia says',
          body: (
            <div className="guide-body">
              <GuideTable
                caption="Football Australia Game Time Policy template"
                head={['Age group', 'Game time each game', 'Notes']}
                rows={[
                  ['MiniRoos, under 6 to 11', 'Equal game time', 'Rotated across both halves and through every position, including goalkeeper'],
                  ['Youth, under 12 to 18', 'At least half of each game', 'More can be earned through performance and attitude; keepers usually stay in goal'],
                ]}
              />
              <p>
                The MiniRoos playing formats say the same thing in their own words:
              </p>
              <blockquote>
                Equal playing time should be a priority ensuring all players regardless of age, gender and/or ability get to take the field.
                <cite>MiniRoos National Playing Formats, Football Australia</cite>
              </blockquote>
              <p>
                The template allows exceptions for injury, poor attitude or a breach of the code of conduct, and time lost that way is not made up in later games. State
                federations can add their own guidance. Football Victoria&apos;s MiniRoos guidelines say that, ideally, all players
                receive equal game time &ldquo;either on a weekly basis, or over the course of the season.&rdquo;
              </p>
            </div>
          ),
        },
        {
          id: 'minutes',
          heading: 'How many minutes each player gets',
          body: (
            <div className="guide-body">
              <p>
                <strong>Minutes each = players on the field × match length ÷ squad size.</strong> This assumes everyone, the keeper
                included, rotates, which is what the template asks for at MiniRoos ages.
              </p>
              <GuideTable
                caption="Minutes per player when the whole squad shares the time equally"
                head={['Format and match length', 'Squad size: minutes each']}
                rows={ROWS.map(r => [r.label, r.squads.map(s => `${s} players: ${fmt((r.onField * r.minutes) / s)}`).join(' · ')])}
              />
              <p>
                When the numbers don&apos;t divide evenly, some players get a minute more than others. Swap who gets the extra
                minute from week to week so it evens out over the season.
              </p>
            </div>
          ),
        },
        {
          id: 'how',
          heading: 'Making it work on the day',
          body: (
            <div className="guide-body">
              <ul>
                <li><strong>Plan the changes before kick-off.</strong> Write down who comes on for whom and when, so you are not counting minutes from the sideline.</li>
                <li><strong>Use rolling subs.</strong> MiniRoos lets players come off and go back on at any time, so you can change every few minutes instead of only at half-time.</li>
                <li><strong>Rotate the starters.</strong> Starting on the bench is easier to take when everyone does it in turn.</li>
                <li><strong>Share the goalkeeper.</strong> At MiniRoos ages the template has players take turns in goal too, so give the keeper minutes in the plan like everyone else.</li>
                <li><strong>Tell the parents.</strong> Sharing the plan in the team chat before the game heads off most questions about minutes.</li>
              </ul>
              <p>
                The <Link href={PLAYING_TIME_TOOL.path} style={linkStyle}>equal playing time calculator</Link> does the counting: pick
                the format, the halves and the squad, and it gives a minute-by-minute substitution list and each player&apos;s total.
                The <Link href={guideByPath('/guides/miniroos-rules-by-age').path} style={linkStyle}>MiniRoos rules by age</Link> guide
                has the match lengths for each age group.
              </p>
            </div>
          ),
        },
      ]}
      cta={{
        tool: PLAYING_TIME_TOOL,
        text: 'Enter your squad and match length and get equal minutes for everyone, with a substitution list to print or share.',
        more: [SUBS_9, SUBS_7, SUBS_5],
      }}
      questions={[
        { q: 'Is equal playing time compulsory in junior football in Australia?', a: 'Football Australia’s Game Time Policy template, which clubs adopt and adapt, gives every MiniRoos player (under 6 to 11) equal game time each game and every youth player (under 12 to 18) at least half of each game. Your club’s own policy is the one that applies, so check it.' },
        { q: 'How do I work out equal playing time?', a: 'Multiply the number of players on the field by the match length, then divide by the squad size. For 9-a-side over 2 × 25 minutes with 12 players: 9 × 50 ÷ 12 = 37.5 minutes each.' },
        { q: 'Does the goalkeeper count in equal playing time?', a: 'At MiniRoos ages, yes. Football Australia’s template has players rotate through every position, goalkeeper included, so the keeper shares the minutes like everyone else.' },
        { q: 'How much game time do under 12 to under 18 players get?', a: 'Football Australia’s template sets a minimum of half of each game for youth players, under 12 to 18. Clubs can make exceptions, for example for injury or under their code of conduct.' },
        { q: 'Does equal time have to be in every game?', a: 'Football Australia’s template says equal game time in each game for MiniRoos. Football Victoria’s MiniRoos guidelines say the ideal is equal game time either week by week or over the season.' },
      ]}
      sources={[SOURCES.faGameTime, SOURCES.faMiniRoos, SOURCES.fvMiniRoos]}
    />
  );
}
