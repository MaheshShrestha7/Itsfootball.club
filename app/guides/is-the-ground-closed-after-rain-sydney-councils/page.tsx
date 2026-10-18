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
  title: 'Is the Football Ground Closed After Rain? Sydney Councils Wet Weather Guide',
  description: 'How Sydney councils decide sportsground wet weather closures: Friday cut-off times, council status hotlines, and ground rules for Liverpool, Penrith, and Blacktown.',
  path: PATH,
  image: toolOgImage(guide.tool.path),
});

const ANSWER = 'Sydney councils inspect sportsgrounds after wet weather on weekday afternoons, with Friday decisions (typically announced between 2:00pm and 3:30pm) applying for the entire weekend in most LGAs. If the council closes a ground, no training or games may proceed. If the council leaves fields open, the home club or referee makes the final matchday safety call.';

export default function GroundClosuresSydneyGuidePage() {
  return (
    <GuidePage
      path={PATH}
      badge="LOCAL SYDNEY · WET WEATHER"
      h1="Is the football ground closed after rain? Sydney councils wet weather guide"
      answer={ANSWER}
      answerMore={
        <p>
          Heavy rainfall frequently disrupts Sydney community football. Understanding when each local council updates its sportsground status and where to check hotlines prevents unnecessary weekend travel.
        </p>
      }
      sections={[
        {
          id: 'council-hotlines',
          heading: 'Sydney council sportsground closure status lines & update schedules',
          body: (
            <div className="guide-body">
              <GuideTable
                caption="Sydney council wet weather decision times and official closure channels"
                head={['Council (LGA)', 'Weekend Decision Schedule', 'Status Method', 'Hotline / Contact']}
                rows={COUNCILS.map(c => [
                  c.name,
                  c.note.split(',')[0] || 'Weekday afternoons',
                  c.kind === 'status' ? 'Live status webpage' : 'Council sportsground portal',
                  c.phone ? `${c.phone.label}: ${c.phone.number}` : 'Online status page',
                ])}
              />
              <p>
                Browse individual ground amenities, pitch configurations, and verified parking in our dedicated{' '}
                <Link href="/grounds" style={linkStyle}>
                  Sydney sportsgrounds directory
                </Link>.
              </p>
            </div>
          ),
        },
        {
          id: 'rules-liability',
          heading: 'Council closure vs Club matchday cancellation',
          body: (
            <div className="guide-body">
              <p>
                There is a legal and contractual distinction between a council closure and a club cancellation:
              </p>
              <ul>
                <li><strong>Council Closure (Binding):</strong> When a council grounds manager declares a park closed due to saturation, all play is strictly prohibited. Clubs that breach council closures face immediate revocation of seasonal licenses and hefty financial penalties for turf damage.</li>
                <li><strong>Council Open, but Club/Referee Closure:</strong> If the council declares fields &ldquo;open&rdquo;, the home club committee or the match referee conducts a pitch inspection prior to kick-off. If surface water, muddy goalmouths, or lightning present safety risks, the referee has the authority to postpone the match.</li>
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
                <li><strong>1. Check your council status first:</strong> If your council status page lists the park as closed, your match is called off.</li>
                <li><strong>2. Check your club live match centre:</strong> Clubs using itsfootball.club update match statuses live to &ldquo;Postponed&rdquo; or &ldquo;Cancelled&rdquo; on their official club website.</li>
                <li><strong>3. Don&apos;t rely solely on group chats:</strong> Check the official club link or council status page before travelling to avoid arriving at a locked gate.</li>
              </ol>
            </div>
          ),
        },
      ]}
      cta={{
        tool: LINEUP_TOOL,
        text: 'Manage your matchday lineups, squad changes, and team fixtures from any phone browser on itsfootball.club.',
      }}
      questions={[
        {
          q: 'What happens if a team plays on a council ground marked as closed?',
          a: 'Playing on a closed council ground is a breach of the sportsground license agreement. Councils can fine the club, charge for turf restoration, and revoke future seasonal field allocations.',
        },
        {
          q: 'If it stops raining on Saturday morning, will closed grounds reopen?',
          a: 'In most Sydney councils (such as Liverpool, Blacktown, and Camden), Friday afternoon decisions stand for the entire weekend. Grounds staff do not re-inspect fields on Saturday mornings, so a field closed on Friday remains closed all weekend.',
        },
        {
          q: 'Where can I find parking and pitch maps for Sydney grounds?',
          a: 'You can check itsfootball.club/grounds for complete field maps, pitch surfaces, floodlight availability, and parking guides for sportsgrounds across Western Sydney.',
        },
      ]}
      sources={[SOURCES.fnswMiniRoos, SOURCES.ascGovernance]}
    />
  );
}
