import Link from 'next/link';
import type { CSSProperties } from 'react';
import {
  ArrowRight, Check, Crown, Shield, ClipboardList, Goal, Heart, Handshake, LifeBuoy, Sparkles,
  type LucideIcon,
} from 'lucide-react';
import PlatformNavbar from '@/components/PlatformNavbar';
import Footer from '@/components/Footer';
import JsonLd from '@/components/JsonLd';

// Platform help (not club matters). Written as plain text in answers so the FAQ schema keeps it; linked when shown.
const CONTACT_EMAIL = 'contact@itsfootball.club';
const withEmailLink = (text: string) => text.split(CONTACT_EMAIL).flatMap((part, i) =>
  i === 0 ? [part] : [<a key={i} href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--club-primary)', fontWeight: 600 }}>{CONTACT_EMAIL}</a>, part]);

type Section = {
  id: string;
  audience: string;
  Icon: LucideIcon;
  color: string;
  pitch: string;
  cta?: { label: string; href: string };
  items: { q: string; a: string }[];
};

// Static on purpose: nothing here is edited by admins. Move to a table if that changes.
const FAQ: Section[] = [
  {
    id: 'pricing',
    audience: 'Is it really free?',
    Icon: Sparkles,
    color: 'var(--c-green)',
    pitch: 'Yes. Your club never pays a penny: no subscription, no premium tier, every feature included from day one.',
    cta: { label: 'Create your club free', href: '/create-club' },
    items: [
      { q: 'How much does itsfootball.club cost?', a: 'Nothing for your club. Your website, live match centre, member passes, lineups, finance, sponsor reports and everything else are included from the moment you sign up. No trial that runs out, no premium tier, no locked features, no invoice at the end of the season.' },
      { q: 'Why is it free?', a: 'Because grassroots clubs run on volunteers and tight budgets, and a monthly bill is exactly what keeps most of them stuck on group chats and spreadsheets. We believe the Sunday league side deserves the same matchday as the big clubs, so every club, however small, gets the full kit from day one.' },
      { q: 'So what\'s the catch?', a: 'No catch, just one small detail we\'d rather tell you upfront. When someone pays your club by card through itsfootball.club, for a membership, a sponsorship or an order from the club shop, a small booking fee is added at checkout, like the one you see when you buy a match ticket online. It\'s shown clearly before anyone pays, and your club\'s price never changes: the money goes straight into your club\'s own Stripe account, less Stripe\'s standard card fee. We don\'t show ads to your players, we don\'t sell your data, and we never take a cut of what your club charges.' },
      { q: 'How does itsfootball.club make money?', a: 'Through that small booking fee on card payments, and nothing else. It keeps us on the same side as your club: we only earn when your club is thriving online, collecting its subs, selling its merch and signing up sponsors, never by charging you to use the platform. And if your club refunds a card payment in full, the booking fee is refunded with it.' },
      { q: 'Do I need a card to create a club?', a: 'No. You only need an email address. Create your club in a few minutes and start using everything straight away, with no limits.' },
      { q: 'Are some features kept behind a paid plan?', a: 'No. Match Center, lineups, tournaments, the QR pass and scanner, finance, sponsors, the club shop, news, branding, custom domain and analytics are all available to every club from day one.' },
      { q: 'Do players or supporters pay anything?', a: 'Following the live match centre, getting a member pass, checking your stats and replying to availability are always free. The only payments are the ones your club chooses to set, like a membership fee or merch from the club shop. If you pay by card, you\'ll see a small booking fee before you confirm; it\'s what keeps the whole platform free for your club.' },
    ],
  },
  {
    id: 'club-representatives',
    audience: 'Club representatives',
    Icon: Crown,
    color: 'var(--c-amber)',
    pitch: 'Give your club a professional home online in minutes, without paying a web designer.',
    cta: { label: 'Claim your club', href: '/create-club' },
    items: [
      { q: 'How do I put my club on itsfootball.club?', a: 'Go to Create Club (/create-club), sign up free with your email and a password, and fill in your club details. You become the club Owner with full admin access, and your club site is live right away. Need a hand getting set up? Email contact@itsfootball.club.' },
      { q: 'Can the club site use our own colours, logo and domain?', a: 'Yes. In your club admin, open Branding to set your colours, logo and a custom domain, and Hero Slider to choose the images on your club home page. It looks like your club, not like us.' },
      { q: 'How do supporters find our club?', a: 'Every active club is listed in the Clubs Directory (/clubs) and gets its own public page at itsfootball.club/your-club-name, ready to share on social media and in group chats.' },
      { q: 'Where do I find the clubs I manage or belong to?', a: 'Sign in and open My Clubs (/my-clubs). Every club you own, administer or are a member of is listed there.' },
    ],
  },
  {
    id: 'club-officials',
    audience: 'Club officials & admins',
    Icon: Shield,
    color: 'var(--c-blue)',
    pitch: 'Replace the spreadsheets, group chats and paper forms with one place to run the club.',
    cta: { label: 'Set up your admin area', href: '/create-club' },
    items: [
      { q: 'What can a club admin do?', a: 'Everything in one place: matchday tools (Match Center, availability, lineups, QR scanner), planning (matches, tournaments, events, seasons), people (squad, members, committee, ClubScore), money (finance, sponsors, club shop) and the club site (branding, news, analytics, enquiries).' },
      { q: 'How do I share the workload with other volunteers?', a: 'Open Squad in the admin area, edit the person and add the "Club Admin" role. They get the full admin area too, so the work doesn\'t all land on one person.' },
      { q: 'How do I track club money and sponsors?', a: 'Use Finance to log income and expenses, and Sponsors to review sponsor applications and manage your existing sponsors, so the treasurer always has an up-to-date picture.' },
      { q: 'Can we sell club merch?', a: 'Yes. Open Club Shop in the admin area and add your products with photos, sizes and a price. A Shop link appears on your club site as soon as something is on sale. Buyers pay by card, Apple Pay or Google Pay and collect their order from the club; every order is recorded in Finance, and you mark it handed out when it\'s picked up.' },
      { q: 'How do I post club news?', a: 'Open Content in the admin area. Published articles appear on your club home page for members and supporters.' },
      { q: 'Where do messages from the public contact form go?', a: 'To Inquiries in the admin area, so nothing gets lost in someone\'s personal inbox. Messages from signed-in members arrive in their member messages.' },
    ],
  },
  {
    id: 'managers-coaches',
    audience: 'Managers, coaches & committee',
    Icon: ClipboardList,
    color: 'var(--c-purple)',
    pitch: 'Know who can play before matchday, pick your squad and run the game live from your phone.',
    cta: { label: 'Set up your team', href: '/create-club' },
    items: [
      { q: 'How do I see which players are available?', a: 'Players mark themselves available or unavailable for each match. No more chasing replies in group chats: admins see every answer under Availability and pick the matchday squad under Lineup.' },
      { q: 'How do live match updates work?', a: 'During a match, an admin runs the Match Center to record the score, goals, cards and substitutions. Supporters following the match page see every update live, wherever they are.' },
      { q: 'How do tournaments work?', a: 'Create a tournament under Tournaments with a group stage, a knockout bracket (up to a round of 32), or both. Standings and the bracket update automatically as results come in, and each tournament gets its own public page.' },
      { q: 'How do check-ins work at matches and events?', a: 'Members show the QR code on their virtual pass and an admin scans it with the Scanner in the admin area. Anyone can check a pass on the club\'s Verify page.' },
      { q: 'Does the Manager, Coach or Executive Committee role give me admin access?', a: 'Not on its own. Those roles show your position in the club. For matchday tools such as lineups or the Match Center, ask your club Owner to add the "Club Admin" role to your squad profile.' },
    ],
  },
  {
    id: 'players',
    audience: 'Players',
    Icon: Goal,
    color: 'var(--c-green)',
    pitch: 'Your stats, your pass and your availability in one place. Free, and no password to remember.',
    cta: { label: 'Find your club', href: '/clubs' },
    items: [
      { q: 'How do I join my club?', a: 'Open your club\'s page, go to Member, and sign up or apply for a membership tier. The club committee approves applications, and your pass activates once you are approved. Joining the platform costs you nothing.' },
      { q: 'Where can I see my stats?', a: 'In the Stats tab of your member area. Your goals, assists and other stats count towards the club leaderboard and awards such as Player of the Tournament.' },
      { q: 'How do I tell the coach whether I can play?', a: 'Open your club\'s Availability page (itsfootball.club/your-club/availability) and answer for each upcoming match. It takes seconds.' },
      { q: 'How do I sign in?', a: 'On your club\'s Member page, enter your email and you\'ll get a one-time sign-in link. There is no password to remember.' },
      { q: 'My account isn\'t linked to my squad profile. What do I do?', a: 'Sign in with the same email your club has on file and your profile links automatically. If it still doesn\'t, ask a club admin to check the email on your squad record.' },
    ],
  },
  {
    id: 'supporters',
    audience: 'Members & supporters',
    Icon: Heart,
    color: 'var(--c-red)',
    pitch: 'Follow every match live, carry your member pass on your phone and stay close to your club.',
    cta: { label: 'Find your club', href: '/clubs' },
    items: [
      { q: 'How do I follow a live match?', a: 'Open your club\'s page and pick the match from the fixtures. The match page updates live with goals, cards and substitutions as the game is played.' },
      { q: 'What is the virtual member pass?', a: 'A QR code pass in the Pass tab of your member area. Show it on your phone to be checked in at matches and club events. Nothing to print, nothing to lose.' },
      { q: 'How do I pay my membership?', a: 'If your chosen tier has a fee, you pay it during sign-up by card, Apple Pay or Google Pay. Payment is handled securely by Stripe and goes straight to the club, with a small booking fee shown before you pay. For a refund, contact your club. If the payment page itself isn\'t working, email contact@itsfootball.club.' },
      { q: 'How do I buy club merch?', a: 'Open the Shop on your club\'s site (itsfootball.club/your-club/shop), pick your items and sizes, and pay by card, Apple Pay or Google Pay. You don\'t need to be a member. Orders are collection only: pick yours up from the club. For questions about an order or a refund, contact your club.' },
      { q: 'How do I contact my club?', a: 'Signed-in members can use the Messages tab in their member area. Anyone else can use the contact form on the club\'s page.' },
    ],
  },
  {
    id: 'sponsors',
    audience: 'Sponsors',
    Icon: Handshake,
    color: 'var(--c-sky)',
    pitch: 'Back a local club and put your brand in front of its players, members and supporters.',
    cta: { label: 'Find a club to back', href: '/clubs' },
    items: [
      { q: 'How do I sponsor a club?', a: 'Open the club\'s Sponsor page (itsfootball.club/club-name/sponsor) and send an application. It goes straight to the club\'s admins, who review it and get back to you.' },
      { q: 'Does it cost anything to apply?', a: 'No. Applying is free. Any sponsorship deal is agreed directly between you and the club.' },
      { q: 'Where will my brand appear?', a: 'Clubs manage their sponsors from the admin area and feature them on their club site, so your support is seen by the people who follow the club.' },
    ],
  },
  {
    id: 'account',
    audience: 'Account & help',
    Icon: LifeBuoy,
    color: 'var(--text-secondary)',
    pitch: 'Quick fixes for sign-in and privacy questions, and how to reach us.',
    items: [
      { q: 'I didn\'t get my sign-in email.', a: 'Check your spam or promotions folder, make sure the address is spelled correctly, and wait a minute before requesting another link. Still nothing? Email contact@itsfootball.club from the address you\'re signing in with.' },
      { q: 'Who can see my information?', a: 'Your club\'s admins can see your membership details. Public club pages show only what the club chooses to publish, such as the squad list and match stats. You can delete your account from My Clubs (/my-clubs). For any other privacy request, email contact@itsfootball.club.' },
      { q: 'Where do I get more help?', a: 'For anything about your club, such as memberships, fixtures or refunds, contact the club through the form on its page or ask a club admin. For help with itsfootball.club itself, such as sign-in problems, something not working or setting up a club, email contact@itsfootball.club.' },
    ],
  },
];

const FREE_POINTS = ['Free to sign up', 'Every feature included', 'No card needed', 'No subscription, ever'];

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.flatMap(s => s.items.map(i => ({
    '@type': 'Question',
    name: i.q,
    acceptedAnswer: { '@type': 'Answer', text: i.a },
  }))),
};

const ctaStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.45rem' };

export default function FaqPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <JsonLd data={faqSchema} />
      <PlatformNavbar />

      <main className="container" style={{ padding: '3.5rem 1rem', flex: 1, maxWidth: '960px' }}>
        {/* Hero */}
        <header style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div className="badge badge-primary" style={{ marginBottom: '0.75rem' }}>FREE FOR EVERY CLUB · EVERY FEATURE</div>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 2.8rem)', fontWeight: 900, lineHeight: 1.1 }}>
            Questions? Here&apos;s why clubs sign up.
          </h1>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0.9rem auto 0', fontSize: '1.05rem', lineHeight: 1.6 }}>
            Club site, matchday tools, member passes, tournaments, finance, sponsors and a club shop. Everything your club needs,
            free to sign up and free to use.
          </p>
          <ul style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.5rem 1.25rem', listStyle: 'none', padding: 0, margin: '1.25rem 0 0' }}>
            {FREE_POINTS.map(p => (
              <li key={p} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.92rem' }}>
                <Check size={16} color="var(--c-green)" /> {p}
              </li>
            ))}
          </ul>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.75rem', marginTop: '1.75rem' }}>
            <Link href="/create-club" className="btn btn-primary btn-lg" style={ctaStyle}>
              Create your club free <ArrowRight size={18} />
            </Link>
            <Link href="/clubs" className="btn btn-secondary btn-lg">Find your club</Link>
          </div>
        </header>

        {/* Role picker */}
        <nav aria-label="FAQ sections" style={{ marginBottom: '3rem' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            I am a…
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            {FAQ.map(({ id, audience, Icon, color, pitch }) => (
              <a key={id} href={`#${id}`} className="glass-panel glass-panel-interactive" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', textDecoration: 'none', borderTop: `3px solid ${color}` }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  <Icon size={18} color={color} /> {audience}
                </span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.45 }}>{pitch}</span>
              </a>
            ))}
          </div>
        </nav>

        {/* Sections */}
        {FAQ.map(({ id, audience, Icon, color, pitch, cta, items }) => (
          <section key={id} id={id} aria-labelledby={`${id}-h`} style={{ marginBottom: '3rem', scrollMarginTop: '90px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '0.75rem 1.5rem', marginBottom: '1rem' }}>
              <div style={{ flex: '1 1 320px' }}>
                <h2 id={`${id}-h`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.45rem', fontWeight: 800 }}>
                  <Icon size={22} color={color} /> {audience}
                </h2>
                <p style={{ color: 'var(--text-secondary)', marginTop: '0.3rem' }}>{pitch}</p>
              </div>
              {cta && (
                <Link href={cta.href} className="btn btn-outline btn-sm" style={ctaStyle}>
                  {cta.label} <ArrowRight size={14} />
                </Link>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {items.map((i, n) => (
                <details key={i.q} open={id === 'pricing' && n === 0} className="glass-panel" style={{ padding: '1rem 1.25rem', borderLeft: `3px solid ${color}` }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--text-primary)' }}>{i.q}</summary>
                  <p style={{ color: 'var(--text-secondary)', marginTop: '0.75rem', lineHeight: 1.65 }}>{withEmailLink(i.a)}</p>
                </details>
              ))}
            </div>
          </section>
        ))}

        {/* Closing CTA */}
        <section className="glass-panel" style={{ padding: '2.25rem 1.5rem', textAlign: 'center', borderTop: '3px solid var(--c-green)' }}>
          <h2 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 900 }}>Ready when you are. It&apos;s free.</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '520px', margin: '0.6rem auto 0', lineHeight: 1.6 }}>
            Sign up in minutes, no card needed, and unlock every feature from day one.
            Still have a question? Ask your club through its page, or email us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--club-primary)', fontWeight: 600 }}>{CONTACT_EMAIL}</a>.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.75rem', marginTop: '1.5rem' }}>
            <Link href="/create-club" className="btn btn-primary btn-lg" style={ctaStyle}>
              Create your club free <ArrowRight size={18} />
            </Link>
            <Link href="/clubs" className="btn btn-secondary btn-lg">Browse clubs</Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
