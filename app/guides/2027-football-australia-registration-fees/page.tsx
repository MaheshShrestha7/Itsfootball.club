import Link from 'next/link';
import GuidePage, { GuideTable } from '@/components/GuidePage';
import { linkStyle } from '@/components/ToolLandingPage';
import { pageMetadata } from '@/lib/seo';
import { SOURCES, guideByPath } from '@/lib/guides';
import { SEASON_FEE_TOOL, toolOgImage } from '@/lib/tool-pages';

const PATH = '/guides/2027-football-australia-registration-fees';
const guide = guideByPath(PATH);

export const metadata = pageMetadata({
  title: '2027 Football Australia Registration Fees: National Development Contribution Explained',
  description: 'Football Australia is freezing base registration fees for 2027 and replacing legacy fees with a single National Football Development Contribution. Full club guide.',
  path: PATH,
  image: toolOgImage(guide.tool.path),
});

const ANSWER = 'From the 2027 season, Football Australia is freezing its national base registration fees and replacing the split base and service charges with a single, unified "National Football Development Contribution". This reform aims to simplify grassroots fee structures, enhance digital registration systems, and fund national coach education.';

export default function RegistrationFees2027Page() {
  return (
    <GuidePage
      path={PATH}
      badge="REGULATORY UPDATE · 2027 REFORMS"
      h1="2027 Football Australia registration fees: the National Football Development Contribution"
      answer={ANSWER}
      answerMore={
        <p>
          Community club committees setting their seasonal player dues need to understand what portion of player registration goes to national and state governing bodies versus what remains with the local club to fund pitch hire and equipment.
        </p>
      }
      sections={[
        {
          id: 'reform-details',
          heading: 'What is changing in the 2027 fee overhaul?',
          body: (
            <div className="guide-body">
              <p>
                Historically, player registration in PlayFootball included multiple separate national charges: a base registration levy, digital service fees, and various administrative surcharges. Football Australia&apos;s 2027 reform introduces three major changes:
              </p>
              <ul>
                <li><strong>Base fee freeze:</strong> The national component of registration fees is frozen for the 2027 season to support family affordability.</li>
                <li><strong>Single unified contribution:</strong> The base fee and service fee are merged into one transparent &ldquo;National Football Development Contribution&rdquo;.</li>
                <li><strong>Direct investment:</strong> Funds from this contribution are ring-fenced for grassroots digital infrastructure, referee training, and volunteer support.</li>
              </ul>
            </div>
          ),
        },
        {
          id: 'breakdown',
          heading: 'Anatomy of an Australian grassroots soccer registration fee',
          body: (
            <div className="guide-body">
              <p>
                When a parent or player pays $250 to $500 to register with a local club, the money is distributed across several levels of the sporting pyramid:
              </p>
              <GuideTable
                caption="Where community soccer registration fees go (typical $350 junior fee)"
                head={['Fee Component', 'Estimated Share', 'What it covers']}
                rows={[
                  ['National Football Development Contribution', '$14 – $33', 'National governance, national insurance, digital system'],
                  ['State Federation Levy (e.g. FNSW, FV)', '$40 – $95', 'State competitions, coach education, state judicial and ref panels'],
                  ['Local Association / District Levy', '$35 – $70', 'Local league administration, scheduling, district rep programs'],
                  ['Council Pitch Hire & Floodlighting', '$60 – $120', 'Winter seasonal field licenses, council maintenance, lighting tokens'],
                  ['Referees & Match Officials', '$25 – $50', 'Weekly match fees for registered center refs and linespersons'],
                  ['Player Kit & Equipment', '$40 – $75', 'Jerseys, shorts, socks, match balls, training cones, first aid'],
                  ['Club Retained Surplus', '$10 – $35', 'End-of-season trophies, volunteer training, clubhouse upkeep'],
                ]}
              />
            </div>
          ),
        },
        {
          id: 'budgeting-advice',
          heading: 'How community club treasurers should budget for 2027',
          body: (
            <div className="guide-body">
              <p>
                Because council field maintenance rates and referee costs continue to rise, clubs cannot simply absorb state or local fee adjustments. Treasurers must calculate their exact break-even cost per player before opening registration.
              </p>
              <p>
                Use our free{' '}
                <Link href={SEASON_FEE_TOOL.path} style={linkStyle}>
                  season registration fee calculator
                </Link>{' '}
                to input your club&apos;s expected team counts, council pitch hire quotes, and kit costs to determine the exact registration fee needed to avoid club deficits.
              </p>
            </div>
          ),
        },
      ]}
      cta={{
        tool: SEASON_FEE_TOOL,
        text: 'Calculate your club’s break-even registration fee, account for card processing rates, and set fair player dues with our free calculator.',
      }}
      questions={[
        {
          q: 'Will grassroots registration fees drop in 2027?',
          a: 'While Football Australia has frozen the national component of the fee, overall club registration fees also depend on state federation levies, local association fees, and local council ground hire charges, which vary by council.',
        },
        {
          q: 'What is the National Football Development Contribution?',
          a: 'It is Football Australia\'s single consolidated national fee starting in 2027 that replaces the previous multi-tiered national base registration and service fees.',
        },
        {
          q: 'Can clubs surcharge credit cards for registration payments?',
          a: 'Under the Reserve Bank of Australia retail payment reforms taking effect 1 October 2026, standalone merchant surcharging on Visa, Mastercard, and eftpos is removed. Clubs must build card processing fees into their overall fee structure or use compliant platform checkout booking fees.',
        },
      ]}
      sources={[SOURCES.faReforms2027, SOURCES.rbaSurcharge, SOURCES.stripeAu]}
    />
  );
}
