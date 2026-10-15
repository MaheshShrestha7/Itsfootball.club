import PlayingTimeTool from '@/components/PlayingTimeTool';
import ToolLandingPage, { bodyStyle } from '@/components/ToolLandingPage';
import { MinutesTable, WorkedExample } from '@/components/PlayingTimeTable';
import { pageMetadata } from '@/lib/seo';
import { PLAYING_TIME_TOOL, toolOgImage } from '@/lib/tool-pages';

const PATH = '/tools/5-a-side-substitution-planner';
const TITLE = '5-a-Side Substitution Planner | Rolling Subs Calculator for 5v5 & Futsal';
const DESCRIPTION = 'Plan rolling subs for 5-a-side and futsal: enter 6, 7 or 8 players and the match length, and get a rotation where everyone plays equal minutes. Free, no sign-up.';

export const metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH, image: toolOgImage(PATH) });

const QUESTIONS = [
  { q: 'How many minutes does each player get in 5-a-side?', a: 'Multiply 5 by the match length and divide by the squad. Over two 20-minute halves (40 minutes): 6 players get 33.3 minutes each, 7 players get 28.6, and 8 players get 25.' },
  { q: 'How often should I sub in 5-a-side?', a: 'With 8 players over 40 minutes and the keeper rotating too, one change every 5 minutes gives everyone exactly 25 minutes. Divide the match length by the squad size for the gap between single changes.' },
  { q: 'Who goes in goal in 5-a-side?', a: 'Choose Rotate with all and the keeper is just another position: whoever comes on takes the spot that is free. Choose Swap at half time for two set keepers, or Same all game if you have one keeper.' },
  { q: 'Does this work for futsal and walking football?', a: 'Yes. It works for any small-sided game with rolling subs: futsal, 5-a-side leagues, walking football and junior mini soccer. Pick 4, 5 or 6-a-side to match.' },
  { q: 'How many subs should a 5-a-side team have?', a: 'One to three. With 6 players everyone gets about 83% of the game; with 8, everyone plays 62.5%. More than three subs means long spells on the bench.' },
];

export default function FiveASideSubstitutionPlannerPage() {
  return (
    <ToolLandingPage
      path={PATH}
      parent={PLAYING_TIME_TOOL}
      badge="FREE TOOL · 5-A-SIDE"
      h1="5-a-side substitution planner"
      intro="In 5-a-side, each player’s fair share is 5 × match length ÷ squad size: with 8 players over two 20-minute halves, that is exactly 25 minutes each, with one rolling sub every 5 minutes. This planner opens on 5v5 with 8 players and tells you who comes on when. Free, with no login."
      description={DESCRIPTION}
      appName="5-a-Side Substitution Planner"
      alternateNames={['5v5 rolling subs calculator', 'Futsal substitution planner', '5 a side playing time calculator']}
      features={['Opens on 5-a-side, 8 players, 2 × 20 minutes', 'Rolling subs with the keeper rotating too', 'Equal minutes for every player', 'Works for futsal and walking football', 'Minute-by-minute schedule and rotation chart', 'Print sheet and copy for WhatsApp', 'No sign-up']}
      tool={<PlayingTimeTool defaultOnField={5} defaultPeriods={2} defaultMinutes={20} defaultSquad={8} defaultKeeper="rolling" />}
      maxWidth="1180px"
      sections={[
        {
          id: 'five-example',
          heading: 'Example: 8 players, rolling subs',
          body: (
            <>
              <p style={{ ...bodyStyle, marginBottom: '1rem' }}>
                With the keeper rotating like any other position, one change every 5 minutes gives all eight players exactly 25
                minutes:
              </p>
              <WorkedExample onField={5} periods={2} periodMinutes={20} squad={8} keeper="rolling" />
            </>
          ),
        },
        {
          id: 'five-minutes',
          heading: '5-a-side minutes per player',
          body: (
            <>
              <p style={{ ...bodyStyle, marginBottom: '1rem' }}>The fair share for common 5-a-side squads and match lengths.</p>
              <MinutesTable
                caption="5-a-side: equal minutes per player"
                squads={[6, 7, 8, 9, 10]}
                columns={[
                  { onField: 5, matchMinutes: 30, label: '2 × 15 min' },
                  { onField: 5, matchMinutes: 40, label: '2 × 20 min' },
                  { onField: 5, matchMinutes: 50, label: '2 × 25 min' },
                ]}
              />
            </>
          ),
        },
      ]}
      howToName="How to plan 5-a-side rolling subs"
      steps={[
        { name: 'Check the match', text: 'The planner opens on 5-a-side, two 20-minute halves, with the keeper rotating. Change any of these to match your game.' },
        { name: 'Set your squad', text: 'Enter how many players you have, from 5 up.' },
        { name: 'Name the players', text: 'Type the names. Players marked Starts begin and the rest come on in order.' },
        { name: 'Run the subs', text: 'Print the sheet or copy it to the team chat, and make each change at the minute shown.' },
      ]}
      questions={QUESTIONS}
    />
  );
}
