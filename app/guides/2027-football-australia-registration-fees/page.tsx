import Link from 'next/link';
import GuidePage, { GuideTable } from '@/components/GuidePage';
import { linkStyle } from '@/components/ToolLandingPage';
import { pageMetadata } from '@/lib/seo';
import { SOURCES, guideByPath } from '@/lib/guides';
import { SEASON_FEE_TOOL, toolOgImage } from '@/lib/tool-pages';

const PATH = '/guides/2027-football-australia-registration-fees';
const guide = guideByPath(PATH);

export const metadata = pageMetadata({
  title: '2027 Football Australia Registration Fees Explained',
  description: 'Football Australia is freezing base registration fees for 2027 and replacing legacy fees with one National Football Development Contribution. Club guide.',
  path: PATH,
  image: toolOgImage(guide.tool.path),
});

const ANSWER = 'From the 2027 season, Football Australia is freezing its national base registration fee and rolling the separate base and service charges into one "National Football Development Contribution". The aim is a simpler fee for grassroots players, with the money going to the digital registration system and national coach education.';

export default function RegistrationFees2027Page() {
  return (
    <GuidePage
      path={PATH}
      badge="REGISTRATION · 2027 CHANGES"
      h1="2027 Football Australia registration fees: the National Football Development Contribution"
      answer={ANSWER}
      answerMore={
        <p>
          If you&apos;re on a club committee setting next season&apos;s fees, it helps to know how much of each registration goes to Football Australia and your state federation, and how much the club keeps for pitch hire and gear.
        </p>
      }
      sections={[
        {
          id: 'reform-details',
          heading: 'What changes in 2027',
          body: (
            <div className="guide-body">
              <p>
                Until now, a PlayFootball registration has carried several separate national charges: a base registration levy, digital service fees and some administrative surcharges. For 2027, Football Australia is changing that in three ways:
              </p>
              <ul>
                <li>The national part of the fee is frozen for the 2027 season, to keep costs down for families.</li>
                <li>The base fee and service fee become one charge, the &ldquo;National Football Development Contribution&rdquo;, so you can see what the national part is.</li>
                <li>Money from the contribution is ring-fenced for grassroots digital systems, referee training and volunteer support.</li>
              </ul>
            </div>
          ),
        },
        {
          id: 'breakdown',
          heading: 'Where an Australian grassroots soccer registration fee goes',
          body: (
            <div className="guide-body">
              <p>
                A family might pay anywhere from $250 to $500 to register with a local club. That money is split between several levels of the game. Here&apos;s a rough split for a $350 junior fee:
              </p>
              <GuideTable
                caption="Where community soccer registration fees go (typical $350 junior fee)"
                head={['Part of the fee', 'Rough share', 'What it pays for']}
                rows={[
                  ['National Football Development Contribution', '$14 – $33', 'National governance, national insurance, digital system'],
                  ['State Federation Levy (e.g. FNSW, FV)', '$40 – $95', 'State competitions, coach education, state judicial and ref panels'],
                  ['Local Association / District Levy', '$35 – $70', 'Local league administration, scheduling, district rep programs'],
                  ['Council Pitch Hire & Floodlighting', '$60 – $120', 'Winter seasonal field licenses, council maintenance, lighting tokens'],
                  ['Referees & Match Officials', '$25 – $50', 'Weekly match fees for registered centre refs and assistant referees'],
                  ['Player Kit & Equipment', '$40 – $75', 'Jerseys, shorts, socks, match balls, training cones, first aid'],
                  ['Club Retained Surplus', '$10 – $35', 'End-of-season trophies, volunteer training, clubhouse upkeep'],
                ]}
              />
            </div>
          ),
        },
        {
          id: 'budgeting-advice',
          heading: 'Budgeting for 2027 as a club treasurer',
          body: (
            <div className="guide-body">
              <p>
                Council ground charges and referee costs keep going up, so most clubs can&apos;t soak up a rise in state or local fees. Work out what each player needs to pay for the club to break even before registrations open.
              </p>
              <p>
                Use our free{' '}
                <Link href={SEASON_FEE_TOOL.path} style={linkStyle}>
                  season registration fee calculator
                </Link>{' '}
                to put in your expected number of teams, the council&apos;s pitch hire quote and kit costs. It tells you the fee you need so the club doesn&apos;t finish the season in the red.
              </p>
            </div>
          ),
        },
      ]}
      cta={{
        tool: SEASON_FEE_TOOL,
        text: 'Work out your club’s break-even registration fee, including card processing costs, with our free calculator.',
      }}
      questions={[
        {
          q: 'Will grassroots registration fees drop in 2027?',
          a: 'Not necessarily. Football Australia has frozen the national part of the fee, but what you pay your club also depends on the state federation levy, your local association fee and council ground hire, and those vary.',
        },
        {
          q: 'What is the National Football Development Contribution?',
          a: 'It\'s the one national fee Football Australia charges from 2027. It replaces the separate national base registration fee and service fee.',
        },
        {
          q: 'Can clubs surcharge credit cards for registration payments?',
          a: 'No. Under the Reserve Bank of Australia payment changes that started on 1 October 2026, merchants can no longer add a surcharge on Visa, Mastercard or eftpos. Clubs need to build card costs into the fee itself, or use a platform that charges a compliant booking fee at checkout.',
        },
      ]}
      sources={[SOURCES.faReforms2027, SOURCES.rbaSurcharge, SOURCES.stripeAu]}
    />
  );
}
