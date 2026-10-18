import Link from 'next/link';
import GuidePage, { GuideTable } from '@/components/GuidePage';
import { linkStyle } from '@/components/ToolLandingPage';
import { pageMetadata } from '@/lib/seo';
import { SOURCES, guideByPath } from '@/lib/guides';
import { CARD_PRESETS, EXAMPLE_COSTS, EXAMPLE_INCOME, EXAMPLE_PLAYERS, money, seasonBudget } from '@/lib/season-fees';
import { SEASON_FEE_TOOL, TOURNAMENT_TOOL, toolOgImage } from '@/lib/tool-pages';

const PATH = '/guides/how-much-to-charge-for-club-registration';
const guide = guideByPath(PATH);

export const metadata = pageMetadata({
  title: 'How Much Should a Soccer Club Charge for Registration? (Australia)',
  description: 'Work out a break-even registration fee: season costs plus a buffer, less sponsorship, divided by paying players. With Stripe card fees and the RBA card surcharge ban from 1 October 2026.',
  path: PATH,
  image: toolOgImage(guide.tool.path),
});

const STRIPE = CARD_PRESETS[0];
// The same example season the calculator opens with: one senior team, 5% buffer, 10% of cash fees never paid
const ex = seasonBudget({ costs: EXAMPLE_COSTS, players: EXAMPLE_PLAYERS, incomeCents: EXAMPLE_INCOME, bufferPercent: 5, card: STRIPE, unpaidPercent: 10, feeCents: null });
const stripeText = `${STRIPE.percent}% + ${money(STRIPE.fixedCents)}`;

const ANSWER = `To calculate club registration fees: sum all season costs, add a 5–10% contingency buffer, subtract confirmed sponsorship, and divide by paying players. For an 18-player squad with ${money(ex.costsCents, true)} in costs and ${money(EXAMPLE_INCOME, true)} sponsorship, break-even is ${money(ex.breakEvenCents)} cash, or ${money(ex.cardPriceCents)} including Stripe card processing (${stripeText}).`;

export default function RegistrationFeeGuidePage() {
  return (
    <GuidePage
      path={PATH}
      badge="CLUB MONEY · AUSTRALIA"
      h1="How much should a soccer club charge for registration?"
      answer={ANSWER}
      answerMore={<p>From 1 October 2026, Australian clubs can&apos;t add a separate surcharge for eftpos, Mastercard or Visa payments, so the card fee belongs in the one fee everyone pays.</p>}
      sections={[
        {
          id: 'method',
          heading: 'The break-even fee in four steps',
          body: (
            <div className="guide-body">
              <ol className="vs-steps" style={{ maxWidth: 'none', margin: '0 0 1rem' }}>
                <li><span><strong>List every cost for the season.</strong> Ground and lights hire, league or association entry, per-player registration and insurance, referees, kit, balls and bibs, first aid, trophies and the presentation night.</span></li>
                <li><span><strong>Add a buffer of 5–10%</strong> for the costs nobody budgets for: a price rise, a replacement goal net, an extra referee.</span></li>
                <li><span><strong>Take off money that is already coming in:</strong> sponsorship, grants, canteen and fundraising.</span></li>
                <li><span><strong>Divide by the players who will actually pay</strong>, not the number on the team sheet.</span></li>
              </ol>
              <p><strong>Break-even fee = (costs + buffer − income) ÷ paying players.</strong></p>
            </div>
          ),
        },
        {
          id: 'example',
          heading: 'A worked example',
          body: (
            <div className="guide-body">
              <GuideTable
                caption={`An example senior team of ${EXAMPLE_PLAYERS} players (illustrative costs, not quotes)`}
                head={['Cost', 'For the season']}
                rows={[
                  ...EXAMPLE_COSTS.map(c => [c.label, c.perPlayer ? `${money(c.cents * EXAMPLE_PLAYERS, true)} (${money(c.cents, true)} × ${EXAMPLE_PLAYERS})` : money(c.cents, true)]),
                  [<strong key="t">Total costs</strong>, <strong key="v">{money(ex.costsCents, true)}</strong>],
                  ['5% buffer', money(ex.bufferCents)],
                  ['Sponsorship and grants', `− ${money(EXAMPLE_INCOME, true)}`],
                  [<strong key="t">To raise from players</strong>, <strong key="v">{money(ex.toRaiseCents)}</strong>],
                ]}
              />
              <p>
                {money(ex.toRaiseCents)} ÷ {EXAMPLE_PLAYERS} players = <strong>{money(ex.breakEvenCents)} each</strong> if
                everyone pays and nothing is deducted. The next two sections are why the fee you set is usually a bit higher.
              </p>
            </div>
          ),
        },
        {
          id: 'cards',
          heading: 'Card fees, and why you can’t surcharge',
          body: (
            <div className="guide-body">
              <p>
                Stripe&apos;s published rate for Australian cards is {stripeText} per payment, GST included. To still receive{' '}
                {money(ex.breakEvenCents)} after the fee, charge ({money(ex.breakEvenCents)} + {money(STRIPE.fixedCents)}) ÷
                (1 − {STRIPE.percent / 100}) = <strong>{money(ex.cardPriceCents)}</strong>.
              </p>
              <p>
                Since 1 October 2026, the Reserve Bank of Australia has removed surcharging on eftpos, Mastercard and Visa, and
                American Express, UnionPay and PayPal have said they will stop surcharging too. The RBA&apos;s guidance is that
                businesses can reflect those costs in their overall pricing instead, which for a club means one fee that already
                covers the card cost.
              </p>
            </div>
          ),
        },
        {
          id: 'cash',
          heading: 'Cash, transfers and the players who never pay',
          body: (
            <div className="guide-body">
              <p>
                Cash and bank transfers have no fee, but they rely on someone chasing payments. If 10% of the {EXAMPLE_PLAYERS}{' '}
                players never pay ({ex.unpaidPlayers} players), the others need to pay{' '}
                <strong>{money(ex.cashPriceCents)}</strong> each for the club to break even, which is more than the card price of{' '}
                {money(ex.cardPriceCents)}. The{' '}
                <Link href={SEASON_FEE_TOOL.path} style={linkStyle}>season fee calculator</Link> shows both side by side for
                your own costs, and suggests a fee rounded up to the next $5 ({money(ex.suggestedCents, true)} in this example).
              </p>
            </div>
          ),
        },
      ]}
      cta={{
        tool: SEASON_FEE_TOOL,
        text: 'Enter your own costs, players and sponsorship and get the break-even fee, the card price and the cash price. Free, no sign-up.',
        more: [TOURNAMENT_TOOL],
      }}
      questions={[
        { q: 'How do I calculate a club registration fee?', a: `Add up the season’s costs, add a 5–10% buffer, take off sponsorship and grants, and divide by the number of players who will pay. For the example team: ${money(ex.toRaiseCents)} ÷ ${EXAMPLE_PLAYERS} = ${money(ex.breakEvenCents)} each.` },
        { q: 'Can a sports club add a card surcharge in Australia?', a: 'Not on eftpos, Mastercard or Visa from 1 October 2026, when the Reserve Bank removed surcharging on those networks. American Express, UnionPay and PayPal have said they will stop surcharging too. Build the card cost into the fee instead.' },
        { q: 'How much does Stripe charge on a registration fee in Australia?', a: `${stripeText} per payment for Australian cards, GST included, from Stripe’s published Australian pricing. On a ${money(ex.cardPriceCents)} fee that leaves the club at least ${money(ex.breakEvenCents)}.` },
        { q: 'Should the fee be the same for every player?', a: 'It doesn’t have to be. You can set a fee per team or age group, or offer a family or early-payment discount. Add what the discounts cost to the season’s costs so the club still breaks even.' },
      ]}
      sources={[SOURCES.rbaSurcharge, SOURCES.stripeAu]}
    />
  );
}
