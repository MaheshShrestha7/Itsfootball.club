'use client';

// "Getting there" on a match page: directions, parking, toilets and the council's wet-weather link,
// from the fixture's ground guide (/grounds/{suburb}/{ground}). Uses the ground the match form linked,
// else the club's home ground when the venue names it. Shows nothing when there is no guide (or
// before the grounds migrations have run), so match pages look exactly as before.
import { useEffect, useState } from 'react';
import { Car, CloudRain, Coffee, ExternalLink, MapPin, Navigation, Phone, Toilet } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { councilName, directionsUrl, groundCouncil, groundForMatch, groundPath, pitchAnchor, type GroundRow } from '@/lib/grounds';

const COLUMNS =
  'id,steward_club_id,name,slug,suburb,suburb_slug,state,postcode,address,lat,lng,council_key,council_name,pitches,parking,toilets,canteen,accessibility,notes,is_published,previous_paths,facts_checked_at,updated_at';

interface MatchLike { club_id: string; ground_id?: string | null; pitch_label?: string | null; is_club_home: boolean; venue?: string | null }

export default function GettingThere({ match }: { match: MatchLike }) {
  const [ground, setGround] = useState<GroundRow | null>(null);

  useEffect(() => {
    const db = getSupabaseClient();
    if (!db) return;
    let stale = false;
    (async () => {
      let linked: GroundRow | null = null;
      let home: GroundRow | null = null;
      if (match.ground_id) {
        const { data } = await db.from('grounds').select(COLUMNS).eq('id', match.ground_id).maybeSingle();
        linked = (data as GroundRow | null) || null;
      } else if (match.is_club_home) {
        const { data: club, error } = await db.from('clubs').select('home_ground_id').eq('id', match.club_id).maybeSingle();
        if (!error && club?.home_ground_id) {
          const { data } = await db.from('grounds').select(COLUMNS).eq('id', club.home_ground_id).maybeSingle();
          home = (data as GroundRow | null) || null;
        }
      }
      if (!stale) setGround(groundForMatch(match, linked, home));
    })().catch(() => {});
    return () => { stale = true; };
  }, [match.ground_id, match.club_id, match.is_club_home, match.venue]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ground) return null;
  const council = groundCouncil(ground);
  const pitch = match.pitch_label && (ground.pitches || []).some(p => p.label === match.pitch_label) ? match.pitch_label : null;
  const guide = `${groundPath(ground)}${pitch ? `#${pitchAnchor(pitch)}` : ''}`;
  const facts = [
    ground.parking && { icon: <Car size={16} />, label: 'Parking', text: ground.parking },
    ground.toilets && { icon: <Toilet size={16} />, label: 'Toilets', text: ground.toilets },
    ground.canteen && { icon: <Coffee size={16} />, label: 'Canteen', text: ground.canteen },
  ].filter(Boolean) as { icon: React.ReactNode; label: string; text: string }[];
  const btn: React.CSSProperties = { display: 'inline-flex', gap: '0.4rem', alignItems: 'center', justifyContent: 'center' };

  return (
    <section className="glass-panel" aria-labelledby="getting-there"
      style={{ padding: '1.5rem', marginBottom: '2rem', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-medium)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
        <MapPin size={22} color="var(--club-primary)" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
        <div style={{ minWidth: 0 }}>
          <h2 id="getting-there" style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Getting there</h2>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>{ground.name}{pitch ? `, ${pitch}` : ''}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {[ground.address, `${ground.suburb} ${ground.state}`].filter(Boolean).join(', ')}{councilName(ground) ? ` · ${councilName(ground)}` : ''}
          </div>
        </div>
      </div>

      {facts.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '0.6rem' }}>
          {facts.map(f => (
            <div key={f.label} style={{ display: 'flex', gap: '0.6rem', padding: '0.65rem 0.8rem', borderRadius: 10, background: 'rgba(var(--tint-rgb), 0.04)' }}>
              <span style={{ color: 'var(--club-primary)', flexShrink: 0, marginTop: 2 }} aria-hidden="true">{f.icon}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{f.label}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.45, overflowWrap: 'anywhere' }}>{f.text}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
        <a className="btn btn-primary" href={directionsUrl(ground)} target="_blank" rel="noopener" style={btn}>
          <Navigation size={15} aria-hidden="true" /> Directions
        </a>
        {council && (
          <a className="btn btn-outline" href={council.url} target="_blank" rel="noopener" style={btn}>
            <CloudRain size={15} aria-hidden="true" /> {council.kind === 'status' ? 'Is it open? Council status' : 'Council wet weather'}
          </a>
        )}
        {council?.phone && (
          <a className="btn btn-outline" href={`tel:${council.phone.number.replace(/[^\d+]/g, '')}`} style={btn}>
            <Phone size={15} aria-hidden="true" /> {council.phone.number}
          </a>
        )}
        <a className="btn btn-outline" href={guide} style={btn}>
          Ground guide <ExternalLink size={14} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
