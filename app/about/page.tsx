import Link from 'next/link';
import type { CSSProperties } from 'react';
import { ArrowRight, Check, Mail, MapPin } from 'lucide-react';
import PlatformNavbar from '@/components/PlatformNavbar';
import Footer from '@/components/Footer';
import JsonLd from '@/components/JsonLd';
import { pageMetadata, SOCIAL_PROFILES } from '@/lib/seo';
import { CONTACT_EMAIL } from '@/lib/faq';
import { aboutSchema } from '@/lib/schema';

export const metadata = pageMetadata({
  title: 'About itsfootball.club | Built by a Club Volunteer',
  description: 'itsfootball.club is built in Sydney by Mahesh Shrestha, a community football volunteer, to give every grassroots club a big-club matchday, free.',
  path: '/about',
});

const PROMISES = [
  'Free for clubs, with every feature included and no paid tier',
  'No ads, ever',
  'Card payers cover a small booking fee, so the club keeps its full price',
  "Your club's site, in your club's colours, on your own domain if you want one",
];

const ctaStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.45rem' };
const h2Style: CSSProperties = { fontSize: 'clamp(1.4rem, 3.5vw, 1.8rem)', fontWeight: 900, marginBottom: '0.75rem' };
const bodyStyle: CSSProperties = { color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: '1rem' };
const linkStyle: CSSProperties = { color: 'var(--club-ink)', fontWeight: 600 };

export default function AboutPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <JsonLd data={aboutSchema()} />
      <PlatformNavbar />

      <main className="container" style={{ padding: '3.5rem 1rem', flex: 1, maxWidth: '760px' }}>
        <header style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div className="badge badge-primary" style={{ marginBottom: '0.75rem' }}>OUR STORY</div>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 2.8rem)', fontWeight: 900, lineHeight: 1.1 }}>
            Built on the sideline, by a club volunteer
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: '0.9rem auto 0', fontSize: '1.05rem', lineHeight: 1.6 }}>
            itsfootball.club is made by Mahesh Shrestha, a community football volunteer in Sydney, NSW, Australia.
          </p>
        </header>

        <section className="glass-panel" style={{ padding: '2rem 1.5rem', marginBottom: '1.5rem' }}>
          <h2 style={h2Style}>Why I built it</h2>
          <p style={bodyStyle}>I never set out to build software. I set out to help my local club.</p>
          <p style={bodyStyle}>
            Volunteering at a community soccer club, I saw what it takes to keep one going: chasing who&apos;s available,
            sorting the team sheet, keeping the score, getting the result out so families and friends could see it. Every job
            lived in a different group chat, spreadsheet or app, and every week the same few people quietly carried it all.
          </p>
          <p style={bodyStyle}>
            What stayed with me wasn&apos;t the workload. It was how much our club deserved better. Players gave up their
            weekends. Parents stood on the sideline in the cold. Local businesses put their names behind us because they
            believed in the club. And by Monday, all of it had disappeared into a group chat.
          </p>
          <p style={bodyStyle}>
            Big clubs have media teams, live scores and proper websites. Grassroots clubs have volunteers, and those volunteers
            are the reason community football exists at all. I wanted to give them the same matchday the big clubs get, without
            the price tag, so they can spend less time on admin and more time on football.
          </p>
          <p style={{ ...bodyStyle, marginBottom: 0 }}>
            That&apos;s itsfootball.club. It&apos;s free for every club, because the clubs that need it most are the ones that
            can least afford it.
          </p>
        </section>

        <section className="glass-panel" style={{ padding: '2rem 1.5rem', marginBottom: '1.5rem' }}>
          <h2 style={h2Style}>Running for real</h2>
          <p style={{ ...bodyStyle, marginBottom: 0 }}>
            Austral Nepalese Community Club (ANCC) runs on itsfootball.club: its fixtures and results, live match centre,
            club news and the ANCC Dashain Cup tournament are all published here.{' '}
            <Link href="/ancc" style={linkStyle}>See the ANCC club site</Link>.
          </p>
        </section>

        <section className="glass-panel" style={{ padding: '2rem 1.5rem', marginBottom: '1.5rem', borderTop: '3px solid var(--c-green)' }}>
          <h2 style={h2Style}>What I promise clubs</h2>
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '0.55rem' }}>
            {PROMISES.map(s => (
              <li key={s} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                <Check size={18} color="var(--c-green)" style={{ flexShrink: 0, marginTop: 2 }} /> {s}
              </li>
            ))}
          </ul>
          <p style={{ ...bodyStyle, marginTop: '1rem', marginBottom: 0 }}>
            How the booking fee works and everything else clubs ask is in the <Link href="/faq" style={linkStyle}>FAQ</Link>.
          </p>
        </section>

        <section className="glass-panel" style={{ padding: '2rem 1.5rem', marginBottom: '2rem' }}>
          <h2 style={h2Style}>Get in touch</h2>
          <p style={{ ...bodyStyle, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Mail size={18} /> <a href={`mailto:${CONTACT_EMAIL}`} style={linkStyle}>{CONTACT_EMAIL}</a>
          </p>
          <p style={{ ...bodyStyle, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MapPin size={18} /> Sydney, NSW, Australia
          </p>
          <p style={{ ...bodyStyle, marginBottom: 0 }}>
            Follow along on{' '}
            {SOCIAL_PROFILES.map((p, i) => (
              <span key={p.url}>
                {i > 0 && ' and '}
                <a href={p.url} target="_blank" rel="noopener noreferrer" style={linkStyle}>{p.name}</a>
              </span>
            ))}
            .
          </p>
        </section>

        <section className="glass-panel" style={{ padding: '2.25rem 1.5rem', textAlign: 'center', borderTop: '3px solid var(--c-green)' }}>
          <h2 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 900, marginBottom: '1.25rem' }}>Give your club the matchday it deserves.</h2>
          <Link href="/create-club" className="btn btn-primary btn-lg" style={ctaStyle}>
            Create your club free <ArrowRight size={18} />
          </Link>
        </section>
      </main>

      <Footer />
    </div>
  );
}
