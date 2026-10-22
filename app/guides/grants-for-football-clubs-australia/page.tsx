import Link from 'next/link';
import GuidePage, { GuideJoin, GuideTable } from '@/components/GuidePage';
import { linkStyle } from '@/components/ToolLandingPage';
import { pageMetadata } from '@/lib/seo';
import { SOURCES, guideByPath } from '@/lib/guides';
import { toolOgImage } from '@/lib/tool-pages';

const PATH = '/guides/grants-for-football-clubs-australia';
const guide = guideByPath(PATH);

export const metadata = pageMetadata({
  title: 'Grants for Football Clubs in Australia (2026–27): What’s Open and When',
  description: 'Grants a community soccer club can apply for: Football Australia’s Growing Football grants, the Australian Sports Foundation, NSW Local Sport Grants, ClubGRANTS, Victoria’s Sporting Club Grants and your council. Amounts, dates and what they fund.',
  path: PATH,
  image: toolOgImage(guide.tool.path),
});

const ANSWER = 'Most community football clubs can apply to three layers of funding: Football Australia’s Growing Football grants (up to $5,000), their state government’s club grants (in NSW, $2,000 to $20,000 through the Local Sport Grant Program), and their local council. Nearly all of them need the club to be incorporated, and most run once a year in a short window, so the trick is knowing the dates.';

export default function GrantsGuidePage() {
  return (
    <GuidePage
      path={PATH}
      badge="CLUB COMMITTEE · FUNDING"
      h1="Grants for football clubs in Australia: what’s out there and when it opens"
      answer={ANSWER}
      answerMore={
        <p>
          Grant rounds open and close fast, often within four to six weeks, and the next year&apos;s dates aren&apos;t always announced early. The table below shows the most recent
          round we could confirm for each one, so you know roughly when to start watching. Check the official page before you plan around a date.
        </p>
      }
      sections={[
        {
          id: 'national',
          heading: 'Football and national grants',
          body: (
            <div className="guide-body">
              <GuideTable
                caption="National grants for community football clubs (checked 22 October 2026)"
                head={['Grant', 'How much', 'What it’s for', 'Latest round']}
                rows={[
                  ['Football Australia Growing Football Community Grant', 'Up to $5,000', 'Bringing in and keeping women and girls: female coach courses, come and try days, female-fit uniforms, subsidised fees', '8 September to 20 October 2026; results December'],
                  ['Australian Sports Foundation Active Kids Grant', 'Equipment and uniforms', 'Volunteer-run clubs with members aged 20 and under', '2026 round awarded; next round announced early 2027'],
                ]}
              />
              <p>
                For the Football Australia grant, the club has to be registered with Football Australia and on its <strong>Club Changer Program</strong> with
                a 1, 2 or 3-star rating, be incorporated, and owe nothing to Football Australia or its state federation. It won&apos;t pay for general equipment for
                existing teams, ground hire, travel or anything you&apos;ve already bought.
              </p>
            </div>
          ),
        },
        {
          id: 'state',
          heading: 'State and council grants',
          body: (
            <div className="guide-body">
              <GuideTable
                caption="State and local grants (checked 22 October 2026)"
                head={['Where', 'Grant', 'How much', 'Latest round']}
                rows={[
                  ['NSW', 'Local Sport Grant Program', '$2,000 to $20,000', '27 July to 24 August 2026; results December 2026'],
                  ['NSW', 'ClubGRANTS (Category 1), funded with local registered clubs', 'Varies by area', 'Opens each March through ClubGRANTS online'],
                  ['VIC', 'Sporting Club Grants Program', 'Uniforms and equipment up to $1,000; volunteering or officiating projects up to $5,000; governance up to $1,500; travel up to $750', '25 February to 7 April 2026'],
                  ['WA', 'Every Club Grant Scheme', 'Up to $50,000 a year to councils', 'Councils apply; ask yours what club programs it runs'],
                  ['Everywhere', 'Your local council’s community grants', 'Usually small', 'Check your council’s grants page'],
                ]}
              />
              <p>
                The NSW Local Sport Grant is the big one for most clubs. It covers things like coach accreditation courses, new equipment and uniforms, regional travel
                and facility upgrades such as lighting. It doesn&apos;t cover running costs, insurance or anything bought before you apply. You&apos;ll need your
                affiliation form signed by your state federation, landowner&apos;s consent (usually the council) for anything to do with the ground, and $5 million
                public liability cover if you&apos;re successful.
              </p>
              <p>
                In Queensland, the state club funding we found open recently was disaster recovery money for clubs hit by the 2025 floods and Cyclone Alfred. If
                you&apos;re in Queensland or another state not listed here, your state sport department&apos;s grants page is the place to start.
              </p>
            </div>
          ),
        },
        {
          id: 'donations',
          heading: 'Not a grant, but worth setting up: tax-deductible donations',
          body: (
            <div className="guide-body">
              <p>
                Most clubs can&apos;t give donors a tax deduction on their own. Through the Australian Sports Foundation, they can. You register a fundraising project
                for free, and donations of $2 or more to it are tax-deductible. The Foundation keeps 5% of online donations and pays the rest to the club fortnightly as
                a grant.
              </p>
              <p>
                It&apos;s a good fit for a local business that wants to help but doesn&apos;t want its logo on a banner, or for a parent who&apos;d rather give $100
                than sell raffle tickets. The club needs to be incorporated, with an ABN and a bank account.
              </p>
            </div>
          ),
        },
        {
          id: 'applying',
          heading: 'How to give your application a real chance',
          body: (
            <div className="guide-body">
              <ul>
                <li><strong>Get the paperwork ready before the round opens.</strong> Incorporation certificate, ABN, latest financial statements, insurance certificate, and a quote for whatever you&apos;re buying.</li>
                <li><strong>Ask for one clear thing.</strong> &ldquo;Twenty sets of female-fit kit for our new under-12 girls team&rdquo; is easier to fund than &ldquo;general club development&rdquo;.</li>
                <li><strong>Show the numbers.</strong> How many players, how many teams, how many girls, how many new members this would bring in.</li>
                <li><strong>Read what&apos;s excluded.</strong> An easy way to miss out is asking for something the guidelines rule out, like running costs or items you&apos;ve already bought.</li>
                <li><strong>Keep receipts.</strong> If you get the money, you&apos;ll have to report on how it was spent.</li>
              </ul>
              <GuideJoin title="Make your club easy to check up on">
                A free club website puts your teams, committee, fixtures and results in one public place, and the finance page keeps a record of income and spending
                for when it&apos;s time to report back on a grant.
              </GuideJoin>
              <p>
                Grants rarely cover the whole season, so most clubs also run a fundraiser or two. Our <Link href="/guides/bunnings-sausage-sizzle-fundraiser" style={linkStyle}>sausage sizzle guide</Link> and
                {' '}<Link href="/guides/football-club-sponsorship-proposal-template" style={linkStyle}>sponsorship proposal template</Link> cover the other two usual routes.
              </p>
            </div>
          ),
        },
      ]}
      cta={{
        tool: guide.tool,
        text: 'Before you apply, work out what the season actually costs. It makes the budget section of any grant application much easier.',
      }}
      questions={[
        {
          q: 'Does our club need to be incorporated to get a grant?',
          a: 'For almost all of them, yes. The NSW Local Sport Grant, Football Australia’s grant and the Australian Sports Foundation all ask for an incorporated club.',
        },
        {
          q: 'Can a grant pay for ground hire or referees?',
          a: 'Usually not. Most programs exclude ongoing running costs. Football Australia’s grant specifically rules out ground hire, competition fees and travel.',
        },
        {
          q: 'When does the NSW Local Sport Grant open?',
          a: 'The 2026/27 round ran from 27 July to 24 August 2026, with results due in December 2026. Watch the NSW Office of Sport grants page from mid-year for the next one.',
        },
        {
          q: 'Are donations to a football club tax-deductible?',
          a: 'Not usually directly, but they can be if the club runs a fundraising project through the Australian Sports Foundation. Donations of $2 or more to it are tax-deductible.',
        },
      ]}
      sources={[SOURCES.faGrowingFootball, SOURCES.asfActiveKids, SOURCES.asfFaqs, SOURCES.nswLsgp, SOURCES.clubGrants, SOURCES.vicClubGrants, SOURCES.waEveryClub]}
    />
  );
}
