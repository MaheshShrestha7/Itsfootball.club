import PlayingTimeTool from '@/components/PlayingTimeTool';
import ToolLandingPage, { bodyStyle } from '@/components/ToolLandingPage';
import { MinutesTable, WorkedExample } from '@/components/PlayingTimeTable';
import { pageMetadata } from '@/lib/seo';
import { PLAYING_TIME_TOOL, toolOgImage } from '@/lib/tool-pages';

const PATH = '/tools/7-a-side-substitution-planner';
const TITLE = '7-a-Side Substitution Planner | Fair Sub Rotation for 7v7 Junior Soccer';
const DESCRIPTION = 'Plan fair 7-a-side substitutions: enter 9 to 11 players to get equal playing time and the exact minute for every substitution. Free, no sign-up.';

export const metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH, image: toolOgImage(PATH) });

const QUESTIONS = [
  { q: 'How many minutes does each player get in 7-a-side?', a: 'Multiply 7 by the match length and divide by the squad. Over two 25-minute halves (50 minutes): 9 players get 38.9 minutes each, 10 players get 35, and 11 players get 31.8.' },
  { q: 'How do I rotate 10 players in 7-a-side?', a: 'Over two 25-minute halves with a new keeper at half time, every player gets exactly 35 minutes from six stoppages of one or two changes. The planner gives you the minute of each change and who comes on for whom.' },
  { q: 'How do I rotate subs in 7-a-side quarters?', a: 'Choose Quarters under Played in and set the length, for example 4 × 12 minutes. Changes at a quarter break are marked as breaks, and you can choose a different keeper for every quarter so four children get a go in goal.' },
  { q: 'What is the best squad size for 7-a-side?', a: 'Nine or ten players is common: two or three on the bench gives everyone about 70% of the game and covers a child who is sick or away. With 11 or more, each player’s share drops to around 30 minutes of a 50-minute match.' },
  { q: 'Does everyone have to play the same minutes in junior 7-a-side?', a: 'Many junior competitions ask for equal or minimum playing time in small-sided football, but the rules vary between associations and age groups. This planner gives every player the same minutes whatever your rule is.' },
];

export default function SevenASideSubstitutionPlannerPage() {
  return (
    <ToolLandingPage
      path={PATH}
      parent={PLAYING_TIME_TOOL}
      badge="FREE TOOL · 7-A-SIDE"
      h1="7-a-side substitution planner"
      intro="In 7-a-side, each player’s fair share is 7 × match length ÷ squad size: with 10 players over two 25-minute halves, that is exactly 35 minutes each. This planner opens on 7v7 with 10 players and works out who comes on for whom, at which minute. Free, with no login."
      description={DESCRIPTION}
      appName="7-a-Side Substitution Planner"
      alternateNames={['7v7 sub rotation', '7v7 playing time calculator', '7 a side substitution calculator']}
      features={['Opens on 7-a-side, 10 players, 2 × 25 minutes', 'Halves or quarters', 'Equal minutes for every child', 'A different keeper each half or quarter', 'Minute-by-minute schedule and rotation chart', 'Print sheet and copy for WhatsApp', 'No sign-up']}
      tool={<PlayingTimeTool defaultOnField={7} defaultPeriods={2} defaultMinutes={25} defaultSquad={10} />}
      maxWidth="1180px"
      sections={[
        {
          id: 'seven-example',
          heading: 'Example: 10 players, 2 × 25 minutes',
          body: (
            <>
              <p style={{ ...bodyStyle, marginBottom: '1rem' }}>
                Player 1 keeps goal in the first half and Player 2 in the second, and all ten end with exactly 35 minutes:
              </p>
              <WorkedExample onField={7} periods={2} periodMinutes={25} squad={10} keeper="per-period" />
            </>
          ),
        },
        {
          id: 'seven-minutes',
          heading: '7-a-side minutes per player',
          body: (
            <>
              <p style={{ ...bodyStyle, marginBottom: '1rem' }}>
                The fair share for common 7-a-side squads and match lengths, keepers included.
              </p>
              <MinutesTable
                caption="7-a-side: equal minutes per player"
                squads={[8, 9, 10, 11, 12, 13, 14]}
                columns={[
                  { onField: 7, matchMinutes: 40, label: '2 × 20 min' },
                  { onField: 7, matchMinutes: 48, label: '4 × 12 min' },
                  { onField: 7, matchMinutes: 50, label: '2 × 25 min' },
                ]}
              />
            </>
          ),
        },
      ]}
      howToName="How to plan 7-a-side subs"
      steps={[
        { name: 'Check the match', text: 'The planner opens on 7-a-side in two 25-minute halves. Change the length, or pick quarters, to match your competition.' },
        { name: 'Set your squad', text: 'Enter how many children are available and who is in goal each half or quarter.' },
        { name: 'Name the players', text: 'Type the names. Use Shuffle each week so different children start.' },
        { name: 'Take it to the game', text: 'Print the sheet for the touchline, or copy the plan to the parents’ WhatsApp.' },
      ]}
      questions={QUESTIONS}
    />
  );
}
