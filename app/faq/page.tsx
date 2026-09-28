import Link from 'next/link';
import PlatformNavbar from '@/components/PlatformNavbar';
import Footer from '@/components/Footer';
import JsonLd from '@/components/JsonLd';

// Static on purpose: nothing here is edited by admins. Move to a table if that changes.
const FAQ: { id: string; audience: string; items: { q: string; a: string }[] }[] = [
  {
    id: 'pricing',
    audience: 'Pricing',
    items: [
      { q: 'How much does itsfootball.club cost?', a: 'Nothing. The platform is free for everyone: clubs, admins, coaches, players and supporters. It will stay free forever.*' },
      { q: 'Do I need a card to create a club?', a: 'No. Creating a club needs only an account, and every feature is available with no limits.' },
      { q: 'Do players or supporters pay the platform?', a: 'No. The only payments on the site are the fees your own club sets, such as membership tiers or event tickets. They are paid by card through Stripe and go to the club, not to itsfootball.club.' },
    ],
  },
  {
    id: 'club-representatives',
    audience: 'Club representatives',
    items: [
      { q: 'How do I put my club on itsfootball.club?', a: 'Go to Create Club (/create-club), sign up with your email and a password, and fill in your club details. Whoever creates the club becomes its Owner, with full admin access.' },
      { q: 'Where do I find the clubs I manage or belong to?', a: 'Sign in and open My Clubs (/my-clubs). Every club you own, administer or are a member of is listed there.' },
      { q: 'Can the club site use our own colours, logo and domain?', a: 'Yes. In your club admin, open Branding to set colours, logo and a custom domain, and Hero Slider to set the images on your club home page.' },
      { q: 'How do supporters find our club?', a: 'Every active club appears in the Clubs Directory (/clubs) and has its own public page at itsfootball.club/your-club-name.' },
    ],
  },
  {
    id: 'club-officials',
    audience: 'Club officials & admins',
    items: [
      { q: 'What can a club admin do?', a: 'Owners and Club Admins get the admin area, which covers matchday tools (Match Center, availability, lineups, the QR scanner), planning (matches, tournaments, events, seasons), people (squad, members, committee, ClubScore), money (finance, sponsors) and the club site (branding, news, analytics, enquiries).' },
      { q: 'How do I give someone admin access?', a: 'Open Squad in the admin area, edit the person and add the "Club Admin" role. That role gives them the admin area.' },
      { q: 'How do I post club news?', a: 'Open Content in the admin area. Published articles show on your club home page.' },
      { q: 'Where do messages from the public contact form go?', a: 'To Inquiries in the admin area. Messages from signed-in members arrive in their member messages.' },
      { q: 'How do I track club money and sponsors?', a: 'Use Finance for income and expenses, and Sponsors to review sponsor applications and manage existing sponsors.' },
    ],
  },
  {
    id: 'managers-coaches',
    audience: 'Managers, coaches & committee',
    items: [
      { q: 'Does the Manager, Coach or Executive Committee role give me admin access?', a: 'No. Those roles describe your position in the club but do not open the admin area. If you need matchday tools such as lineups or the Match Center, ask your club Owner to add the "Club Admin" role to your squad profile.' },
      { q: 'How do I see which players are available?', a: 'Players mark themselves available or unavailable for each match. Admins see the replies under Availability and can then pick the matchday squad under Lineup.' },
      { q: 'How do live match updates work?', a: 'During a match, an admin runs the Match Center to record the score, goals, cards and substitutions. Supporters following the match page see each update live.' },
      { q: 'How do tournaments work?', a: 'Admins create a tournament under Tournaments with a group stage, a knockout bracket (up to a round of 32), or both. Standings and the bracket update as results are entered, and each tournament has a public page.' },
      { q: 'How do check-ins work at matches and events?', a: 'Members show the QR code on their virtual pass and an admin scans it with the Scanner in the admin area. Anyone can check a pass on the club\'s Verify page.' },
    ],
  },
  {
    id: 'players',
    audience: 'Players',
    items: [
      { q: 'How do I join my club?', a: 'Open your club\'s page, go to Member, and sign up or apply for a membership tier. The club committee approves applications, and your pass activates once you are approved.' },
      { q: 'How do I sign in?', a: 'On your club\'s Member page, enter your email and you\'ll get a one-time sign-in link. There is no password to remember.' },
      { q: 'How do I tell the coach whether I can play?', a: 'Open your club\'s Availability page (itsfootball.club/your-club/availability) and answer for each upcoming match.' },
      { q: 'Where can I see my stats?', a: 'In the Stats tab of your member area. Goals, assists and other stats also count towards the club leaderboard and awards such as Player of the Tournament.' },
      { q: 'My account isn\'t linked to my squad profile. What do I do?', a: 'Sign in with the same email your club has on file and your profile links automatically. If it still doesn\'t, ask a club admin to check the email on your squad record.' },
    ],
  },
  {
    id: 'supporters',
    audience: 'Members & supporters',
    items: [
      { q: 'What is the virtual member pass?', a: 'A QR code pass in the Pass tab of your member area. Show it on your phone to be checked in at matches and club events.' },
      { q: 'How do I pay my membership?', a: 'If your chosen tier has a fee, you pay it by card during sign-up. Payment is handled securely by Stripe and goes to the club.' },
      { q: 'How do I contact my club?', a: 'Signed-in members can use the Messages tab in their member area. Anyone else can use the contact form on the club\'s page.' },
      { q: 'How do I follow a live match?', a: 'Open your club\'s page and pick the match from the fixtures. The match page updates live while the game is played.' },
    ],
  },
  {
    id: 'sponsors',
    audience: 'Sponsors',
    items: [
      { q: 'How do I sponsor a club?', a: 'Open the club\'s Sponsor page (itsfootball.club/club-name/sponsor) and send an application. The club reviews it and gets back to you.' },
    ],
  },
  {
    id: 'account',
    audience: 'Account & help',
    items: [
      { q: 'I didn\'t get my sign-in email.', a: 'Check your spam or promotions folder, make sure the address is spelled correctly, and wait a minute before requesting another link.' },
      { q: 'Who can see my information?', a: 'Your club\'s admins can see your membership details. Public club pages show only what the club chooses to publish, such as the squad list and match stats.' },
      { q: 'Where do I get more help?', a: 'Contact your club through the form on its page, or ask your club admin. They manage everything in the club.' },
    ],
  },
];

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.flatMap(s => s.items.map(i => ({
    '@type': 'Question',
    name: i.q,
    acceptedAnswer: { '@type': 'Answer', text: i.a },
  }))),
};

export default function FaqPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <JsonLd data={faqSchema} />
      <PlatformNavbar />

      <main className="container" style={{ padding: '3.5rem 1.5rem', flex: 1, maxWidth: '860px' }}>
        <div style={{ marginBottom: '2rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '2rem' }}>
          <div className="badge badge-primary" style={{ marginBottom: '0.5rem' }}>HELP</div>
          <h1 style={{ fontSize: '2.4rem', fontWeight: 900 }}>Frequently Asked Questions</h1>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '560px' }}>
            Find your role below. itsfootball.club is free forever.*
          </p>
          <nav aria-label="FAQ sections" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1.25rem' }}>
            {FAQ.map(s => (
              <a key={s.id} href={`#${s.id}`} className="badge" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                {s.audience}
              </a>
            ))}
          </nav>
        </div>

        {FAQ.map(s => (
          <section key={s.id} id={s.id} style={{ marginBottom: '2.5rem', scrollMarginTop: '90px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '1rem' }}>{s.audience}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {s.items.map(i => (
                <details key={i.q} className="glass-panel" style={{ padding: '1rem 1.25rem' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--text-primary)' }}>{i.q}</summary>
                  <p style={{ color: 'var(--text-secondary)', marginTop: '0.75rem', lineHeight: 1.65 }}>{i.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}

        <p style={{ color: 'var(--text-muted)' }}>
          Can&apos;t find your answer? Contact your club through its page, or <Link href="/create-club" style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>create your club for free</Link>.
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2rem' }}>
          *For at least the first 10 clubs. We will review pricing at that milestone.
        </p>
      </main>

      <Footer />
    </div>
  );
}
