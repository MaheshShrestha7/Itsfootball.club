import Link from 'next/link';
import GuidePage, { GuideTable } from '@/components/GuidePage';
import { DeliberatePlayDiagram, OffsideBodyDiagram, OffsideLineDiagram, OffsideTimingDiagram } from '@/components/GuideDiagrams';
import { linkStyle } from '@/components/ToolLandingPage';
import { pageMetadata } from '@/lib/seo';
import { SOURCES, guideByPath } from '@/lib/guides';
import { LINEUP_FORMAT_PAGES, LINEUP_TOOL, toolOgImage } from '@/lib/tool-pages';

const PATH = '/guides/offside-rule-soccer';
const guide = guideByPath(PATH);
const [LINEUP_11] = LINEUP_FORMAT_PAGES;

export const metadata = pageMetadata({
  title: 'The Offside Rule in Soccer, Explained With Examples',
  description: 'Offside in plain English: when a player is in an offside position, when it becomes an offence, ten match situations judged, and the myths that start arguments.',
  path: PATH,
  image: toolOgImage(guide.tool.path),
});

const ANSWER = 'A player is in an offside position if, at the moment a team-mate plays the ball, any part of their head, body or feet is in the opponents’ half and closer to the goal line than both the ball and the second-last opponent. That alone is not an offence: the referee only penalises it when that player then plays the ball, interferes with an opponent, or gains an advantage from having been there.';

export default function OffsideRulePage() {
  return (
    <GuidePage
      path={PATH}
      badge="LAW 11 · LAWS OF THE GAME 2026/27"
      h1="The offside rule in soccer, explained"
      answer={ANSWER}
      answerMore={
        <p>
          The punishment is an indirect free kick to the other team, from the spot where the player got involved. You
          cannot be offside in your own half, or when you receive the ball straight from a throw-in, goal kick or corner.
          In Australia there is no offside at all in MiniRoos (under 6 to under 11).
        </p>
      }
      sections={[
        {
          id: 'two-questions',
          heading: 'Every offside call answers two questions',
          body: (
            <div className="guide-body">
              <p>
                Most offside arguments on the sideline come from mixing up two separate questions. The referee asks them in
                order, and the second one only matters if the answer to the first is yes.
              </p>
              <p>
                <strong>1. Where was the player when the ball was played?</strong> Think of it as a photo taken the instant a
                team-mate kicks, heads or touches the ball. Where the player ends up afterwards doesn’t matter. A striker who
                is onside when the pass is struck can sprint five metres past the last defender before the ball arrives and is
                still onside.
              </p>
              <OffsideTimingDiagram />
              <p>
                In that photo, the player is in an offside position only if all three of these are true:
              </p>
              <ul>
                <li>Some part of their head, body or feet is in the opponents’ half. The halfway line itself counts as their own half.</li>
                <li>That part is closer to the opponents’ goal line than the ball.</li>
                <li>It is also closer to the goal line than the second-last opponent.</li>
              </ul>
              <p>
                Hands and arms don’t count, for anyone, goalkeepers included. The Law draws the line at the bottom of the
                armpit: a shoulder can be offside, a fingertip can’t. Level counts as onside, whether that’s level with the
                second-last opponent or level with the last two. That’s been the rule since 1990, and it’s why
                “level is onside” is still the most useful thing a young striker can learn.
              </p>
              <OffsideBodyDiagram />
              <p>
                The “second-last opponent” is usually the last outfield defender, because the goalkeeper is normally the last
                one. It isn’t always. When the keeper has come out for a corner or rushed off their line, count the two
                deepest opponents, whoever they are. If a defender is on the goal line and the keeper is at the edge of the
                box, the keeper is the second-last opponent.
              </p>
              <OffsideLineDiagram />
              <p>
                <strong>2. Did the player then get involved?</strong> Being in an offside position is legal. A striker can
                stand there all afternoon. It only becomes an offence if the player does one of three things, covered in the
                next section.
              </p>
            </div>
          ),
        },
        {
          id: 'three-ways',
          heading: 'The three ways to commit the offence',
          body: (
            <div className="guide-body">
              <GuideTable
                caption="Law 11.2: what turns an offside position into an offside offence"
                head={['Offence', 'What it means', 'Typical example']}
                rows={[
                  ['Interfering with play', 'Playing or touching a ball passed or touched by a team-mate', 'The through ball, the flick-on, the square pass across the six-yard box'],
                  ['Interfering with an opponent', 'Blocking an opponent’s view, challenging them for the ball, clearly trying to play a ball that’s close by when that affects them, or an obvious action that affects their ability to play the ball', 'Standing in front of the keeper as a shot goes in; jumping with the centre-back for a header you don’t win'],
                  ['Gaining an advantage', 'Playing the ball, or interfering with an opponent, after it rebounds or deflects off the post, crossbar, a match official or an opponent, or after an opponent deliberately saves it', 'The keeper parries a shot and the player who was offside when it was struck taps in the rebound'],
                ]}
              />
              <p>
                Notice what’s missing from that table: running. A player in an offside position who chases a ball but
                doesn’t touch it, and doesn’t affect a defender, hasn’t committed an offence. That’s why a good assistant
                referee waits. The flag goes up when the player becomes involved, not when the pass leaves the boot.
              </p>
              <p>
                For a pass or a shot, the moment that counts is the first contact with the ball. For a goalkeeper’s throw,
                it’s the last contact, when the ball leaves the hand.
              </p>
            </div>
          ),
        },
        {
          id: 'situations',
          heading: 'Offside or not? Ten situations',
          body: (
            <div className="guide-body">
              <p>
                These are the situations that come up most weekends. The verdict assumes the referee saw what you saw.
              </p>
              <GuideTable
                caption="Common offside situations under Law 11"
                head={['Situation', 'Call', 'Why']}
                rows={[
                  ['Striker level with the last defender when the through ball is played', 'Onside', 'Level is onside'],
                  ['Winger receives a cut-back while standing behind the ball', 'Onside', 'You can’t be offside if you’re not ahead of the ball'],
                  ['Forward starts in their own half, then runs past the defence to collect a long ball', 'Onside', 'Position is judged when the ball is played, and your own half never counts'],
                  ['Player in an offside position receives the ball straight from a throw-in', 'No offence', 'There’s no offside from a throw-in, goal kick or corner kick'],
                  ['Player in an offside position stands in the goalkeeper’s line of sight as a team-mate shoots and scores', 'Offside', 'Interfering with an opponent by blocking their view'],
                  ['Player in an offside position out wide, not moving, while a team-mate scores from 20 metres', 'Goal stands', 'Not involved, so no offence'],
                  ['Keeper saves a shot, the ball rebounds to a player who was offside when it was struck', 'Offside', 'Gaining an advantage after a save'],
                  ['Centre-back miscues a clearance straight to a striker who was in an offside position', 'Onside', 'A deliberate play by a defender resets it, even a bad one'],
                  ['Shot deflects off a defender’s leg, which they weren’t trying to play it with, to a striker in an offside position', 'Offside', 'A deflection doesn’t reset anything'],
                  ['Defender steps off the pitch behind their own goal line to try to play a striker offside', 'Onside', 'The defender still counts as being on the goal line, and gets a caution at the next stoppage if they left on purpose'],
                ]}
              />
            </div>
          ),
        },
        {
          id: 'deliberate-play',
          heading: 'When a defender touches it: deliberate play, deflection or save',
          body: (
            <div className="guide-body">
              <p>
                This is where the hardest calls are, at every level. The question isn’t whether the defender touched the
                ball. It’s how.
              </p>
              <ul>
                <li>
                  <strong>A deliberate play resets offside.</strong> If a defender has the ball under control and chooses
                  what to do with it (pass, clear or keep it), and it ends up with an attacker who was in an offside
                  position, there’s no offence. It still counts if the defender makes a mess of it. A sliced clearance is
                  still a deliberate play.
                </li>
                <li>
                  <strong>A deflection doesn’t.</strong> A ball that strikes a defender who had no real chance to play it
                  (a shot that hits a shin from two metres, a cross that clips a heel) leaves the original offside position
                  in place.
                </li>
                <li>
                  <strong>A save doesn’t either.</strong> A save is stopping, or trying to stop, a ball that’s going into or
                  very close to the goal. A defender blocking a goal-bound shot on the line is making a save, not a
                  deliberate play, so a striker who was offside can’t score the rebound.
                </li>
              </ul>
              <DeliberatePlayDiagram />
              <p>
                To tell a deliberate play from a deflection, referees look at four things. Did the ball travel some distance
                with a clear view of it? Was it moving slowly? Was it going where you’d expect? Did the defender have time to
                set their body? The more of those that are true, the more likely it was deliberate. A ball on the ground is
                easier to control than one in the air, so it gets judged more harshly.
              </p>
            </div>
          ),
        },
        {
          id: 'australia',
          heading: 'Offside in Australian community football',
          body: (
            <div className="guide-body">
              <p>
                <strong>MiniRoos (under 6 to under 11): no offside.</strong> Football Australia’s junior formats leave it out
                on purpose. A six-year-old trying to hold a line is a six-year-old not learning to dribble. Instead, the
                other team retreats on restarts, as set out in our{' '}
                <Link href="/guides/miniroos-rules-by-age" style={linkStyle}>MiniRoos rules by age</Link> guide.
              </p>
              <p>
                <strong>From under 12, the full Law applies</strong> once players move to 11-a-side, although the age
                varies by association. Expect that first season to be full of flags. Players who have spent six years
                drifting forward have to learn to check the line before every run.
              </p>
              <p>
                <strong>The referee is often on their own.</strong> In a lot of junior and lower senior grades there are no
                appointed assistants. The referee judges offside from wherever they’re standing, often well behind play
                and at a bad angle, and will get some wrong. Where clubs supply volunteer linespeople, many associations only let them flag
                for the ball going out, and leave offside to the referee. Check your association’s rules before you shout
                at the person holding the flag.
              </p>
            </div>
          ),
        },
        {
          id: 'coaching',
          heading: 'For coaches: using the line instead of fearing it',
          body: (
            <div className="guide-body">
              <p>
                <strong>Teaching strikers.</strong> The best forwards move across the line, not just along it. Start level
                or a step behind the last defender, and curve your run so you’re moving sideways while the passer looks up,
                then straight when the ball is struck. Watch the passer’s standing foot, not the defender. And one habit
                saves more flags than any other: when a team-mate shoots and you’re in an offside position, get out of the
                keeper’s eyeline. You can’t score the rebound anyway.
              </p>
              <p>
                <strong>Teaching defenders.</strong> A back line only steps up together. One player decides when (usually
                the centre-back with the best view), and calls it early and loudly. The trap fails when one defender hangs
                back, and in community football without an assistant referee it’s a gamble even when it works. With a
                referee working alone, holding a slightly deeper line usually costs you less than the goals a missed flag
                gives away.
              </p>
              <p>
                You can sketch both on the{' '}
                <Link href={LINEUP_11.path} style={linkStyle}>11-a-side lineup builder</Link>: set out the back four’s
                shape and the strikers’ starting spots, then share the picture with the team before training.
              </p>
            </div>
          ),
        },
        {
          id: 'whats-next',
          heading: 'Is the offside rule changing?',
          body: (
            <div className="guide-body">
              <p>
                Not for 2026/27. Law 11 came through the latest edition of the Laws of the Game, in force from 1 July 2026,
                without any change. The proposal people have heard of, the “daylight” rule backed by Arsène Wenger, would
                only make a player offside if there were clear space between them and the defender. It was trialled in the
                Canadian Premier League in 2026, with fewer offside calls and more goals. In late October 2026 the IFAB’s
                football and technical advisory panels gave it little support, so it’s unlikely to come in soon.
              </p>
              <p>
                At the top level, technology changes how it’s judged, not what the Law says. Competitions may now use
                semi-automated offside technology, and VAR can check offside before a goal is given. Neither is in
                community football, where it’s still the referee’s eyes and the assistant’s flag.
              </p>
            </div>
          ),
        },
      ]}
      cta={{
        tool: LINEUP_11,
        text: 'Set your back four, midfield and front line on a pitch, then download the picture for the team chat before training.',
        more: [LINEUP_TOOL, guideByPath('/guides/soccer-rules')],
      }}
      questions={[
        {
          q: 'Can you be offside from a throw-in?',
          a: 'No. A player cannot commit an offside offence when they receive the ball directly from a throw-in, a goal kick or a corner kick. Offside applies again from the next time a team-mate plays the ball.',
        },
        {
          q: 'Can you be offside in your own half?',
          a: 'No. An offside position needs part of the head, body or feet in the opponents’ half, and the halfway line counts as your own half. Where a player is when the ball is played is what matters, not where they receive it.',
        },
        {
          q: 'Do arms count for offside?',
          a: 'No. Hands and arms are ignored for every player, including goalkeepers. The Law treats the arm as starting at the bottom of the armpit, so a shoulder can put a player offside but an arm cannot.',
        },
        {
          q: 'Is level with the defender offside?',
          a: 'No. A player level with the second-last opponent, or level with the last two opponents, is onside.',
        },
        {
          q: 'What happens after an offside offence?',
          a: 'The other team gets an indirect free kick from where the offside player became involved in play, even if that spot is in the player’s own half.',
        },
        {
          q: 'Is there offside in futsal or MiniRoos?',
          a: 'No. Futsal has no offside law, and Football Australia’s MiniRoos formats for under 6 to under 11 do not use offside. In MiniRoos the opponents retreat on restarts instead.',
        },
      ]}
      sources={[
        SOURCES.ifabLaw11,
        SOURCES.ifabChanges2627,
        SOURCES.faMiniRoos,
        {
          title: 'IFAB go cold on Wenger’s offside proposal after Canadian Premier League test',
          publisher: 'Inside World Football',
          url: 'https://www.insideworldfootball.com/2026/10/28/ifab-go-cold-on-wengers-offside-proposal-after-canadian-premier-league-test/',
          note: 'The 2026 “daylight” trial and the IFAB advisory panels’ response in October 2026',
        },
      ]}
    />
  );
}
