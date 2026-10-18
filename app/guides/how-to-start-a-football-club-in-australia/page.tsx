import Link from 'next/link';
import GuidePage, { GuideTable } from '@/components/GuidePage';
import { linkStyle } from '@/components/ToolLandingPage';
import { pageMetadata } from '@/lib/seo';
import { SOURCES, guideByPath } from '@/lib/guides';
import { LINEUP_TOOL, SEASON_FEE_TOOL, toolOgImage } from '@/lib/tool-pages';

const PATH = '/guides/how-to-start-a-football-club-in-australia';
const guide = guideByPath(PATH);

export const metadata = pageMetadata({
  title: 'How to Start a Football Club in Australia: Affiliation, Constitution & Setup',
  description: 'Complete step-by-step guide to starting a community soccer club in Australia: incorporation, association affiliation, council pitch hire, and launching your club website.',
  path: PATH,
  image: toolOgImage(guide.tool.path),
});

const ANSWER = 'To start a community football (soccer) club in Australia, you need to form a founding committee, adopt a constitution, incorporate as a non-profit association with your state fair trading authority, apply for affiliation with your local football district association, secure training grounds from your local council, and launch an official club website for player registration.';

export default function HowToStartClubPage() {
  return (
    <GuidePage
      path={PATH}
      badge="FOUNDING A CLUB · STEP-BY-STEP"
      h1="How to start a football club in Australia: from constitution to kick-off"
      answer={ANSWER}
      answerMore={
        <p>
          Starting a grassroots club takes about 3 to 6 months of lead time before the winter season commences in March/April. Here is the operational roadmap every founder must follow.
        </p>
      }
      sections={[
        {
          id: 'roadmap',
          heading: 'The 6-step roadmap to founding a football club',
          body: (
            <div className="guide-body">
              <GuideTable
                caption="Operational roadmap for launching a new Australian football club"
                head={['Stage', 'Action Required', 'Authority / Partner', 'Timeline']}
                rows={[
                  ['1. Founding Committee', 'Elect minimum 3 officers: President, Secretary, Treasurer', 'Founding members', '6 months before season'],
                  ['2. Incorporation', 'Adopt Model Constitution; register as Incorporated Association', 'State Fair Trading / Consumer Affairs', '5 months before season'],
                  ['3. Association Affiliation', 'Apply for membership with local Football District Association', 'District Football Association', '4–5 months before season'],
                  ['4. Ground Allocation', 'Submit winter sportsground booking application for pitches', 'Local City / Shire Council', '4 months before season'],
                  ['5. Banking & Kit Design', 'Open club bank account, connect Stripe, order kit samples', 'Financial Institution & Kit Supplier', '3 months before season'],
                  ['6. Digital Club Launch', 'Launch official club website, open player registration, publish squad', 'itsfootball.club (Free platform)', '2 months before season'],
                ]}
              />
            </div>
          ),
        },
        {
          id: 'legal-governance',
          heading: 'Legal requirements and model constitution',
          body: (
            <div className="guide-body">
              <p>
                In Australia, sports clubs operate as <strong>Incorporated Associations</strong> (Inc.) under state legislation (e.g. <em>Associations Incorporation Act 2009</em> in NSW). Incorporation protects committee members with limited liability and allows the club to hold bank accounts, sign lease agreements, and enter insurance contracts.
              </p>
              <p>
                Most state departments provide a standard &ldquo;Model Constitution&rdquo; that sets out:
              </p>
              <ul>
                <li>The club&apos;s non-profit sporting objective.</li>
                <li>Annual General Meeting (AGM) voting procedures.</li>
                <li>Rules for electing committee office-bearers.</li>
                <li>Non-distribution clauses (all funds must be reinvested into the club).</li>
              </ul>
            </div>
          ),
        },
        {
          id: 'ground-affiliation',
          heading: 'District affiliation and council pitch allocation',
          body: (
            <div className="guide-body">
              <p>
                Your club cannot simply register players independently; you must affiliate with a recognized member association (such as Southern Districts SFA, Eastern Suburbs FA, or Football Victoria hubs) to enter sanctioned weekend leagues and receive Football Australia insurance coverage.
              </p>
              <p>
                Simultaneously, liaise with your local municipal council&apos;s Sportsground &amp; Recreation team. Councils allocate seasonal licenses for fields (April to August for winter soccer), and applications generally close between October and December of the preceding year.
              </p>
            </div>
          ),
        },
        {
          id: 'launch-website',
          heading: 'Setting up your club website and registrations',
          body: (
            <div className="guide-body">
              <p>
                Once your association accepts your affiliation, you need a public home on the web to attract players, showcase your sponsors, and announce trial dates.
              </p>
              <p>
                With <Link href="/create-club" style={linkStyle}>itsfootball.club/create-club</Link>, you can launch a free official club website in 5 minutes with custom colours, club logo, fixtures, and mobile match centre at zero software cost.
              </p>
            </div>
          ),
        },
      ]}
      cta={{
        tool: LINEUP_TOOL,
        text: 'Claim your new football club website and visual squad lineup board today, completely free.',
        more: [SEASON_FEE_TOOL],
      }}
      questions={[
        {
          q: 'How much does it cost to start a football club in Australia?',
          a: 'Initial startup costs typically range from $1,500 to $4,000, covering incorporation filing fees ($150–$250), association bond/affiliation ($500–$1,500), initial training equipment and balls ($500–$1,000), and preliminary council pitch deposits.',
        },
        {
          q: 'How many people do you need on a club committee?',
          a: 'Under Australian state association incorporation rules, an incorporated club requires at least 3 distinct officers: a President/Chairperson, a Secretary, and a Treasurer.',
        },
        {
          q: 'How long before the season should we start planning?',
          a: 'At least 5 to 6 months. Council sportsground applications and association affiliation deadlines for the winter soccer season typically close between October and December.',
        },
      ]}
      sources={[SOURCES.nswIncorporation, SOURCES.ascGovernance]}
    />
  );
}
