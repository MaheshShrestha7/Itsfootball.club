import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage, { type LegalSection } from '@/components/LegalPage';
import { fitDescription, pageMetadata } from '@/lib/seo';
import { LEGAL, LEGAL_IDENTITY } from '@/lib/legal';
import { FEE_PHRASE } from '@/lib/faq';

export const metadata: Metadata = pageMetadata({
  title: 'Terms of Service | itsfootball.club',
  description: fitDescription(
    'The terms for using itsfootball.club: accounts, club responsibilities, the booking fee on card payments, acceptable use and your rights.',
    'Free for clubs, every feature included.'
  ),
  path: '/terms',
});

const mail = <a href={`mailto:${LEGAL.email}`} style={{ color: 'var(--club-primary)', fontWeight: 600 }}>{LEGAL.email}</a>;
const privacy = <Link href="/privacy" style={{ color: 'var(--club-primary)' }}>Privacy Policy</Link>;

const sections: LegalSection[] = [
  {
    id: 'about',
    heading: 'About these terms',
    body: (
      <>
        <p>{LEGAL_IDENTITY} (&ldquo;we&rdquo;, &ldquo;us&rdquo;). These terms apply when you use itsfootball.club or any club website running on it, including club sites on a club&rsquo;s own domain.</p>
        <p>By creating an account or a club, or by paying a club through the platform, you agree to these terms and to our {privacy}. If you don&rsquo;t agree, please don&rsquo;t use the service.</p>
      </>
    ),
  },
  {
    id: 'accounts',
    heading: 'Your account',
    body: (
      <ul>
        <li>Give accurate details and keep them up to date.</li>
        <li>Your account is for you alone. Keep access to your email secure, since sign-in links are sent there, and tell us if you think someone else has used your account.</li>
        <li>Children under 13 shouldn&rsquo;t create their own account; a parent, guardian or the club should manage their details.</li>
        <li>You can delete your account at any time from <Link href="/my-clubs" style={{ color: 'var(--club-primary)' }}>My Clubs</Link>.</li>
      </ul>
    ),
  },
  {
    id: 'clubs',
    heading: 'Running a club',
    body: (
      <>
        <p>If you create or administer a club, you confirm you&rsquo;re authorised to act for that club, and the club is responsible for:</p>
        <ul>
          <li>Everything it publishes or records on the platform: its website, news, photos, squad, results and messages.</li>
          <li>Its members&rsquo; personal information. The club decides what to collect and must have a proper reason and, where needed, consent to collect and publish it. That includes consent from a parent or guardian before recording or publishing a child&rsquo;s details or photo.</li>
          <li>Answering its members&rsquo; requests to see, correct or remove the club&rsquo;s records about them.</li>
          <li>Who it gives admin access to. Admins can see members&rsquo; private details, so only give access to people the club trusts.</li>
          <li>Any custom domain it connects, including keeping the domain registered.</li>
        </ul>
        <p>The club owner can transfer the club to another person or close it by contacting us.</p>
      </>
    ),
  },
  {
    id: 'pricing',
    heading: 'Price and booking fee',
    body: (
      <>
        <p>itsfootball.club is free for clubs. There&rsquo;s no subscription and no paid tier, and every feature is included.</p>
        <p>When someone pays a club by card through the platform (for a membership, a shop order, an event ticket or a sponsorship), {FEE_PHRASE} is added on top of the club&rsquo;s price and shown before they pay. The person paying pays the booking fee; the club&rsquo;s price is unchanged.</p>
        <p>We may change the booking fee in future. Any change applies only to payments made after it&rsquo;s shown at checkout and on this page.</p>
      </>
    ),
  },
  {
    id: 'payments',
    heading: 'Payments to clubs',
    body: (
      <>
        <ul>
          <li>Card payments are processed by Stripe and paid into the club&rsquo;s own Stripe account. Clubs that take card payments must accept Stripe&rsquo;s terms, and Stripe deducts its standard card fees from the club&rsquo;s payout.</li>
          <li>When you buy from a club (a membership, merchandise, tickets or a sponsorship), the sale is between you and the club. We provide the checkout but aren&rsquo;t the seller.</li>
          <li>The club handles orders, collection, refunds and disputes, and is responsible for its obligations to buyers under consumer law. If a club refunds a card payment in full, the booking fee is refunded with it.</li>
          <li>Payments by bank transfer go directly to the club; we only record them for the club.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'acceptable-use',
    heading: 'Acceptable use',
    body: (
      <>
        <p>Don&rsquo;t use itsfootball.club to:</p>
        <ul>
          <li>Post anything unlawful, abusive, threatening, discriminatory, sexually explicit or misleading.</li>
          <li>Upload photos or personal information about other people without the right to do so.</li>
          <li>Pretend to be a club or person you don&rsquo;t represent.</li>
          <li>Send spam, collect other users&rsquo; information, or use members&rsquo; details for anything other than running the club.</li>
          <li>Interfere with the service: probe its security, overload it, scrape it at scale or get around access controls.</li>
        </ul>
        <p>To report content that breaks these rules, email {mail}.</p>
      </>
    ),
  },
  {
    id: 'content',
    heading: 'Your content',
    body: (
      <>
        <p>You and your club keep ownership of what you upload. You give us permission to store, display, copy and distribute it as needed to run the service, for example showing a club&rsquo;s public pages to visitors, search engines and AI assistants, and sending club emails. This permission ends when the content is deleted, except for copies we&rsquo;re required to keep or that remain briefly in backups.</p>
        <p>The itsfootball.club name, logo and software belong to us.</p>
      </>
    ),
  },
  {
    id: 'service',
    heading: 'The service',
    body: (
      <>
        <p>We work to keep itsfootball.club running and secure, but we provide it as it is and can&rsquo;t promise it will always be available or free of errors. We may add, change or remove features.</p>
        <p>Club pages, including live scores, fixtures and results, are entered by each club. We don&rsquo;t check them and aren&rsquo;t responsible for their accuracy.</p>
      </>
    ),
  },
  {
    id: 'liability',
    heading: 'Your consumer rights and our liability',
    body: (
      <>
        <p>Nothing in these terms excludes rights you have under the Australian Consumer Law or other laws that can&rsquo;t be excluded. If you&rsquo;re a consumer in the UK, your statutory rights are not affected.</p>
        <p>Otherwise, to the extent the law allows, we aren&rsquo;t liable for indirect or consequential loss, for loss of data or profits, or for the acts of clubs, members or other users. Where our liability for a failure to meet a consumer guarantee can be limited, it&rsquo;s limited to supplying the service again or paying the cost of having it supplied again.</p>
      </>
    ),
  },
  {
    id: 'suspension',
    heading: 'Suspension and closure',
    body: (
      <p>We may suspend or remove content, accounts or clubs that break these terms or the law, or that put other users or the service at risk. Where it&rsquo;s reasonable we&rsquo;ll tell you first and give you a chance to fix the problem. You can stop using the service at any time.</p>
    ),
  },
  {
    id: 'changes',
    heading: 'Changes to these terms',
    body: <p>We may update these terms. We&rsquo;ll show the date of the latest version at the top of this page and tell club owners by email about significant changes. Continuing to use the service after a change means you accept the updated terms.</p>,
  },
  {
    id: 'law',
    heading: 'Governing law and contact',
    body: (
      <p>These terms are governed by the laws of {LEGAL.jurisdiction}, and the courts there have jurisdiction, without affecting any right you have to bring a claim where you live. Questions about these terms: {mail}.</p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      summary={<p>In short: itsfootball.club is free for clubs. Clubs are responsible for what they publish and for their members&rsquo; information. When you pay a club by card, a booking fee is added and the sale is between you and the club.</p>}
      sections={sections}
      other={{ label: 'Privacy Policy', href: '/privacy' }}
    />
  );
}
