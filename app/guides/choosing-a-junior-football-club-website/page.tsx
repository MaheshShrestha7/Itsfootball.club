import Link from 'next/link';
import GuidePage, { GuideTable } from '@/components/GuidePage';
import { linkStyle } from '@/components/ToolLandingPage';
import { pageMetadata } from '@/lib/seo';
import { SOURCES, BUILDERS_COMPARED } from '@/lib/guides';
import { SEASON_FEE_TOOL } from '@/lib/tool-pages';
import { FEE_PHRASE } from '@/lib/faq';

const PATH = '/guides/choosing-a-junior-football-club-website';

export const metadata = pageMetadata({
  title: 'Choosing a Junior Football Club Website in Australia: What to Compare',
  description: 'What to compare before you pick a website for a junior soccer club in Australia: real yearly cost, card fees and the surcharge ban, kids’ names and photos, phones and handover.',
  path: PATH,
});

const ANSWER = 'Compare five things: what the club really pays in a year (subscription plus card fees, now that surcharges on eftpos, Mastercard and Visa are banned), how the site shows children’s names and photos, whether parents can use it on a phone without an app, how much volunteer time it takes each week, and whether the next committee can take it over.';

export default function ChoosingJuniorClubWebsitePage() {
  return (
    <GuidePage
      path={PATH}
      badge="JUNIOR CLUBS · AUSTRALIA"
      h1="What to compare when choosing a website for a junior football club"
      answer={ANSWER}
      answerMore={
        <p>
          Registration itself usually still runs through PlayFootball, so the club website is the public face of the club: fixtures,
          results, news, sponsors and how to join. Pick the one your volunteers will actually keep up to date.
        </p>
      }
      sections={[
        {
          id: 'checklist',
          heading: 'The checklist',
          body: (
            <div className="guide-body">
              <GuideTable
                caption="Questions to ask each platform before you sign up"
                head={['What to check', 'Ask this', 'Why it matters']}
                rows={[
                  ['Yearly cost', 'What is the price per month or year, and is there a free plan?', 'A small monthly fee adds up to a few hundred dollars a season, which is real money for a junior club.'],
                  ['Card fees', 'What does each card payment cost, and who pays it?', 'Since 1 October 2026 clubs can’t add a surcharge for eftpos, Mastercard or Visa, so the fee comes out of the club’s price unless it’s built in.'],
                  ['Kids’ names and photos', 'How are junior players named on public pages, and can photos be left off?', 'Football SA’s guidance is to get parent permission for images and avoid publishing a child’s first name and surname together.'],
                  ['Phones', 'Can parents see fixtures and scores in the browser, or do they need an app?', 'Every app download is a step some parents won’t take. A link in the team chat is easier.'],
                  ['Volunteer time', 'Do results, ladders and stats update by themselves, or does someone retype them?', 'Whatever takes a volunteer 20 minutes on Sunday night stops getting done by round 5.'],
                  ['Ads', 'Are there ads on the club’s pages, and who chooses them?', 'Parents and sponsors see whatever ads the platform runs next to the club’s name.'],
                  ['Handover', 'Can you add other admins, and change the owner when the committee changes?', 'Committees turn over at the AGM. A site that lives in one person’s account goes with them.'],
                  ['Your own domain', 'Can you use your club’s own web address, and what does it cost?', 'Some platforms charge extra for a custom domain.'],
                ]}
              />
            </div>
          ),
        },
        {
          id: 'real-cost',
          heading: 'Working out the real yearly cost',
          body: (
            <div className="guide-body">
              <p>
                Add the subscription for 12 months, any add-ons you need (custom domain, extra teams, email), and the card fees on what
                you expect to collect online. Stripe&apos;s published rate is the usual starting point for card fees in Australia, and the
                platform&apos;s own fee goes on top.
              </p>
              <p>
                Because you can&apos;t surcharge any more, the club either absorbs the card fee or builds it into the registration price.
                The{' '}
                <Link href={SEASON_FEE_TOOL.path} style={linkStyle}>season fee calculator</Link>{' '}
                does that sum for you.
              </p>
            </div>
          ),
        },
        {
          id: 'children',
          heading: 'Children’s names and photos',
          body: (
            <div className="guide-body">
              <p>
                This is the one that can cause real harm, so check it before anything else. Football SA&apos;s procedure says to get
                permission from a parent or guardian before taking images of a child, and if an image is used, to avoid naming the child,
                or at least not to use their first name and surname together. Play by the Rules gives the same advice for any sport, and
                suggests checking who has opted out before you share anything.
              </p>
              <p>
                When you trial a platform, open a junior team&apos;s public page while signed out and look at what a stranger would see:
                full names, photos, ages, and anything else that could identify the child.
              </p>
            </div>
          ),
        },
        {
          id: 'itsfootball',
          heading: 'How itsfootball.club answers these',
          body: (
            <div className="guide-body">
              <p>
                We make itsfootball.club, so check our answers the same way you&apos;d check anyone else&apos;s. The website, live
                scores, lineups and member passes cost the club nothing, and there are no ads. The only charge is {FEE_PHRASE} on card
                payments, which the person paying covers. Junior players are shown on public pages as first name and initial (for example
                &ldquo;Sam T.&rdquo;). Supporters use it in the browser, with no app to install. Clubs can add other admins and use their own
                domain, and when the committee changes we move the club to its new owner.
              </p>
              <p>
                For the same questions answered for Stack Team App, Pitchero, Spond, Playpass and ClubHelix, with each fact linked to that
                platform&apos;s own page, see{' '}
                <Link href={BUILDERS_COMPARED.path} style={linkStyle}>club website builders compared</Link>.
              </p>
            </div>
          ),
        },
      ]}
      cta={{
        tool: BUILDERS_COMPARED,
        text: 'Six platforms side by side on price, card fees, ads and features, with every fact about other platforms linked to its source.',
        button: 'See the comparison',
        more: [SEASON_FEE_TOOL],
      }}
      questions={[
        {
          q: 'Can a football club still add a card surcharge in Australia?',
          a: 'Not on eftpos, Mastercard or Visa. The Reserve Bank removed surcharging on those cards from 1 October 2026, so the card cost has to be built into the price.',
        },
        {
          q: 'Should a junior club website show players’ full names?',
          a: 'Football SA’s guidance is to avoid naming children in images, or at least to avoid using a first name and surname together, and to get a parent’s permission before taking photos.',
        },
        {
          q: 'Do we still need PlayFootball if we have a club website?',
          a: 'Usually yes. Player registration with Football Australia and your state federation goes through PlayFootball. The club website covers everything around it: fixtures, results, news, sponsors and how to join.',
        },
      ]}
      sources={[SOURCES.rbaSurcharge, SOURCES.stripeAu, SOURCES.faSaImages, SOURCES.pbtrImages, SOURCES.playFootballSa]}
    />
  );
}
