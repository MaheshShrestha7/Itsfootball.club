import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { ArrowRight, Check, Share2, Shield, Smartphone, Users } from 'lucide-react';
import PlatformNavbar from '@/components/PlatformNavbar';
import Footer from '@/components/Footer';
import JsonLd from '@/components/JsonLd';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Free Live Scores for Community Soccer Clubs | itsfootball.club',
  description: "Post live scores, goals, cards and subs from your phone at the ground. Supporters follow on your club's website, no app to install. Free for every club.",
  path: '/live-scores',
});

const QUESTIONS = [
  { q: 'How do community soccer clubs post live scores?', a: "Open Match Center in your itsfootball.club admin on a phone at the ground and record goals, cards and substitutions as they happen. Supporters follow the club's match page live, with nothing to install." },
  { q: 'Is there a free live score app for grassroots football?', a: "Yes. itsfootball.club's live match centre is free for every club, with no paid plan. Supporters don't need an app at all; they follow the match on the club's website." },
  { q: 'Can parents follow the game without downloading anything?', a: "Yes. Share the match link and anyone can open it in their phone's browser and watch the score update live." },
  { q: 'Can we hide scores for junior teams?', a: 'Yes. Each team has a hide scores setting that keeps goals and the score off the public match page and share graphics, while the lineup and other events still show.' },
  { q: 'Can more than one person run the match centre?', a: 'Yes. The club owner can give any squad member the Club Admin role, so whoever is at the ground can record the match.' },
  { q: 'Does the result update our fixtures and stats?', a: "Yes. When the match is recorded, the result, goal scorers and player stats update the club's fixtures and leaderboard automatically." },
];

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: QUESTIONS.map(i => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })),
};

const ctaStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.45rem' };
const h2Style: CSSProperties = { fontSize: 'clamp(1.4rem, 3.5vw, 1.8rem)', fontWeight: 900, marginBottom: '0.75rem' };
const bodyStyle: CSSProperties = { color: 'var(--text-secondary)', lineHeight: 1.7 };
const linkStyle: CSSProperties = { color: 'var(--club-ink)', fontWeight: 600 };

// An illustration of a public match page, not live data
const TIMELINE = [
  { min: "12'", kind: 'Goal', who: 'J. Thapa', color: 'var(--c-green)' },
  { min: "34'", kind: 'Yellow card', who: 'R. Gurung', color: 'var(--c-amber)' },
  { min: "45'", kind: 'Half time', who: '', color: 'var(--text-muted)' },
  { min: "58'", kind: 'Goal', who: 'S. Rai', color: 'var(--c-green)' },
  { min: "61'", kind: 'Substitution', who: 'A. Lama on, K. Magar off', color: 'var(--c-blue)' },
];

const SEES = [
  'The live score and match status: kick-off, half time, full time',
  'A minute-by-minute timeline of goals, cards and subs',
  'Your lineup, on a pitch view',
  'Match stats: goals, cards and substitutions for both sides',
  'Player of the Match',
  'Your sponsors, shown along the match page',
];

function Feature({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="glass-panel" style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem', color: 'var(--club-ink)' }}>
        {icon}
        <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>{title}</h2>
      </div>
      <p style={bodyStyle}>{children}</p>
    </section>
  );
}

export default function LiveScoresPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <JsonLd data={faqSchema} />
      <PlatformNavbar />

      <main className="container" style={{ padding: '3.5rem 1rem', flex: 1, maxWidth: '960px' }}>
        <header style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div className="badge badge-primary" style={{ marginBottom: '0.75rem' }}>LIVE MATCH CENTRE · FREE FOR EVERY CLUB</div>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 2.8rem)', fontWeight: 900, lineHeight: 1.1 }}>
            Live scores for your club, free
          </h1>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '640px', margin: '0.9rem auto 0', fontSize: '1.05rem', lineHeight: 1.6 }}>
            Run a live match centre from your phone at the ground. Supporters follow the score, goals, cards and subs on your
            club&apos;s own website, with nothing to download. No paid plan, no locked features.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.75rem', marginTop: '1.5rem' }}>
            <Link href="/create-club" className="btn btn-primary btn-lg" style={ctaStyle}>
              Create your club free <ArrowRight size={18} />
            </Link>
            <Link href="/ancc" className="btn btn-secondary btn-lg">See a live club site</Link>
          </div>
        </header>

        <section aria-label="Example match page" className="glass-panel" style={{ padding: '1.5rem', maxWidth: '560px', margin: '0 auto 2.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.9rem' }}>
            <span className="badge badge-live"><span className="pulse-dot" /> LIVE · 61&apos;</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '0.75rem', textAlign: 'center' }}>
            <strong>Your Club FC</strong>
            <span style={{ fontSize: '2.4rem', fontWeight: 900, letterSpacing: '0.05em' }}>2 – 0</span>
            <strong>Rivals United</strong>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '1.25rem 0 0', borderTop: '1px solid var(--border-subtle)' }}>
            {TIMELINE.map(e => (
              <li key={e.min} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '0.55rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ width: 36, fontWeight: 800, color: 'var(--text-muted)' }}>{e.min}</span>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: e.color, flexShrink: 0 }} />
                <span><strong>{e.kind}</strong>{e.who && <span style={{ color: 'var(--text-secondary)' }}> · {e.who}</span>}</span>
              </li>
            ))}
          </ul>
          <p style={{ marginTop: '0.8rem', fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            Updates on supporters&apos; phones as you log each event. No refreshing.
          </p>
        </section>

        <section className="glass-panel" style={{ padding: '2rem 1.5rem', marginBottom: '1.5rem', textAlign: 'center' }}>
          <h2 style={h2Style}>How it works on match day</h2>
          <ol className="vs-steps" style={{ maxWidth: '560px' }}>
            <li><span><strong>Pick your squad.</strong> Players mark themselves available, and you choose the team under Lineup.</span></li>
            <li><span><strong>Open Match Center at the ground.</strong> It&apos;s in your club admin and runs on any phone.</span></li>
            <li><span><strong>Tap in what happens.</strong> Goals, penalties, own goals, cards, subs and the whistle, each with the minute.</span></li>
            <li><span><strong>Supporters watch it live.</strong> The match page updates by itself. No refreshing, no app.</span></li>
            <li><span><strong>Full time does the rest.</strong> The result, scorers and player stats flow into your fixtures and leaderboard.</span></li>
          </ol>
        </section>

        <section className="glass-panel" style={{ padding: '2rem 1.5rem', marginBottom: '1.5rem' }}>
          <h2 style={h2Style}>What supporters see</h2>
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '0.55rem' }}>
            {SEES.map(s => (
              <li key={s} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                <Check size={18} color="var(--c-green)" style={{ flexShrink: 0, marginTop: 2 }} /> {s}
              </li>
            ))}
          </ul>
          <p style={{ ...bodyStyle, marginTop: '1rem' }}>
            It&apos;s all on your club&apos;s site, in your club&apos;s colours, at a link like itsfootball.club/your-club, or on your own domain.
          </p>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
          <Feature icon={<Share2 size={20} />} title="Share it before, during and after">
            Hit Share on any match to post a ready-made graphic to Instagram, Facebook or the team chat: a matchday card, the
            lineup, and the result at full time. Every card brings people back to your club&apos;s site.
          </Feature>
          <Feature icon={<Smartphone size={20} />} title="No app for supporters">
            They tap the link and they&apos;re watching. Parents on the sideline, injured players, grandparents at home: anyone
            with the link can follow along.
          </Feature>
          <Feature icon={<Shield size={20} />} title="Junior teams">
            Under-age teams that don&apos;t publish scores can turn on hide scores. The lineup, cards and subs still show, but
            goals and the score stay off the public page.
          </Feature>
          <Feature icon={<Users size={20} />} title="Who enters the score?">
            A club admin, usually the coach, manager or a volunteer on the sideline. Give anyone the Club Admin role so a
            different person can run each match. It shows what your club records; it&apos;s not a feed from the league.
          </Feature>
        </div>

        <section className="glass-panel" style={{ padding: '2rem 1.5rem', marginBottom: '2rem', borderTop: '3px solid var(--c-green)' }}>
          <h2 style={h2Style}>What does it cost?</h2>
          <p style={bodyStyle}>
            Nothing. The live match centre, lineups, availability, member passes and every other feature are free for the club,
            with no trial and no premium tier. The only charge anywhere on itsfootball.club is a small booking fee on card
            payments (like memberships or shop orders), paid by the person paying, never by the club.{' '}
            <Link href="/faq" style={linkStyle}>Read the FAQ</Link>.
          </p>
          <p style={{ ...bodyStyle, marginTop: '0.75rem' }}>
            Already using another app for scores?{' '}
            <Link href="/vs" style={linkStyle}>See how we compare with Pitchero, Spond and others</Link>.
          </p>
        </section>

        <section aria-label="Questions clubs ask" style={{ marginBottom: '2rem' }}>
          <h2 style={{ ...h2Style, textAlign: 'center' }}>Questions clubs ask</h2>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {QUESTIONS.map(i => (
              <details key={i.q} className="glass-panel" style={{ padding: '1rem 1.25rem' }}>
                <summary style={{ fontWeight: 700, cursor: 'pointer' }}>{i.q}</summary>
                <p style={{ ...bodyStyle, marginTop: '0.6rem' }}>{i.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="glass-panel" style={{ padding: '2.25rem 1.5rem', textAlign: 'center', borderTop: '3px solid var(--c-green)' }}>
          <h2 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 900, marginBottom: '1.25rem' }}>Your next match, live. Free.</h2>
          <Link href="/create-club" className="btn btn-primary btn-lg" style={ctaStyle}>
            Create your club free <ArrowRight size={18} />
          </Link>
        </section>
      </main>

      <Footer />
    </div>
  );
}
