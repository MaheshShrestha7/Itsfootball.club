// The layout of a guide (/guides/*): the question as the heading, a short answer first (the part search and
// AI engines quote), the detail with tables, a link into the free tool, questions and the sources the facts
// were checked against. Same look as the tool pages: glass panels, club colours, server-rendered text.
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import PlatformNavbar from '@/components/PlatformNavbar';
import Footer from '@/components/Footer';
import JsonLd from '@/components/JsonLd';
import { h2Style, bodyStyle, linkStyle } from '@/components/ToolLandingPage';
import { SITE_URL } from '@/lib/seo';
import { ORGANIZATION_ID, WEBSITE_ID } from '@/lib/schema';
import { GUIDES, GUIDES_HUB, GUIDES_UPDATED, guideByPath } from '@/lib/guides';
import { TOOLS_HUB, formatUpdated, toolOgImage, type ToolPageLink } from '@/lib/tool-pages';

export interface GuideSource {
  /** What the document is, e.g. "MiniRoos National Playing Formats" */
  title: string;
  publisher: string;
  url: string;
  /** What the guide takes from it */
  note?: string;
}

export interface GuidePageProps {
  path: string;
  badge: string;
  h1: string;
  /** The short answer, two sentences at most; also the Article description */
  answer: string;
  /** Extra detail under the short answer */
  answerMore?: ReactNode;
  sections: { id: string; heading: string; body: ReactNode }[];
  /** The tool the guide leads into, and why to open it */
  cta: { tool: ToolPageLink; text: string; more?: ToolPageLink[] };
  questions: { q: string; a: string }[];
  sources: GuideSource[];
}

const cell: CSSProperties = { padding: '0.6rem 0.8rem', verticalAlign: 'top' };

/** A small fact table in a glass panel; the first column is the row heading */
export function GuideTable({ caption, head, rows }: { caption: string; head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="glass-panel" style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
        <caption style={{ textAlign: 'left', padding: '0.9rem 0.8rem 0.4rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{caption}</caption>
        <thead>
          <tr style={{ textAlign: 'left', color: 'var(--text-primary)' }}>
            {head.map(h => <th key={h} scope="col" style={{ ...cell, fontWeight: 800 }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              {r.map((c, j) => j === 0
                ? <th key={j} scope="row" style={{ ...cell, textAlign: 'left', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{c}</th>
                : <td key={j} style={cell}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function GuidePage(p: GuidePageProps) {
  const url = `${SITE_URL}${p.path}`;
  const guide = guideByPath(p.path);
  const others = GUIDES.filter(g => g.path !== p.path);
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${url}#article`,
        headline: p.h1,
        description: p.answer,
        url,
        mainEntityOfPage: url,
        inLanguage: 'en-AU',
        datePublished: GUIDES_UPDATED,
        dateModified: GUIDES_UPDATED,
        author: {
          '@type': 'Person',
          name: 'Mahesh Shrestha',
          jobTitle: 'Founder',
          url: `${SITE_URL}/about`,
          sameAs: 'https://www.linkedin.com/in/maheshshrestha',
        },
        publisher: { '@id': ORGANIZATION_ID },
        isPartOf: { '@id': WEBSITE_ID },
        about: guide.question,
        citation: p.sources.map(s => ({ '@type': 'CreativeWork', name: s.title, url: s.url, publisher: { '@type': 'Organization', name: s.publisher } })),
        mentions: { '@type': 'WebApplication', name: p.cta.tool.label, url: `${SITE_URL}${p.cta.tool.path}` },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'itsfootball.club', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: GUIDES_HUB.label, item: `${SITE_URL}${GUIDES_HUB.path}` },
          { '@type': 'ListItem', position: 3, name: p.h1, item: url },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: p.questions.map(i => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })),
      },
    ],
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <JsonLd data={schema} />
      <PlatformNavbar />

      <main className="container" style={{ padding: '3rem 1rem', flex: 1, maxWidth: '860px' }}>
        <nav aria-label="Breadcrumb" className="tool-breadcrumb">
          <Link href={GUIDES_HUB.path}>Guides</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{guide.label}</span>
        </nav>
        <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div className="badge badge-primary" style={{ marginBottom: '0.75rem' }}>{p.badge}</div>
          <h1 style={{ fontSize: 'clamp(1.8rem, 4.6vw, 2.4rem)', fontWeight: 900, lineHeight: 1.15 }}>{p.h1}</h1>
          <p className="tool-updated">
            Written by Mahesh Shrestha (Sydney grassroots volunteer) •{' '}
            {p.sources.length ? 'Checked against primary sources on ' : 'Updated '}
            <time dateTime={GUIDES_UPDATED}>{formatUpdated(GUIDES_UPDATED)}</time>
          </p>
        </header>

        <section className="glass-panel guide-answer" aria-labelledby="answer">
          <h2 id="answer">Short answer</h2>
          <p>{p.answer}</p>
          {p.answerMore}
        </section>

        {p.sections.map(s => (
          <section key={s.id} style={{ marginTop: '2.5rem' }} aria-labelledby={s.id}>
            <h2 id={s.id} style={h2Style}>{s.heading}</h2>
            {s.body}
          </section>
        ))}

        <section className="glass-panel guide-cta" aria-labelledby="cta">
          <div>
            <h2 id="cta">{p.cta.tool.label}</h2>
            <p>{p.cta.text}</p>
          </div>
          <Link href={p.cta.tool.path} className="btn btn-primary">Open the free tool <ArrowRight size={16} aria-hidden="true" /></Link>
          {p.cta.more && p.cta.more.length > 0 && (
            <p className="guide-cta-more">
              Also: {p.cta.more.map((t, i) => (
                <span key={t.path}>{i > 0 && ', '}<Link href={t.path} style={linkStyle}>{t.label.toLowerCase()}</Link></span>
              ))}
            </p>
          )}
        </section>

        <section style={{ marginTop: '2.5rem' }} aria-labelledby="faq">
          <h2 id="faq" style={h2Style}>Questions</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {p.questions.map(i => (
              <details key={i.q} className="glass-panel" style={{ padding: '1rem 1.25rem' }}>
                <summary style={{ fontWeight: 700, cursor: 'pointer' }}>{i.q}</summary>
                <p style={{ ...bodyStyle, marginTop: '0.5rem' }}>{i.a}</p>
              </details>
            ))}
          </div>
        </section>

        {p.sources.length > 0 && (
          <section style={{ marginTop: '2.5rem' }} aria-labelledby="sources">
            <h2 id="sources" style={h2Style}>Sources</h2>
            <ol className="guide-sources">
              {p.sources.map(s => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" style={linkStyle}>{s.title}</a>
                  <span>{s.publisher}{s.note ? `. ${s.note}` : ''}</span>
                </li>
              ))}
            </ol>
            <p style={{ ...bodyStyle, fontSize: '0.88rem' }}>
              Associations and clubs can set their own rules within these, so check your association&apos;s handbook for anything
              that decides a match or a fee.
            </p>
          </section>
        )}

        <section style={{ marginTop: '2.5rem' }} aria-labelledby="more-guides">
          <h2 id="more-guides" style={h2Style}>More guides</h2>
          <ul className="tool-links">
            {[...others, TOOLS_HUB].map(g => (
              <li key={g.path}>
                <Link href={g.path} className="glass-panel tool-link">
                  <strong>{g.label}</strong>
                  <span>{g.blurb}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <Footer />
    </div>
  );
}
