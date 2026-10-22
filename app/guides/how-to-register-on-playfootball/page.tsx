import Link from 'next/link';
import GuidePage, { GuideJoin, GuideTable } from '@/components/GuidePage';
import { linkStyle } from '@/components/ToolLandingPage';
import { pageMetadata } from '@/lib/seo';
import { SOURCES, guideByPath } from '@/lib/guides';
import { toolOgImage } from '@/lib/tool-pages';

const PATH = '/guides/how-to-register-on-playfootball';
const guide = guideByPath(PATH);

export const metadata = pageMetadata({
  title: 'How to Register on PlayFootball: Steps for Players and Parents',
  description: 'Registering for a football club on PlayFootball, step by step: your Football Account, claiming last year’s record, what to have ready, why it says pending, and how refunds and transfers work.',
  path: PATH,
  image: toolOgImage(guide.tool.path),
});

const ANSWER = 'Sign in to your Football Account at playfootball.com.au (or create one), search for your club, pick what you’re registering as, claim your old record if you’ve played before, add a photo, accept the terms and pay. After that it shows as pending until it’s approved, which is normal.';

export default function PlayFootballGuidePage() {
  return (
    <GuidePage
      path={PATH}
      badge="REGISTRATION · PLAYERS AND PARENTS"
      h1="How to register on PlayFootball (and what to do when it gets stuck)"
      answer={ANSWER}
      answerMore={
        <p>
          Every registered player, coach and referee in Australia goes through PlayFootball, Football Australia&apos;s national system. The screens look a little
          different from state to state, but the steps are the same. Most of the trouble people run into comes from one thing: making a second account.
        </p>
      }
      sections={[
        {
          id: 'before',
          heading: 'Have these ready before you start',
          body: (
            <div className="guide-body">
              <ul>
                <li><strong>The email you used last season.</strong> Your playing history is linked to it, so a new email usually means a new, empty record.</li>
                <li><strong>A photo of the player.</strong> It&apos;s required. A clear head-and-shoulders shot from your phone is fine.</li>
                <li><strong>ID for the player.</strong> The club has to sight it, so check whether they want it uploaded or shown in person.</li>
                <li><strong>A credit or debit card</strong>, unless your club has told you to pay them another way.</li>
                <li><strong>Any voucher or code your club gave you.</strong> If you&apos;re using a government sport voucher, follow your club&apos;s instructions (see our <Link href="/guides/sport-vouchers-for-football-by-state" style={linkStyle}>sport vouchers guide</Link>).</li>
              </ul>
              <p>
                Registering a child? Create the Football Account in <strong>your</strong> name, then register them as someone else. That way you can manage all your
                kids from one login.
              </p>
            </div>
          ),
        },
        {
          id: 'steps',
          heading: 'Registering, step by step',
          body: (
            <div className="guide-body">
              <GuideTable
                caption="Registering for a club on PlayFootball"
                head={['Step', 'What you do', 'Watch out for']}
                rows={[
                  ['1. Sign in', 'Go to playfootball.com.au and sign in to your Football Account, or choose to create one', 'Use last season’s email if you’ve played before'],
                  ['2. Find the club', 'Search by club name or postcode, then start the registration', 'Check it’s the right club and season before you go on'],
                  ['3. Who and what', 'Choose yourself or someone else, then the role: player, coach, volunteer or referee', 'Coaches and team managers usually register too, not just players'],
                  ['4. Claim or create', 'If you’ve played before, claim your existing record. If you’re new, enter your details', 'If the record that comes up isn’t yours, stop and contact support'],
                  ['5. Terms', 'Open the first document, then keep clicking Next until you’ve been through them all', 'There are several, so don’t stop after the first'],
                  ['6. Details', 'Add the photo, confirm contact details and enter any voucher or club code', 'Codes go in before payment, not after'],
                  ['7. Pay', 'Pay the fees shown. The national and state fees (which include insurance) are paid at registration', 'Some clubs take their part separately; their instructions win'],
                  ['8. Wait', 'Your registration now shows as pending', 'This is normal. Approval isn’t instant'],
                ]}
              />
            </div>
          ),
        },
        {
          id: 'second-account',
          heading: 'Played before? Don’t make a new account',
          body: (
            <div className="guide-body">
              <p>
                This is the big one. If you can&apos;t get into your old account and start fresh instead, the player can lose their playing history, and the club or
                federation then has to merge the records by hand. Football SA&apos;s guide is blunt about it: if your old number doesn&apos;t show up under your name,
                don&apos;t continue.
              </p>
              <p>
                If you&apos;ve forgotten which email you used or can&apos;t get into it, contact PlayFootball support (below) before you register. It takes a few minutes
                now and saves a lot of back and forth later.
              </p>
            </div>
          ),
        },
        {
          id: 'pending',
          heading: 'Why does it say pending?',
          body: (
            <div className="guide-body">
              <p>
                Once you&apos;ve paid, the registration waits for approval. Depending on your state that&apos;s the club registrar, the federation, or both. The club
                has to sight the player&apos;s ID, so a missing document or an unclear photo can hold things up.
              </p>
              <p>
                In the busy weeks before the season starts it can take a few days. If it&apos;s still pending close to the first game, message your club&apos;s registrar
                rather than registering again. A second registration just creates a second payment to untangle.
              </p>
              <GuideJoin title="Club registrar? Give parents one page to start from">
                Put your PlayFootball link, age groups, fees and the date registrations close on a free club website, so parents aren&apos;t digging through old
                Facebook posts in January.
              </GuideJoin>
            </div>
          ),
        },
        {
          id: 'refunds',
          heading: 'Refunds and changing clubs',
          body: (
            <div className="guide-body">
              <p>
                Football Australia&apos;s refund policy (from 1 November 2025) splits it up: Football Australia decides on its national fee, and the club, association
                and state federation each decide on their own fees under their own policies. If you paid through PlayFootball, you ask for a refund through PlayFootball
                with any evidence, and it gets passed to the right people.
              </p>
              <ul>
                <li>A refund is most likely if the registration was declined or cancelled before the player did any training or matches.</li>
                <li>Once a player has trained or played, a refund is unlikely. Injury on its own usually isn&apos;t enough.</li>
                <li>If a player moves clubs mid-season and pays the national fee again, that second fee can be refunded.</li>
                <li>Refunds can have an admin fee taken off, and platform service fees aren&apos;t refunded.</li>
              </ul>
            </div>
          ),
        },
        {
          id: 'help',
          heading: 'Who to call',
          body: (
            <div className="guide-body">
              <p>
                For account and login problems, PlayFootball support is on <strong>02 8880 7983</strong> or <strong>support@playfootball.com.au</strong>, and
                there&apos;s a help page at playfootball.com.au/help. For anything about fees, teams or age groups, ask your club first. They know their own setup
                far better than the national helpdesk does.
              </p>
            </div>
          ),
        },
      ]}
      cta={{
        tool: guide.tool,
        text: 'Setting your club’s fee for next season? Work out the price that covers PlayFootball fees, pitch hire and kit, before registrations open.',
      }}
      questions={[
        {
          q: 'Can I register more than one child on the same account?',
          a: 'Yes. Create the Football Account in the parent’s name and register each child as someone else. They each get their own record.',
        },
        {
          q: 'I registered with the wrong email. What now?',
          a: 'Don’t register again. Contact PlayFootball support on 02 8880 7983 or support@playfootball.com.au and ask them to link or merge the records.',
        },
        {
          q: 'Do coaches and volunteers need to register on PlayFootball?',
          a: 'Usually, yes. Coach, volunteer and referee are registration options alongside player, and most clubs ask their coaches and team managers to register.',
        },
        {
          q: 'How long does approval take?',
          a: 'It varies by state and by how busy the club registrar is. A few days in the pre-season rush is common. Check with your club if it’s still pending near the first game.',
        },
      ]}
      sources={[SOURCES.playFootballSa, SOURCES.playFootballClub, SOURCES.faRefunds]}
    />
  );
}
