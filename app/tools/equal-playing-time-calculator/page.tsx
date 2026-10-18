import Link from 'next/link';
import PlayingTimeTool from '@/components/PlayingTimeTool';
import ToolLandingPage, { bodyStyle, linkStyle } from '@/components/ToolLandingPage';
import { MinutesTable, WorkedExample } from '@/components/PlayingTimeTable';
import { pageMetadata } from '@/lib/seo';
import { PLAYING_TIME_FORMAT_PAGES, toolOgImage } from '@/lib/tool-pages';

const PATH = '/tools/equal-playing-time-calculator';
const TITLE = 'Equal Playing Time Calculator | Free Soccer Sub Rotation Planner';
const DESCRIPTION = 'Calculate fair, equal playing time for 5, 7, 9 or 11-a-side soccer. Get a minute-by-minute substitution schedule for every player. Free, no sign-up.';

export const metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH, image: toolOgImage(PATH) });

const QUESTIONS = [
  { q: 'How do you calculate equal playing time in football?', a: 'Multiply the number of players on the pitch by the match length, then divide by the squad size. For 9-a-side over 60 minutes with 13 players: 9 × 60 ÷ 13 = 41.5 minutes each. If the keeper stays in goal all game, leave them out: 8 × 60 ÷ 12 = 40 minutes for each outfield player.' },
  { q: 'How often should I make substitutions so everyone gets equal time?', a: 'Divide the match length by the squad size for one change at a time: 60 minutes ÷ 13 players is a change roughly every 4½ minutes. The calculator gives each player one spell on the bench, which uses the fewest changes, and groups changes into the same stoppage where the numbers allow (13 players at 9-a-side with a fixed keeper needs only three stops).' },
  { q: 'How many minutes does each player get with 12 players in 9-a-side?', a: 'Over 60 minutes, 9 × 60 ÷ 12 = 45 minutes each, with three players on the bench at any time. With the same keeper all game, the 11 outfield players get 8 × 60 ÷ 11 = 43.6 minutes each.' },
  { q: 'Should the goalkeeper count towards equal playing time?', a: 'In junior football it usually does. Choose Swap at half time (or each quarter) and the keepers share the minutes like everyone else: they play in goal for one period and outfield in the others. Choose Same all game if one keeper plays the whole match; the outfield players then share the rest equally.' },
  { q: 'What if equal minutes are not a whole number?', a: 'With Whole minutes, sub times fall on the minute and players get the nearest whole numbers, for example 41 or 42 minutes when the exact share is 41.5. Choose To the second for exactly equal time with sub times such as 13:51.' },
  { q: 'Can I use it for quarters?', a: 'Yes. Choose Quarters (or Thirds) under Played in and set the length of each one. Changes that fall at a quarter break are marked as breaks, and you can choose a different keeper for each quarter.' },
  { q: 'Do junior leagues require equal playing time?', a: 'Many junior and community competitions have a fair play, minimum minutes or equal playing time policy, especially in small-sided formats. Rules differ between associations and age groups, so check your own competition’s rules; this calculator works for any of them.' },
  { q: 'Can I print the sub plan or send it to parents?', a: 'Yes. Print sheet opens a one-page plan with a tick box beside each change for the touchline, and Copy for WhatsApp copies the plan as text for the team chat.' },
  { q: 'Is the calculator free? Are names uploaded?', a: 'It is free with no account or ads. Names stay in your own browser and the plan is worked out on your device, so nothing is uploaded.' },
];

const STEPS = [
  { name: 'Set the match', text: 'Pick the format (for example 9-a-side), whether it is played in halves or quarters, and how long each one lasts.' },
  { name: 'Set the squad', text: 'Enter how many players you have, and choose how the goalkeeper works: same all game, swapped at the break, or rotated with everyone.' },
  { name: 'Type the names', text: 'The first names in the list start and the rest come on in order. Use Shuffle to mix up who starts.' },
  { name: 'Check the plan', text: 'The rotation chart shows when each player is on, the schedule lists every change with its minute, and each player’s total minutes are shown.' },
  { name: 'Print or share', text: 'Print the sheet for the touchline or copy it for the team WhatsApp.' },
];

const pageFor = (n: number) => PLAYING_TIME_FORMAT_PAGES.find(p => p.path.includes(`/${n}-a-side`));

export default function EqualPlayingTimeCalculatorPage() {
  return (
    <ToolLandingPage
      path={PATH}
      badge="FREE TOOL · NO SIGN-UP"
      h1="Equal playing time calculator"
      intro="To calculate equal playing time in football, multiply on-pitch players by match duration and divide by squad size: 9 players × 60 min ÷ 13 squad = 41.5 min each. For 7-a-side over 40 min with 10 players: 7 × 40 ÷ 10 = 28.0 min each. Use the free rotation planner below to generate a fair substitution schedule."
      description={DESCRIPTION}
      appName="Equal Playing Time Calculator"
      alternateNames={['Soccer substitution calculator', 'Sub rotation planner', 'Fair playing time calculator', 'Youth soccer playing time calculator', 'Football substitution planner']}
      features={[
        '4 to 11-a-side, in halves, thirds or quarters',
        'Squads of up to 30 players',
        'Equal minutes for every player, to the minute or to the second',
        'Minute-by-minute substitution schedule',
        'Rotation chart and each player’s total minutes',
        'Goalkeeper: same all game, swapped each period, or rotated',
        'Print sheet and copy for WhatsApp',
        'No sign-up, nothing uploaded',
      ]}
      tool={<PlayingTimeTool />}
      maxWidth="1180px"
      sections={[
        {
          id: 'how-it-works',
          heading: 'How equal playing time is worked out',
          body: (
            <>
              <p style={bodyStyle}>
                A match has a fixed number of <strong>player-minutes</strong>: the players on the pitch multiplied by the length
                of the game. Nine players for 60 minutes is 540 player-minutes. Share those equally across the squad and each of
                13 players gets 540 ÷ 13 = 41.5 minutes.
              </p>
              <p style={{ ...bodyStyle, marginTop: '0.75rem' }}>
                The calculator lays all of those minutes end to end, cuts them into one equal piece per player, and folds them back
                onto the positions. Each piece is shorter than the match, so nobody is ever needed in two places, and the cuts become
                the substitution times. Every player gets one spell on the bench, which keeps the number of changes as low as
                possible, and it moves the cuts so changes land together, at half time where it can, and nobody comes on for a
                minute or two.
              </p>
              <p style={{ ...bodyStyle, marginTop: '0.75rem' }}>
                Here is the plan for 13 players at 9-a-side over two 30-minute halves with the same keeper all game. The 12 outfield
                players get exactly 40 minutes each from just three stoppages:
              </p>
              <div style={{ marginTop: '1rem' }}>
                <WorkedExample onField={9} periods={2} periodMinutes={30} squad={13} keeper="fixed" />
              </div>
            </>
          ),
        },
        {
          id: 'minutes-table',
          heading: 'Minutes per player by squad size',
          body: (
            <>
              <p style={{ ...bodyStyle, marginBottom: '1rem' }}>
                The fair share for each format at a typical match length, when everyone (keepers included) shares the minutes.
                Your competition’s match lengths may differ: change them in the calculator above.
              </p>
              <MinutesTable
                caption="Equal minutes per player"
                squads={[6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18]}
                columns={[
                  { onField: 5, matchMinutes: 40, label: '5v5 · 40 min' },
                  { onField: 7, matchMinutes: 50, label: '7v7 · 50 min' },
                  { onField: 9, matchMinutes: 60, label: '9v9 · 60 min' },
                  { onField: 11, matchMinutes: 90, label: '11v11 · 90 min' },
                ]}
              />
              <p style={{ ...bodyStyle, marginTop: '1rem' }}>
                Planners set up for each format:{' '}
                {[9, 7, 5].map((n, i) => (
                  <span key={n}>{i > 0 && (i === 2 ? ' and ' : ', ')}<Link href={pageFor(n)!.path} style={linkStyle}>{pageFor(n)!.label}</Link></span>
                ))}.
              </p>
            </>
          ),
        },
        {
          id: 'keepers',
          heading: 'Goalkeeper options',
          body: (
            <ul style={{ ...bodyStyle, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <li><strong>Swap at half time (or each quarter).</strong> A different keeper each period. Keepers count towards equal time: they play a whole period in goal and fewer outfield minutes, so everyone ends with the same total. The usual choice for junior teams.</li>
              <li><strong>Same all game.</strong> Player 1 keeps goal for the whole match and the outfield minutes are shared by everyone else. Best when you have one keeper.</li>
              <li><strong>Rotate with all.</strong> No set keeper: the gloves are just another position, and whoever comes on takes the spot that is free. Common in 5-a-side and futsal.</li>
            </ul>
          ),
        },
        {
          id: 'tips',
          heading: 'Tips for fair rotation on match day',
          body: (
            <ul style={{ ...bodyStyle, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <li>Tell players the plan before kick-off, so they know when they are coming on and nobody has to ask.</li>
              <li>Print the sheet and tick off each change as you make it; with rolling subs it is easy to lose track by the second half.</li>
              <li>Rotate who starts each week with Shuffle, so the same players are not always on the bench at kick-off.</li>
              <li>If a player arrives late or gets hurt, change the squad size and follow the new plan from the next change.</li>
              <li>Equal minutes and equal positions are different things: move players around the pitch too, especially young ones.</li>
            </ul>
          ),
        },
      ]}
      howToName="How to plan equal playing time"
      steps={STEPS}
      questions={QUESTIONS}
    />
  );
}
