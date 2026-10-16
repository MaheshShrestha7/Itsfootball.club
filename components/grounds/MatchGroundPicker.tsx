'use client';

// The match form's "Ground guide" picker: links a fixture to a ground in the public grounds directory
// (matches.ground_id + pitch_label, migration 20261110) so the match page can show "Getting there"
// and the ground's guide lists the fixture. Shows nothing until that migration has run, so the form
// never sends columns the database doesn't have. The free-text venue stays the admin's to edit.
import { useEffect, useRef, useState } from 'react';
import { ExternalLink, MapPin, Search } from 'lucide-react';
import { getAccessToken } from '@/lib/supabase/client';
import { groundPath, type GroundRow } from '@/lib/grounds';

const FIND = '__find__';

async function get(query: string) {
  const token = await getAccessToken();
  const res = await fetch(`/api/admin/grounds${query}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).catch(() => null);
  return res?.ok ? res.json().catch(() => null) : null;
}

interface Props {
  clubId: string;
  groundId: string;
  pitch: string;
  /** A new home fixture: start on the club's home ground */
  preferHome: boolean;
  onChange: (ground: GroundRow | null, pitch: string) => void;
}

export default function MatchGroundPicker({ clubId, groundId, pitch, preferHome, onChange }: Props) {
  const [ready, setReady] = useState(false);
  const [options, setOptions] = useState<GroundRow[]>([]);
  const [homeId, setHomeId] = useState<string | null>(null);
  const [finding, setFinding] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<GroundRow[]>([]);
  const defaulted = useRef(false);

  useEffect(() => {
    let stale = false;
    get(`?clubId=${clubId}&venues=1${groundId ? `&include=${groundId}` : ''}`).then(data => {
      if (stale || !data?.ready) return;
      const list = [data.home, ...(data.recent || [])].filter(Boolean) as GroundRow[];
      setOptions(list);
      setHomeId(data.home?.id || null);
      setReady(true);
      if (preferHome && !groundId && data.home && !defaulted.current) {
        defaulted.current = true;
        onChange(data.home, '');
      }
    });
    return () => { stale = true; };
    // Loads once per form opening; the selection is the parent's state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId]);

  useEffect(() => {
    if (!finding || q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      const data = await get(`?clubId=${clubId}&venues=1&q=${encodeURIComponent(q.trim())}`);
      setResults(data?.results || []);
    }, 250);
    return () => clearTimeout(t);
  }, [q, finding, clubId]);

  if (!ready) return null;
  const selected = options.find(g => g.id === groundId) || null;
  const pick = (g: GroundRow | null, p = '') => {
    if (g && !options.some(o => o.id === g.id)) setOptions(list => [...list, g]);
    setFinding(false);
    setQ('');
    onChange(g, p);
  };

  return (
    <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '1rem' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" htmlFor="form-ground">Ground guide</label>
          <select id="form-ground" className="form-input" value={finding ? FIND : groundId}
            onChange={e => {
              if (e.target.value === FIND) { setFinding(true); return; }
              pick(options.find(g => g.id === e.target.value) || null);
            }}>
            <option value="">Not linked</option>
            {options.map(g => <option key={g.id} value={g.id}>{g.name}, {g.suburb}{g.id === homeId ? ' (home ground)' : ''}</option>)}
            <option value={FIND}>Find another ground…</option>
          </select>
        </div>
        {selected && (selected.pitches || []).length > 0 && (
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="form-pitch">Pitch</label>
            <select id="form-pitch" className="form-input" value={pitch} onChange={e => pick(selected, e.target.value)}>
              <option value="">Not set</option>
              {(selected.pitches || []).map(p => <option key={p.label} value={p.label}>{p.label}</option>)}
            </select>
          </div>
        )}
      </div>

      {finding && (
        <div>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--text-muted)' }} aria-hidden="true" />
            <input className="form-input" style={{ paddingLeft: 36 }} value={q} onChange={e => setQ(e.target.value)} placeholder="Ground name, suburb or postcode" aria-label="Find a ground" autoFocus
              onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }} />
          </div>
          {(results.length > 0 || q.trim().length >= 2) && (
            <div className="glass-panel" style={{ marginTop: '0.4rem', padding: '0.35rem', display: 'flex', flexDirection: 'column' }}>
              {results.map(r => (
                <button key={r.id} type="button" onClick={() => pick(r)}
                  style={{ textAlign: 'left', padding: '0.6rem 0.75rem', borderRadius: 10, display: 'flex', gap: '0.7rem', alignItems: 'center', background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}>
                  <MapPin size={16} color="var(--club-primary)" />
                  <span><strong style={{ color: 'var(--text-primary)' }}>{r.name}</strong> <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.suburb} {r.state}</span></span>
                </button>
              ))}
              {results.length === 0 && <p style={{ margin: 0, padding: '0.6rem 0.75rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>No ground guide yet. Leave it unlinked and type the venue below.</p>}
            </div>
          )}
          <button type="button" className="btn btn-outline" style={{ marginTop: '0.5rem', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => { setFinding(false); setQ(''); }}>Cancel</button>
        </div>
      )}

      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.45 }}>
        {selected ? (
          <>Players and away teams get directions, parking and the council&apos;s wet-weather link on the match page.{' '}
            <a href={groundPath(selected)} target="_blank" rel="noopener" style={{ color: 'var(--club-ink)', fontWeight: 600, display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }}>
              View guide <ExternalLink size={12} />
            </a>
          </>
        ) : 'Link the ground to show directions, parking and wet-weather info on the match page.'}
      </p>
    </div>
  );
}
