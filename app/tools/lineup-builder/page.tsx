import Link from 'next/link';
import type { CSSProperties } from 'react';
import PlatformNavbar from '@/components/PlatformNavbar';
import Footer from '@/components/Footer';
import JsonLd from '@/components/JsonLd';
import LineupBuilderTool from '@/components/LineupBuilderTool';
import { SITE_URL, pageMetadata } from '@/lib/seo';
import { howToSchema } from '@/lib/schema';

export const metadata = pageMetadata({
  title: 'Free Football Lineup Builder | Soccer Team Sheet Maker',
  description: 'Build your 5, 7, 9 or 11-a-side football team lineup on a pitch and download it as an image for Instagram, Facebook or WhatsApp. Free, no sign-up.',
  path: '/tools/lineup-builder',
});

const STEPS = [
  { name: 'Pick the format', text: '5-a-side, 7-a-side, 9-a-side or 11-a-side, then a formation.' },
  { name: 'Name your team', text: 'Type the players and shirt numbers, choose your colour and add your badge if you like.' },
  { name: 'Move players around', text: 'Drag anyone on the pitch to where they will actually play, and pick a captain.' },
  { name: 'Download the image', text: 'A post or story sized graphic, ready for Instagram, Facebook or the team WhatsApp.' },
];

const QUESTIONS = [
  { q: 'Is the lineup builder free?', a: 'Yes. It is free to use with no account, no sign-up and no ads. The image has a small "Made at itsfootball.club" line at the bottom.' },
  { q: 'Which formats can I build?', a: '5-a-side, 7-a-side and 9-a-side for small-sided and junior soccer, and 11-a-side for full matches, each with a few common formations.' },
  { q: 'Is my lineup saved anywhere?', a: 'Only in your own browser, so it is still there next time you open the page. Nothing is sent to our servers and the image is drawn on your device.' },
  { q: 'What size is the image?', a: 'Post is 1080 × 1350 for an Instagram or Facebook feed post and WhatsApp chats. Story is 1080 × 1920 for Instagram and Facebook stories and WhatsApp status.' },
  { q: 'Can I see who is available before I pick the team?', a: "Yes, with a free itsfootball.club club site. Players mark themselves available for each fixture, you pick the lineup from that squad, and it publishes to your club's match page." },
];

const schema = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Free Football Lineup Builder',
  url: `${SITE_URL}/tools/lineup-builder`,
  applicationCategory: 'SportsApplication',
  operatingSystem: 'Any (web browser)',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'AUD' },
  publisher: { '@id': `${SITE_URL}/#organization` },
};

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: QUESTIONS.map(i => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })),
};

const howTo = howToSchema('How to make a football lineup graphic', '/tools/lineup-builder', STEPS);

const h2Style: CSSProperties = { fontSize: 'clamp(1.3rem, 3.2vw, 1.6rem)', fontWeight: 900, marginBottom: '0.75rem' };
const bodyStyle: CSSProperties = { color: 'var(--text-secondary)', lineHeight: 1.7 };

export default function LineupBuilderPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <JsonLd data={schema} />
      <JsonLd data={faqSchema} />
      <JsonLd data={howTo} />
      <PlatformNavbar />

      <main className="container" style={{ padding: '3rem 1rem', flex: 1, maxWidth: '1120px' }}>
        <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div className="badge badge-primary" style={{ marginBottom: '0.75rem' }}>FREE TOOL · NO SIGN-UP</div>
          <h1 style={{ fontSize: 'clamp(1.9rem, 5vw, 2.6rem)', fontWeight: 900, lineHeight: 1.1 }}>
            Free football lineup builder
          </h1>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '640px', margin: '0.9rem auto 0', fontSize: '1.02rem', lineHeight: 1.6 }}>
            Build your soccer starting lineup for 5, 7, 9 or 11-a-side, drag players into place and download a team sheet
            graphic for your socials or the team chat. No login needed.
          </p>
        </header>

        <LineupBuilderTool />

        <section className="glass-panel" style={{ padding: '1.6rem', marginTop: '3rem' }}>
          <h2 style={h2Style}>How it works</h2>
          <ol className="vs-steps" style={{ maxWidth: 'none', margin: '0' }}>
            {STEPS.map(s => <li key={s.name}><span><strong>{s.name}.</strong> {s.text}</span></li>)}
          </ol>
        </section>

        <section style={{ marginTop: '2.5rem' }}>
          <h2 style={h2Style}>Questions</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {QUESTIONS.map(i => (
              <details key={i.q} className="glass-panel" style={{ padding: '1rem 1.25rem' }}>
                <summary style={{ fontWeight: 700, cursor: 'pointer' }}>{i.q}</summary>
                <p style={{ ...bodyStyle, marginTop: '0.5rem' }}>{i.a}</p>
              </details>
            ))}
          </div>
          <p style={{ ...bodyStyle, marginTop: '1.25rem', textAlign: 'center' }}>
            Running a club? See how the <Link href="/live-scores" style={{ color: 'var(--club-ink)', fontWeight: 600 }}>free live match centre</Link> works,
            or <Link href="/create-club" style={{ color: 'var(--club-ink)', fontWeight: 600 }}>launch your free club site</Link>.
          </p>
        </section>
      </main>

      <Footer />
    </div>
  );
}
