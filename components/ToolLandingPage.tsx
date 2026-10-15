// The layout of a free tool's format landing page (e.g. /tools/9-a-side-lineup-builder): its own intro,
// the tool opened with that format's defaults, format-specific sections, steps, FAQ and links to the
// other tools. Server-rendered, so crawlers get all of the text; only the tool itself is a client component.
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import PlatformNavbar from '@/components/PlatformNavbar';
import Footer from '@/components/Footer';
import JsonLd from '@/components/JsonLd';
import { SITE_URL } from '@/lib/seo';
import { ORGANIZATION_ID, WEBSITE_ID, howToSchema } from '@/lib/schema';
import { MAIN_TOOLS, TOOL_GROUPS, TOOLS_HUB, TOOLS_UPDATED, formatUpdated, toolExample, type ToolPageLink } from '@/lib/tool-pages';

export interface ToolLandingProps {
  path: string;
  /** The parent tool, for the breadcrumb (none on a main tool's own page) */
  parent?: ToolPageLink;
  badge: string;
  h1: string;
  /** Answer first: the sentence search and AI engines lift as the summary */
  intro: string;
  description: string;
  appName: string;
  alternateNames: string[];
  features: string[];
  tool: ReactNode;
  sections: { id: string; heading: string; body: ReactNode }[];
  howToName: string;
  steps: { name: string; text: string }[];
  questions: { q: string; a: string }[];
  maxWidth?: string;
}

export const h2Style: CSSProperties = { fontSize: 'clamp(1.3rem, 3.2vw, 1.6rem)', fontWeight: 900, marginBottom: '0.75rem' };
export const bodyStyle: CSSProperties = { color: 'var(--text-secondary)', lineHeight: 1.7 };
export const linkStyle: CSSProperties = { color: 'var(--club-ink)', fontWeight: 600 };

/** The tools other than this page: its own group first, then the other main tools, then the hub */
function otherTools(path: string): ToolPageLink[] {
  const group = TOOL_GROUPS.find(g => [...g.main, ...g.formats].some(t => t.path === path));
  const own = group ? [...group.main, ...group.formats] : [];
  const others = MAIN_TOOLS.filter(t => !own.includes(t));
  return [...own, ...others, TOOLS_HUB].filter(t => t.path !== path);
}

/** Home > Free football tools > (parent tool) > this page, as schema.org breadcrumbs */
export function toolBreadcrumbSchema(path: string, name: string, parent?: ToolPageLink) {
  const trail = [
    { name: 'itsfootball.club', item: SITE_URL },
    { name: TOOLS_HUB.label, item: `${SITE_URL}${TOOLS_HUB.path}` },
    ...(parent ? [{ name: parent.label, item: `${SITE_URL}${parent.path}` }] : []),
    { name, item: `${SITE_URL}${path}` },
  ];
  return { '@type': 'BreadcrumbList', itemListElement: trail.map((t, i) => ({ '@type': 'ListItem', position: i + 1, ...t })) };
}

/** The visible trail above a tool page's heading */
export function ToolBreadcrumb({ name, parent }: { name: string; parent?: ToolPageLink }) {
  return (
    <nav aria-label="Breadcrumb" className="tool-breadcrumb">
      <Link href={TOOLS_HUB.path}>Free tools</Link>
      {parent && (
        <>
          <span aria-hidden="true">/</span>
          <Link href={parent.path}>{parent.label}</Link>
        </>
      )}
      <span aria-hidden="true">/</span>
      <span aria-current="page">{name}</span>
    </nav>
  );
}

/** "Updated" line under a tool page's intro (the same date is the schema's dateModified) */
export function ToolUpdated() {
  return <p className="tool-updated">Updated <time dateTime={TOOLS_UPDATED}>{formatUpdated(TOOLS_UPDATED)}</time></p>;
}

/** The tool's example output, so the page shows (and can rank in image search for) what it makes */
export function ToolExampleFigure({ path, heading = 'What you get' }: { path: string; heading?: string }) {
  const e = toolExample(path);
  if (!e) return null;
  return (
    <section style={{ marginTop: '2.5rem' }} aria-labelledby="example">
      <h2 id="example" style={h2Style}>{heading}</h2>
      <figure className="glass-panel tool-example">
        <img src={e.src} width={e.width} height={e.height} alt={e.alt} loading="lazy" decoding="async"
          style={{ maxWidth: e.height > e.width ? '420px' : '640px' }} />
        <figcaption>{e.caption}</figcaption>
      </figure>
    </section>
  );
}

/** schema.org fields for a tool's WebApplication: last change and the example output as its image */
export function toolSchemaExtras(path: string) {
  const e = toolExample(path);
  return {
    dateModified: TOOLS_UPDATED,
    ...(e ? { image: `${SITE_URL}${e.src}`, screenshot: { '@type': 'ImageObject', url: `${SITE_URL}${e.src}`, width: e.width, height: e.height, caption: e.caption } } : {}),
  };
}

export function ToolLinks({ path, heading = 'More free tools' }: { path: string; heading?: string }) {
  return (
    <section style={{ marginTop: '2.5rem' }} aria-labelledby="more-tools">
      <h2 id="more-tools" style={h2Style}>{heading}</h2>
      <ul className="tool-links">
        {otherTools(path).map(t => (
          <li key={t.path}>
            <Link href={t.path} className="glass-panel tool-link">
              <strong>{t.label}</strong>
              <span>{t.blurb}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function ToolLandingPage(p: ToolLandingProps) {
  const url = `${SITE_URL}${p.path}`;
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        '@id': `${url}#app`,
        name: p.appName,
        alternateName: p.alternateNames,
        url,
        description: p.description,
        applicationCategory: 'SportsApplication',
        operatingSystem: 'Any (web browser)',
        browserRequirements: 'Requires JavaScript',
        inLanguage: 'en-AU',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'AUD' },
        featureList: p.features,
        publisher: { '@id': ORGANIZATION_ID },
        isPartOf: { '@id': WEBSITE_ID },
        ...toolSchemaExtras(p.path),
      },
      toolBreadcrumbSchema(p.path, p.h1, p.parent),
      {
        '@type': 'FAQPage',
        mainEntity: p.questions.map(i => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })),
      },
    ],
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <JsonLd data={schema} />
      <JsonLd data={howToSchema(p.howToName, p.path, p.steps)} />
      <PlatformNavbar />

      <main className="container" style={{ padding: '3rem 1rem', flex: 1, maxWidth: p.maxWidth || '1120px' }}>
        <ToolBreadcrumb name={p.h1} parent={p.parent} />
        <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div className="badge badge-primary" style={{ marginBottom: '0.75rem' }}>{p.badge}</div>
          <h1 style={{ fontSize: 'clamp(1.9rem, 5vw, 2.6rem)', fontWeight: 900, lineHeight: 1.1 }}>{p.h1}</h1>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '680px', margin: '0.9rem auto 0', fontSize: '1.02rem', lineHeight: 1.6 }}>{p.intro}</p>
          <ToolUpdated />
        </header>

        {p.tool}

        {p.sections.map((s, i) => (
          <section key={s.id} className={i === 0 ? 'glass-panel' : undefined} style={i === 0 ? { padding: '1.6rem', marginTop: '3rem' } : { marginTop: '2.5rem' }} aria-labelledby={s.id}>
            <h2 id={s.id} style={h2Style}>{s.heading}</h2>
            {s.body}
          </section>
        ))}

        <ToolExampleFigure path={p.path} />

        <section style={{ marginTop: '2.5rem' }} aria-labelledby="how">
          <h2 id="how" style={h2Style}>{p.howToName}</h2>
          <ol className="vs-steps" style={{ maxWidth: 'none', margin: '0' }}>
            {p.steps.map(s => <li key={s.name}><span><strong>{s.name}.</strong> {s.text}</span></li>)}
          </ol>
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

        <ToolLinks path={p.path} />

        <p style={{ ...bodyStyle, marginTop: '1.5rem', textAlign: 'center' }}>
          Running a club? See how the <Link href="/live-scores" style={linkStyle}>free live match centre</Link> works,
          or <Link href="/create-club" style={linkStyle}>launch your free club site</Link>.
        </p>
      </main>

      <Footer />
    </div>
  );
}
