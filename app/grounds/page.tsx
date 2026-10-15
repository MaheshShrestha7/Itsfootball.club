// The grounds directory: every published ground, by state then council, each council with its own
// wet-weather status link. Kept out of search until it lists a few real ground guides.
import Link from 'next/link';
import { CloudRain } from 'lucide-react';
import PlatformNavbar from '@/components/PlatformNavbar';
import Footer from '@/components/Footer';
import JsonLd from '@/components/JsonLd';
import GroundList from '@/components/grounds/GroundList';
import GroundsSearch from '@/components/grounds/GroundsSearch';
import { h2Style, bodyStyle, linkStyle } from '@/components/ToolLandingPage';
import { pageMetadata } from '@/lib/seo';
import { STATES } from '@/lib/councils';
import { GROUNDS_PATH, MIN_INDEXABLE_DIRECTORY, councilName, groundCouncil, groundListSchema, isIndexableGround, type GroundRow } from '@/lib/grounds';
import { clubsWithHomeGrounds, groundUse, listGrounds } from '@/lib/supabase/grounds-lookup';

async function load() {
  const [grounds, clubs] = await Promise.all([listGrounds(), clubsWithHomeGrounds()]);
  const { count } = groundUse(clubs);
  const indexable = grounds.filter(g => isIndexableGround(g, count.get(g.id) || 0));
  return { grounds, indexable };
}

export async function generateMetadata() {
  const { indexable } = await load();
  return pageMetadata({
    title: 'Community Soccer Grounds: Parking, Pitches & Wet Weather',
    description: 'Free guides to community soccer grounds in Australia: where to park, which pitch, toilets and canteen, and how to check if a ground is closed after rain.',
    path: GROUNDS_PATH,
    noIndex: indexable.length < MIN_INDEXABLE_DIRECTORY,
  });
}

function groupGrounds(grounds: GroundRow[]) {
  return STATES.map(s => {
    const inState = grounds.filter(g => g.state === s.code);
    const councils = new Map<string, GroundRow[]>();
    for (const g of inState) {
      const name = councilName(g) || 'Other grounds';
      councils.set(name, [...(councils.get(name) || []), g]);
    }
    return {
      state: s,
      councils: [...councils.entries()]
        .sort(([a], [b]) => (a === 'Other grounds' ? 1 : b === 'Other grounds' ? -1 : a.localeCompare(b)))
        .map(([name, list]) => ({ name, list: list.sort((a, b) => a.name.localeCompare(b.name)), council: groundCouncil(list[0]) })),
    };
  }).filter(s => s.councils.length);
}

export default async function GroundsDirectoryPage() {
  const { grounds } = await load();
  const groups = groupGrounds(grounds);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {grounds.length > 0 && <JsonLd data={groundListSchema('Community soccer grounds', GROUNDS_PATH, grounds)} />}
      <PlatformNavbar />
      <main className="container" style={{ padding: '2.5rem 1rem', flex: 1, maxWidth: '960px' }}>
        <header style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div className="badge badge-primary" style={{ marginBottom: '0.75rem' }}>FREE GROUND GUIDES</div>
          <h1 style={{ fontSize: 'clamp(1.9rem, 5vw, 2.6rem)', fontWeight: 900, lineHeight: 1.1 }}>Community soccer grounds</h1>
          <p style={{ ...bodyStyle, marginTop: '0.5rem', maxWidth: 640, marginInline: 'auto' }}>
            Where to park, which pitch, toilets and canteen, and how to check if a ground is closed after rain. Each guide is kept up to
            date by a local club and links to the council&apos;s own wet-weather status page.
          </p>
        </header>

        {grounds.length > 0 && <GroundsSearch targetId="ground-groups" />}

        <div id="ground-groups">
          {groups.map(({ state, councils }) => (
            <section key={state.code} aria-labelledby={`state-${state.code}`} data-ground-group style={{ marginBottom: '1rem' }}>
              <h2 id={`state-${state.code}`} style={h2Style}>{state.name}</h2>
              {councils.map(c => (
                <section key={c.name} data-ground-group style={{ marginBottom: '1.75rem' }}>
                  <div className="ground-group-head">
                    <h3>{c.name}</h3>
                    {c.council && (
                      <a href={c.council.url} target="_blank" rel="noopener" style={{ ...linkStyle, fontSize: '0.85rem', display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
                        <CloudRain size={15} aria-hidden="true" /> Wet weather status
                      </a>
                    )}
                  </div>
                  <GroundList grounds={c.list} />
                </section>
              ))}
            </section>
          ))}
        </div>

        {grounds.length === 0 && (
          <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <p style={bodyStyle}>No ground guides yet.</p>
          </div>
        )}

        <section className="glass-panel guide-cta" aria-labelledby="add-ground">
          <div>
            <h2 id="add-ground">Run a club? Add your home ground</h2>
            <p>
              Club admins add their ground&apos;s pin, pitches, parking and facilities in Admin, Branding. The guide is free and helps away
              teams and parents find you on match day.
            </p>
          </div>
          <Link href="/create-club" className="btn btn-primary">Launch your free club site</Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
