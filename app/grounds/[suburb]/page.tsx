// Grounds in one suburb: /grounds/{suburb}. Indexed only once it lists two or more real ground guides;
// with one ground it adds nothing over that ground's own page.
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CloudRain, ExternalLink } from 'lucide-react';
import PlatformNavbar from '@/components/PlatformNavbar';
import Footer from '@/components/Footer';
import JsonLd from '@/components/JsonLd';
import GroundList from '@/components/grounds/GroundList';
import { OSM_COPYRIGHT_URL } from '@/lib/ground-import';
import { h2Style, bodyStyle } from '@/components/ToolLandingPage';
import { fitDescription, fitTitle, pageMetadata, SITE_URL } from '@/lib/seo';
import {
  GROUNDS_PATH, MIN_INDEXABLE_SUBURB_GROUNDS, councilName, groundCouncil, groundListSchema, isIndexableGround, suburbPath, type GroundRow,
} from '@/lib/grounds';
import { clubsWithHomeGrounds, groundUse, listGrounds } from '@/lib/supabase/grounds-lookup';

type Params = { params: Promise<{ suburb: string }> };

async function load(suburb: string) {
  const [all, clubs] = await Promise.all([listGrounds(), clubsWithHomeGrounds()]);
  const grounds = all.filter(g => g.suburb_slug === suburb.toLowerCase()).sort((a, b) => a.name.localeCompare(b.name));
  const { count } = groundUse(clubs);
  return { grounds, indexable: grounds.filter(g => isIndexableGround(g, count.get(g.id) || 0)) };
}

/** 'Austral NSW', or 'St Marys' when the slug covers more than one state */
const placeName = (grounds: GroundRow[]) => {
  const states = [...new Set(grounds.map(g => g.state))];
  return states.length === 1 ? `${grounds[0].suburb} ${states[0]}` : grounds[0].suburb;
};

function summary(grounds: GroundRow[]) {
  const place = placeName(grounds);
  const councils = [...new Set(grounds.map(councilName).filter(Boolean))];
  const names = grounds.map(g => g.name);
  const list = names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `${grounds.length === 1 ? 'There is 1 soccer ground' : `There are ${grounds.length} soccer grounds`} in ${place} with a guide: ${list}.${councils.length ? ` ${councils.join(' and ')} ${councils.length === 1 ? 'looks' : 'look'} after ${grounds.length === 1 ? 'it' : 'them'}.` : ''}`;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { suburb } = await params;
  const { grounds, indexable } = await load(suburb);
  if (!grounds.length) return pageMetadata({ title: 'Grounds not found | itsfootball.club', description: 'No ground guides for this suburb.', path: suburbPath(suburb), noIndex: true });
  const place = placeName(grounds);
  return pageMetadata({
    title: fitTitle([`Soccer Grounds in ${place}: Parking, Pitches & Wet Weather`, `Soccer Grounds in ${place}`], 'itsfootball.club'),
    description: fitDescription(summary(grounds), 'Parking, pitches, toilets and how to check if a ground is closed after rain.'),
    path: suburbPath(grounds[0].suburb_slug),
    noIndex: indexable.length < MIN_INDEXABLE_SUBURB_GROUNDS,
  });
}

export default async function SuburbGroundsPage({ params }: Params) {
  const { suburb } = await params;
  const { grounds } = await load(suburb);
  if (!grounds.length) notFound();
  const place = placeName(grounds);
  const councils = [...new Map(grounds.map(g => [g.council_key, groundCouncil(g)])).values()].filter(c => !!c);
  const path = suburbPath(grounds[0].suburb_slug);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@graph': [
          groundListSchema(`Soccer grounds in ${place}`, path, grounds),
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Grounds', item: `${SITE_URL}${GROUNDS_PATH}` },
              { '@type': 'ListItem', position: 2, name: place, item: `${SITE_URL}${path}` },
            ],
          },
        ],
      }} />
      <PlatformNavbar />
      <main className="container" style={{ padding: '2.5rem 1rem', flex: 1, maxWidth: '960px' }}>
        <nav aria-label="Breadcrumb" className="tool-breadcrumb">
          <Link href={GROUNDS_PATH}>Grounds</Link><span aria-hidden="true">/</span>
          <span aria-current="page">{place}</span>
        </nav>
        <header style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div className="badge badge-primary" style={{ marginBottom: '0.75rem' }}>GROUND GUIDES · {place.toUpperCase()}</div>
          <h1 style={{ fontSize: 'clamp(1.9rem, 5vw, 2.6rem)', fontWeight: 900, lineHeight: 1.1 }}>Soccer grounds in {place}</h1>
        </header>

        <section className="glass-panel guide-answer" aria-labelledby="answer">
          <h2 id="answer">At a glance</h2>
          <p>{summary(grounds)}</p>
        </section>

        {councils.map(c => (
          <section key={c.key} className="glass-panel ground-status" aria-label={`${c.name} wet weather`}>
            <div style={{ flex: '1 1 300px', display: 'flex', gap: '0.9rem' }}>
              <CloudRain size={24} color="#F59E0B" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
              <div>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 900, margin: 0 }}>Is it open today? {c.name}</h2>
                <p style={{ ...bodyStyle, margin: '0.2rem 0 0', fontSize: '0.9rem' }}>{c.note}</p>
              </div>
            </div>
            <a className="btn btn-primary" href={c.url} target="_blank" rel="noopener" style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
              {c.kind === 'status' ? 'Council ground status' : 'Council sportsgrounds page'} <ExternalLink size={15} aria-hidden="true" />
            </a>
          </section>
        ))}

        <section style={{ marginTop: '2.5rem' }} aria-labelledby="grounds">
          <h2 id="grounds" style={h2Style}>Grounds</h2>
          <GroundList grounds={grounds} showSuburb={false} />
        </section>

        <p style={{ ...bodyStyle, marginTop: '2rem', textAlign: 'center' }}>
          <Link href={GROUNDS_PATH} style={{ color: 'var(--club-ink)', fontWeight: 600 }}>All community soccer grounds</Link>
        </p>
        {grounds.some(g => g.source === 'osm') && (
          <p style={{ ...bodyStyle, fontSize: '0.78rem', marginTop: '1.5rem', textAlign: 'center' }}>
            Some ground locations and pitches © <a href={OSM_COPYRIGHT_URL} target="_blank" rel="noopener" style={{ color: 'var(--club-ink)' }}>OpenStreetMap contributors</a> (ODbL).
          </p>
        )}
      </main>
      <Footer />
    </div>
  );
}
