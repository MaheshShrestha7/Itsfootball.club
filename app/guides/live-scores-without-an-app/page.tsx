import Link from 'next/link';
import GuidePage, { GuideTable } from '@/components/GuidePage';
import { linkStyle } from '@/components/ToolLandingPage';
import { pageMetadata } from '@/lib/seo';
import { SOURCES, guideByPath } from '@/lib/guides';
import { RESULT_TOOL, toolOgImage } from '@/lib/tool-pages';

const PATH = '/guides/live-scores-without-an-app';
const guide = guideByPath(PATH);

export const metadata = pageMetadata({
  title: 'Live Scores for a Grassroots Football Match Without an App',
  description: 'Ways for a grassroots soccer club to post live scores that supporters can follow in a browser, with no app to install: chat updates, a club live match page, and a result graphic.',
  path: PATH,
  image: toolOgImage(guide.tool.path),
});

const ANSWER = 'Give one person at the ground the job of scorer and have them update a live match page on their phone, then share that page’s link in the team chat and on the club’s socials before kick-off. Supporters open the link in their browser, so nobody has to install anything.';

export default function LiveScoresWithoutAppPage() {
  return (
    <GuidePage
      path={PATH}
      badge="MATCHDAY · ANY CLUB"
      h1="How to post live scores for a local match without an app"
      answer={ANSWER}
      answerMore={
        <p>
          The scorer doesn&apos;t need to be the coach. A parent or a player on the bench with a charged phone is enough, as long as everyone
          knows it&apos;s their job for the day.
        </p>
      }
      sections={[
        {
          id: 'options',
          heading: 'The three ways clubs do it',
          body: (
            <div className="guide-body">
              <GuideTable
                caption="Ways to share a score as the game is played"
                head={['Way', 'What supporters need', 'Good for', 'Watch out for']}
                rows={[
                  ['Messages in the team chat', 'Already in the chat', 'One team, family and players', 'Updates get lost between other messages, and nobody outside the chat sees them'],
                  ['Posts on the club’s Facebook or Instagram', 'The app, or a browser', 'Big games, cup finals', 'Someone has to type every post, and the score is spread over several posts'],
                  ['A live match page on the club website', 'A link, opened in any browser', 'Every game, every team', 'Only works if the club’s platform has one, and the scorer needs phone signal at the ground'],
                ]}
              />
              <p>
                Some club platforms put live scores in their own app. Pitchero, for example, has scores entered in its Club app, and
                they show on the club&apos;s Pitchero website as well as in the app. If your platform shows the score on a web page, share
                that page, not the app download link.
              </p>
            </div>
          ),
        },
        {
          id: 'on-the-day',
          heading: 'On the day',
          body: (
            <div className="guide-body">
              <ul>
                <li>Pick the scorer before the warm-up, and check their phone is charged and signed in.</li>
                <li>Post the match link in the team chat before kick-off, so people can open it when the game starts.</li>
                <li>Record the other team&apos;s goals too. A live score that only shows your goals is wrong half the time.</li>
                <li>If signal drops at the ground, note the minute of each goal on paper and add them once you&apos;re back online.</li>
                <li>
                  MiniRoos games (under 6 to under 11) don&apos;t have ladders, so check your association&apos;s rules before you
                  publish scores for those age groups. Our{' '}
                  <Link href="/guides/miniroos-rules-nsw-vic-qld-wa" style={linkStyle}>MiniRoos rules by state</Link> guide covers it.
                </li>
              </ul>
            </div>
          ),
        },
        {
          id: 'after',
          heading: 'After full time',
          body: (
            <div className="guide-body">
              <p>
                Post the final score while people are still talking about the game. A picture gets more attention in a feed than a line
                of text: the{' '}
                <Link href={RESULT_TOOL.path} style={linkStyle}>match result graphic maker</Link>{' '}
                makes a full-time score image for stories and posts, free and without signing in.
              </p>
            </div>
          ),
        },
        {
          id: 'itsfootball',
          heading: 'Doing it on itsfootball.club',
          body: (
            <div className="guide-body">
              <p>
                We make itsfootball.club, and this is how it works there. A club admin opens Match Centre on their phone at the ground and
                records goals, cards and substitutions as they happen. There&apos;s a touchline mode with a big score and large buttons for
                one-handed use. Supporters follow the club&apos;s match page in their browser, and when the game ends the result, scorers
                and player stats go into the club&apos;s fixtures automatically. It&apos;s free for clubs.
              </p>
            </div>
          ),
        },
      ]}
      cta={{
        tool: RESULT_TOOL,
        text: 'Make a full-time score graphic with both crests and the scorers, ready for Instagram, Facebook or the team chat.',
      }}
      questions={[
        {
          q: 'Do supporters need an app to follow a live score?',
          a: 'No. If the score is on a web page, anyone with the link can follow it in their phone’s browser. An app is only needed if the platform shows scores inside its own app and nowhere else.',
        },
        {
          q: 'Who should update the score during a grassroots match?',
          a: 'One named person for the whole game, usually a parent or a player on the bench. The coach is normally too busy, and two people updating at once leads to mistakes.',
        },
        {
          q: 'Should we post live scores for MiniRoos games?',
          a: 'Check first. MiniRoos (under 6 to under 11) is played without ladders, and associations can set their own rules on publishing junior results.',
        },
      ]}
      sources={[SOURCES.pitcheroScores, SOURCES.faMiniRoos]}
    />
  );
}
