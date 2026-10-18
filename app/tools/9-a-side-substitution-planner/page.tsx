import PlayingTimeTool from '@/components/PlayingTimeTool';
import ToolLandingPage, { bodyStyle } from '@/components/ToolLandingPage';
import { MinutesTable, WorkedExample } from '@/components/PlayingTimeTable';
import { pageMetadata } from '@/lib/seo';
import { PLAYING_TIME_TOOL, toolOgImage } from '@/lib/tool-pages';

const PATH = '/tools/9-a-side-substitution-planner';
const TITLE = '9-a-Side Substitution Planner | Equal Minutes Sub Rotation for 9v9';
const DESCRIPTION = 'Plan fair 9-a-side soccer substitutions: enter 12 to 14 players to get equal minutes and an exact substitution schedule. Free, no sign-up.';

export const metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH, image: toolOgImage(PATH) });

const QUESTIONS = [
  { q: 'How many minutes does each player get in 9-a-side?', a: 'Multiply 9 by the match length and divide by your squad. Over two 30-minute halves (60 minutes): 12 players get 45 minutes each, 13 players get 41.5, and 14 players get 38.6.' },
  { q: 'How do I rotate 13 players in 9-a-side?', a: 'With the same keeper all game, the 12 outfield players share 8 positions, so each plays 40 of 60 minutes. Swap four players at 10 minutes, four at half time and four at 50 minutes, and everyone gets exactly 40. If the keeper changes at half time, everyone gets 41 or 42 minutes, mostly with one change at a time.' },
  { q: 'How many subs can a 9-a-side team have?', a: 'It depends on your competition. Most junior 9-a-side football uses rolling substitutions with a squad of around 11 to 14, but check your association’s rules for squad limits and when changes can be made.' },
  { q: 'Should 9-a-side be played in halves or quarters?', a: 'Both are common in junior football. Quarters give natural breaks to make changes and talk to players; halves mean fewer stoppages. Choose Quarters under Played in to plan for four periods.' },
  { q: 'Can the keeper swap at half time?', a: 'Yes, that is the default here. Choose who is in goal for each half, and the calculator gives both keepers the same total minutes as everyone else by playing them outfield in the other half.' },
];

export default function NineASideSubstitutionPlannerPage() {
  return (
    <ToolLandingPage
      path={PATH}
      parent={PLAYING_TIME_TOOL}
      badge="FREE TOOL · 9-A-SIDE"
      h1="9-a-side substitution planner"
      intro="In 9-a-side, each player’s fair share is 9 × match length ÷ squad size: with 13 players over two 30-minute halves, that is 41.5 minutes each. This planner opens on 9v9 with 13 players and works out the sub rotation, the minute of every change and each player’s total. Free, with no login."
      description={DESCRIPTION}
      appName="9-a-Side Substitution Planner"
      alternateNames={['9v9 sub rotation', '9v9 playing time calculator', '9 a side substitution calculator']}
      features={['Opens on 9-a-side, 13 players, 2 × 30 minutes', 'Halves or quarters', 'Equal minutes for every player', 'Keeper swapped at half time or the same all game', 'Minute-by-minute schedule and rotation chart', 'Print sheet and copy for WhatsApp', 'No sign-up']}
      tool={<PlayingTimeTool defaultOnField={9} defaultPeriods={2} defaultMinutes={30} defaultSquad={13} />}
      maxWidth="1180px"
      sections={[
        {
          id: 'nine-minutes',
          heading: '9-a-side minutes per player',
          body: (
            <>
              <p style={{ ...bodyStyle, marginBottom: '1rem' }}>
                The fair share for common 9-a-side squads and match lengths, keepers included. A squad of 12 to 14 gives each
                player most of the game while leaving cover for absences.
              </p>
              <MinutesTable
                caption="9-a-side: equal minutes per player"
                squads={[10, 11, 12, 13, 14, 15, 16]}
                columns={[
                  { onField: 9, matchMinutes: 50, label: '2 × 25 min' },
                  { onField: 9, matchMinutes: 60, label: '2 × 30 min' },
                  { onField: 9, matchMinutes: 70, label: '2 × 35 min' },
                ]}
              />
            </>
          ),
        },
        {
          id: 'nine-example',
          heading: 'Example: 13 players, keeper swapped at half time',
          body: (
            <>
              <p style={{ ...bodyStyle, marginBottom: '1rem' }}>
                Player 1 keeps goal in the first half and Player 2 in the second. Both play outfield in the other half, so they end
                up with the same minutes as everyone else.
              </p>
              <WorkedExample onField={9} periods={2} periodMinutes={30} squad={13} keeper="per-period" />
            </>
          ),
        },
      ]}
      howToName="How to plan 9-a-side subs"
      steps={[
        { name: 'Check the match', text: 'The planner opens on 9-a-side in two 30-minute halves. Change the length, or pick quarters, to match your competition.' },
        { name: 'Set your squad', text: 'Enter how many players are available and who is in goal each half.' },
        { name: 'Name the players', text: 'Type the names. Players marked Starts begin the game and the rest come on in order.' },
        { name: 'Take it to the game', text: 'Print the sheet and tick off each change, or copy the plan to the team WhatsApp.' },
      ]}
      questions={QUESTIONS}
    />
  );
}
