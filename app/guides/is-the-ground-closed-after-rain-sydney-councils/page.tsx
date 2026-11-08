import Link from 'next/link';
import GuidePage, { GuideTable } from '@/components/GuidePage';
import { linkStyle } from '@/components/ToolLandingPage';
import { pageMetadata } from '@/lib/seo';
import { SOURCES, guideByPath } from '@/lib/guides';
import { LINEUP_TOOL, toolOgImage } from '@/lib/tool-pages';
import { COUNCILS } from '@/lib/councils';

const PATH = '/guides/is-the-ground-closed-after-rain-sydney-councils';
const guide = guideByPath(PATH);

export const metadata = pageMetadata({
  title: 'Is the Ground Closed After Rain? Sydney Council Guide',
  description: 'How Sydney councils decide sportsground wet weather closures: Friday cut-offs, status hotlines and ground rules for Liverpool, Penrith and Blacktown.',
  path: PATH,
  image: toolOgImage(guide.tool.path),
});

const ANSWER = 'After rain, Sydney councils check their sportsgrounds on weekday afternoons. In most council areas the Friday decision, usually out between 2:00pm and 3:30pm, holds for the whole weekend. If the council closes a ground, nobody can train or play there. If it stays open, the home club or the referee decides on the day whether it\'s safe.';

export default function GroundClosuresSydneyGuidePage() {
  return (
    <GuidePage
      path={PATH}
      badge="LOCAL SYDNEY · WET WEATHER"
      h1="Is the football ground closed after rain? Sydney councils wet weather guide"
      answer={ANSWER}
      answerMore={
        <p>
          Rain calls off a lot of Sydney community football. If you know when your council updates its ground status and where to check it, you won&apos;t drive to a closed ground.
        </p>
      }
      sections={[
        {
          id: 'council-hotlines',
          heading: 'When each Sydney council decides, and where to check',
          body: (
            <div className="guide-body">
              <GuideTable
                caption="Sydney council wet weather decision times and where they post closures"
                head={['Council (LGA)', 'When they decide', 'Where they post it', 'Phone line']}
                rows={COUNCILS.map(c => [
                  c.name,
                  c.note.split(',')[0] || 'Weekday afternoons',
                  c.kind === 'status' ? 'Live status webpage' : 'Council sportsground portal',
                  c.phone ? `${c.phone.label}: ${c.phone.number}` : 'Online status page',
                ])}
              />
              <p>
                For toilets, pitch layouts and parking at each ground, see our{' '}
                <Link href="/grounds" style={linkStyle}>
                  Sydney sportsgrounds directory
                </Link>.
              </p>
            </div>
          ),
        },
        {
          id: 'rules-liability',
          heading: 'Council closures and club cancellations',
          body: (
            <div className="guide-body">
              <p>
                A council closure and a club calling off a game are different things, and they carry different consequences:
              </p>
              <ul>
                <li><strong>The council closes the ground.</strong> When the council&apos;s grounds staff close a park because it&apos;s waterlogged, nobody can play on it. A club that plays anyway can lose its seasonal licence straight away and be charged heavily for the turf damage.</li>
                <li><strong>The council says open, but the club or referee calls it off.</strong> If the council lists the ground as open, the home club committee or the referee checks the pitch before kick-off. If there&apos;s standing water, the goalmouths are too muddy or there&apos;s lightning around, the referee can postpone the game.</li>
              </ul>
            </div>
          ),
        },
        {
          id: 'tips-for-parents',
          heading: 'How to check your match status on Saturday morning',
          body: (
            <div className="guide-body">
              <ol>
                <li><strong>Check the council first.</strong> If the council&apos;s status page lists the park as closed, your game is off.</li>
                <li><strong>Then check your club&apos;s site.</strong> Clubs on itsfootball.club can mark a match &ldquo;Postponed&rdquo; or &ldquo;Cancelled&rdquo;, and it shows on the club website straight away.</li>
                <li><strong>Don&apos;t go by the group chat alone.</strong> Look at the club link or the council page before you leave, so you don&apos;t turn up to a locked gate.</li>
              </ol>
            </div>
          ),
        },
      ]}
      cta={{
        tool: LINEUP_TOOL,
        text: 'Game back on? Make the lineup on your phone and send it to the team chat.',
      }}
      questions={[
        {
          q: 'What happens if a team plays on a council ground marked as closed?',
          a: 'It breaks the club\'s sportsground licence. The council can fine the club, charge it for fixing the turf and take away its future seasonal bookings.',
        },
        {
          q: 'If it stops raining on Saturday morning, will closed grounds reopen?',
          a: 'Usually not. In most Sydney councils, such as Liverpool, Blacktown and Camden, the Friday afternoon decision stands for the whole weekend. Grounds staff don\'t check again on Saturday morning, so a ground closed on Friday stays closed.',
        },
        {
          q: 'Where can I find parking and pitch maps for Sydney grounds?',
          a: 'Our grounds directory at itsfootball.club/grounds has pitch maps, surfaces, floodlights and parking for sportsgrounds across Western Sydney.',
        },
      ]}
      sources={[SOURCES.fnswMiniRoos, SOURCES.ascGovernance]}
    />
  );
}
