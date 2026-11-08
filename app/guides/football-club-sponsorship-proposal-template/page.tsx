import Link from 'next/link';
import GuidePage, { GuideTable } from '@/components/GuidePage';
import { linkStyle } from '@/components/ToolLandingPage';
import { pageMetadata } from '@/lib/seo';
import { SOURCES, guideByPath } from '@/lib/guides';
import { SEASON_FEE_TOOL, toolOgImage } from '@/lib/tool-pages';

const PATH = '/guides/football-club-sponsorship-proposal-template';
const guide = guideByPath(PATH);

export const metadata = pageMetadata({
  title: 'Football Club Sponsorship Proposal Template & Packages',
  description: 'How to write a winning sponsorship proposal for a grassroots soccer club. Sponsorship package tiers, pricing guidelines, pitch assets, and email template.',
  path: PATH,
  image: toolOgImage(guide.tool.path),
});

const ANSWER = 'A good grassroots football sponsorship proposal puts the things a sponsor actually gets (the front of the jersey, a sleeve patch, training gear, a spot on the club website, a banner at the ground) into a few priced tiers, typically $500 to $5,000 a year. It tells the business how many local people will see their name, how you\'ll count that, and that the sponsorship is usually a tax-deductible advertising cost.';

export default function SponsorshipProposalPage() {
  return (
    <GuidePage
      path={PATH}
      badge="RUNNING A CLUB · SPONSORS"
      h1="Football club sponsorship proposal: packages, valuation & template"
      answer={ANSWER}
      answerMore={
        <p>
          Local businesses get a lot of vague requests for sponsorship. The clubs that get a yes tend to say exactly what the business gets for its money and how they&apos;ll show it worked.
        </p>
      }
      sections={[
        {
          id: 'tier-matrix',
          heading: 'Typical sponsorship tiers and prices',
          body: (
            <div className="guide-body">
              <GuideTable
                caption="Grassroots football sponsorship tiers and what they usually cost (AUD)"
                head={['Tier', 'Typical price (AUD)', 'What the sponsor gets', 'Who it suits']}
                rows={[
                  ['Platinum / Principal', '$3,500 – $6,000 / year', 'Front of 1st team jersey, website hero banner, clubhouse banner, 4 social posts', 'A big local car dealer, real estate agency or builder'],
                  ['Gold Partner', '$1,800 – $3,000 / year', 'Back of jersey or training kit sponsor, website partner listing, matchday shoutouts', 'Established local gym, accounting firm or medical centre'],
                  ['Silver Partner', '$800 – $1,500 / year', 'Jersey sleeve patch, shorts branding, digital match centre partner display', 'Local cafes and tradies (plumbers, electricians)'],
                  ['Bronze / Team Sponsor', '$400 – $750 / year', 'Sponsor of 1 junior team, logo on junior player of the match graphic', 'Small local family businesses and retail shops'],
                  ['Player Sponsor', '$150 – $300 / season', 'Player profile sponsor tag on web squad page & matchday lineup graphics', 'Player families, local sole traders and former players'],
                ]}
              />
            </div>
          ),
        },
        {
          id: 'structure',
          heading: 'What to put in the proposal',
          body: (
            <div className="guide-body">
              <ol>
                <li><strong>Your numbers, up front.</strong> How many registered players, junior families and teams you have, and how many people come to the ground each weekend.</li>
                <li><strong>What the club does locally.</strong> A couple of lines on how you keep local kids active and give them coaches and mentors.</li>
                <li><strong>Exactly what they get.</strong> Name the item, not general &ldquo;support&rdquo;. For example, &ldquo;Your logo printed on 15 senior match kits, seen by 300+ spectators across 18 rounds&rdquo;.</li>
                <li><strong>How you&apos;ll count it.</strong> Say how your club site tracks views and clicks on sponsor logos. itsfootball.club, for one, records sponsor impressions automatically.</li>
                <li><strong>A next step.</strong> Suggest a date to meet, or send a payment link so they can lock in the spot.</li>
              </ol>
            </div>
          ),
        },
        {
          id: 'proposal-script',
          heading: 'Email template you can copy',
          body: (
            <div className="guide-body">
              <div className="glass-panel" style={{ padding: '1.25rem', fontFamily: 'monospace', fontSize: '0.88rem', lineHeight: 1.6, background: 'rgba(0,0,0,0.2)' }}>
                <p><strong>Subject:</strong> Partnership opportunity: Supporting [Club Name] for the 2027 Season</p>
                <p>Hi [Business Owner Name],</p>
                <p>
                  I’m reaching out on behalf of [Club Name], based right here in [Suburb]. Over the past [X] years, our club has grown to [Number] players across [Number] junior and senior teams, welcoming over [Number] local families to our ground every Saturday morning.
                </p>
                <p>
                  We&apos;re a not-for-profit community club, and we&apos;d love [Business Name] to be one of the local businesses behind us this season.
                </p>
                <p>
                  We have one [Gold / Silver] Partner spot for next season. It includes:
                </p>
                <ul>
                  <li>Your logo on our [First Team / Junior] kits.</li>
                  <li>Your logo and link on our club website and live match centre.</li>
                  <li>A post about your business on our social media and in our member newsletter.</li>
                </ul>
                <p>
                  Could we grab a 10-minute coffee this week? I can change the package to suit what [Business Name] wants out of it.
                </p>
                <p>Warm regards,<br />[Your Name]<br />Sponsorship Officer / Committee Member<br />[Club Name] · [Phone] · [Website]</p>
              </div>
            </div>
          ),
        },
      ]}
      cta={{
        tool: SEASON_FEE_TOOL,
        text: 'See how much sponsorship takes off each player’s fee with our free season budget calculator.',
      }}
      questions={[
        {
          q: 'Is football club sponsorship tax deductible for Australian businesses?',
          a: 'Usually, yes. The Australian Taxation Office (ATO) generally treats a local business sponsoring a community sports club as a deductible advertising cost, as long as the business gets real promotion in return.',
        },
        {
          q: 'When is the best time to approach sponsors for grassroots football?',
          a: 'Between October and January, before the winter season starts. Businesses are planning their budgets then, and there\'s still time to get logos printed on jerseys before the kit order closes.',
        },
        {
          q: 'Can clubs track how many impressions a sponsor receives?',
          a: 'Yes, online at least. itsfootball.club counts how often each sponsor\'s logo is seen and clicked on the club website, match pages and tournament pages, so you can show the sponsor real numbers at renewal time.',
        },
      ]}
      sources={[SOURCES.ascGovernance, SOURCES.stripeAu]}
    />
  );
}
