import Link from 'next/link';
import GuidePage, { GuideTable } from '@/components/GuidePage';
import { linkStyle } from '@/components/ToolLandingPage';
import { pageMetadata } from '@/lib/seo';
import { SOURCES, guideByPath } from '@/lib/guides';
import { LINEUP_TOOL, SEASON_FEE_TOOL, toolOgImage } from '@/lib/tool-pages';

const PATH = '/guides/how-to-start-a-football-club-in-australia';
const guide = guideByPath(PATH);

export const metadata = pageMetadata({
  title: 'How to Start a Football Club in Australia (Step by Step)',
  description: 'Step-by-step guide to starting a community soccer club in Australia: incorporation, association affiliation, council pitch hire and your club website.',
  path: PATH,
  image: toolOgImage(guide.tool.path),
});

const ANSWER = 'To start a community football (soccer) club in Australia, get a founding committee together and adopt a constitution, then incorporate as a not-for-profit association with your state’s fair trading office. After that, apply to join your local football association, book grounds with the council, and put up a club website so players can register.';

export default function HowToStartClubPage() {
  return (
    <GuidePage
      path={PATH}
      badge="STARTING A CLUB · STEP BY STEP"
      h1="How to start a football club in Australia: from constitution to kick-off"
      answer={ANSWER}
      answerMore={
        <p>
          Give yourself 3 to 6 months before the winter season starts in March or April. These are the steps in the order most new clubs do them.
        </p>
      }
      sections={[
        {
          id: 'roadmap',
          heading: 'The six steps, with timings',
          body: (
            <div className="guide-body">
              <GuideTable
                caption="Steps to start a new Australian football club"
                head={['Step', 'What to do', 'Who you deal with', 'When']}
                rows={[
                  ['1. Founding committee', 'Elect at least 3 officers: President, Secretary and Treasurer', 'Founding members', '6 months before the season'],
                  ['2. Incorporation', 'Adopt the model constitution and register as an incorporated association', 'State Fair Trading / Consumer Affairs', '5 months before the season'],
                  ['3. Affiliation', 'Apply to join your local football association', 'District football association', '4 to 5 months before the season'],
                  ['4. Grounds', 'Apply to the council for winter sportsground bookings', 'Local city or shire council', '4 months before the season'],
                  ['5. Bank account and kit', 'Open a club bank account, connect Stripe and order kit samples', 'Your bank and kit supplier', '3 months before the season'],
                  ['6. Website and registrations', 'Put up the club website, open player registration and publish the squad', 'itsfootball.club (free)', '2 months before the season'],
                ]}
              />
            </div>
          ),
        },
        {
          id: 'legal-governance',
          heading: 'Incorporation and the model constitution',
          body: (
            <div className="guide-body">
              <p>
                Most Australian sports clubs are incorporated associations (Inc.) under state law, such as the <em>Associations Incorporation Act 2009</em> in NSW. Incorporating gives committee members limited liability, and it lets the club hold a bank account, sign a lease and take out insurance in its own name.
              </p>
              <p>
                Most states publish a &ldquo;model constitution&rdquo; you can adopt as is. It covers:
              </p>
              <ul>
                <li>What the club is for, as a not-for-profit sporting club.</li>
                <li>How voting works at the Annual General Meeting (AGM).</li>
                <li>How committee office-bearers are elected.</li>
                <li>That profits can&apos;t be paid out to members and have to go back into the club.</li>
              </ul>
            </div>
          ),
        },
        {
          id: 'ground-affiliation',
          heading: 'Joining an association and getting a ground',
          body: (
            <div className="guide-body">
              <p>
                A club can&apos;t register players on its own. You need to affiliate with a member association, such as Southern Districts SFA, Eastern Suburbs FA or a Football Victoria hub, to play in its weekend leagues and be covered by Football Australia&apos;s insurance.
              </p>
              <p>
                At the same time, get in touch with your council&apos;s sportsground or recreation team. Councils give out seasonal licences for grounds (April to August for winter football), and applications usually close between October and December the year before.
              </p>
            </div>
          ),
        },
        {
          id: 'launch-website',
          heading: 'Your club website and registrations',
          body: (
            <div className="guide-body">
              <p>
                Once the association accepts you, you&apos;ll want a website where new players can find you, your sponsors get seen and you can post trial dates.
              </p>
              <p>
                At <Link href="/create-club" style={linkStyle}>itsfootball.club/create-club</Link> you can set up a free club website in about 5 minutes, with your colours, logo, fixtures and a match centre that works on phones.
              </p>
            </div>
          ),
        },
      ]}
      cta={{
        tool: LINEUP_TOOL,
        text: 'Once you have a squad, make your first lineup graphic for the team chat. It’s free and you don’t need an account.',
        more: [SEASON_FEE_TOOL],
      }}
      questions={[
        {
          q: 'How much does it cost to start a football club in Australia?',
          a: 'Expect around $1,500 to $4,000 to get going. That covers incorporation fees ($150 to $250), the association bond or affiliation fee ($500 to $1,500), training gear and balls ($500 to $1,000), and any deposit the council wants for the ground.',
        },
        {
          q: 'How many people do you need on a club committee?',
          a: 'At least 3. Under state incorporation rules, an incorporated club needs three different people as President (or Chairperson), Secretary and Treasurer.',
        },
        {
          q: 'How long before the season should we start planning?',
          a: 'At least 5 to 6 months ahead. For the winter season, council ground applications and association affiliation usually close between October and December.',
        },
      ]}
      sources={[SOURCES.nswIncorporation, SOURCES.ascGovernance]}
    />
  );
}
