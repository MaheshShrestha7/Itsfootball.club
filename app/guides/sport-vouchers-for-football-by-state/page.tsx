import Link from 'next/link';
import GuidePage, { GuideJoin, GuideTable } from '@/components/GuidePage';
import { linkStyle } from '@/components/ToolLandingPage';
import { pageMetadata } from '@/lib/seo';
import { SOURCES, guideByPath } from '@/lib/guides';
import { toolOgImage } from '@/lib/tool-pages';

const PATH = '/guides/sport-vouchers-for-football-by-state';
const guide = guideByPath(PATH);

export const metadata = pageMetadata({
  title: 'Sport Vouchers for Football Registration, State by State (2026)',
  description: 'Which government sport vouchers cover soccer registration: NSW Active and Creative Kids, VIC Get Active Kids, QLD Play On!, WA KidSport, SA Sports Vouchers, TAS Ticket to Play and NT Sport Vouchers. Amounts, who’s eligible and how to use them.',
  path: PATH,
  image: toolOgImage(guide.tool.path),
});

const ANSWER = 'Every state, plus the Northern Territory, has a government sport voucher you can put toward a child’s football registration, worth between $100 and $300 a year. Most are for families with a Health Care Card, Pensioner Concession Card or Family Tax Benefit, and the club has to be a registered provider for that scheme. We couldn’t find one in the ACT.';

export default function SportVouchersGuidePage() {
  return (
    <GuidePage
      path={PATH}
      badge="REGISTRATION · COST OF PLAYING"
      h1="Sport vouchers for football: what you can claim in each state"
      answer={ANSWER}
      answerMore={
        <p>
          Football is one of the biggest users of these schemes. In the first season of NSW&apos;s Active Kids program, Football NSW said about half of all vouchers went on
          football. The catch is that every state runs its own scheme with its own rules and dates, and they change most years. We&apos;ve linked the official page for
          each one below, so check it before you apply.
        </p>
      }
      sections={[
        {
          id: 'by-state',
          heading: 'The schemes, state by state',
          body: (
            <div className="guide-body">
              <GuideTable
                caption="Government sport vouchers that can go toward football registration (checked 22 October 2026)"
                head={['State', 'Scheme', 'How much', 'Who can get it']}
                rows={[
                  ['NSW', 'Active and Creative Kids', 'Two $50 vouchers a year ($100)', 'Ages 4.5 to 18, families getting Family Tax Benefit A or B. One voucher from 15 January, one from 15 July'],
                  ['VIC', 'Get Active Kids Voucher Program', 'Up to $200', 'Up to 18, on a Health Care Card or Pensioner Concession Card and a Medicare card. Runs in rounds; Round 10 closed 2 April 2026'],
                  ['QLD', 'Play On! Sports Vouchers (replaced FairPlay)', 'Up to $200, one per financial year', 'Families with a Health Care Card or Pensioner Concession Card. Current round open 27 July to 18 December 2026'],
                  ['WA', 'KidSport', 'Up to $300 per financial year', 'Ages 5 to 18, on a Health Care Card or Pensioner Concession Card, joining a KidSport club. Resets 1 July'],
                  ['SA', 'Sports Vouchers', 'Two $100 vouchers a year', 'Reception to Year 9 now; ages 5 to 18 from 1 January 2027. No concession card needed'],
                  ['TAS', 'Ticket to Play', 'Two vouchers of up to $100', 'Ages 5 to 18, with a concession card, Family Tax Benefit A, or in out-of-home care'],
                  ['NT', 'Sport Voucher Scheme', 'Two $100 vouchers a year', 'School-age children in urban areas. Apply through GrantsNT'],
                  ['ACT', 'No territory-wide scheme found', '-', 'Ask your club whether it offers hardship help'],
                ]}
              />
              <p>
                A few things that catch people out: Queensland&apos;s vouchers for families with only a Medicare card ran out in the current round, Victoria&apos;s rounds
                can close early once the budget is used, and the NSW voucher can&apos;t be spent on boots, socks or a jersey bought from a shop.
              </p>
            </div>
          ),
        },
        {
          id: 'how-to-use',
          heading: 'How to use one with your club',
          body: (
            <div className="guide-body">
              <ul>
                <li><strong>Check the club is a registered provider first.</strong> Each scheme has its own provider search. If your club isn&apos;t on it, the voucher can&apos;t be used there.</li>
                <li><strong>Apply for the voucher</strong> on the state&apos;s site. Most send you a voucher number or a printable voucher by email.</li>
                <li><strong>Give it to the club when you register.</strong> On PlayFootball there&apos;s a spot for vouchers and codes before you pay. Some clubs want it emailed to the registrar instead, so read their instructions.</li>
                <li><strong>Pay the rest.</strong> If the fee is more than the voucher, you pay the difference. Any leftover value isn&apos;t refunded.</li>
              </ul>
              <p>
                If you haven&apos;t registered on PlayFootball before, our <Link href="/guides/how-to-register-on-playfootball" style={linkStyle}>PlayFootball step-by-step</Link> covers
                where the voucher code goes.
              </p>
            </div>
          ),
        },
        {
          id: 'for-clubs',
          heading: 'For clubs: making vouchers easy',
          body: (
            <div className="guide-body">
              <p>
                Families who qualify for these vouchers are often the ones most likely to skip a season because of the cost. A few small things help:
              </p>
              <ul>
                <li>Register as a provider for your state&apos;s scheme well before registrations open. It isn&apos;t automatic.</li>
                <li>Say on your registration page, in plain words, which voucher you accept and how to hand it over.</li>
                <li>Tell your registrar how vouchers get recorded, so a family isn&apos;t chased for money they&apos;ve already covered.</li>
                <li>Keep the voucher claim dates in your committee calendar. Some schemes reimburse the club after the fact, and they have their own cut-off dates.</li>
              </ul>
              <GuideJoin title="Show voucher families exactly what to do">
                A free club website gives you a registration page with your fees and a clear &ldquo;we accept vouchers&rdquo; note, plus member emails for reminders
                before a round closes.
              </GuideJoin>
            </div>
          ),
        },
      ]}
      cta={{
        tool: guide.tool,
        text: 'Pricing next season? Work out a fee that actually covers your costs, so you know what families pay before any voucher comes off.',
      }}
      questions={[
        {
          q: 'Can I use a sport voucher for football boots?',
          a: 'Usually not. In NSW, items normally bought from a shop, like boots, socks and jerseys, are excluded. The NT scheme allows uniforms and equipment bought through the same provider. Check your state’s rules.',
        },
        {
          q: 'Can I use the voucher at two clubs?',
          a: 'Where a scheme gives two vouchers a year, as in Tasmania, they can often go to different providers. Single vouchers, like Queensland’s Play On!, can only be used once.',
        },
        {
          q: 'Is there a sport voucher in the ACT?',
          a: 'We couldn’t find a territory-wide sport voucher scheme in the ACT when we checked in October 2026. Ask your club whether it has its own hardship or fee-help policy.',
        },
        {
          q: 'Our club isn’t a registered provider. Can families still use their voucher?',
          a: 'No. The voucher can only be redeemed by a provider registered with that scheme, so the club needs to sign up first.',
        },
      ]}
      sources={[
        SOURCES.nswVoucher,
        SOURCES.fnswVouchers,
        SOURCES.vicVoucher,
        SOURCES.qldVoucher,
        SOURCES.waVoucher,
        SOURCES.waVoucherAmount,
        SOURCES.saVoucher,
        SOURCES.tasVoucher,
        SOURCES.ntVoucher,
      ]}
    />
  );
}
