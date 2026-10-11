import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage, { type LegalSection } from '@/components/LegalPage';
import { fitDescription, pageMetadata } from '@/lib/seo';
import { LEGAL, LEGAL_IDENTITY } from '@/lib/legal';

export const metadata: Metadata = pageMetadata({
  title: 'Privacy Policy | itsfootball.club',
  description: fitDescription(
    'What itsfootball.club collects, why, who it is shared with and how to access, correct or delete your information.',
    'Clubs control their members’ records; we run the platform.'
  ),
  path: '/privacy',
});

const mail = <a href={`mailto:${LEGAL.email}`} style={{ color: 'var(--club-primary)', fontWeight: 600 }}>{LEGAL.email}</a>;

const sections: LegalSection[] = [
  {
    id: 'who-we-are',
    heading: 'Who we are',
    body: (
      <>
        <p>{LEGAL_IDENTITY} (&ldquo;we&rdquo;, &ldquo;us&rdquo;). You can contact us about privacy at {mail}{LEGAL.address ? ` or by post at ${LEGAL.address}` : ''}.</p>
        <p>This policy explains how we handle personal information under the Australian Privacy Principles in the <em>Privacy Act 1988</em> (Cth) and, for people in the United Kingdom, the UK GDPR and Data Protection Act 2018.</p>
      </>
    ),
  },
  {
    id: 'clubs-and-us',
    heading: 'Your club and us',
    body: (
      <>
        <p>itsfootball.club is a platform that football clubs use to run their own websites and admin. That means two different organisations look after different parts of your information:</p>
        <ul>
          <li><strong>Your club</strong> decides what it records about its members, players and supporters (your squad profile, membership, payments to the club, attendance, stats) and who in the club can see it. For those records the club is responsible for your information (in UK GDPR terms, the &ldquo;controller&rdquo;) and we store and process it on the club&rsquo;s behalf.</li>
          <li><strong>We</strong> are responsible for your itsfootball.club account (your email and sign-in), the platform&rsquo;s own visit statistics, security logs and the emails we send about the platform.</li>
        </ul>
        <p>For questions about what a club holds about you, contact the club first (every club page has a contact form). If you can&rsquo;t reach them, email us and we&rsquo;ll help.</p>
      </>
    ),
  },
  {
    id: 'what-we-collect',
    heading: 'What we collect',
    body: (
      <>
        <p><strong>Account details.</strong> Your email address and, if you set one, a password (stored only as a secure hash). Most people sign in with a one-time link sent by email.</p>
        <p><strong>Member and player profiles</strong>, entered by you or by your club: name, email, phone number, photo, date of birth, nationality, playing position and shirt number, height, weight, preferred foot, emergency contact, membership type and status, membership application notes and any committee role.</p>
        <p><strong>Club activity.</strong> Availability replies, lineups and matchday squads, match statistics, ClubScore points and the activity behind them, check-ins at matches and events (including the time of each scan of your member pass), event registrations and tickets, messages you send to your club and messages sent through a club&rsquo;s contact form or sponsor application form.</p>
        <p><strong>Payments.</strong> When you pay a club, we record your name, email, what you paid for, the amount and the payment reference. Card details are entered directly with Stripe and never reach our servers. If a club accepts bank transfers, we store the receipt you upload.</p>
        <p><strong>Visit statistics.</strong> When you view a club&rsquo;s pages we record the page, the referring site and a random visitor ID kept in your browser, so clubs can see how many people visit. When you click a sponsor&rsquo;s link we also record your device type and country (worked out from your connection, not your precise location). We don&rsquo;t use third-party analytics or advertising trackers.</p>
        <p><strong>Notifications and email.</strong> If you turn on notifications, your browser&rsquo;s push subscription. For every email we send, a record of the recipient, type and subject, and any unsubscribe choices you make.</p>
        <p><strong>Technical information.</strong> Your IP address and browser details are processed by our hosting provider to deliver the site, keep it secure and limit abuse.</p>
      </>
    ),
  },
  {
    id: 'how-we-use-it',
    heading: 'How we use it',
    body: (
      <ul>
        <li>To run the platform: sign you in, show club pages, run the match centre, passes, check-ins, tournaments, shop and payments.</li>
        <li>To let your club manage its membership, squad, events, finances and communication with you.</li>
        <li>To send the emails and notifications you or your club have asked for (sign-in links, receipts, membership renewals, match, event and news updates). Club update emails always include an unsubscribe link.</li>
        <li>To keep the service secure, prevent fraud and spam, and fix problems.</li>
        <li>To meet legal obligations, such as keeping payment records.</li>
      </ul>
    ),
  },
  {
    id: 'what-is-public',
    heading: 'What appears publicly',
    body: (
      <>
        <p>Club websites are public. A club can choose to show its squad (names, photos, positions, nationality and statistics), its committee, match lineups, events and news, and those pages may be found by search engines and AI assistants.</p>
        <p>Your date of birth, email, phone number, emergency contact, payments and messages are never shown on public pages; only the people your club gives admin access can see them. If you don&rsquo;t want to appear on a club&rsquo;s public pages, ask the club to remove you.</p>
      </>
    ),
  },
  {
    id: 'sharing',
    heading: 'Who we share it with',
    body: (
      <>
        <p>We don&rsquo;t sell personal information and we don&rsquo;t show ads. We share it only with:</p>
        <ul>
          <li><strong>Your club&rsquo;s admins</strong>, for the club records described above.</li>
          <li><strong>Supabase</strong>: our database and sign-in provider.</li>
          <li><strong>Cloudflare</strong>: website hosting, security and storage of uploaded files such as photos and receipts.</li>
          <li><strong>Stripe</strong>: card payments, paid into the club&rsquo;s own Stripe account. Stripe handles your card under its own <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--club-primary)' }}>privacy policy</a>.</li>
          <li><strong>Resend</strong>: delivery of our emails.</li>
          <li><strong>Browser push services</strong> (run by Apple, Google or Mozilla, depending on your browser) to deliver notifications you turned on.</li>
          <li><strong>Google</strong>, when a club page shows its ground on an embedded Google Map, and <strong>YouTube</strong>, when a club article includes a video (we use YouTube&rsquo;s privacy-enhanced mode). These load from Google&rsquo;s servers, which receive your IP address.</li>
          <li>Authorities, where the law requires it.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'overseas',
    heading: 'Where your information is stored',
    body: (
      <>
        <p>Our database, which holds accounts and all club and member records, is hosted in <strong>Sydney, Australia</strong>.</p>
        <p>Some providers handle information outside Australia as part of their service: Cloudflare delivers the site through its global network and stores uploaded files, and Stripe, Resend, browser push services and Google may process information in other countries, including the United States. Where information leaves the UK, we rely on our providers&rsquo; standard data protection terms. We choose providers that protect information to a standard comparable to Australian and UK law.</p>
      </>
    ),
  },
  {
    id: 'cookies',
    heading: 'Cookies and browser storage',
    body: (
      <>
        <p>We use a small number of cookies and browser storage items, all needed for the site to work or to remember your choices:</p>
        <ul>
          <li>Your sign-in session, so you stay signed in.</li>
          <li>Your light or dark theme choice.</li>
          <li>The random visitor ID used for visit statistics (described above).</li>
          <li>Display preferences, such as how the squad list is shown.</li>
          <li>An offline copy of pages, if you install the site as an app on your phone.</li>
        </ul>
        <p>We don&rsquo;t use advertising or cross-site tracking cookies. You can clear these at any time in your browser settings.</p>
      </>
    ),
  },
  {
    id: 'retention',
    heading: 'How long we keep it',
    body: (
      <ul>
        <li>Your account: until you delete it.</li>
        <li>Club records: for as long as the club keeps them. When you delete your account, your club&rsquo;s records about you (such as your squad entry, payments and attendance) stay with the club but are no longer linked to your account; ask the club if you want them removed.</li>
        <li>Payment records: as long as the law requires (in Australia, generally five years for financial records).</li>
        <li>Visit statistics and security logs: only as long as they&rsquo;re useful for running the service.</li>
      </ul>
    ),
  },
  {
    id: 'your-rights',
    heading: 'Your choices and rights',
    body: (
      <>
        <p>You can ask to see the personal information held about you, to correct it, or to delete it. You can:</p>
        <ul>
          <li>Delete your itsfootball.club account at any time from <Link href="/my-clubs" style={{ color: 'var(--club-primary)' }}>My Clubs</Link>.</li>
          <li>Unsubscribe from club emails using the link in any of them, and turn off notifications in your browser.</li>
          <li>Ask your club to update, correct or remove your member details and the other records it keeps (club admins manage these).</li>
          <li>Email us at {mail} for anything else. We&rsquo;ll reply within 30 days.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'children',
    heading: 'Children and junior players',
    body: (
      <p>Many clubs have junior players. A club that records a child&rsquo;s details, photo or statistics is responsible for having the consent of the child&rsquo;s parent or guardian. Children under 13 shouldn&rsquo;t create their own account; a parent, guardian or the club should manage their details. If you believe a child&rsquo;s information is on the platform without that consent, contact the club or email us and we&rsquo;ll act on it.</p>
    ),
  },
  {
    id: 'security',
    heading: 'Security',
    body: (
      <p>All traffic to the site is encrypted, each club&rsquo;s records are only available to that club&rsquo;s admins, and card payments are handled by Stripe. No system is perfectly secure, but if a data breach is likely to cause you serious harm we&rsquo;ll notify you and the regulator as the law requires.</p>
    ),
  },
  {
    id: 'changes',
    heading: 'Changes to this policy',
    body: <p>We&rsquo;ll update this page when our practices change and show the date at the top. For significant changes we&rsquo;ll also tell club owners by email.</p>,
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      summary={<p>In short: your club controls what it records about its members; we run the platform it&rsquo;s built on. We collect only what the platform needs, we don&rsquo;t sell your information or show ads, and you can delete your account at any time.</p>}
      sections={sections}
      other={{ label: 'Terms of Service', href: '/terms' }}
    />
  );
}
