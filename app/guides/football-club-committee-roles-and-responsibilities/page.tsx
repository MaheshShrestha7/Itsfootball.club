import Link from 'next/link';
import GuidePage, { GuideTable } from '@/components/GuidePage';
import { linkStyle } from '@/components/ToolLandingPage';
import { pageMetadata } from '@/lib/seo';
import { SOURCES, guideByPath } from '@/lib/guides';
import { PLAYING_TIME_TOOL, LINEUP_TOOL, toolOgImage } from '@/lib/tool-pages';

const PATH = '/guides/football-club-committee-roles-and-responsibilities';
const guide = guideByPath(PATH);

export const metadata = pageMetadata({
  title: 'Football Club Committee Roles and Responsibilities',
  description: 'Core committee positions and duties for community soccer clubs: President, Secretary, Treasurer, Registrar, and Member Protection Officer (MPIO).',
  path: PATH,
  image: toolOgImage(guide.tool.path),
});

const ANSWER = 'An Australian community football club committee has an executive (President, Secretary and Treasurer) and a group of officers who do the day-to-day jobs, usually a Registrar, Member Protection Officer, Coaching Coordinator and Equipment Manager. Between them they look after association affiliation, the club’s legal obligations, ground hire, the money and the volunteer rosters.';

export default function CommitteeRolesPage() {
  return (
    <GuidePage
      path={PATH}
      badge="RUNNING A CLUB · COMMITTEE"
      h1="Football club committee roles and responsibilities: Australian club guide"
      answer={ANSWER}
      answerMore={
        <p>
          Splitting the work across several volunteers stops one or two people burning out. Here&apos;s what each role usually does at an Australian club.
        </p>
      }
      sections={[
        {
          id: 'executive-roles',
          heading: 'The executive roles',
          body: (
            <div className="guide-body">
              <GuideTable
                caption="What the executive does"
                head={['Role', 'What it\'s for', 'Main jobs']}
                rows={[
                  ['Club President / Chairperson', 'Leads the club and speaks for it', 'Chairs committee meetings and the AGM. Deals with the council and the association. Makes sure the club follows its constitution.'],
                  ['Club Secretary', 'Paperwork and official letters', 'Keeps the club records and handles letters and emails from the association. Lodges the annual return with Fair Trading, books meetings and takes the minutes.'],
                  ['Club Treasurer', 'Looks after the money', 'Runs the bank account and Stripe ledger, writes the yearly budget, invoices sponsors, pays referee and council fees, and reports on the finances.'],
                  ['Vice President', 'Backs up the President', 'Helps the President, looks after sub-committees such as canteen, social and grounds, and fills in when the President is away.'],
                ]}
              />
            </div>
          ),
        },
        {
          id: 'operational-roles',
          heading: 'The other committee jobs',
          body: (
            <div className="guide-body">
              <GuideTable
                caption="The roles that keep matchday running"
                head={['Position', 'Main jobs']}
                rows={[
                  ['Club Registrar', 'Handles player registrations in PlayFootball, confirms transfers, and checks each player is eligible and has an approved photo.'],
                  ['Member Protection Officer (MPIO)', 'Looks after child safety, checks everyone\'s Working with Children Check (WWCC), and handles complaints from members fairly.'],
                  ['Technical Director / Coaching Coordinator', 'Supports the volunteer coaches, keeps training in line with the Football Australia National Curriculum, and organises coaching courses.'],
                  ['Equipment & Kit Officer', 'Looks after balls, cones, bibs, portable goals and first aid kits, and sorts out jersey sizes and handing out kit each season.'],
                  ['Canteen & Matchday Manager', 'Stocks and runs the canteen, writes the team duty roster, and makes sure the ground is set up, corner flags included.'],
                ]}
              />
            </div>
          ),
        },
        {
          id: 'compliance-rules',
          heading: 'Your legal duties as a committee member',
          body: (
            <div className="guide-body">
              <p>
                Under the incorporated associations laws in each state, committee members count as &ldquo;officers&rdquo; and owe the club fiduciary duties. In practice that means:
              </p>
              <ul>
                <li>Act with care and diligence: read the financial statements and turn up to meetings.</li>
                <li>Act in good faith. Decisions should be in the interests of the club and its players, not your own business.</li>
                <li>Don&apos;t let the club take on debts it can&apos;t pay when they&apos;re due (insolvent trading).</li>
                <li>Coaches, managers and committee members who deal with children need a current Working with Children Check for their state.</li>
              </ul>
            </div>
          ),
        },
      ]}
      cta={{
        tool: PLAYING_TIME_TOOL,
        text: 'Give your coaches an equal playing time schedule, so nobody has to work out the subs by hand.',
        more: [LINEUP_TOOL],
      }}
      questions={[
        {
          q: 'What is the minimum committee size for an incorporated club?',
          a: 'State laws generally expect at least 3 different people in the President, Secretary and Treasurer roles. In most states one person can\'t be both Secretary and Treasurer.',
        },
        {
          q: 'Do committee members need a Working with Children Check (WWCC)?',
          a: 'Yes, if the club has junior players. Every state and territory requires it by law. In Queensland the check is called a Blue Card.',
        },
        {
          q: 'Can club committee members be held personally liable for debts?',
          a: 'Usually not, if the club is an incorporated association (Inc.). Incorporation protects committee members\' personal assets, as long as they act honestly and don\'t knowingly let the club trade while insolvent.',
        },
      ]}
      sources={[SOURCES.ascGovernance, SOURCES.nswIncorporation]}
    />
  );
}
