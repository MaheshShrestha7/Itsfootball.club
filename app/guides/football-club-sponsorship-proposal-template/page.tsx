import Link from 'next/link';
import GuidePage, { GuideTable } from '@/components/GuidePage';
import { linkStyle } from '@/components/ToolLandingPage';
import { pageMetadata } from '@/lib/seo';
import { SOURCES, guideByPath } from '@/lib/guides';
import { SEASON_FEE_TOOL, toolOgImage } from '@/lib/tool-pages';

const PATH = '/guides/football-club-sponsorship-proposal-template';
const guide = guideByPath(PATH);

export const metadata = pageMetadata({
  title: 'Football Club Sponsorship Proposal: Packages, Valuation & Template',
  description: 'How to write a winning sponsorship proposal for a grassroots soccer club. Sponsorship package tiers, pricing guidelines, pitch assets, and email template.',
  path: PATH,
  image: toolOgImage(guide.tool.path),
});

const ANSWER = 'A successful grassroots football club sponsorship proposal clearly packages tangible assets (jersey chest placement, sleeve patches, training gear, digital website showcases, and matchday pitch banners) into defined pricing tiers ($500 to $5,000/year). It emphasizes local community goodwill, measurable brand impressions, and tax-deductible advertising value.';

export default function SponsorshipProposalPage() {
  return (
    <GuidePage
      path={PATH}
      badge="COMMERCIAL · CLUB REVENUE"
      h1="Football club sponsorship proposal: packages, valuation & template"
      answer={ANSWER}
      answerMore={
        <p>
          Local businesses receive dozens of vague sponsorship requests every season. To win support, community clubs must present professional commercial proposals with clear deliverables and transparent returns.
        </p>
      }
      sections={[
        {
          id: 'tier-matrix',
          heading: 'Standard grassroots sponsorship tiers and pricing',
          body: (
            <div className="guide-body">
              <GuideTable
                caption="Grassroots football sponsorship tiers and package valuation (AUD)"
                head={['Tier Level', 'Typical Price (AUD)', 'Key Deliverables', 'Best Suited For']}
                rows={[
                  ['Platinum / Principal', '$3,500 – $6,000 / year', 'Front of 1st team jersey, website hero banner, clubhouse banner, 4 social posts', 'Major local car dealership, real estate agency, or builder'],
                  ['Gold Partner', '$1,800 – $3,000 / year', 'Back of jersey or training kit sponsor, website partner listing, matchday shoutouts', 'Established local gym, accounting firm, or medical center'],
                  ['Silver Partner', '$800 – $1,500 / year', 'Jersey sleeve patch, shorts branding, digital match centre partner display', 'Local cafes, trade businesses (plumbers/electricians)'],
                  ['Bronze / Team Sponsor', '$400 – $750 / year', 'Sponsor of 1 junior team, logo on junior player of the match graphic', 'Small local family businesses and retail shops'],
                  ['Player Sponsor', '$150 – $300 / season', 'Player profile sponsor tag on web squad page & matchday lineup graphics', 'Player families, local sole traders, and alumni'],
                ]}
              />
            </div>
          ),
        },
        {
          id: 'structure',
          heading: 'The 5-part structure of a winning club proposal',
          body: (
            <div className="guide-body">
              <ol>
                <li><strong>1. The Hook &amp; Community Reach:</strong> State your numbers immediately: how many registered players, junior families, teams, and matchday spectators visit your ground each weekend.</li>
                <li><strong>2. Shared Community Values:</strong> Explain how your club keeps youth healthy, active, and mentored in the local area.</li>
                <li><strong>3. Specific Deliverables:</strong> List tangible assets rather than abstract &ldquo;support&rdquo; (e.g. &ldquo;Your logo printed on 15 senior match kits, viewed by 300+ spectators across 18 rounds&rdquo;).</li>
                <li><strong>4. Digital Tracking:</strong> Highlight how your digital club site tracks sponsor impressions and link clicks (platforms like itsfootball.club include automated sponsor impression tracking).</li>
                <li><strong>5. Clear Call to Action:</strong> Propose a specific meeting date or supply an online payment link to lock in exclusivity.</li>
              </ol>
            </div>
          ),
        },
        {
          id: 'proposal-script',
          heading: 'High-converting email pitch template',
          body: (
            <div className="guide-body">
              <div className="glass-panel" style={{ padding: '1.25rem', fontFamily: 'monospace', fontSize: '0.88rem', lineHeight: 1.6, background: 'rgba(0,0,0,0.2)' }}>
                <p><strong>Subject:</strong> Partnership opportunity: Supporting [Club Name] for the 2027 Season</p>
                <p>Hi [Business Owner Name],</p>
                <p>
                  I’m reaching out on behalf of [Club Name], based right here in [Suburb]. Over the past [X] years, our club has grown to [Number] players across [Number] junior and senior teams, welcoming over [Number] local families to our ground every Saturday morning.
                </p>
                <p>
                  As a community non-profit, we are looking to partner with respected local businesses like [Business Name] who share our dedication to grassroots sport and community well-being.
                </p>
                <p>
                  For the upcoming season, we have an exclusive opportunity for a [Gold / Silver] Partner, which includes:
                </p>
                <ul>
                  <li>Your company logo featured prominently on our [First Team / Junior] kits.</li>
                  <li>Official partner placement on our public website and live match centre.</li>
                  <li>Dedicated partner spotlight across our social channels and member newsletter.</li>
                </ul>
                <p>
                  Could we grab a quick 10-minute coffee this week to discuss how we can tailor this package to showcase [Business Name] to our community?
                </p>
                <p>Warm regards,<br />[Your Name]<br />Sponsorship Officer / Committee Member<br />[Club Name] · [Phone] · [Website]</p>
              </div>
            </div>
          ),
        },
      ]}
      cta={{
        tool: SEASON_FEE_TOOL,
        text: 'Model your club budget, calculate sponsorship revenue offsets, and project your season finances with our free calculator.',
      }}
      questions={[
        {
          q: 'Is football club sponsorship tax deductible for Australian businesses?',
          a: 'Yes. In most cases, local business sponsorship of a community sports club is treated by the Australian Taxation Office (ATO) as a legitimate tax-deductible advertising and marketing expense, provided the club provides tangible promotional benefits.',
        },
        {
          q: 'When is the best time to approach sponsors for grassroots football?',
          a: 'The best window is between October and January before the winter soccer season starts. This aligns with business financial planning cycles and ensures logos can be printed on jerseys before season production deadlines.',
        },
        {
          q: 'Can clubs track how many impressions a sponsor receives?',
          a: 'Yes. Modern platforms like itsfootball.club automatically record digital banner impressions and click-through rates across club websites, match pages, and tournament hubs, giving sponsors verifiable end-of-season renewal reports.',
        },
      ]}
      sources={[SOURCES.ascGovernance, SOURCES.stripeAu]}
    />
  );
}
