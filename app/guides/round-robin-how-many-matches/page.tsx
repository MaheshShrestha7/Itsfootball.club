import Link from 'next/link';
import GuidePage, { GuideTable } from '@/components/GuidePage';
import { linkStyle } from '@/components/ToolLandingPage';
import { pageMetadata } from '@/lib/seo';
import { guideByPath } from '@/lib/guides';
import { TOURNAMENT_FORMAT_PAGES, TOURNAMENT_TOOL, toolOgImage } from '@/lib/tool-pages';

const PATH = '/guides/round-robin-how-many-matches';
const guide = guideByPath(PATH);
const [ROUND_ROBIN, KNOCKOUT] = TOURNAMENT_FORMAT_PAGES;

export const metadata = pageMetadata({
  title: 'How Many Matches in a Round Robin? Table for 3 to 12 Teams',
  description: 'A round robin of n teams has n × (n − 1) ÷ 2 matches: 4 teams play 6, 6 play 15, 8 play 28. Rounds, games per team and time slots on 1, 2 or 3 pitches, with example fixtures.',
  path: PATH,
  image: toolOgImage(guide.tool.path),
});

const matchesFor = (n: number) => (n * (n - 1)) / 2;
const roundsFor = (n: number) => (n % 2 ? n : n - 1);
/** Time slots when each round finishes before the next starts */
const slotsFor = (n: number, pitches: number) => roundsFor(n) * Math.ceil(Math.floor(n / 2) / pitches);

/** One round robin draw by the circle method: the first team stays put and the rest rotate; odd counts get a bye */
function circleDraw(teams: string[]): [string, string][][] {
  const list = teams.length % 2 ? [...teams, 'Bye'] : [...teams];
  const n = list.length;
  const rounds: [string, string][][] = [];
  let ring = list.slice(1);
  for (let r = 0; r < n - 1; r++) {
    const order = [list[0], ...ring];
    rounds.push(Array.from({ length: n / 2 }, (_, i) => [order[i], order[n - 1 - i]] as [string, string]));
    ring = [ring[ring.length - 1], ...ring.slice(0, -1)];
  }
  return rounds;
}

const TEAMS = ['A', 'B', 'C', 'D', 'E', 'F'];
const DRAW_6 = circleDraw(TEAMS);
const DRAW_5 = circleDraw(TEAMS.slice(0, 5));
const showRound = (round: [string, string][]) => {
  const games = round.filter(([h, a]) => h !== 'Bye' && a !== 'Bye').map(([h, a]) => `${h} v ${a}`).join(', ');
  const bye = round.find(([h, a]) => h === 'Bye' || a === 'Bye');
  return bye ? `${games} (${bye[0] === 'Bye' ? bye[1] : bye[0]} rests)` : games;
};

const ANSWER = 'A round robin with n teams has n × (n − 1) ÷ 2 matches, because every team plays every other team once: 4 teams play 6 matches, 6 teams play 15 and 8 teams play 28. It takes n − 1 rounds with an even number of teams, or n rounds with an odd number, when one team rests each round.';

export default function RoundRobinGuidePage() {
  return (
    <GuidePage
      path={PATH}
      badge="TOURNAMENTS · ROUND ROBIN"
      h1="How many matches in a round robin? Rounds, games and time for 3 to 12 teams"
      answer={ANSWER}
      sections={[
        {
          id: 'table',
          heading: 'Round robin matches by number of teams',
          body: (
            <div className="guide-body">
              <GuideTable
                caption="Every team plays every other team once. Time slots assume each round ends before the next starts."
                head={['Teams', 'Matches', 'Rounds', 'Games per team', 'Slots on 1 pitch', '2 pitches', '3 pitches']}
                rows={[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => [
                  n, matchesFor(n), `${roundsFor(n)}${n % 2 ? ' (1 bye each)' : ''}`, n - 1, slotsFor(n, 1), slotsFor(n, 2), slotsFor(n, 3),
                ])}
              />
              <p>
                A double round robin, where teams meet home and away, has twice as many matches and rounds:
                n × (n − 1). For bigger numbers, groups followed by a knockout keep the day shorter: 16 teams in one round
                robin is 120 matches, while four groups of four is 24 group matches.
              </p>
            </div>
          ),
        },
        {
          id: 'time',
          heading: 'How long a round robin takes',
          body: (
            <div className="guide-body">
              <p>
                <strong>Time = slots × (match length + changeover).</strong> Six teams on two pitches need 10 slots. With 15 minute
                games and 5 minutes to change over, that is 10 × 20 = 200 minutes, about 3 hours 20. On three pitches every
                round fits in one slot, so it takes 5 × 20 = 100 minutes.
              </p>
              <p>
                With an odd number of teams, one team rests every round, so extra pitches help less: five teams have only two
                matches a round, so a third pitch sits empty.
              </p>
            </div>
          ),
        },
        {
          id: 'fixtures',
          heading: 'Example fixtures for 5 and 6 teams',
          body: (
            <div className="guide-body">
              <p>
                These are drawn by the circle method: one team stays put and the others move round one place each round, so no
                team plays twice in a round and every pair meets once.
              </p>
              <GuideTable
                caption="Six teams: 15 matches in 5 rounds"
                head={['Round', 'Matches']}
                rows={DRAW_6.map((r, i) => [`Round ${i + 1}`, showRound(r)])}
              />
              <div style={{ height: '0.9rem' }} />
              <GuideTable
                caption="Five teams: 10 matches in 5 rounds, one team resting each round"
                head={['Round', 'Matches']}
                rows={DRAW_5.map((r, i) => [`Round ${i + 1}`, showRound(r)])}
              />
              <p>
                The <Link href={ROUND_ROBIN.path} style={linkStyle}>round robin fixture generator</Link> draws this for your own
                teams, sets kick-off times and pitches, and keeps a live table as scores go in. Ties on points are separated by goal
                difference, then goals scored. For a cup instead, see the{' '}
                <Link href={KNOCKOUT.path} style={linkStyle}>knockout bracket maker</Link>.
              </p>
            </div>
          ),
        },
      ]}
      cta={{
        tool: ROUND_ROBIN,
        text: 'Paste your teams and get the full fixture list with a live league table and a link to share. Free, no sign-up.',
        more: [TOURNAMENT_TOOL, KNOCKOUT],
      }}
      questions={[
        { q: 'How many matches are in a round robin with 4 teams?', a: '6 matches over 3 rounds, with each team playing 3 games.' },
        { q: 'How many matches are in a round robin with 5 teams?', a: '10 matches over 5 rounds. Each team plays 4 games and rests once.' },
        { q: 'How many matches are in a round robin with 6 teams?', a: '15 matches over 5 rounds, with each team playing 5 games.' },
        { q: 'How many matches are in a round robin with 8 teams?', a: '28 matches over 7 rounds, with each team playing 7 games.' },
        { q: 'What is the formula for round robin matches?', a: 'n × (n − 1) ÷ 2 for a single round robin, where n is the number of teams, and n × (n − 1) when teams play each other twice. Rounds: n − 1 for an even number of teams, n for an odd number.' },
        { q: 'How do I schedule a round robin with an odd number of teams?', a: 'Add a "bye" as an extra team and draw it as if the count were even. Whoever is drawn against the bye rests that round, so 5 teams take 5 rounds with one team resting each round.' },
      ]}
      sources={[]}
    />
  );
}
