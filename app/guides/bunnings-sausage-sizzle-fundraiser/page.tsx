import Link from 'next/link';
import GuidePage, { GuideJoin, GuideTable } from '@/components/GuidePage';
import { linkStyle } from '@/components/ToolLandingPage';
import { pageMetadata } from '@/lib/seo';
import { SOURCES, guideByPath } from '@/lib/guides';
import { toolOgImage } from '@/lib/tool-pages';

const PATH = '/guides/bunnings-sausage-sizzle-fundraiser';
const guide = guideByPath(PATH);

export const metadata = pageMetadata({
  title: 'How to Book and Run a Bunnings Sausage Sizzle for Your Club',
  description: 'A football club’s guide to the Bunnings sausage sizzle: how to ask your local store, food safety rules in NSW and Victoria, a volunteer roster, the shopping list and the onion question.',
  path: PATH,
  image: toolOgImage(guide.tool.path),
});

const ANSWER = 'To get a Bunnings sausage sizzle, write to your nearest store on your club’s letterhead, addressed to the Activities Organiser, and ask for a date. Once you have one, check your state’s food rules (in Victoria you register it through Streatrader; in NSW a sizzle that’s cooked and eaten straight away doesn’t need to be notified), then roster your volunteers and do the shopping.';

const ROSTER = [
  ['Cooks', '2', 'On the barbecue the whole shift. Tongs for raw, a separate pair for cooked'],
  ['Servers', '2', 'Bread, sausage, onion, sauce, and handing it over'],
  ['Cash and card', '1', 'Takes payment and keeps the float. Nobody else touches money'],
  ['Runner', '1', 'Restocks, empties bins, swaps people for breaks'],
];

export default function SausageSizzleGuidePage() {
  return (
    <GuidePage
      path={PATH}
      badge="FUNDRAISING · CLUB EVENTS"
      h1="The Bunnings sausage sizzle: how to book one and run it well"
      answer={ANSWER}
      answerMore={
        <p>
          It&apos;s probably the most Australian fundraiser there is, and for good reason: the crowd is already there and everyone knows what they&apos;re getting. The
          work is in the organising. Each store runs its own community calendar, so the details below are what tends to apply, and your store&apos;s Activities
          Organiser has the final word.
        </p>
      }
      sections={[
        {
          id: 'booking',
          heading: 'Asking your local store',
          body: (
            <div className="guide-body">
              <p>
                Bunnings asks for community requests in writing, on the organisation&apos;s letterhead, sent to the nearest store and addressed to the Activities
                Organiser. In practice that means a short letter or email that says:
              </p>
              <ul>
                <li>who you are: the club&apos;s full incorporated name, how many players, and the suburb</li>
                <li>what the money is for: &ldquo;new goals for our MiniRoos&rdquo; lands better than &ldquo;general funds&rdquo;</li>
                <li>two or three dates that would suit, ideally weekends</li>
                <li>a contact name and mobile number</li>
              </ul>
              <p>
                Popular stores can be booked out a long way ahead, so ask early and be flexible on the date. If you don&apos;t hear back in a week or two, drop into the store and ask
                for the Activities Organiser by name. Ask them at the same time what the store supplies on the day and what you need to bring.
              </p>
            </div>
          ),
        },
        {
          id: 'food-rules',
          heading: 'Food safety rules',
          body: (
            <div className="guide-body">
              <GuideTable
                caption="Community sausage sizzles: what the rules say (checked 22 October 2026)"
                head={['State', 'Do you need to register?', 'Notes']}
                rows={[
                  ['NSW', 'No, if the food is cooked thoroughly and eaten straight away', 'No Food Safety Supervisor needed for a charity or community fundraiser. Normal food safety still applies'],
                  ['VIC', 'Yes, through Streatrader', 'Register as a temporary food premises, Class 4, then lodge a Statement of Trade for the date and place. Wait for council approval before you trade'],
                  ['Other states', 'Check with your council', 'Most treat a simple sizzle as low risk, but the paperwork differs'],
                ]}
              />
              <p>
                Wherever you are, the basics are the same: keep raw sausages cold until they go on the barbecue, cook them right through, wash hands (bring a water
                container with a tap, soap and paper towel if there&apos;s no sink nearby), and keep raw and cooked food apart. The NSW Food Authority has a free Food
                Handler Basics course if anyone on the roster wants a refresher.
              </p>
            </div>
          ),
        },
        {
          id: 'roster',
          heading: 'The roster',
          body: (
            <div className="guide-body">
              <p>A sizzle runs smoothly with about six people on at once. Two-hour shifts are long enough to be useful and short enough that parents will say yes.</p>
              <GuideTable caption="People needed per shift" head={['Job', 'People', 'What they do']} rows={ROSTER} />
              <GuideJoin title="Fill the roster without a group chat">
                Post the sizzle as an event on a free club website so families can RSVP, and record the takings and costs on the club&apos;s finance page afterwards.
              </GuideJoin>
            </div>
          ),
        },
        {
          id: 'shopping',
          heading: 'The shopping list',
          body: (
            <div className="guide-body">
              <p>
                There&apos;s no magic number. The best guide is a club that&apos;s done the same store before, so ask around your association. Otherwise, start from
                the number of sausages you think you&apos;ll sell and work everything else out from that:
              </p>
              <ul>
                <li><strong>Sausages:</strong> your estimate, plus a few spare for volunteers.</li>
                <li><strong>Bread:</strong> one slice per sausage. Count the slices in a loaf before you buy.</li>
                <li><strong>Onions:</strong> sliced the night before and kept cold, saves a lot of crying in the car park.</li>
                <li><strong>Sauce:</strong> tomato and barbecue at a minimum, mustard if you&apos;re feeling fancy.</li>
                <li><strong>Drinks:</strong> cans or bottles of water, sold unopened, keep it simple.</li>
                <li><strong>Gear:</strong> tongs, gloves, napkins, bin bags, a gas bottle if you&apos;re bringing a barbecue, a cooler with ice, a cash float in small notes and coins, and a card reader.</li>
              </ul>
              <p>
                Some butchers and supermarkets will give a community discount or take back unopened stock, and it costs nothing to ask. Check the store&apos;s gift card
                and product donations too: Bunnings also donates to community raffles.
              </p>
            </div>
          ),
        },
        {
          id: 'onion',
          heading: 'Onion on top or underneath?',
          body: (
            <div className="guide-body">
              <p>
                Underneath. In 2018 Bunnings suggested that sizzle groups put the onion under the sausage, because onion falling off the top was a slipping hazard on
                the store&apos;s floors. It caused an uproar at the time, but it&apos;s a sensible idea, and it&apos;s worth asking your store whether it expects it.
              </p>
              <p>
                For the other ways clubs raise money, see our <Link href="/guides/grants-for-football-clubs-australia" style={linkStyle}>grants guide</Link>.
              </p>
            </div>
          ),
        },
      ]}
      cta={{
        tool: guide.tool,
        text: 'Know what you’re fundraising for. Work out how much each player’s season costs, and how much a sizzle takes off next year’s fee.',
      }}
      questions={[
        {
          q: 'Do we need a food handling certificate to run a sausage sizzle?',
          a: 'In NSW, not for a charity or community sizzle where food is cooked and eaten straight away, though volunteers need practical food safety skills. Other states have their own rules, so check with your council.',
        },
        {
          q: 'How do we book a Bunnings sausage sizzle?',
          a: 'Write to your nearest store on your club’s letterhead, addressed to the Activities Organiser, with a few dates that suit and a contact number.',
        },
        {
          q: 'Should the onion go on top or under the sausage?',
          a: 'Under. Bunnings suggested it in 2018 so onion doesn’t fall on the floor and become a slipping hazard.',
        },
        {
          q: 'Do we need to register the sizzle in Victoria?',
          a: 'Yes. Register through Streatrader as a temporary food premises (Class 4) and lodge a Statement of Trade for the date and location, then wait for your council to approve it.',
        },
      ]}
      sources={[SOURCES.bunningsCommunity, SOURCES.nswFoodCharity, SOURCES.vicStreatrader, SOURCES.bunningsOnion]}
    />
  );
}
