import Link from 'next/link';
import GuidePage, { GuideTable } from '@/components/GuidePage';
import { linkStyle } from '@/components/ToolLandingPage';
import { pageMetadata } from '@/lib/seo';
import { SOURCES, guideByPath } from '@/lib/guides';
import { PLAYING_TIME_TOOL, LINEUP_TOOL, toolOgImage } from '@/lib/tool-pages';

const PATH = '/guides/football-club-committee-roles-and-responsibilities';
const guide = guideByPath(PATH);

export const metadata = pageMetadata({
  title: 'Football Club Committee Roles & Responsibilities: Guide for Australian Clubs',
  description: 'Core committee positions and duties for community soccer clubs: President, Secretary, Treasurer, Registrar, and Member Protection Officer (MPIO).',
  path: PATH,
  image: toolOgImage(guide.tool.path),
});

const ANSWER = 'An Australian community football club committee is led by an Executive (President, Secretary, and Treasurer) supported by operational officers (Registrar, Member Protection Officer, Coaching Coordinator, and Equipment Manager). Together, they manage association affiliation, legal governance, field hire, finances, and volunteer duty rosters.';

export default function CommitteeRolesPage() {
  return (
    <GuidePage
      path={PATH}
      badge="GOVERNANCE · COMMITTEE MANAGEMENT"
      h1="Football club committee roles and responsibilities: Australian club guide"
      answer={ANSWER}
      answerMore={
        <p>
          Running a community sports club requires dividing operational workloads among volunteers to prevent volunteer burnout. Here is the official breakdown of committee duties under Australian sports governance guidelines.
        </p>
      }
      sections={[
        {
          id: 'executive-roles',
          heading: 'The Executive committee roles',
          body: (
            <div className="guide-body">
              <GuideTable
                caption="Executive committee responsibilities and key deliverables"
                head={['Role', 'Primary Purpose', 'Core Responsibilities']}
                rows={[
                  ['Club President / Chairperson', 'Strategic leadership & external representation', 'Chairs committee meetings and AGMs; liaises with council and association; ensures club adherence to constitution and values.'],
                  ['Club Secretary', 'Administration & official communication', 'Maintains club records; manages official association correspondence; lodges annual returns with Fair Trading; schedules meetings and records minutes.'],
                  ['Club Treasurer', 'Financial management & budget oversight', 'Manages club bank accounts and Stripe ledger; prepares annual budgets; invoices sponsors; pays referee and council fees; presents financial reports.'],
                  ['Vice President', 'Executive support & operations', 'Supports the President; coordinates sub-committees (canteen, social, grounds); steps in when the President is absent.'],
                ]}
              />
            </div>
          ),
        },
        {
          id: 'operational-roles',
          heading: 'Essential operational club positions',
          body: (
            <div className="guide-body">
              <GuideTable
                caption="Operational roles vital for smooth soccer club matchdays"
                head={['Position', 'Key Duties']}
                rows={[
                  ['Club Registrar', 'Manages player registrations in PlayFootball; confirms transfers; ensures player eligibility and photo verification.'],
                  ['Member Protection Officer (MPIO)', 'Ensures child safety compliance; verifies Working with Children Checks (WWCC); handles member grievances impartially.'],
                  ['Technical Director / Coaching Coordinator', 'Mentors volunteer coaches; aligns training drills with the Football Australia National Curriculum; organizes coaching courses.'],
                  ['Equipment & Kit Officer', 'Manages match balls, cones, bibs, portable goals, and first aid kits; coordinates seasonal jersey sizing and distribution.'],
                  ['Canteen & Matchday Manager', 'Stocks and operates the matchday canteen; schedules volunteer team duty rosters; manages ground setup and corner flags.'],
                ]}
              />
            </div>
          ),
        },
        {
          id: 'compliance-rules',
          heading: 'Legal duties of Australian club committee members',
          body: (
            <div className="guide-body">
              <p>
                Under Australian incorporated association laws, committee members are legally classified as &ldquo;officers&rdquo; and owe fiduciary duties to their club:
              </p>
              <ul>
                <li><strong>Duty of care and diligence:</strong> Committee members must act prudently, review financial statements, and attend meetings regularly.</li>
                <li><strong>Good faith and proper purpose:</strong> Decisions must serve the best interests of the club and its players, never personal commercial interests.</li>
                <li><strong>Preventing insolvent trading:</strong> The committee must ensure the club does not incur debts it cannot pay when they fall due.</li>
                <li><strong>Child safety &amp; WWCC:</strong> All coaches, managers, and committee members in contact with minors must hold a valid state Working with Children Check.</li>
              </ul>
            </div>
          ),
        },
      ]}
      cta={{
        tool: PLAYING_TIME_TOOL,
        text: 'Save hours for your club committee and coaches with automated equal playing time schedules and live match sheets.',
        more: [LINEUP_TOOL],
      }}
      questions={[
        {
          q: 'What is the minimum committee size for an incorporated club?',
          a: 'Australian state laws generally require a minimum of 3 distinct individuals to hold the positions of President, Secretary, and Treasurer. A single individual cannot hold both the Secretary and Treasurer roles in most jurisdictions.',
        },
        {
          q: 'Do committee members need a Working with Children Check (WWCC)?',
          a: 'Yes. In all Australian states and territories, committee members of clubs involving junior participants are required by law to hold a verified Working with Children Check (or state equivalent like the Blue Card in Queensland).',
        },
        {
          q: 'Can club committee members be held personally liable for debts?',
          a: 'Incorporation as an Association (Inc.) provides limited liability protection to committee members, shielding their personal assets, provided they act honestly and do not knowingly trade while insolvent.',
        },
      ]}
      sources={[SOURCES.ascGovernance, SOURCES.nswIncorporation]}
    />
  );
}
