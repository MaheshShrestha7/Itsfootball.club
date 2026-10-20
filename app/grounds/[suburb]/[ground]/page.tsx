// A public ground guide: /grounds/{suburb}/{ground}. Facts first (what away teams and parents search
// for: parking, which pitch, toilets, is it open after rain), all server-rendered so crawlers that
// skip JavaScript see them. Clubs and fixtures appear only for clubs that opted in (lib/grounds.ts).
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { MapPin, Car, Toilet, Coffee, Accessibility, CloudRain, Phone, ExternalLink, Navigation, Shield, Info } from 'lucide-react';
import PlatformNavbar from '@/components/PlatformNavbar';
import Footer from '@/components/Footer';
import JsonLd from '@/components/JsonLd';
import ShareGround from '@/components/grounds/ShareGround';
import SuggestEdit from '@/components/grounds/SuggestEdit';
import { h2Style, bodyStyle, linkStyle } from '@/components/ToolLandingPage';
import { fitDescription, fitTitle, pageMetadata, SITE_URL } from '@/lib/seo';
import {
  GROUNDS_PATH, councilName, directionsUrl, factCount, groundCouncil, groundPath, groundQuestions, groundSchema, groundSummary,
  isIndexableGround, mapEmbedUrl, pitchAnchor, pitchSummary, suburbPath, type GroundFixture, type GroundRow,
} from '@/lib/grounds';
import { OSM_COPYRIGHT_URL } from '@/lib/ground-import';
import { clubsWithHomeGrounds, findGround, groundFixtures, groundUse, listGrounds } from '@/lib/supabase/grounds-lookup';

type Params = { params: Promise<{ suburb: string; ground: string }> };

async function load(suburb: string, slug: string) {
  const [grounds, clubs] = await Promise.all([listGrounds(), clubsWithHomeGrounds()]);
  const { ground, movedTo } = findGround(grounds, suburb, slug);
  const use = groundUse(clubs);
  return {
    ground,
    movedTo,
    clubsUsing: ground ? use.count.get(ground.id) || 0 : 0,
    homeClubs: ground ? use.listed.get(ground.id) || [] : [],
  };
}

const TIME_ZONES: Record<string, string> = {
  NSW: 'Australia/Sydney', ACT: 'Australia/Sydney', VIC: 'Australia/Melbourne', TAS: 'Australia/Hobart',
  QLD: 'Australia/Brisbane', SA: 'Australia/Adelaide', NT: 'Australia/Darwin', WA: 'Australia/Perth',
};

const dateLong = (iso: string) => new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Sydney' });

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { suburb, ground: slug } = await params;
  const { ground, clubsUsing, homeClubs } = await load(suburb, slug);
  if (!ground) {
    return pageMetadata({ title: 'Ground not found | itsfootball.club', description: 'This ground guide could not be found.', path: `${GROUNDS_PATH}/${suburb}/${slug}`, noIndex: true });
  }
  const wants = [ground.parking && 'Parking', (ground.pitches || []).length && 'Pitches', (ground.toilets || ground.canteen) && 'Toilets', 'Wet Weather']
    .filter(Boolean)
    .join(', ')
    .replace(/, ([^,]*)$/, ' & $1');
  return pageMetadata({
    title: fitTitle([`${ground.name}, ${ground.suburb}: ${wants}`, `${ground.name}: ${wants}`], 'itsfootball.club'),
    description: fitDescription(groundSummary(ground, homeClubs), 'How to check if it’s closed after rain, with directions and the council’s status page.'),
    path: groundPath(ground),
    noIndex: !isIndexableGround(ground, clubsUsing),
  });
}

function Fact({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="glass-panel" style={{ padding: '0.85rem 1.1rem', display: 'flex', alignItems: 'flex-start', gap: '0.9rem' }}>
      <span style={{ color: 'var(--club-primary)', marginTop: 2, flexShrink: 0 }} aria-hidden="true">{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 className="text-meta" style={{ margin: 0, fontSize: 'inherit' }}>{label}</h3>
        <div style={{ fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.5 }}>{children}</div>
      </div>
    </div>
  );
}

function FixtureRow({ f, timeZone }: { f: GroundFixture; timeZone: string }) {
  const d = new Date(f.date);
  const done = f.status === 'completed';
  const off = f.status === 'cancelled' || f.status === 'postponed';
  return (
    <Link href={`/${f.clubSlug}/match/${f.id}`} className="glass-panel" style={{ padding: '0.85rem 1.1rem', display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-primary)', textDecoration: 'none' }}>
      <div style={{ width: 96, flexShrink: 0 }}>
        <time dateTime={f.date} style={{ display: 'block', fontWeight: 800, fontSize: '0.88rem' }}>
          {d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', timeZone })}
        </time>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: done ? 'var(--club-ink)' : 'var(--text-muted)' }}>
          {off ? f.status[0].toUpperCase() + f.status.slice(1) : done ? 'Full time' : d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', timeZone })}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700 }}>{done && f.homeScore != null && f.awayScore != null ? `${f.home} ${f.homeScore}–${f.awayScore} ${f.away}` : `${f.home} v ${f.away}`}</div>
        {(f.competition || f.pitch) && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{[f.competition, f.pitch].filter(Boolean).join(' · ')}</div>}
      </div>
    </Link>
  );
}

export default async function GroundPage({ params }: Params) {
  const { suburb, ground: slug } = await params;
  const { ground, movedTo, homeClubs } = await load(suburb, slug);
  if (!ground && movedTo) permanentRedirect(groundPath(movedTo));
  if (!ground) notFound();
  const g: GroundRow = ground;

  const fixtures = await groundFixtures(g, homeClubs);
  const now = Date.now();
  const upcoming = fixtures.filter(f => Date.parse(f.date) >= now - 3 * 3600_000).reverse().slice(0, 6);
  const recent = fixtures.filter(f => Date.parse(f.date) < now - 3 * 3600_000).slice(0, 6);
  const council = groundCouncil(g);
  const cName = councilName(g);
  const questions = groundQuestions(g);
  const timeZone = TIME_ZONES[g.state] || 'Australia/Sydney';
  const url = `${SITE_URL}${groundPath(g)}`;
  const steward = homeClubs.find(c => c.id === g.steward_club_id);
  const address = [g.address, `${g.suburb} ${g.state}${g.postcode ? ` ${g.postcode}` : ''}`].filter(Boolean).join(', ');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <JsonLd data={groundSchema(g, homeClubs, [...upcoming, ...recent], questions)} />
      <PlatformNavbar />

      <main className="container" style={{ padding: '2.5rem 1rem', flex: 1, maxWidth: '960px' }}>
        <nav aria-label="Breadcrumb" className="tool-breadcrumb">
          <Link href={GROUNDS_PATH}>Grounds</Link><span aria-hidden="true">/</span>
          <Link href={suburbPath(g.suburb_slug)}>{g.suburb} {g.state}</Link><span aria-hidden="true">/</span>
          <span aria-current="page">{g.name}</span>
        </nav>

        <header style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div className="badge badge-primary" style={{ marginBottom: '0.75rem' }}>SOCCER GROUND · {g.suburb.toUpperCase()} {g.state}</div>
          <h1 style={{ fontSize: 'clamp(1.9rem, 5vw, 2.6rem)', fontWeight: 900, lineHeight: 1.1 }}>{g.name}, {g.suburb}</h1>
          <p style={{ ...bodyStyle, marginTop: '0.4rem' }}>Parking, pitches, toilets, canteen and wet weather</p>
          <p className="tool-updated">Facts last checked <time dateTime={g.facts_checked_at}>{dateLong(g.facts_checked_at)}</time></p>
        </header>

        <section className="glass-panel guide-answer" aria-labelledby="answer">
          <h2 id="answer">At a glance</h2>
          <p>{groundSummary(g, homeClubs)}</p>
        </section>

        <section className="glass-panel ground-status" aria-labelledby="status">
          <div style={{ flex: '1 1 300px', display: 'flex', gap: '0.9rem' }}>
            <CloudRain size={26} color="#F59E0B" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
            <div>
              <h2 id="status" style={{ fontSize: '1.1rem', fontWeight: 900, margin: 0 }}>Is {g.name} open today?</h2>
              <p style={{ ...bodyStyle, margin: '0.2rem 0 0', fontSize: '0.9rem' }}>
                {council ? council.note : `${cName || 'The council'} closes grounds after heavy rain. Your club or association will tell you if a match is off.`}
              </p>
            </div>
          </div>
          {council && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
              <a className="btn btn-primary" href={council.url} target="_blank" rel="noopener" style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                {council.kind === 'status' ? 'Council ground status' : 'Council sportsgrounds page'} <ExternalLink size={15} aria-hidden="true" />
              </a>
              {council.phone && (
                <a className="btn btn-outline" href={`tel:${council.phone.number.replace(/[^\d+]/g, '')}`} style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                  <Phone size={15} aria-hidden="true" /> {council.phone.number}
                </a>
              )}
            </div>
          )}
        </section>

        <div className="ground-grid" style={{ marginTop: '2rem' }}>
          <div className="glass-panel" style={{ overflow: 'hidden', borderRadius: 'var(--radius-xl)', minHeight: 330, position: 'relative' }}>
            <iframe
              title={`Map of ${g.name}, ${g.suburb}`}
              src={mapEmbedUrl(g)}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              style={{ border: 'none', position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            />
            <div style={{ position: 'absolute', left: 12, right: 12, bottom: 12, display: 'flex' }}>
              <a className="btn btn-primary" href={directionsUrl(g)} target="_blank" rel="noopener" style={{ flex: 1, display: 'inline-flex', gap: '0.4rem', alignItems: 'center', justifyContent: 'center' }}>
                <Navigation size={15} aria-hidden="true" /> Directions
              </a>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            <Fact icon={<MapPin size={20} />} label="Address">
              <address style={{ fontStyle: 'normal' }}>{address}</address>
              {cName && <span style={{ display: 'block', fontWeight: 500, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{cName}</span>}
            </Fact>
            {g.parking && <Fact icon={<Car size={20} />} label="Parking">{g.parking}</Fact>}
            {g.toilets && <Fact icon={<Toilet size={20} />} label="Toilets">{g.toilets}</Fact>}
            {g.canteen && <Fact icon={<Coffee size={20} />} label="Canteen">{g.canteen}</Fact>}
            {g.accessibility && <Fact icon={<Accessibility size={20} />} label="Accessibility">{g.accessibility}</Fact>}
            {g.notes && <Fact icon={<Info size={20} />} label="Good to know">{g.notes}</Fact>}
          </div>
        </div>

        {(g.pitches || []).length > 0 && (
          <section style={{ marginTop: '2.5rem' }} aria-labelledby="pitches">
            <h2 id="pitches" style={h2Style}>Pitches ({pitchSummary(g.pitches)})</h2>
            <ul className="tool-links" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(240px, 100%), 1fr))' }}>
              {(g.pitches || []).map(p => (
                <li key={p.label} id={pitchAnchor(p.label)}>
                  <div className="glass-panel tool-link" style={{ borderLeft: '3px solid var(--club-primary)' }}>
                    <strong>{p.label}</strong>
                    <span>{[p.surface, p.size, p.lights ? 'Lights' : ''].filter(Boolean).join(' · ') || 'Pitch'}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {homeClubs.length > 0 && (
          <section style={{ marginTop: '2.5rem' }} aria-labelledby="clubs">
            <h2 id="clubs" style={h2Style}>Clubs that play here</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {homeClubs.map(c => (
                <Link key={c.id} href={`/${c.slug}`} className="glass-panel" style={{ padding: '1rem 1.2rem', display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-primary)', textDecoration: 'none' }}>
                  {c.logo_url
                    ? <img src={c.logo_url} alt="" width={46} height={46} style={{ borderRadius: '50%', objectFit: 'cover', background: '#fff' }} />
                    : <span aria-hidden="true" style={{ width: 46, height: 46, borderRadius: '50%', background: c.primary_color || 'var(--club-primary)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: '0.8rem' }}>{c.short_name.slice(0, 4)}</span>}
                  <div style={{ flex: 1 }}>
                    <strong>{c.name}</strong>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Home ground</div>
                  </div>
                  <span style={linkStyle}>Club site</span>
                </Link>
              ))}
            </div>
            <p style={{ ...bodyStyle, fontSize: '0.82rem', marginTop: '0.6rem' }}>Only clubs that chose to be listed appear here. Junior teams and training are never shown.</p>
          </section>
        )}

        {(upcoming.length > 0 || recent.length > 0) && (
          <section style={{ marginTop: '2.5rem' }} aria-labelledby="fixtures">
            <h2 id="fixtures" style={h2Style}>Fixtures at {g.name}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {upcoming.map(f => <FixtureRow key={f.id} f={f} timeZone={timeZone} />)}
              {recent.length > 0 && upcoming.length > 0 && <h3 className="text-meta" style={{ marginTop: '0.6rem' }}>Recent results</h3>}
              {recent.map(f => <FixtureRow key={f.id} f={f} timeZone={timeZone} />)}
            </div>
          </section>
        )}

        <section className="glass-panel guide-cta" aria-labelledby="link-guide">
          <div>
            <h2 id="link-guide">Posting a fixture here?</h2>
            <p>Link away teams and parents to this guide so they know where to park and how to check if the ground is open.</p>
            <ShareGround url={url} fileName={`${g.slug}-${g.suburb_slug}`} />
          </div>
        </section>

        <section style={{ marginTop: '2.5rem' }} aria-labelledby="faq">
          <h2 id="faq" style={h2Style}>Questions</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {questions.map((i, n) => (
              <details key={i.q} className="glass-panel" style={{ padding: '1rem 1.25rem' }} open={n === 0}>
                <summary style={{ fontWeight: 700, cursor: 'pointer' }}>{i.q}</summary>
                <p style={{ ...bodyStyle, marginTop: '0.5rem' }}>{i.a}</p>
              </details>
            ))}
          </div>
        </section>

        <div style={{ marginTop: '2rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <span style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
            <Shield size={15} aria-hidden="true" /> {steward ? `Facts kept up to date by ${steward.name}` : g.steward_club_id ? 'Facts kept up to date by a local club' : 'Facts kept up to date by itsfootball.club'}
          </span>
          <SuggestEdit groundId={g.id} groundName={g.name} stewardName={steward?.name} />
        </div>
        {g.source === 'osm' && (
          <p style={{ ...bodyStyle, fontSize: '0.78rem', marginTop: '1rem' }}>
            Location and pitches © <a href={OSM_COPYRIGHT_URL} target="_blank" rel="noopener" style={linkStyle}>OpenStreetMap contributors</a> (ODbL).
          </p>
        )}
        {factCount(g) < 3 && (
          <p style={{ ...bodyStyle, fontSize: '0.82rem', marginTop: '1rem' }}>
            This guide is still being filled in. Club admins can add parking, pitches and facilities in Admin, Branding.
          </p>
        )}
      </main>
      <Footer />
    </div>
  );
}
