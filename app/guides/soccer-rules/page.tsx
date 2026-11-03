import Link from 'next/link';
import GuidePage, { GuideTable } from '@/components/GuidePage';
import { BallInOutDiagram, FoulScaleDiagram, JuniorPathwayDiagram, PitchMarkingsDiagram } from '@/components/GuideDiagrams';
import { linkStyle } from '@/components/ToolLandingPage';
import { pageMetadata } from '@/lib/seo';
import { SOURCES, guideByPath } from '@/lib/guides';
import { LINEUP_TOOL, PLAYING_TIME_TOOL, toolOgImage } from '@/lib/tool-pages';

const PATH = '/guides/soccer-rules';
const guide = guideByPath(PATH);

export const metadata = pageMetadata({
  title: 'Soccer Rules: The 17 Laws in Plain English (2026/27)',
  description: 'The rules of soccer as the IFAB writes them, in plain English: the 17 Laws, fouls and cards, the 2026/27 changes, and how juniors play in Australia.',
  path: PATH,
  image: toolOgImage(guide.tool.path),
});

const ANSWER = 'Two teams of up to 11 players, one of them a goalkeeper, play two 45-minute halves, and a goal is scored when the whole ball crosses the goal line between the posts and under the crossbar. Only the goalkeeper may handle the ball, and only inside their own penalty area; everything else is set out in the 17 Laws of the Game, which the IFAB publishes and every competition in Australia plays under, with changes for juniors.';

export default function SoccerRulesPage() {
  return (
    <GuidePage
      path={PATH}
      badge="LAWS OF THE GAME 2026/27 · IN FORCE FROM 1 JULY 2026"
      h1="Soccer rules in plain English"
      answer={ANSWER}
      answerMore={
        <p>
          The rulebook is called the Laws of the Game, and there are 17 of them. They’re written by the International
          Football Association Board (the IFAB), not FIFA, and change a little every 1 July. Below is what each Law decides
          on a match day, followed by the fouls and cards, this season’s changes, and the rules most people get wrong.
        </p>
      }
      sections={[
        {
          id: 'basics',
          heading: 'The game in one table',
          body: (
            <div className="guide-body">
              <GuideTable
                caption="The basics of an 11-a-side match"
                head={['', 'The rule']}
                rows={[
                  ['Players', '11 a side, including a goalkeeper. A match can’t start or continue with fewer than 7'],
                  ['Length', 'Two halves of 45 minutes, half-time no longer than 15 minutes, plus time added for stoppages'],
                  ['Scoring', 'The whole ball has to cross the whole goal line, between the posts and under the bar'],
                  ['In or out', 'The ball is only out when all of it has crossed all of the line, on the ground or in the air'],
                  ['Handling', 'Only the goalkeeper, only inside their own penalty area, and not from a team-mate’s deliberate kick or throw-in'],
                  ['Winning', 'Most goals wins. A draw stands unless the competition needs a winner, then it’s extra time, penalties or both'],
                ]}
              />
              <p>
                The rule people forget is about the lines. A line is part of the area it marks. A ball sitting on the
                touchline is in play. A foul on the edge of the penalty area line is a penalty. A ball resting on the goal line
                is not a goal, however far it’s rolled over.
              </p>
              <BallInOutDiagram />
            </div>
          ),
        },
        {
          id: 'seventeen-laws',
          heading: 'The 17 Laws and what each one decides',
          body: (
            <div className="guide-body">
              <PitchMarkingsDiagram />
              <GuideTable
                caption="The Laws of the Game 2026/27, summarised for a community match"
                head={['Law', 'What it covers', 'The part that matters on a Saturday']}
                rows={[
                  ['1', 'The field of play', 'Penalty mark 11 m from goal, penalty area 16.5 m deep, goals 7.32 m wide and 2.44 m high. Lines belong to the area they mark'],
                  ['2', 'The ball', 'Size 5 for seniors: 68–70 cm around, 410–450 g. Juniors use smaller balls'],
                  ['3', 'The players', 'Up to 11 a side, minimum 7. Return (rolling) substitutions are allowed in youth, veterans, disability and grassroots football if the competition says so. A substituted player has 10 seconds to leave the field'],
                  ['4', 'Equipment', 'Shirt, shorts, socks, shin pads and boots. Goalkeepers wear different colours from everyone else. Nothing dangerous, so no jewellery'],
                  ['5', 'The referee', 'Their decisions on facts are final. They can play advantage. A player treated on the field must stay off for a minute after play restarts'],
                  ['6', 'Other match officials', 'Assistant referees, a fourth official and, in some competitions, VAR'],
                  ['7', 'Duration', '2 × 45 minutes plus added time. Competitions can agree shorter halves before kick-off, and juniors play shorter games'],
                  ['8', 'Starting and restarting', 'At the kick-off the ball has to clearly move, and you can score straight from it. Dropped balls go to the team that would have had possession'],
                  ['9', 'Ball in and out of play', 'If the ball hits the referee, play stops only if it leads to a goal, a change of possession or a promising attack'],
                  ['10', 'Deciding the result', 'A goal counts only if the scoring team committed no offence on the way. Extra time and penalty shoot-outs live here too'],
                  ['11', 'Offside', 'See our offside guide. No offside from a throw-in, goal kick or corner'],
                  ['12', 'Fouls and misconduct', 'Free kicks, penalties, yellow and red cards. See the next section'],
                  ['13', 'Free kicks', 'Opponents 9.15 m away. Attackers stay at least 1 m from a wall of three or more defenders'],
                  ['14', 'The penalty kick', 'From the 11 m mark. The keeper stays between the posts, with part of one foot on or level with the goal line when the ball is kicked'],
                  ['15', 'The throw-in', 'Both hands, from behind and over the head, both feet partly on the line or on the ground outside it. You can’t score straight from one'],
                  ['16', 'The goal kick', 'In play as soon as it’s kicked and clearly moves, even inside the area. Can score directly against the opponents'],
                  ['17', 'The corner kick', 'From the corner arc, opponents 9.15 m away. Can score directly'],
                ]}
              />
            </div>
          ),
        },
        {
          id: 'fouls-cards',
          heading: 'Fouls, free kicks and cards',
          body: (
            <div className="guide-body">
              <p>
                Law 12 is the one that starts arguments, but its logic is simple. The referee asks two questions about a
                challenge: was it an offence, and how bad was it?
              </p>
              <FoulScaleDiagram />
              <p>
                <strong>Direct and indirect free kicks.</strong> Kicks, trips, pushes, charges, holding, biting, spitting
                and handball are direct free kick offences, and you can score straight from them. Indirect free kicks are for
                the technical offences: offside, dangerous play without contact, impeding an opponent without contact,
                dissent, and the goalkeeper picking up a team-mate’s deliberate kick or throw-in. The referee keeps an arm
                straight up until someone else touches the ball. If an indirect free kick goes straight in, it’s a goal kick,
                not a goal.
              </p>
              <p>
                <strong>Handball.</strong> Not every touch counts. It’s an offence when a player deliberately handles the
                ball, or makes their body unnaturally bigger with their arm and the ball hits it. An attacker who scores with
                their hand or arm, even accidentally, or straight after the ball has hit it, has the goal ruled out. If the
                ball hits a team-mate’s arm by accident earlier in the move, the goal stands.
              </p>
              <p>
                <strong>The goalkeeper’s eight seconds.</strong> A keeper who holds the ball in their hands for more than
                eight seconds gives away a corner. The referee counts the last five seconds down with a raised hand, so
                nobody is surprised.
              </p>
              <p>
                <strong>Cards.</strong> Two yellows in the same match make a red. A sent-off player can’t be replaced, so the
                team plays the rest of the game with one fewer. Youth, veterans, disability and grassroots competitions can
                use temporary dismissals (sin bins) for some cautions instead. Whether yours does is up to your association.
              </p>
              <p>
                <strong>Advantage.</strong> If stopping play would help the team that was fouled less than playing on, the
                referee lets it go and signals with both arms forward. If the advantage doesn’t come within a few seconds,
                they can go back and give the free kick. A card for the original foul can still come at the next stoppage.
              </p>
            </div>
          ),
        },
        {
          id: 'changes-2026-27',
          heading: 'What changed for 2026/27',
          body: (
            <div className="guide-body">
              <p>
                The current Laws have applied since 1 July 2026. Most of the changes are aimed at time-wasting, and the ones
                you’ll notice in a community match are these:
              </p>
              <ul>
                <li><strong>10 seconds to leave for a substitution.</strong> Once the substitution is signalled, the player coming off has ten seconds. Take longer and the substitute can’t come on until the first stoppage after a minute of play.</li>
                <li><strong>One minute off after treatment.</strong> An outfield player treated on the field, or who stops play with an injury, has to stay off for a minute after the restart. The exception is a player injured by a foul that gets a card.</li>
                <li><strong>Five-second countdowns on restarts.</strong> A throw-in that isn’t taken in time goes to the opponents. A goal kick that isn’t taken in time becomes a corner to the opponents.</li>
                <li><strong>A minimum of seven players.</strong> A match can’t start or carry on with fewer, and the team responsible for an abandonment can, in principle, forfeit.</li>
                <li><strong>Covered accessories.</strong> Items that aren’t dangerous can be worn if they’re safely covered. Dangerous ones have to come off, and taping them isn’t enough.</li>
                <li><strong>Penalty double touch.</strong> If the kicker accidentally touches the ball twice and it goes in, the kick is retaken. If it doesn’t go in, the other team gets an indirect free kick.</li>
              </ul>
              <p>
                “Only the captain may approach the referee” is still a guideline this season. It becomes compulsory in every
                competition from 1 July 2027.
              </p>
            </div>
          ),
        },
        {
          id: 'juniors',
          heading: 'How the rules change for juniors in Australia',
          body: (
            <div className="guide-body">
              <p>
                Football Australia changes the Laws for children on purpose, so younger players get more touches, more goals
                and less standing around. The MiniRoos formats run from under 6 to under 11:
              </p>
              <JuniorPathwayDiagram />
              <GuideTable
                caption="Football Australia MiniRoos formats"
                head={['Age', 'Format', 'Match length', 'What’s different']}
                rows={[
                  ['Under 6 & 7', '4 v 4, no goalkeepers', '2 × 20 min','Opponents retreat to halfway on restarts'],
                  ['Under 8 & 9', '7 v 7', '2 × 20 min', 'No offside, rolling subs, retreat line on goal kicks'],
                  ['Under 10 & 11', '9 v 9', '2 × 25 min', 'No offside, rolling subs, retreat line on goal kicks'],
                  ['Under 12 up', '11 v 11', 'Set by your association', 'Full Laws, often with rolling subs in junior competitions'],
                ]}
              />
              <p>
                MiniRoos games don’t publish scores or ladders, and every player gets equal game time. Our{' '}
                <Link href="/guides/miniroos-rules-by-age" style={linkStyle}>MiniRoos rules by age</Link> guide has the
                pitch, ball and goal sizes for each age, and the{' '}
                <Link href={PLAYING_TIME_TOOL.path} style={linkStyle}>equal playing time calculator</Link> works out the
                substitutions for you.
              </p>
            </div>
          ),
        },
        {
          id: 'myths',
          heading: 'Rules most people on the sideline get wrong',
          body: (
            <div className="guide-body">
              <ul>
                <li><strong>“It’s on the line, so it’s out.”</strong> It isn’t. All of the ball has to be over all of the line.</li>
                <li><strong>“It came off the defender, so he’s onside.”</strong> Only if the defender played it deliberately. A deflection or a save doesn’t reset offside.</li>
                <li><strong>“Handball! It hit his hand!”</strong> Contact alone isn’t an offence. It has to be deliberate, or the arm has to make the body unnaturally bigger.</li>
                <li><strong>“The keeper can pick it up, it was a header back.”</strong> True. The back-pass rule only covers a deliberate kick and a throw-in from a team-mate. A header, chest or knee back to the keeper can be picked up.</li>
                <li><strong>“You can’t score from a goal kick.”</strong> You can, against the other team. Same for a kick-off, a corner and a direct free kick.</li>
                <li><strong>“The ref hit the ball, so it’s a drop ball.”</strong> Only if that touch leads to a goal, gives the ball to the other team or starts a promising attack. Otherwise play carries on.</li>
                <li><strong>“He was already booked, so that’s a red.”</strong> Only for a second cautionable offence. A careless foul by a player on a yellow is just a free kick.</li>
              </ul>
            </div>
          ),
        },
      ]}
      cta={{
        tool: LINEUP_TOOL,
        text: 'Pick a 5, 7, 9 or 11-a-side formation, put your players in it and download the team sheet for match day.',
        more: [guideByPath('/guides/offside-rule-soccer'), PLAYING_TIME_TOOL],
      }}
      questions={[
        {
          q: 'How long is a soccer game?',
          a: 'Two halves of 45 minutes, so 90 minutes plus added time for stoppages, with a half-time break of no more than 15 minutes. Junior games are shorter: MiniRoos under 8 and 9 play 2 × 20 minutes, and under 10 and 11 play 2 × 25 minutes.',
        },
        {
          q: 'How many players are on a soccer team?',
          a: 'Eleven on the field, including the goalkeeper. A match cannot start or continue if either team has fewer than seven. MiniRoos juniors play 4, 7 or 9 a side depending on age.',
        },
        {
          q: 'How many substitutes are allowed in soccer?',
          a: 'It depends on the competition. Top competitions allow up to five substitutes, used in no more than three stoppages plus half-time. Youth, veterans, disability and grassroots competitions can allow unlimited rolling substitutions, which is normal in Australian junior football.',
        },
        {
          q: 'Who writes the rules of soccer?',
          a: 'The International Football Association Board (IFAB), made up of FIFA and the four British football associations. It publishes the Laws of the Game, which change each year on 1 July.',
        },
        {
          q: 'Can a goalkeeper pick up a back pass?',
          a: 'Not if a team-mate deliberately kicks it to them, or throws it to them straight from a throw-in. That is an indirect free kick to the opponents. A header, chest or knee back to the keeper can be picked up.',
        },
        {
          q: 'What happens if two yellow cards are shown?',
          a: 'Two yellow cards to the same player in the same match mean a red card. The player is sent off and cannot be replaced, so the team carries on with one fewer.',
        },
      ]}
      sources={[SOURCES.ifabLaws, SOURCES.ifabChanges2627, SOURCES.ifabLaw11, SOURCES.faMiniRoos]}
    />
  );
}
