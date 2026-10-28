'use client';

// Mission Control -> Grounds: every ground in the public directory (drafts included), adding or
// editing one with no club, and "Import from map": find the soccer pitches in a council area on
// OpenStreetMap and add the ticked parks as drafts. Writes go through /api/platform/grounds.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check, CheckCircle2, Download, ExternalLink, Layers, Loader2, MapPin, Plus, RefreshCw, Search, ShieldCheck, Trash2, X,
} from 'lucide-react';
import { getAccessToken } from '@/lib/supabase/client';
import { COUNCILS, STATES, type AuState } from '@/lib/councils';
import { councilName, groundPath, mapEmbedUrl, parseLatLng, pitchSummary, slugify, type GroundRow, type Pitch } from '@/lib/grounds';
import { OSM_COPYRIGHT_URL, findExisting, pitchesLine, type Candidate } from '@/lib/ground-import';
import { councilAreas, findGroundsInCouncil } from '@/lib/ground-import-fetch';
import { confirmAction, notify } from '@/components/ConfirmDialog';

interface ListedGround extends GroundRow {
  source?: string | null;
  steward_name: string | null;
  clubs_using: number;
  indexable: boolean;
}

interface Area { code: string; name: string; listed: boolean }
interface FoundCouncil { code: string; name: string; key: string; councilName: string | null; state: string | null }
type Row = Candidate & { picked: boolean; unnamed: boolean };

type Filter = 'all' | 'drafts' | 'live' | 'noclub';
type View = 'all' | 'import' | 'edit';

const ACCENT = '#818CF8';
const muted: React.CSSProperties = { fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 };
const inline: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.4rem' };
const badge = (bg: string, color: string): React.CSSProperties => ({ background: bg, color, fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.04em' });
const SURFACES = ['Grass', 'Synthetic', 'Hybrid'];

async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`/api/platform/grounds${path}`, {
    method: init?.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `The server couldn’t do that (error ${res.status}). Try again.`);
  return json as T;
}

// ---------------------------------------------------------------------------------------------
// Add or edit a ground
// ---------------------------------------------------------------------------------------------

interface Form {
  name: string; suburb: string; state: string; postcode: string; address: string; pin: string;
  council_key: string; council_name: string; pitches: Pitch[];
  parking: string; toilets: string; canteen: string; accessibility: string; notes: string;
  published: boolean;
}

const toForm = (g: ListedGround | null): Form => ({
  name: g?.name || '', suburb: g?.suburb || '', state: g?.state || 'NSW', postcode: g?.postcode || '', address: g?.address || '',
  pin: g?.lat != null && g?.lng != null ? `${g.lat}, ${g.lng}` : '',
  council_key: g?.council_key || '', council_name: g?.council_name || '', pitches: g?.pitches || [],
  parking: g?.parking || '', toilets: g?.toilets || '', canteen: g?.canteen || '', accessibility: g?.accessibility || '', notes: g?.notes || '',
  published: g ? g.is_published : true,
});

function GroundForm({ ground, onDone, showToast }: { ground: ListedGround | null; onDone: (changed: boolean) => void; showToast: (m: string) => void }) {
  const [form, setForm] = useState<Form>(() => toForm(ground));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoCouncil, setAutoCouncil] = useState<string | null>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }));
  const pin = useMemo(() => parseLatLng(form.pin), [form.pin]);
  const councils = COUNCILS.filter(c => c.state === form.state);

  // Council from the map pin, unless one is already picked
  useEffect(() => {
    if (!pin || form.council_key) return;
    let live = true;
    api<{ council: { key: string; name: string } | null }>(`?lat=${pin.lat}&lng=${pin.lng}`)
      .then(({ council }) => {
        if (!live || !council) return;
        setForm(f => (f.council_key ? f : { ...f, council_key: council.key, council_name: council.key === 'other' ? council.name : '' }));
        setAutoCouncil(council.name);
      })
      .catch(() => null);
    return () => { live = false; };
  }, [pin, form.council_key]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const { published, ...facts } = form;
      await api('', { method: 'POST', body: { action: 'save', groundId: ground?.id, ground: facts, publish: published } });
      showToast(ground ? `✓ Saved ${form.name}` : `✓ Added ${form.name}`);
      onDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '1.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
        <div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0, ...inline }}>
            {ground ? <MapPin size={18} color={ACCENT} /> : <Plus size={18} color={ACCENT} />} {ground ? `Edit ${ground.name}` : 'Add a ground'}
          </h3>
          <p style={{ ...muted, marginTop: '0.3rem' }}>
            <ShieldCheck size={14} style={{ verticalAlign: '-2px', marginRight: '0.35rem' }} />
            Looked after by <strong style={{ color: 'var(--text-secondary)' }}>{ground?.steward_name || 'itsfootball.club'}</strong>.
            {!ground?.steward_club_id && ' The first club to pick it as its home ground takes it over.'}
          </p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => onDone(false)} aria-label="Close"><X size={16} /></button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0 1rem' }}>
        <div className="form-group">
          <label className="form-label" htmlFor="pg-name">Ground name *</label>
          <input id="pg-name" className="form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Craik Park" maxLength={120} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="pg-suburb">Suburb *</label>
          <input id="pg-suburb" className="form-input" value={form.suburb} onChange={e => set('suburb', e.target.value)} placeholder="e.g. Austral" maxLength={80} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="pg-state">State</label>
          <select id="pg-state" className="form-select" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value, council_key: '', council_name: '' }))}>
            {STATES.map(s => <option key={s.code} value={s.code}>{s.code}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="pg-postcode">Postcode</label>
          <input id="pg-postcode" className="form-input" value={form.postcode} onChange={e => set('postcode', e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="2179" />
        </div>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label" htmlFor="pg-address">Street address</label>
          <input id="pg-address" className="form-input" value={form.address} onChange={e => set('address', e.target.value)} placeholder="e.g. Fifteenth Avenue" maxLength={200} />
        </div>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label" htmlFor="pg-pin">Map pin</label>
          <input id="pg-pin" className="form-input" value={form.pin} onChange={e => set('pin', e.target.value)} placeholder="Paste a Google Maps link to the ground, or -33.93, 150.80" />
          {form.pin && !pin && <p style={{ ...muted, marginTop: '0.3rem' }}>No pin found in that yet.</p>}
          {pin && (
            <div style={{ height: 200, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-subtle)', marginTop: '0.5rem' }}>
              <iframe title="Pin preview" src={mapEmbedUrl({ lat: pin.lat, lng: pin.lng } as GroundRow)} style={{ border: 'none', width: '100%', height: '100%' }} loading="lazy" />
            </div>
          )}
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="pg-council">Council</label>
          <select id="pg-council" className="form-select" value={form.council_key} onChange={e => { setAutoCouncil(null); set('council_key', e.target.value); }}>
            <option value="">Pick the council</option>
            {councils.map(c => <option key={c.key} value={c.key}>{c.name}</option>)}
            <option value="other">Another council</option>
          </select>
          <p style={{ ...muted, marginTop: '0.3rem' }}>{autoCouncil ? `Found from the map pin: ${autoCouncil}.` : 'Filled in from the map pin.'}</p>
        </div>
        {form.council_key === 'other' && (
          <div className="form-group">
            <label className="form-label" htmlFor="pg-council-name">Council name</label>
            <input id="pg-council-name" className="form-input" value={form.council_name} onChange={e => set('council_name', e.target.value)} placeholder="e.g. Wollondilly council area" maxLength={120} />
          </div>
        )}

        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <span className="form-label">Pitches</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {form.pitches.map((p, i) => (
              <div key={i} className="ground-pitch-row" style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 1fr) minmax(110px, 1fr) minmax(130px, 1.4fr) auto auto', gap: '0.5rem', alignItems: 'center' }}>
                <input className="form-input" aria-label="Pitch name" value={p.label} placeholder="Pitch 1" maxLength={40}
                  onChange={e => set('pitches', form.pitches.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                <select className="form-select" aria-label="Surface" value={p.surface || ''}
                  onChange={e => set('pitches', form.pitches.map((x, j) => (j === i ? { ...x, surface: e.target.value } : x)))}>
                  <option value="">Surface</option>
                  {SURFACES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <input className="form-input" aria-label="Size" value={p.size || ''} placeholder="Full size, 9-a-side…" maxLength={60}
                  onChange={e => set('pitches', form.pitches.map((x, j) => (j === i ? { ...x, size: e.target.value } : x)))} />
                <label style={{ ...inline, fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  <input type="checkbox" checked={!!p.lights} onChange={e => set('pitches', form.pitches.map((x, j) => (j === i ? { ...x, lights: e.target.checked } : x)))} /> Lights
                </label>
                <button type="button" className="btn btn-secondary btn-sm" aria-label={`Remove ${p.label || 'pitch'}`}
                  onClick={() => set('pitches', form.pitches.filter((_, j) => j !== i))}><Trash2 size={15} /></button>
              </div>
            ))}
            <button type="button" className="btn btn-secondary btn-sm" style={{ ...inline, alignSelf: 'flex-start' }}
              onClick={() => set('pitches', [...form.pitches, { label: `Pitch ${form.pitches.length + 1}`, surface: 'Grass' }])}>
              <Plus size={15} /> Add a pitch
            </button>
          </div>
        </div>

        {([
          ['parking', 'Parking', 'e.g. Free car park next to the clubhouse, about 60 spaces.'],
          ['toilets', 'Toilets', 'e.g. Amenities block by Pitch 1, open on match days'],
          ['canteen', 'Canteen', 'e.g. Match days, run by the home club, card accepted'],
          ['accessibility', 'Accessibility', 'e.g. Accessible toilet; flat path from the car park to Pitch 1'],
          ['notes', 'Good to know', 'e.g. No dogs on the fields.'],
        ] as const).map(([k, label, ph]) => (
          <div key={k} className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label" htmlFor={`pg-${k}`}>{label}</label>
            <input id={`pg-${k}`} className="form-input" value={form[k]} onChange={e => set(k, e.target.value)} placeholder={ph} maxLength={k === 'notes' ? 600 : 400} />
          </div>
        ))}

        <label style={{ gridColumn: '1 / -1', ...inline, gap: '0.6rem', fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 700, marginBottom: '1rem' }}>
          <input type="checkbox" checked={form.published} onChange={e => set('published', e.target.checked)} />
          Show on the site
          <span style={{ ...muted, fontWeight: 400 }}>(Google only lists it once it has a pin, a council, 3 facts and a club using it)</span>
        </label>
      </div>

      {error && <p role="alert" style={{ ...muted, color: 'var(--c-red)', marginBottom: '0.75rem' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-primary" style={inline} onClick={save} disabled={busy}>
          {busy ? <Loader2 size={15} className="spin" /> : <CheckCircle2 size={15} />} {ground ? 'Save ground' : 'Add ground'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => onDone(false)}>Cancel</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Import from map
// ---------------------------------------------------------------------------------------------

function ImportPanel({ showToast, onImported }: { showToast: (m: string) => void; onImported: () => void }) {
  const [state, setState] = useState('NSW');
  const [areas, setAreas] = useState<Area[]>([]);
  const [areasError, setAreasError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [finding, setFinding] = useState(false);
  const [council, setCouncil] = useState<FoundCouncil | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [skipped, setSkipped] = useState<{ name: string; reason: string }[]>([]);

  useEffect(() => {
    let live = true;
    setAreas([]);
    setAreasError(null);
    setCode('');
    // The browser asks the ABS itself; the server is the fallback; the councils we list are the last resort
    councilAreas(state as AuState)
      .catch(() => api<{ areas: Area[] }>(`?areas=1&state=${state}`).then(r => r.areas))
      .catch(e => {
        if (live) setAreasError(`${(e as Error).message} Showing only the councils we already list.`);
        return COUNCILS.filter(c => c.state === state).map(c => ({ code: c.lgaCode, name: c.name, listed: true }));
      })
      .then(list => {
        if (!live) return;
        setAreas(list);
        setCode((list.find(a => a.listed) || list[0])?.code || '');
      });
    return () => { live = false; };
  }, [state]);

  const canTick = (r: Row) => !r.existing;
  const ready = (r: Row) => r.picked && !r.existing && r.name.trim().length >= 2 && r.suburb.trim().length >= 2;

  const find = async () => {
    if (!code) return;
    setFinding(true);
    setError(null);
    setRows(null);
    setSkipped([]);
    try {
      let res: { council: FoundCouncil; candidates: Candidate[] };
      try {
        // In the browser first: no Worker time or CPU limits, and the map services see a normal browser
        const [search, { grounds }] = await Promise.all([
          findGroundsInCouncil(code),
          api<{ grounds: Parameters<typeof findExisting>[1] }>('?match=1'),
        ]);
        res = { council: search.council, candidates: search.candidates.map(c => ({ ...c, existing: findExisting(c, grounds, slugify) })) };
      } catch (browserError) {
        try {
          res = await api<{ council: FoundCouncil; candidates: Candidate[] }>(`?find=${code}`);
        } catch (serverError) {
          throw new Error(`${(browserError as Error).message} (From the server too: ${(serverError as Error).message})`);
        }
      }
      setCouncil(res.council);
      setRows(res.candidates.map(c => ({ ...c, unnamed: !c.name, picked: !c.existing && !c.school && !c.private && !!c.name && !!c.suburb })));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setFinding(false);
    }
  };

  const update = (i: number, patch: Partial<Row>) => setRows(rs => (rs ? rs.map((r, j) => (j === i ? { ...r, ...patch } : r)) : rs));
  const picked = (rows || []).filter(ready);

  const add = async () => {
    if (!council || !picked.length) return;
    setAdding(true);
    setError(null);
    try {
      const res = await api<{ added: { id: string; name: string; ref: string }[]; skipped: { name: string; reason: string }[] }>('', {
        method: 'POST',
        body: {
          action: 'import',
          council: { key: council.key, councilName: council.councilName, state: council.state },
          items: picked.map(r => ({ ref: r.ref, name: r.name.trim(), suburb: r.suburb.trim(), postcode: r.postcode, lat: r.lat, lng: r.lng, pitches: r.pitches })),
        },
      });
      const byRef = new Map(res.added.map(a => [a.ref, a]));
      setRows(rs => (rs ? rs.map(r => {
        const a = byRef.get(r.ref);
        return a ? { ...r, picked: false, existing: { id: a.id, name: a.name } } : r;
      }) : rs));
      setSkipped(res.skipped);
      showToast(`✓ Added ${res.added.length} ${res.added.length === 1 ? 'ground' : 'grounds'} as drafts`);
      onImported();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdding(false);
    }
  };

  const listedCount = (rows || []).filter(r => r.existing).length;
  const unnamed = (rows || []).filter(r => !r.existing && !r.name).length;

  return (
    <>
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 0.3rem', ...inline }}>
          <Layers size={18} color={ACCENT} /> Find grounds in a council area
        </h3>
        <p style={{ ...muted, marginBottom: '1rem' }}>Looks up soccer pitches on OpenStreetMap and groups them by park. Nothing is added until you tick and confirm.</p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: '0 1 120px', margin: 0 }}>
            <label className="form-label" htmlFor="imp-state">State</label>
            <select id="imp-state" className="form-select" value={state} onChange={e => { setState(e.target.value); setRows(null); }}>
              {STATES.map(s => <option key={s.code} value={s.code}>{s.code}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ flex: '1 1 260px', margin: 0 }}>
            <label className="form-label" htmlFor="imp-council">Council area</label>
            <select id="imp-council" className="form-select" value={code} onChange={e => { setCode(e.target.value); setRows(null); }} disabled={!areas.length}>
              {!areas.length && <option value="">{areasError ? 'Couldn’t load councils' : 'Loading councils…'}</option>}
              {areas.some(a => a.listed) && (
                <optgroup label="Councils with wet-weather links">
                  {areas.filter(a => a.listed).map(a => <option key={a.code} value={a.code}>{a.name}</option>)}
                </optgroup>
              )}
              <optgroup label="All council areas">
                {areas.filter(a => !a.listed).map(a => <option key={a.code} value={a.code}>{a.name}</option>)}
              </optgroup>
            </select>
          </div>
          <button type="button" className="btn btn-primary" style={inline} onClick={find} disabled={!code || finding}>
            {finding ? <Loader2 size={16} className="spin" /> : <Search size={16} />} {finding ? 'Searching the map…' : 'Find grounds'}
          </button>
        </div>
        {areasError && <p role="alert" style={{ ...muted, color: 'var(--c-red)', marginTop: '0.75rem' }}>{areasError}</p>}
        {error && <p role="alert" style={{ ...muted, color: 'var(--c-red)', marginTop: '0.75rem' }}>{error}</p>}
      </div>

      {rows && council && (
        <div className="glass-panel" style={{ padding: '0.4rem' }}>
          <div style={{ padding: '0.9rem', display: 'flex', justifyContent: 'space-between', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>
                {rows.length ? `${rows.length} ${rows.length === 1 ? 'park' : 'parks'} with soccer pitches in ${council.name}` : `No soccer pitches mapped in ${council.name} yet`}
              </strong>
              {rows.length > 0 && (
                <p style={muted}>
                  {[listedCount ? `${listedCount} already in the directory.` : '', unnamed ? `${unnamed} ${unnamed === 1 ? 'has' : 'have'} no name on the map, so type one before adding it.` : ''].filter(Boolean).join(' ') || 'Untick any you don’t want.'}
                </p>
              )}
            </div>
            {rows.some(canTick) && (
              <button type="button" className="btn btn-secondary btn-sm" style={{ ...inline, color: ACCENT }}
                onClick={() => setRows(rs => (rs ? rs.map(r => (canTick(r) && r.name && r.suburb && !r.school && !r.private ? { ...r, picked: true } : r)) : rs))}>
                <CheckCircle2 size={15} /> Select all new
              </button>
            )}
          </div>
          {rows.map((r, i) => {
            const off = !!r.existing;
            return (
              <div key={r.ref} style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', padding: '0.75rem 0.9rem', borderTop: '1px solid var(--border-subtle)', opacity: off ? 0.55 : 1 }}>
                <input type="checkbox" aria-label={`Add ${r.name || 'this ground'}`} checked={r.picked && !off} disabled={off}
                  onChange={e => update(i, { picked: e.target.checked })} style={{ width: 20, height: 20, accentColor: '#6366F1', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  {r.unnamed && !off
                    ? (
                      <div style={{ ...inline, flexWrap: 'wrap' }}>
                        <input className="form-input" style={{ padding: '0.4rem 0.6rem', fontSize: '0.9rem', maxWidth: 320 }} placeholder="Name this ground" value={r.name}
                          onChange={e => update(i, { name: e.target.value, picked: true })} maxLength={120} />
                        {r.school && <span className="badge" style={badge('rgba(245, 158, 11, 0.15)', 'var(--c-amber)')}>SCHOOL GROUNDS</span>}
                        {r.private && <span className="badge" style={badge('rgba(245, 158, 11, 0.15)', 'var(--c-amber)')}>PRIVATE</span>}
                      </div>
                    )
                    : (
                      <div style={{ ...inline, flexWrap: 'wrap', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {r.name}
                        {r.existing && <span className="badge" style={badge('rgba(var(--tint-rgb), 0.08)', 'var(--text-secondary)')}>{r.existing.name === r.name ? 'ALREADY LISTED' : `LISTED AS ${r.existing.name.toUpperCase()}`}</span>}
                        {!r.existing && r.school && <span className="badge" style={badge('rgba(245, 158, 11, 0.15)', 'var(--c-amber)')}>SCHOOL GROUNDS</span>}
                        {!r.existing && r.private && <span className="badge" style={badge('rgba(245, 158, 11, 0.15)', 'var(--c-amber)')}>PRIVATE</span>}
                      </div>
                    )}
                  <div style={{ ...muted, display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.15rem' }}>
                    {r.suburb || off
                      ? <span>{r.suburb} {council.state} {r.postcode}</span>
                      : <input className="form-input" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', maxWidth: 180 }} placeholder="Suburb" value={r.suburb}
                          onChange={e => update(i, { suburb: e.target.value })} maxLength={80} />}
                    <span>· {pitchesLine(r.pitches)}</span>
                  </div>
                </div>
                <a href={`https://www.openstreetmap.org/?mlat=${r.lat}&mlon=${r.lng}#map=18/${r.lat}/${r.lng}`} target="_blank" rel="noopener"
                  style={{ ...inline, fontSize: '0.78rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                  <MapPin size={14} /> Map
                </a>
              </div>
            );
          })}
          {rows.length > 0 && (
            <div style={{ padding: '1rem 0.9rem 0.8rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ ...muted, flex: '1 1 300px' }}>
                They go in as <strong style={{ color: 'var(--text-secondary)' }}>drafts</strong>: not public until you publish them, and kept out of Google until a club plays there and they have three facts like parking or toilets.
              </p>
              <button type="button" className="btn btn-primary" style={inline} onClick={add} disabled={!picked.length || adding}>
                {adding ? <Loader2 size={16} className="spin" /> : <Download size={16} />} Add {picked.length} {picked.length === 1 ? 'ground' : 'grounds'} as drafts
              </button>
            </div>
          )}
          {skipped.length > 0 && (
            <div style={{ padding: '0 0.9rem 0.8rem' }}>
              <p style={{ ...muted, color: 'var(--c-amber)' }}>Not added: {skipped.map(s => `${s.name} (${s.reason})`).join('; ')}</p>
            </div>
          )}
          <p style={{ ...muted, fontSize: '0.72rem', padding: '0 0.9rem 0.7rem' }}>
            Map data © <a href={OSM_COPYRIGHT_URL} target="_blank" rel="noopener" style={{ color: 'inherit', textDecoration: 'underline' }}>OpenStreetMap contributors</a> (ODbL). Suburbs, postcodes and council areas from ABS boundaries (CC BY 4.0).
          </p>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// The tab
// ---------------------------------------------------------------------------------------------

export default function GroundsTab({ showToast }: { showToast: (msg: string) => void }) {
  const [view, setView] = useState<View>('all');
  const [editing, setEditing] = useState<ListedGround | null>(null);
  const [grounds, setGrounds] = useState<ListedGround[]>([]);
  const [migrated, setMigrated] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ grounds: ListedGround[]; migrated: boolean }>('');
      setGrounds(res.grounds);
      setMigrated(res.migrated);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = {
    all: grounds.length,
    drafts: grounds.filter(g => !g.is_published).length,
    live: grounds.filter(g => g.is_published).length,
    noclub: grounds.filter(g => !g.steward_club_id).length,
  };
  const needle = q.trim().toLowerCase();
  const shown = grounds.filter(g =>
    (filter === 'all' || (filter === 'drafts' && !g.is_published) || (filter === 'live' && g.is_published) || (filter === 'noclub' && !g.steward_club_id)) &&
    (!needle || [g.name, g.suburb, g.postcode || '', councilName(g)].some(s => s.toLowerCase().includes(needle)))
  );

  const act = async (g: ListedGround, action: 'publish' | 'unpublish' | 'delete') => {
    if (action === 'delete' && !(await confirmAction({ title: `Delete the draft ${g.name}?`, message: 'This can’t be undone.', confirmLabel: 'Delete', danger: true }))) return;
    setBusyId(g.id);
    try {
      await api('', { method: 'POST', body: action === 'delete' ? { action, id: g.id } : { action: 'publish', id: g.id, published: action === 'publish' } });
      showToast(action === 'publish' ? `✓ ${g.name} is live` : action === 'unpublish' ? `✓ ${g.name} taken down` : `✓ Deleted ${g.name}`);
      await load();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  // Grounds per council for the side panel, biggest first
  const byCouncil = Object.entries(
    grounds.reduce<Record<string, number>>((acc, g) => {
      const c = councilName(g) || 'No council yet';
      acc[c] = (acc[c] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);
  const councilMax = Math.max(1, ...byCouncil.map(([, c]) => c));
  const COUNCIL_TINTS = [
    ['var(--mc-mint)', 'var(--mc-green-ink)', '#10B981'],
    ['var(--mc-lilac)', 'var(--mc-indigo)', '#818CF8'],
    ['var(--mc-pink)', 'var(--mc-pink-ink)', '#F472B6'],
    ['var(--mc-sky)', 'var(--mc-sky-ink)', '#60A5FA'],
  ];

  const surfaceClass = (g: ListedGround) => {
    if (!g.is_published) return 'draft';
    const s = (g.pitches || []).map(p => (p.surface || '').toLowerCase());
    return s.length && s.every(x => x === 'synthetic') ? 'syn' : '';
  };

  return (
    <div>
      <div className="mc-page-h">
        <div>
          <h1>Grounds</h1>
          <p>Every ground in the public directory, with or without a club.</p>
        </div>
        <div className="right">
          <span className="mc-seg" role="group" aria-label="Grounds view">
            <button type="button" aria-pressed={view === 'all'} onClick={() => { setView('all'); setEditing(null); }}>All grounds</button>
            <button type="button" aria-pressed={view === 'import'} onClick={() => { setView('import'); setEditing(null); }}>Import from map</button>
          </span>
          <button type="button" className="mc-pill-btn" onClick={() => { setEditing(null); setView('edit'); }}>
            <Plus size={14} /> Add a ground
          </button>
          <a href="/grounds" target="_blank" rel="noopener" className="mc-icon-btn" aria-label="Open the public directory" title="Open the public directory">
            <ExternalLink size={14} />
          </a>
        </div>
      </div>

      {!migrated && (
        <p className="mc-card" style={{ ...muted, marginBottom: '1rem', color: 'var(--mc-amber)' }}>
          Run the 20261114_grounds_platform.sql database migration before importing from the map.
        </p>
      )}

      {view === 'edit' && (
        <GroundForm key={editing?.id || 'new'} ground={editing} showToast={showToast}
          onDone={changed => { setView('all'); setEditing(null); if (changed) load(); }} />
      )}

      {view === 'import' && <ImportPanel showToast={showToast} onImported={load} />}

      {view === 'all' && (
        <div className="mc-wrap">
          <div>
            <div className="mc-toolbar">
              <label className="mc-search">
                <Search size={15} aria-hidden="true" />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Ground, suburb, postcode or council" aria-label="Search grounds" />
              </label>
              <span className="mc-seg" role="group" aria-label="Filter grounds">
                {([['all', 'All'], ['drafts', 'Drafts'], ['live', 'Live'], ['noclub', 'No club']] as const).map(([f, label]) => (
                  <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>{label} {counts[f]}</button>
                ))}
              </span>
              <button type="button" className="mc-icon-btn" onClick={load} disabled={loading} aria-label="Refresh">
                <RefreshCw size={14} className={loading ? 'spin' : ''} />
              </button>
            </div>

            {error && <p role="alert" style={{ ...muted, color: 'var(--mc-red)', marginBottom: '0.75rem' }}>{error}</p>}

            {loading && !grounds.length && <div className="mc-card mc-empty" style={inline}><Loader2 size={15} className="spin" /> Loading grounds…</div>}
            {!loading && !shown.length && (
              <div className="mc-card mc-empty">
                {grounds.length ? 'No grounds match.' : 'No grounds yet. Add one, or import a council area from the map.'}
              </div>
            )}

            {shown.length > 0 && (
              <div className="mc-grid">
                {shown.map(g => (
                  <div key={g.id} className="mc-card mc-gcard mc-lift">
                    <button type="button" className={`top mc-pitch ${surfaceClass(g)}`} onClick={() => { setEditing(g); setView('edit'); }} aria-label={`Edit ${g.name}`}>
                      <span className="mid" />
                      <span className={`st${g.is_published ? '' : ' draft'}`}>{g.is_published ? (g.indexable ? 'Live · in Google' : 'Live') : 'Draft'}</span>
                    </button>
                    <h3><button type="button" onClick={() => { setEditing(g); setView('edit'); }}>{g.name}</button></h3>
                    <div className="meta">
                      {[`${g.suburb} ${g.state}${g.postcode ? ` ${g.postcode}` : ''}`, councilName(g)].filter(Boolean).join(' · ')}
                    </div>
                    <div className="meta" style={{ marginTop: 4 }}>
                      Looked after by {g.steward_name || 'itsfootball.club'}
                      {g.clubs_using > 0 && <> · home of {g.clubs_using} {g.clubs_using === 1 ? 'club' : 'clubs'}</>}
                    </div>
                    <div className="flags">
                      <span className={`mc-flag${(g.pitches || []).length ? ' ok' : ' warn'}`}>{(g.pitches || []).length ? pitchSummary(g.pitches) : 'No pitches yet'}</span>
                      {g.is_published && !g.indexable && <span className="mc-flag">Not in Google yet</span>}
                      {g.source === 'osm' && <span className="mc-flag info">From OpenStreetMap</span>}
                    </div>
                    <div className="acts">
                      {!g.is_published && (
                        <button type="button" className="mc-pill-btn ok" disabled={busyId === g.id} onClick={() => act(g, 'publish')}>
                          {busyId === g.id ? <Loader2 size={12} className="spin" /> : <Check size={12} />} Publish
                        </button>
                      )}
                      <button type="button" className="mc-pill-btn soft" onClick={() => { setEditing(g); setView('edit'); }}>Edit</button>
                      {g.is_published
                        ? (
                          <>
                            <a className="mc-icon-btn" href={groundPath(g)} target="_blank" rel="noopener" aria-label={`Open ${g.name}`} title="Open the ground page"><ExternalLink size={13} /></a>
                            <button type="button" className="mc-pill-btn ghost" disabled={busyId === g.id} onClick={() => act(g, 'unpublish')}>Take down</button>
                          </>
                        )
                        : (
                          <button type="button" className="mc-icon-btn" style={{ color: 'var(--mc-red)' }} aria-label={`Delete ${g.name}`} title="Delete draft" disabled={busyId === g.id} onClick={() => act(g, 'delete')}>
                            <Trash2 size={13} />
                          </button>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mc-card">
            <div className="mc-card-h"><h3>By council</h3><span className="mc-eyebrow num">{grounds.length} grounds</span></div>
            {byCouncil.length === 0 ? (
              <p className="mc-muted">No grounds yet.</p>
            ) : (
              <div className="mc-coll">
                {byCouncil.slice(0, 8).map(([name, count], idx) => {
                  const [bg, color, bar] = COUNCIL_TINTS[idx % COUNCIL_TINTS.length];
                  return (
                    <button key={name} type="button" className="mc-coll-row" aria-pressed={needle === name.toLowerCase()} onClick={() => setQ(needle === name.toLowerCase() || name === 'No council yet' ? '' : name)}>
                      <span className="mc-sq" style={{ background: bg, color }}><MapPin size={14} /></span>
                      <div>
                        <b>{name}</b>
                        <div className="mc-track"><span style={{ width: `${Math.round((count / councilMax) * 100)}%`, background: bar }} /></div>
                      </div>
                      <em className="num">{count}</em>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="mc-dark-cta">
              <b>Import from map</b>
              <p>Find the soccer pitches in a council area on OpenStreetMap. Nothing is added until you tick and confirm.</p>
              <button type="button" className="mc-pill-btn" onClick={() => setView('import')}>
                <Layers size={14} /> Pick the council
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
