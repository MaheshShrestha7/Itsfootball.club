import Link from 'next/link';
import GuidePage, { GuideJoin, GuideTable } from '@/components/GuidePage';
import { linkStyle } from '@/components/ToolLandingPage';
import { pageMetadata } from '@/lib/seo';
import { SOURCES, guideByPath } from '@/lib/guides';
import { toolOgImage } from '@/lib/tool-pages';

const PATH = '/guides/football-club-agm-agenda-template';
const guide = guideByPath(PATH);

export const metadata = pageMetadata({
  title: 'Football Club AGM Agenda Template and Rules (NSW, VIC, QLD)',
  description: 'Running your football club’s AGM: when it has to be held, how much notice members need, an agenda you can copy, and what to lodge with Fair Trading or Consumer Affairs afterwards.',
  path: PATH,
  image: toolOgImage(guide.tool.path),
});

const ANSWER = 'An incorporated football club has to hold its AGM within 6 months of the end of its financial year in NSW and Queensland, and within 5 months in Victoria. Give members at least 14 days’ notice under the model rules (21 days in NSW and Victoria if there’s a special resolution), present the financial statements and elect the committee. In NSW and Victoria the annual paperwork is due with the regulator within a month of the meeting.';

const AGENDA = [
  'Welcome, attendance and apologies. Confirm there’s a quorum',
  'Confirm the minutes of the last AGM (and any special general meeting since)',
  'President’s report on the season',
  'Treasurer’s report and the financial statements for the year',
  'Auditor’s or reviewer’s report, if your club needs one',
  'Appoint the auditor or reviewer for next year (required under Queensland’s model rules)',
  'Election of office bearers and committee members',
  'Special resolutions, if any were in the notice (rule changes, name change)',
  'General business that members were told about in the notice',
  'Close, and the date of the first committee meeting',
];

export default function AgmGuidePage() {
  return (
    <GuidePage
      path={PATH}
      badge="CLUB COMMITTEE · GOVERNANCE"
      h1="Running your football club AGM: deadlines, notice and an agenda you can copy"
      answer={ANSWER}
      answerMore={
        <p>
          Work backwards from your financial year end. If it&apos;s 30 September, say, a NSW club has until 31 March, but a Victorian club only has until 28 February.
          The rules below are the defaults from each state&apos;s model constitution. Your own constitution can set longer notice or a different quorum, and if it does, follow it.
        </p>
      }
      sections={[
        {
          id: 'deadlines',
          heading: 'When it has to happen, and how much notice to give',
          body: (
            <div className="guide-body">
              <GuideTable
                caption="AGM rules for incorporated associations (model rules, checked 22 October 2026)"
                head={['State', 'Hold the AGM', 'Notice to members', 'Lodge afterwards']}
                rows={[
                  ['NSW', 'Within 6 months of the financial year end', '14 days; 21 days for a special resolution', 'Form A12 and the financial statements within 1 month of the AGM, and no later than 7 months after year end'],
                  ['VIC', 'Within 5 months of the financial year end', 'Set by your rules; 21 days for a special resolution', 'Annual statement through myCAV within 1 month of the AGM'],
                  ['QLD', 'Within 6 months of the financial year end', '14 days, including any special resolution', 'Check the Office of Fair Trading for your association’s requirements'],
                ]}
              />
              <p>
                Brand-new clubs get a bit longer: in NSW and Victoria the first AGM is due within 18 months of incorporation. If you&apos;re in another state or territory,
                your regulator&apos;s website will have the equivalent rules, and they&apos;re broadly similar.
              </p>
            </div>
          ),
        },
        {
          id: 'agenda',
          heading: 'An AGM agenda you can copy',
          body: (
            <div className="guide-body">
              <p>This running order covers everything the model rules require. Copy it into your notice and fill in the blanks.</p>
              <div className="glass-panel" style={{ padding: '1rem 1.25rem' }}>
                <ol style={{ margin: 0, paddingLeft: '1.2rem', lineHeight: 1.75, color: 'var(--text-secondary)' }}>
                  {AGENDA.map(item => <li key={item}>{item}</li>)}
                </ol>
              </div>
              <p>
                One thing the rules are strict about: nothing can be decided without a quorum, so check your constitution for the number and count heads before you
                start. If you think it&apos;ll be close, ask a few parents to come along.
              </p>
            </div>
          ),
        },
        {
          id: 'notice',
          heading: 'What to put in the notice',
          body: (
            <div className="guide-body">
              <p>The notice should say plainly that it&apos;s the annual general meeting, and include:</p>
              <ul>
                <li>The date, time and place. Online or hybrid is fine in NSW as long as members can properly take part.</li>
                <li>The business, which is basically the agenda above.</li>
                <li>The full wording of any special resolution, with a note that it&apos;s being proposed as a special resolution. In Victoria it needs 75% of votes to pass.</li>
                <li>How nominations for committee positions work, and the deadline if your constitution has one.</li>
                <li>Whether proxy votes are allowed, and how. Your constitution decides this.</li>
              </ul>
              <GuideJoin title="Send the AGM notice to every member at once">
                On a free club site you can add the AGM as a club event, email the notice to every member from one place, and show the new committee on the
                club&apos;s About page once the votes are in.
              </GuideJoin>
            </div>
          ),
        },
        {
          id: 'statements',
          heading: 'The treasurer’s part',
          body: (
            <div className="guide-body">
              <p>
                The main legal purpose of the AGM is to present the year&apos;s financial statements to members. In NSW, a smaller club (Tier 2: revenue up to $500,000 and
                current assets up to $1,000,000) needs to show:
              </p>
              <ul>
                <li>income and expenditure for the year, by category</li>
                <li>a balance sheet of what the club owns and owes</li>
                <li>any mortgages or other securities over club property</li>
              </ul>
              <p>
                A copy of the statements goes into the AGM minutes. In Victoria, two committee members sign a certificate that goes with them. For the committee
                handover, our <Link href="/guides/football-club-committee-roles-and-responsibilities" style={linkStyle}>committee roles guide</Link> covers who does what next season.
              </p>
            </div>
          ),
        },
      ]}
      cta={{
        tool: guide.tool,
        text: 'Treasurer setting next season’s fees at the AGM? Work out the fee that covers pitch hire, kit and PlayFootball costs before the meeting.',
      }}
      questions={[
        {
          q: 'Can a football club hold its AGM online?',
          a: 'In NSW, yes, even if your constitution doesn’t mention it, as long as the technology gives members a reasonable chance to take part. Check your state’s rules and your constitution elsewhere.',
        },
        {
          q: 'What happens if we miss the AGM deadline?',
          a: 'In Victoria the Registrar can grant a 2-month extension in exceptional circumstances, if you apply. NSW has an extension form (Form A11). Apply before the deadline passes, not after.',
        },
        {
          q: 'Who signs the AGM minutes?',
          a: 'In NSW the chair of that meeting or of the next meeting signs them. They can be kept on paper or electronically.',
        },
        {
          q: 'How many people need to turn up?',
          a: 'Whatever your constitution sets as the quorum. Without it, no business can be decided, so check the number before the night.',
        },
      ]}
      sources={[SOURCES.nswMeetings, SOURCES.nswTier2, SOURCES.vicMeetings, SOURCES.vicAnnualStatement, SOURCES.qldMeetings]}
    />
  );
}
