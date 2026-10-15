import SeasonFeeTool from '@/components/SeasonFeeTool';
import ToolLandingPage, { bodyStyle, linkStyle } from '@/components/ToolLandingPage';
import { pageMetadata } from '@/lib/seo';
import {
  CARD_PRESETS, EXAMPLE_COSTS, EXAMPLE_INCOME, EXAMPLE_PLAYERS, STRIPE_AU_SOURCE,
  cardFeeCents, grossUpCents, money, seasonBudget,
} from '@/lib/season-fees';
import { toolOgImage } from '@/lib/tool-pages';

const PATH = '/tools/season-fee-calculator';
const TITLE = 'Club Registration Fee Calculator | Season Budget & Subs Break-Even (AUD)';
const DESCRIPTION = 'Work out what to charge players this season: add pitch hire, association rego, referees, insurance and kit, take off sponsor money, and get the break-even fee per player, plus what Stripe card fees cost versus chasing cash. Free, no sign-up.';

export const metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH, image: toolOgImage(PATH) });

const STRIPE = CARD_PRESETS[0];
const INTL = CARD_PRESETS[1];
const example = seasonBudget({ costs: EXAMPLE_COSTS, players: EXAMPLE_PLAYERS, incomeCents: EXAMPLE_INCOME, bufferPercent: 5, card: STRIPE, unpaidPercent: 10, feeCents: null });
const stripeText = `${STRIPE.percent}% + ${money(STRIPE.fixedCents)}`;
const fee200 = cardFeeCents(20000, STRIPE);

const QUESTIONS = [
  { q: 'How do I work out how much to charge for club registration?', a: `Add up every cost for the season, add a buffer of 5–10%, take off sponsorship, grants and fundraising, then divide by the number of paying players. That is the break-even fee. For example, a senior team with ${money(example.costsCents, true)} of costs, a 5% buffer and ${money(EXAMPLE_INCOME, true)} from sponsors needs ${money(example.toRaiseCents, true)} from ${EXAMPLE_PLAYERS} players: ${money(example.breakEvenCents)} each.` },
  { q: 'What costs should a football club include in its season budget?', a: 'Ground and training hire (including lights), league or association team entry, per-player registration and insurance, referee fees, balls, bibs and cones, playing kit, first aid and strapping, trophies and the presentation night, coaching courses, and bank or card fees. Treasurers most often forget referees, lights, the presentation night and card processing fees.' },
  { q: 'How much does Stripe charge on a membership fee in Australia?', a: `Stripe’s published rate for Australian cards is ${stripeText} per payment, GST included (${INTL.percent}% + ${money(INTL.fixedCents)} for international cards), as listed at stripe.com/au/pricing on ${STRIPE_AU_SOURCE.checked}. On a ${money(20000, true)} fee that is ${money(fee200)}, so the club receives ${money(20000 - fee200)}.` },
  { q: 'Can the club add a card surcharge to cover Stripe fees?', a: `Not on Visa, Mastercard or eftpos in Australia: the Reserve Bank removed surcharging on those cards from 1 October 2026 (American Express is not covered). Build the card fee into the one fee everyone pays instead. To still receive ${money(example.breakEvenCents)} per player at ${stripeText}, set the fee at (${money(example.breakEvenCents)} + ${money(STRIPE.fixedCents)}) ÷ (1 − ${STRIPE.percent / 100}) = ${money(example.cardPriceCents)}.` },
  { q: 'Is it cheaper to collect fees in cash than by card?', a: `Only if everyone pays. Cash has no processing fee, but most clubs end the season with a few players who never paid. In the example, card fees cost ${money(example.card.lostCents, true)} for the season while two unpaid players out of ${EXAMPLE_PLAYERS} cost ${money(example.cash.lostCents, true)}. One non-payer usually costs more than a whole squad’s card fees.` },
  { q: 'What if the break-even fee is too high for our players?', a: 'Look for more sponsorship, a grant or a fundraiser first, since every dollar of income comes straight off the fee. You can also share ground hire with another team, buy kit that lasts two seasons, or offer instalments or a family discount and make up the difference with a slightly higher senior fee.' },
  { q: 'How big should the buffer be?', a: 'Most club treasurers keep 5–10% on top of known costs for things like an extra referee, a washed-out ground that needs rebooking or a new set of balls. Choose None if your costs are fixed quotes and you have reserves in the bank.' },
  { q: 'Is the calculator free? Is anything uploaded?', a: 'It is free with no account or ads. Your figures stay in your own browser and nothing is sent anywhere. You can print the budget or copy a summary for the committee.' },
];

const STEPS = [
  { name: 'List the season’s costs', text: 'Replace the example lines with your quotes and invoices. Mark costs charged for every player, such as association registration, as per player.' },
  { name: 'Add the squad and income', text: 'Enter how many players will pay and the money coming in from sponsors, grants and fundraising, then pick a buffer.' },
  { name: 'Read the break-even fee', text: 'The calculator shows the fee per player that covers the season, the fee to charge by card so the card fee is covered, and the fee to charge in cash if some players never pay.' },
  { name: 'Compare card and cash', text: 'Enter the fee you will charge and how many players usually do not pay, and see what the club keeps each way.' },
  { name: 'Share it', text: 'Print the budget or copy the summary for the committee meeting or the AGM.' },
];

const FEE_ROWS = [5000, 10000, 15000, 20000, 25000, 30000, 40000, 50000];
const UNPAID_ROWS = [0, 5, 10, 20];

export default function SeasonFeeCalculatorPage() {
  return (
    <ToolLandingPage
      path={PATH}
      badge="FREE TOOL · NO SIGN-UP"
      h1="Season budget & subs fee calculator"
      intro="Break-even registration fee = (season costs + buffer − sponsorship and other income) ÷ paying players. Enter your pitch hire, association rego, referees, insurance and kit below, take off what sponsors bring in, and see the fee per player that covers the season, what Stripe card fees take, and how much you keep by card versus chasing cash. Free, with no login."
      description={DESCRIPTION}
      appName="Season Budget & Subs Fee Calculator"
      alternateNames={['Club registration fee calculator', 'Football club subs calculator', 'Membership fee calculator', 'Stripe fee calculator Australia', 'Sports club break-even calculator', 'Soccer club budget calculator']}
      features={[
        'Season costs, per season or per player',
        'Sponsorship, grants and fundraising',
        'Buffer of 5, 10 or 15%',
        'Break-even fee per player',
        `Stripe Australia card fee presets (${stripeText}), editable`,
        'Fee that covers card fees, built into the price',
        'Card vs cash: what the club keeps when some players never pay',
        'Print budget and copy for the committee',
        'No sign-up, nothing uploaded',
      ]}
      tool={<SeasonFeeTool />}
      maxWidth="1180px"
      sections={[
        {
          id: 'how-it-works',
          heading: 'How the break-even fee is worked out',
          body: (
            <>
              <p style={bodyStyle}>
                Your players’ fees have to cover whatever the season costs that sponsors and fundraising don’t. So the calculator
                adds up every cost (multiplying per-player costs such as association registration by the squad), adds the buffer,
                takes off income, and divides what is left by the number of players who pay:
              </p>
              <p style={{ ...bodyStyle, marginTop: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Break-even fee = (costs + buffer − income) ÷ paying players
              </p>
              <p style={{ ...bodyStyle, marginTop: '0.75rem' }}>
                Here is the example the calculator opens with: one senior amateur team of {EXAMPLE_PLAYERS} players. The figures are
                illustrative, so use your own quotes.
              </p>
              <div className="pt-table-wrap" style={{ marginTop: '1rem' }}>
                <table className="pt-table">
                  <caption>Example season budget, {EXAMPLE_PLAYERS} players</caption>
                  <thead><tr><th scope="col">Cost</th><th scope="col">Amount</th><th scope="col">Per player</th></tr></thead>
                  <tbody>
                    {EXAMPLE_COSTS.map(c => (
                      <tr key={c.label}>
                        <th scope="row">{c.label}</th>
                        <td>{c.perPlayer ? `${money(c.cents, true)} × ${EXAMPLE_PLAYERS} = ${money(c.cents * EXAMPLE_PLAYERS, true)}` : money(c.cents, true)}</td>
                        <td>{money(c.perPlayer ? c.cents : Math.round(c.cents / EXAMPLE_PLAYERS))}</td>
                      </tr>
                    ))}
                    <tr><th scope="row">Total costs</th><td>{money(example.costsCents, true)}</td><td>{money(Math.round(example.costsCents / EXAMPLE_PLAYERS))}</td></tr>
                    <tr><th scope="row">Buffer (5%)</th><td>{money(example.bufferCents, true)}</td><td>{money(Math.round(example.bufferCents / EXAMPLE_PLAYERS))}</td></tr>
                    <tr><th scope="row">Sponsors and fundraising</th><td>−{money(EXAMPLE_INCOME, true)}</td><td>−{money(Math.round(EXAMPLE_INCOME / EXAMPLE_PLAYERS))}</td></tr>
                    <tr><th scope="row">Break-even fee</th><td>{money(example.toRaiseCents, true)} to raise</td><td><strong>{money(example.breakEvenCents)}</strong></td></tr>
                  </tbody>
                </table>
              </div>
              <p style={{ ...bodyStyle, marginTop: '1rem' }}>
                Collected by card at {stripeText}, the fee has to be {money(example.cardPriceCents)} for the club to still receive{' '}
                {money(example.breakEvenCents)}; the calculator suggests rounding up to {money(example.suggestedCents, true)}. Collected in
                cash with two players who never pay, the fee would need to be {money(example.cashPriceCents)}.
              </p>
            </>
          ),
        },
        {
          id: 'stripe-fees',
          heading: 'Stripe fees on club membership payments in Australia',
          body: (
            <>
              <p style={{ ...bodyStyle, marginBottom: '1rem' }}>
                Stripe’s published rate for Australian cards is {stripeText} per payment, GST included, and{' '}
                {INTL.percent}% + {money(INTL.fixedCents)} for international cards (source:{' '}
                <a href={STRIPE_AU_SOURCE.url} target="_blank" rel="noopener noreferrer" style={linkStyle}>stripe.com/au/pricing</a>,
                checked {STRIPE_AU_SOURCE.checked}). What that means for common registration fees:
              </p>
              <div className="pt-table-wrap">
                <table className="pt-table">
                  <caption>Stripe fees on Australian cards ({stripeText})</caption>
                  <thead><tr><th scope="col">Fee</th><th scope="col">Stripe fee</th><th scope="col">Club receives</th><th scope="col">Fee that nets the full amount</th></tr></thead>
                  <tbody>
                    {FEE_ROWS.map(cents => (
                      <tr key={cents}>
                        <th scope="row">{money(cents, true)}</th>
                        <td>{money(cardFeeCents(cents, STRIPE))}</td>
                        <td>{money(cents - cardFeeCents(cents, STRIPE))}</td>
                        <td>{money(grossUpCents(cents, STRIPE))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ ...bodyStyle, marginTop: '1rem' }}>
                To build the fee into your price, divide rather than add: set the fee at (amount you need + {money(STRIPE.fixedCents)}) ÷
                (1 − {STRIPE.percent / 100}). Adding {STRIPE.percent}% on top falls slightly short, because Stripe takes its percentage of
                the extra too. Since 1 October 2026, Australian clubs can no longer add a separate card surcharge on Visa, Mastercard or
                eftpos payments, so the card cost belongs in the one fee everyone pays.
              </p>
            </>
          ),
        },
        {
          id: 'card-vs-cash',
          heading: 'Card vs chasing cash: what the club keeps',
          body: (
            <>
              <p style={{ ...bodyStyle, marginBottom: '1rem' }}>
                Cash and bank transfers have no processing fee, but they rely on the treasurer chasing every player. Card payments
                taken at sign-up are paid before the player takes the field. For the example squad of {EXAMPLE_PLAYERS} at{' '}
                {money(example.suggestedCents, true)} each:
              </p>
              <div className="pt-table-wrap">
                <table className="pt-table">
                  <caption>{EXAMPLE_PLAYERS} players at {money(example.suggestedCents, true)}</caption>
                  <thead><tr><th scope="col">Collected</th><th scope="col">Lost</th><th scope="col">Club keeps</th></tr></thead>
                  <tbody>
                    <tr><th scope="row">By card ({stripeText})</th><td>{money(example.card.lostCents)}</td><td>{money(example.card.keptCents)}</td></tr>
                    {UNPAID_ROWS.map(u => {
                      const b = seasonBudget({ costs: EXAMPLE_COSTS, players: EXAMPLE_PLAYERS, incomeCents: EXAMPLE_INCOME, bufferPercent: 5, card: STRIPE, unpaidPercent: u, feeCents: example.suggestedCents });
                      return (
                        <tr key={u}>
                          <th scope="row">Cash, {b.unpaidPlayers === 0 ? 'everyone pays' : `${b.unpaidPlayers} never ${b.unpaidPlayers === 1 ? 'pays' : 'pay'}`}</th>
                          <td>{money(b.cash.lostCents)}</td>
                          <td>{money(b.cash.keptCents)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p style={{ ...bodyStyle, marginTop: '1rem' }}>
                A whole squad’s card fees come to less than one unpaid registration, before counting the evenings spent sending
                reminders and matching bank transfers to names.
              </p>
            </>
          ),
        },
        {
          id: 'forgotten-costs',
          heading: 'Season costs treasurers often forget',
          body: (
            <ul style={{ ...bodyStyle, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <li><strong>Referee fees.</strong> Often paid per game by the home team, so they add up over a long season.</li>
              <li><strong>Lights and extra training sessions.</strong> Council and school grounds may charge for lights or extra hours separately from the ground hire.</li>
              <li><strong>Per-player registration and insurance.</strong> Charged by the federation or association for every registered player, on top of the team’s league entry.</li>
              <li><strong>Fines and forfeits.</strong> Late team sheets, cards and forfeited games can carry association fines.</li>
              <li><strong>Card processing fees.</strong> {stripeText} on every payment unless you build them into the fee.</li>
              <li><strong>End of season.</strong> Trophies, medals and the presentation night.</li>
              <li><strong>Replacement gear.</strong> Balls go over fences and bibs go missing; budget for a top-up mid-season.</li>
            </ul>
          ),
        },
      ]}
      howToName="How to set your club’s registration fee"
      steps={STEPS}
      questions={QUESTIONS}
    />
  );
}
