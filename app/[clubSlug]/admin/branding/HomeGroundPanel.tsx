'use client';

// The club's home ground in the public grounds directory (/grounds/{suburb}/{ground}), saved on its own
// through /api/admin/grounds (not with the branding form). Ground facts are public once saved; the
// switch decides whether the club's name and senior fixtures appear on ground pages.
// Sits inside the branding <form>, so every button is type="button" and Enter doesn't submit.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, CheckCircle2, Circle, ExternalLink, MapPin, MessageSquare, Plus, Search, Trash2, Loader2, X } from 'lucide-react';
import { getAccessToken } from '@/lib/supabase/client';
import { COUNCILS, STATES } from '@/lib/councils';
import {
  MIN_INDEXABLE_FACTS, SUGGESTION_TOPICS, councilName, factCount, groundPath, mapEmbedUrl, parseLatLng, type GroundRow, type Pitch,
} from '@/lib/grounds';
import type { Club } from '@/lib/supabase/types';

interface Suggestion { id: string; ground_name?: string; topic: string; message: string; contact: string | null; created_at: string }

interface Form {
  name: string; suburb: string; state: string; postcode: string; address: string; pin: string;
  council_key: string; council_name: string; pitches: Pitch[];
  parking: string; toilets: string; canteen: string; accessibility: string; notes: string;
}

const SURFACES = ['Grass', 'Synthetic', 'Hybrid'];

const fromGround = (g: GroundRow): Form => ({
  name: g.name, suburb: g.suburb, state: g.state, postcode: g.postcode || '', address: g.address || '',
  pin: g.lat != null && g.lng != null ? `${g.lat}, ${g.lng}` : '',
  council_key: g.council_key || '', council_name: g.council_name || '', pitches: g.pitches || [],
  parking: g.parking || '', toilets: g.toilets || '', canteen: g.canteen || '', accessibility: g.accessibility || '', notes: g.notes || '',
});

const fromClub = (club: Club): Form => ({
  name: club.stadium_name || '', suburb: '', state: 'NSW', postcode: '', address: club.stadium_address || '',
  pin: club.stadium_lat != null && club.stadium_lng != null ? `${club.stadium_lat}, ${club.stadium_lng}` : '',
  council_key: '', council_name: '', pitches: [],
  parking: club.stadium_parking_info || '', toilets: '', canteen: '', accessibility: '', notes: '',
});

const hint: React.CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem', lineHeight: 1.45 };
const smallBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.4rem' };

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className="touch-target"
      style={{ flexShrink: 0, width: 48, height: 28, borderRadius: 999, border: '1px solid var(--border-medium)', background: checked ? 'var(--club-primary)' : 'rgba(var(--tint-rgb), 0.1)', position: 'relative', cursor: 'pointer', transition: 'background-color 0.2s ease' }}>
      <span style={{ position: 'absolute', top: 3, left: checked ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s ease' }} />
    </button>
  );
}

async function api(method: 'GET' | 'POST', body?: object, query = '') {
  const token = await getAccessToken();
  const res = await fetch(`/api/admin/grounds${query}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => null);
  const data = res ? await res.json().catch(() => ({})) : {};
  return { ok: !!res?.ok, status: res?.status || 0, data, error: res ? data.error : 'Network error. Check your connection.' };
}

export default function HomeGroundPanel({ club }: { club: Club }) {
  const [loading, setLoading] = useState(true);
  const [migrated, setMigrated] = useState(true);
  const [ground, setGround] = useState<GroundRow | null>(null);
  const [steward, setSteward] = useState(false);
  const [listed, setListed] = useState(false);
  const [mode, setMode] = useState<'view' | 'pick' | 'edit'>('view');
  const [form, setForm] = useState<Form>(() => fromClub(club));
  const [q, setQ] = useState('');
  const [results, setResults] = useState<GroundRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const r = await api('GET', undefined, `?clubId=${club.id}`);
    if (r.ok) {
      setMigrated(r.data.migrated !== false);
      setGround(r.data.ground || null);
      setSteward(!!r.data.steward);
      setListed(!!r.data.listed);
      if (r.data.ground) setForm(fromGround(r.data.ground));
    } else if (r.status !== 401 && r.status !== 403) {
      setMessage({ ok: false, text: r.error || 'Could not load the home ground.' });
    }
    setLoading(false);
  }, [club.id]);

  useEffect(() => { load(); }, [load]);

  // Visitors' "Suggest an edit" messages for the grounds this club looks after
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  useEffect(() => {
    if (!steward) { setSuggestions([]); return; }
    api('GET', undefined, `?clubId=${club.id}&suggestions=1`).then(r => setSuggestions(r.ok ? r.data.suggestions || [] : []));
  }, [steward, club.id]);
  const closeSuggestion = async (id: string, status: 'done' | 'dismissed') => {
    const r = await api('POST', { clubId: club.id, action: 'suggestion', id, status });
    if (r.ok) setSuggestions(list => list.filter(x => x.id !== id));
    else setMessage({ ok: false, text: r.error || 'Could not update the suggestion.' });
  };

  // Search existing grounds as the admin types (so two clubs sharing a park don't add it twice)
  useEffect(() => {
    if (mode !== 'pick' || q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      const r = await api('GET', undefined, `?clubId=${club.id}&q=${encodeURIComponent(q.trim())}`);
      setResults(r.ok ? r.data.results || [] : []);
    }, 250);
    return () => clearTimeout(t);
  }, [q, mode, club.id]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }));
  const pin = useMemo(() => parseLatLng(form.pin), [form.pin]);
  // The council the pin is in (ABS boundaries), filled in unless the admin picked one themselves
  const [autoCouncil, setAutoCouncil] = useState<string | null>(null);
  const [councilPicked, setCouncilPicked] = useState(false);
  const [pinTouched, setPinTouched] = useState(false);
  useEffect(() => {
    // A saved ground keeps its council until the pin is moved
    if (mode !== 'edit' || !pin || councilPicked || (form.council_key && !pinTouched)) return;
    let stale = false;
    const t = setTimeout(async () => {
      const r = await api('GET', undefined, `?clubId=${club.id}&lat=${pin.lat}&lng=${pin.lng}`);
      const c = r.ok ? r.data.council : null;
      if (stale || !c) return;
      setForm(f => ({ ...f, state: c.state || f.state, council_key: c.key, council_name: c.key === 'other' ? c.name : '' }));
      setAutoCouncil(c.name);
    }, 400);
    return () => { stale = true; clearTimeout(t); };
  }, [pin?.lat, pin?.lng, mode, councilPicked, pinTouched, club.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const councils = COUNCILS.filter(c => c.state === form.state);

  const save = async (groundId?: string) => {
    setBusy(true);
    setMessage(null);
    const r = await api('POST', { clubId: club.id, action: 'save', groundId: groundId ?? (steward ? ground?.id : undefined), ground: form, listed });
    setBusy(false);
    if (!r.ok) {
      if (r.status === 409 && r.data.existing) {
        setMode('pick');
        setQ(r.data.existing.name);
      }
      setMessage({ ok: false, text: r.error || 'Could not save.' });
      return;
    }
    setGround(r.data.ground);
    setSteward(!!r.data.steward);
    setForm(fromGround(r.data.ground));
    setMode('view');
    setMessage({ ok: true, text: 'Saved. The ground guide is live.' });
  };

  const toggleListed = async (v: boolean) => {
    setListed(v);
    if (!ground) return;
    const r = await api('POST', { clubId: club.id, action: 'listed', listed: v });
    if (!r.ok) { setListed(!v); setMessage({ ok: false, text: r.error || 'Could not save.' }); }
  };

  const unlink = async () => {
    if (!window.confirm('Remove this ground as your home ground? The ground guide stays in the directory.')) return;
    setBusy(true);
    const r = await api('POST', { clubId: club.id, action: 'unlink' });
    setBusy(false);
    if (r.ok) { setGround(null); setSteward(false); setForm(fromClub(club)); setMode('view'); }
    else setMessage({ ok: false, text: r.error || 'Could not save.' });
  };

  const checks = ground ? [
    { done: ground.lat != null && ground.lng != null, text: 'Map pin' },
    { done: !!councilName(ground), text: 'Council (for the wet-weather link)' },
    { done: factCount(ground) >= MIN_INDEXABLE_FACTS, text: `At least ${MIN_INDEXABLE_FACTS} of: pitches, parking, toilets, canteen, accessibility (${factCount(ground)} so far)` },
  ] : [];
  const live = ground ? groundPath(ground) : '';

  return (
    <div className="glass-panel" style={{ padding: '2rem' }}
      onKeyDown={e => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') e.preventDefault(); }}>
      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <MapPin size={20} color="var(--club-primary)" /> Public Ground Guide
      </h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: '1.25rem' }}>
        A free page in the <a href="/grounds" target="_blank" rel="noopener" style={{ color: 'var(--club-ink)', fontWeight: 600 }}>grounds directory</a> that
        tells away teams and parents where to park, which pitch, toilets and canteen, and how to check if the ground is closed after rain.
        Ground facts are public once saved. Saved on its own, not with the button at the bottom.
      </p>

      {loading && <p style={hint}><Loader2 size={14} className="spin" /> Loading…</p>}
      {!loading && !migrated && <p style={{ ...hint, color: 'var(--c-amber)' }}>The grounds directory isn&apos;t switched on yet (database migration 20261109_grounds.sql).</p>}

      {!loading && migrated && mode === 'view' && !ground && (
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary" style={smallBtn} onClick={() => { setMode('pick'); setQ(form.name); }}>
            <Plus size={16} /> Add your home ground
          </button>
        </div>
      )}

      {!loading && migrated && mode === 'view' && ground && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <strong style={{ color: 'var(--text-primary)', fontSize: '1.05rem' }}>{ground.name}, {ground.suburb} {ground.state}</strong>
            <a href={live} target="_blank" rel="noopener" style={{ ...smallBtn, color: 'var(--club-ink)', fontWeight: 600, fontSize: '0.85rem' }}>
              itsfootball.club{live} <ExternalLink size={14} />
            </a>
          </div>
          {steward ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem' }}>
              <li style={{ color: 'var(--text-muted)' }}>To show in Google and AI search, the guide needs:</li>
              {checks.map(c => (
                <li key={c.text} style={{ ...smallBtn, color: c.done ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {c.done ? <CheckCircle2 size={16} color="var(--c-green)" /> : <Circle size={16} />} {c.text}
                </li>
              ))}
            </ul>
          ) : (
            <p style={hint}>Another club looks after this ground&apos;s facts. Spotted something wrong? Use &quot;Suggest an edit&quot; on the guide.</p>
          )}
          {steward && suggestions.length > 0 && (
            <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', borderLeft: '3px solid var(--c-amber)' }}>
              <strong style={{ ...smallBtn, color: 'var(--text-primary)' }}>
                <MessageSquare size={16} color="var(--c-amber)" /> {suggestions.length} suggested edit{suggestions.length === 1 ? '' : 's'} from visitors
              </strong>
              {suggestions.map(x => (
                <div key={x.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flexWrap: 'wrap', paddingTop: '0.6rem', borderTop: '1px solid var(--border-subtle)' }}>
                  <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {SUGGESTION_TOPICS.find(t => t.key === x.topic)?.label || 'Something else'}
                      {x.ground_name && x.ground_name !== ground.name ? ` · ${x.ground_name}` : ''} · {new Date(x.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                    </div>
                    <p style={{ margin: '0.2rem 0 0', color: 'var(--text-primary)', fontSize: '0.9rem', lineHeight: 1.5, overflowWrap: 'anywhere' }}>{x.message}</p>
                    {x.contact && <p style={{ ...hint, marginTop: '0.2rem' }}>From {x.contact}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button type="button" className="btn btn-outline" style={{ ...smallBtn, padding: '0.4rem 0.75rem', fontSize: '0.8rem' }} onClick={() => closeSuggestion(x.id, 'done')} title="I've updated the ground details">
                      <Check size={14} /> Done
                    </button>
                    <button type="button" className="btn btn-outline" style={{ ...smallBtn, padding: '0.4rem 0.75rem', fontSize: '0.8rem' }} onClick={() => closeSuggestion(x.id, 'dismissed')} title="Not right, or not needed">
                      <X size={14} /> Dismiss
                    </button>
                  </div>
                </div>
              ))}
              <p style={{ ...hint, marginTop: 0 }}>Nothing changes on the guide until you edit the ground details. Mark each one done once you have.</p>
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            {steward && <button type="button" className="btn btn-primary" style={smallBtn} onClick={() => setMode('edit')}>Edit ground details</button>}
            <button type="button" className="btn btn-outline" style={smallBtn} onClick={() => { setMode('pick'); setQ(''); }}>Change ground</button>
            <button type="button" className="btn btn-outline" style={smallBtn} onClick={unlink} disabled={busy}><Trash2 size={15} /> Remove</button>
          </div>
        </div>
      )}

      {!loading && migrated && mode === 'pick' && (
        <div>
          <label className="form-label" htmlFor="ground-search">Find your ground</label>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 13, color: 'var(--text-muted)' }} aria-hidden="true" />
            <input id="ground-search" className="form-input" style={{ paddingLeft: 36 }} value={q} onChange={e => setQ(e.target.value)} placeholder="Ground name, suburb or postcode" autoFocus />
          </div>
          <div className="glass-panel" style={{ marginTop: '0.4rem', padding: '0.35rem', display: 'flex', flexDirection: 'column' }}>
            {results.map(r => (
              <button key={r.id} type="button" onClick={() => save(r.id)} disabled={busy}
                style={{ textAlign: 'left', padding: '0.65rem 0.75rem', borderRadius: 10, display: 'flex', gap: '0.7rem', alignItems: 'flex-start', background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}>
                <MapPin size={18} color="var(--club-primary)" style={{ marginTop: 2 }} />
                <span>
                  <strong style={{ display: 'block', color: 'var(--text-primary)' }}>{r.name}</strong>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{[`${r.suburb} ${r.state}`, councilName(r)].filter(Boolean).join(' · ')}</span>
                </span>
              </button>
            ))}
            <button type="button" onClick={() => { setForm(f => ({ ...fromClub(club), ...f, name: q.trim() || f.name })); setMode('edit'); }}
              style={{ textAlign: 'left', padding: '0.65rem 0.75rem', display: 'flex', gap: '0.7rem', alignItems: 'center', color: 'var(--club-ink)', fontWeight: 700, background: 'transparent', border: 'none', borderTop: results.length ? '1px solid var(--border-subtle)' : 'none', cursor: 'pointer' }}>
              <Plus size={18} /> Add a new ground{q.trim() ? ` “${q.trim()}”` : ''}
            </button>
          </div>
          <button type="button" className="btn btn-outline" style={{ marginTop: '0.75rem' }} onClick={() => setMode('view')}>Cancel</button>
        </div>
      )}

      {!loading && migrated && mode === 'edit' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '1.1rem' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="g-name">Ground name *</label>
            <input id="g-name" className="form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Craik Park" maxLength={120} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="g-suburb">Suburb *</label>
            <input id="g-suburb" className="form-input" value={form.suburb} onChange={e => set('suburb', e.target.value)} placeholder="e.g. Austral" maxLength={80} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="g-state">State *</label>
            <select id="g-state" className="form-select" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value, council_key: '' }))}>
              {STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="g-postcode">Postcode</label>
            <input id="g-postcode" className="form-input" value={form.postcode} onChange={e => set('postcode', e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="2179" />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label" htmlFor="g-address">Street address</label>
            <input id="g-address" className="form-input" value={form.address} onChange={e => set('address', e.target.value)} placeholder="e.g. Fifteenth Avenue" maxLength={200} />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label" htmlFor="g-pin">Map pin</label>
            <input id="g-pin" className="form-input" value={form.pin} onChange={e => { setPinTouched(true); set('pin', e.target.value); }} placeholder="Paste a Google Maps link to the ground, or -33.93, 150.80" />
            <p style={hint}>
              In Google Maps, drop a pin on the car park entrance or the clubhouse, then copy the link from the address bar (or right-click the pin and copy the numbers).
              {form.pin && (pin ? ' Pin found.' : ' No pin found in that yet.')}
            </p>
            {pin && (
              <div style={{ height: 200, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-subtle)', marginTop: '0.5rem' }}>
                <iframe title="Pin preview" src={mapEmbedUrl({ lat: pin.lat, lng: pin.lng } as GroundRow)} style={{ border: 'none', width: '100%', height: '100%' }} loading="lazy" />
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="g-council">Council</label>
            <select id="g-council" className="form-select" value={form.council_key} onChange={e => { setCouncilPicked(true); setAutoCouncil(null); set('council_key', e.target.value); }}>
              <option value="">Pick the council</option>
              {councils.map(c => <option key={c.key} value={c.key}>{c.name}</option>)}
              <option value="other">Another council</option>
            </select>
            <p style={hint}>
              {autoCouncil ? `Found from the map pin: ${autoCouncil}. Change it if that's wrong.` : 'Paste the map pin and we fill this in. It links the guide to the council\'s wet-weather status page.'}
            </p>
          </div>
          {form.council_key === 'other' && (
            <div className="form-group">
              <label className="form-label" htmlFor="g-council-name">Council name</label>
              <input id="g-council-name" className="form-input" value={form.council_name} onChange={e => set('council_name', e.target.value)} placeholder="e.g. Wollondilly Shire Council" maxLength={120} />
            </div>
          )}

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <span className="form-label">Pitches</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {form.pitches.map((p, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 1fr) minmax(110px, 1fr) minmax(130px, 1.4fr) auto auto', gap: '0.5rem', alignItems: 'center' }} className="ground-pitch-row">
                  <input className="form-input" aria-label="Pitch name" value={p.label} placeholder="Pitch 1" maxLength={40}
                    onChange={e => set('pitches', form.pitches.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                  <select className="form-select" aria-label="Surface" value={p.surface || ''}
                    onChange={e => set('pitches', form.pitches.map((x, j) => (j === i ? { ...x, surface: e.target.value } : x)))}>
                    <option value="">Surface</option>
                    {SURFACES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <input className="form-input" aria-label="Size" value={p.size || ''} placeholder="Full size, 9-a-side…" maxLength={60}
                    onChange={e => set('pitches', form.pitches.map((x, j) => (j === i ? { ...x, size: e.target.value } : x)))} />
                  <label style={{ ...smallBtn, fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    <input type="checkbox" checked={!!p.lights} onChange={e => set('pitches', form.pitches.map((x, j) => (j === i ? { ...x, lights: e.target.checked } : x)))} /> Lights
                  </label>
                  <button type="button" className="btn btn-outline" aria-label={`Remove ${p.label || 'pitch'}`} style={{ padding: '0.45rem 0.6rem' }}
                    onClick={() => set('pitches', form.pitches.filter((_, j) => j !== i))}><Trash2 size={15} /></button>
                </div>
              ))}
              <button type="button" className="btn btn-outline" style={{ ...smallBtn, alignSelf: 'flex-start' }}
                onClick={() => set('pitches', [...form.pitches, { label: `Pitch ${form.pitches.length + 1}`, surface: 'Grass' }])}>
                <Plus size={15} /> Add a pitch
              </button>
            </div>
          </div>

          {([
            ['parking', 'Parking', 'e.g. Free car park next to the clubhouse, about 60 spaces. Street parking when full.'],
            ['toilets', 'Toilets', 'e.g. Amenities block by Pitch 1, open on match days'],
            ['canteen', 'Canteen', 'e.g. Match days, run by the home club, card accepted'],
            ['accessibility', 'Accessibility', 'e.g. Accessible toilet; flat path from the car park to Pitch 1'],
            ['notes', 'Good to know', 'e.g. No dogs on the fields. Enter from Fifteenth Avenue only.'],
          ] as const).map(([k, label, ph]) => (
            <div key={k} className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label" htmlFor={`g-${k}`}>{label}</label>
              <input id={`g-${k}`} className="form-input" value={form[k]} onChange={e => set(k, e.target.value)} placeholder={ph} maxLength={k === 'notes' ? 600 : 400} />
            </div>
          ))}

          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" style={smallBtn} onClick={() => save()} disabled={busy}>
              {busy ? <Loader2 size={15} className="spin" /> : <CheckCircle2 size={15} />} Save ground guide
            </button>
            <button type="button" className="btn btn-outline" onClick={() => { setMode('view'); if (ground) setForm(fromGround(ground)); }}>Cancel</button>
          </div>
        </div>
      )}

      {!loading && migrated && (
        <div style={{ display: 'flex', gap: '0.9rem', alignItems: 'flex-start', marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
          <Switch checked={listed} onChange={toggleListed} label="Show our club and fixtures on public ground pages" />
          <div>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Show our club and fixtures on public ground pages</div>
            <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.55, marginTop: '0.25rem' }}>
              Ground facts like parking and toilets are public either way. With this on, your club name appears on your ground&apos;s page,
              and your senior fixtures appear on the guide of the ground they&apos;re played at. Junior teams, teams that hide scores, and training are never shown.
            </div>
          </div>
        </div>
      )}

      {message && <p role="status" style={{ ...hint, marginTop: '1rem', color: message.ok ? 'var(--c-green)' : 'var(--c-red, #ef4444)' }}>{message.text}</p>}
    </div>
  );
}
