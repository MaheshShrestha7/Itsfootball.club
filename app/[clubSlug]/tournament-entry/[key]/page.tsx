'use client';

import React, { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, CreditCard, Info, Lock, Plus, Shirt, Trash2, Trophy, Upload, Users, CalendarDays, ClipboardList } from 'lucide-react';
import { DATE_LOCALE } from '@/lib/dates';
import { DEFAULT_CREST, crestOnError } from '@/lib/crest';
import { ENTRY_POSITIONS, money, type EntryPlayer } from '@/lib/hosted-tournaments';
import { juniorPublicName } from '@/lib/teams';
import type { EntryView } from '@/lib/tournament-entries-server';
import '@/components/tournament/hosted.css';

/** "7 Sam Patel", "Sam Patel, 7" or "Sam Patel" per line */
function parsePlayers(text: string): EntryPlayer[] {
  return text.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
    const m = /^(\d{1,2})[\s.,)-]+(.+)$/.exec(line) || /^(.+?)[\s,]+#?(\d{1,2})$/.exec(line);
    const [name, num] = m ? (/^\d/.test(line) ? [m[2], m[1]] : [m[1], m[2]]) : [line, ''];
    return { name: name.replace(/[,\t]+/g, ' ').trim().slice(0, 80), shirt_number: num ? Number(num) : null, position: null, is_junior: false, hide_public: false };
  }).filter(p => p.name);
}

const when = (iso: string) => new Date(iso).toLocaleString(DATE_LOCALE, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/**
 * /{club}/tournament-entry/{key}: a guest club's own page for a tournament the club hosts. No
 * account: the link is the key. They add their crest, colours, staff and players until entries
 * close, pay the entry fee, and see their games (and, afterwards, how their tournament went).
 */
export default function TeamEntryPage({ params }: { params: Promise<{ clubSlug: string; key: string }> }) {
  const { clubSlug, key } = use(params);
  const [view, setView] = useState<EntryView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<'draft' | 'submit' | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [form, setForm] = useState({ manager_name: '', coach_name: '', assistant_name: '', first_aid_name: '', contact_name: '', contact_phone: '', color: '#2563EB', secondary_color: '#FFFFFF' });
  const [players, setPlayers] = useState<EntryPlayer[]>([]);
  const [paste, setPaste] = useState<string | null>(null);
  const [crest, setCrest] = useState<File | null>(null);
  const [crestPreview, setCrestPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fill = (v: EntryView) => {
    setView(v);
    setForm({
      manager_name: v.team.manager_name || '', coach_name: v.team.coach_name || '',
      assistant_name: v.entry.assistant_name || '', first_aid_name: v.entry.first_aid_name || '',
      contact_name: v.entry.contact_name || '', contact_phone: v.entry.contact_phone || '',
      color: /^#[0-9a-f]{6}$/i.test(v.team.color || '') ? v.team.color! : '#2563EB',
      secondary_color: /^#[0-9a-f]{6}$/i.test(v.team.secondary_color || '') ? v.team.secondary_color! : '#FFFFFF',
    });
    setPlayers(v.players.map(p => ({ ...p, is_junior: !!p.is_junior, hide_public: !!p.hide_public })));
  };

  useEffect(() => {
    let stale = false;
    fetch(`/api/tournament-entry?k=${encodeURIComponent(key)}`)
      .then(async r => {
        const data = await r.json().catch(() => ({}));
        if (stale) return;
        if (r.ok) fill(data as EntryView);
        else setError(data.error || 'This link isn’t working.');
      })
      .catch(() => !stale && setError('We couldn’t load this. Check your connection and try again.'));
    return () => { stale = true; };
  }, [key]);

  useEffect(() => () => { if (crestPreview) URL.revokeObjectURL(crestPreview); }, [crestPreview]);

  const save = async (submit: boolean) => {
    setSaving(submit ? 'submit' : 'draft');
    setError(null);
    setSaved(null);
    const body = new FormData();
    body.set('k', key);
    body.set('data', JSON.stringify({ ...form, players, submit }));
    if (crest) body.set('crest', crest);
    try {
      const r = await fetch('/api/tournament-entry', { method: 'POST', body });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) return setError(data.error || 'That didn’t save. Please try again.');
      fill(data as EntryView);
      setCrest(null);
      setSaved(submit ? 'Entry sent. The host club has it, and you can still make changes until entries close.' : 'Saved. Come back to this link any time to finish.');
    } catch {
      setError('That didn’t save. Check your connection and try again.');
    } finally {
      setSaving(null);
    }
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));
  const setPlayer = (i: number, patch: Partial<EntryPlayer>) => setPlayers(list => list.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  if (!view) {
    return (
      <div className="te-page">
        <div className="container te-wrap">
          <div className="glass-panel frp">
            <span className="frp-icon" aria-hidden="true"><Trophy size={22} /></span>
            {error ? (
              <>
                <h1>This link isn&rsquo;t working</h1>
                <p className="frp-lead">{error}</p>
              </>
            ) : <p className="frp-lead">Loading your team&hellip;</p>}
          </div>
        </div>
      </div>
    );
  }

  const t = view.tournament;
  const open = t.open;
  const max = t.max_squad || 40;
  const submitted = view.entry.status === 'submitted';
  const ro = !open;

  const state = !open ? { tone: 'closed', label: 'Entries closed' } : submitted ? { tone: 'ok', label: 'Entry sent' } : { tone: 'warn', label: 'Not sent yet' };
  const showName = (n: string) => (t.is_junior ? juniorPublicName(n) : n);

  return (
    <div className="te-page" style={{ '--te-c1': form.color, '--te-c2': form.secondary_color } as React.CSSProperties}>
      <div className="container te-wrap">
        <Link href={`/${view.club.slug || clubSlug}`} className="frp-back"><ArrowLeft size={16} aria-hidden="true" /> {view.club.name}</Link>

        {/* The team's own kit runs under the header: it is their page */}
        <header className="te-head">
          <span className="te-crest"><img src={crestPreview || view.team.logo_url || DEFAULT_CREST} onError={crestOnError} alt="" /></span>
          <div className="min-w-0">
            <h1>{view.team.name}</h1>
            <p className="te-meta">{t.name}{t.age_group ? `, ${t.age_group}` : ''}. Hosted by {view.club.name}, {t.when}{t.venue ? ` at ${t.venue}` : ''}.</p>
          </div>
          <span className="te-state" data-tone={state.tone}>{state.label}</span>
        </header>

        <div className="te-layout">
          <form className="te-form" onSubmit={e => { e.preventDefault(); save(true); }}>
            <fieldset className="glass-panel te-card" disabled={ro}>
              <legend><ClipboardList size={18} aria-hidden="true" /> Team sheet <span className="te-count">{players.length}{t.max_squad ? ` of ${t.max_squad}` : ''} players</span></legend>
              <p className="te-hint">
                {t.is_junior
                  ? 'Junior tournament: public pages show first names and last initials only.'
                  : 'Tick Junior for a player under 18: public pages then show their first name and last initial only.'}
                {' '}Hide keeps a player off public pages altogether.
              </p>
              {players.length > 0 && (
                <div className="te-sheet" role="table" aria-label="Players">
                  <div className="te-sheet-head" role="row">
                    <span role="columnheader">No.</span>
                    <span role="columnheader">Name</span>
                    <span role="columnheader">Position</span>
                    <span role="columnheader">Public page</span>
                    <span role="columnheader"><span className="sr-only">Remove</span></span>
                  </div>
                  <ul className="te-players">
                    {players.map((p, i) => (
                      <li key={i} role="row">
                        <input className="form-input te-num" inputMode="numeric" aria-label={`Shirt number, player ${i + 1}`} placeholder="#" value={p.shirt_number ?? ''}
                          onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 2); setPlayer(i, { shirt_number: v === '' ? null : Number(v) }); }} />
                        <input className="form-input te-pname" aria-label={`Name, player ${i + 1}`} placeholder="Full name" value={p.name} maxLength={80} onChange={e => setPlayer(i, { name: e.target.value })} />
                        <select className="form-select te-pos" aria-label={`Position, player ${i + 1}`} value={p.position || ''} onChange={e => setPlayer(i, { position: e.target.value || null })}>
                          <option value="">Position</option>
                          {ENTRY_POSITIONS.map(x => <option key={x} value={x}>{x}</option>)}
                        </select>
                        <span className="te-ticks">
                          {!t.is_junior && <label className="te-tick"><input type="checkbox" checked={p.is_junior} onChange={e => setPlayer(i, { is_junior: e.target.checked })} /> Junior</label>}
                          <label className="te-tick"><input type="checkbox" checked={p.hide_public} onChange={e => setPlayer(i, { hide_public: e.target.checked })} /> Hide</label>
                        </span>
                        <button type="button" className="te-remove" aria-label={`Remove ${p.name || `player ${i + 1}`}`} onClick={() => setPlayers(list => list.filter((_, j) => j !== i))}><Trash2 size={15} /></button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {paste !== null ? (
                <div className="te-paste">
                  <textarea className="form-input" rows={6} value={paste} onChange={e => setPaste(e.target.value)} aria-label="Players, one per line" placeholder={'7 Sam Patel\n10 Leo Brooks\nAri Haddad'} />
                  <div className="te-row">
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => { setPlayers(list => [...list, ...parsePlayers(paste)].slice(0, max)); setPaste(null); }}>Add {parsePlayers(paste).length || ''} players</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPaste(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="te-row">
                  <button type="button" className="btn btn-secondary btn-sm" disabled={players.length >= max} onClick={() => setPlayers(list => [...list, { name: '', shirt_number: null, position: null, is_junior: false, hide_public: false }])}><Plus size={14} aria-hidden="true" /> Add a player</button>
                  <button type="button" className="btn btn-secondary btn-sm" disabled={players.length >= max} onClick={() => setPaste('')}>Paste a list</button>
                </div>
              )}
            </fieldset>

            <fieldset className="glass-panel te-card" disabled={ro}>
              <legend><Users size={18} aria-hidden="true" /> Team staff</legend>
              <p className="te-hint">The manager and coach show on your team&rsquo;s public page. Everything else only goes to the host club.</p>
              <div className="te-two">
                <label className="form-group"><span className="form-label">Team manager *</span><input className="form-input" value={form.manager_name} onChange={set('manager_name')} maxLength={128} autoComplete="name" /></label>
                <label className="form-group"><span className="form-label">Coach</span><input className="form-input" value={form.coach_name} onChange={set('coach_name')} maxLength={128} /></label>
                <label className="form-group"><span className="form-label">Assistant</span><input className="form-input" value={form.assistant_name} onChange={set('assistant_name')} maxLength={128} /></label>
                <label className="form-group"><span className="form-label">First aid</span><input className="form-input" value={form.first_aid_name} onChange={set('first_aid_name')} maxLength={128} /></label>
                <label className="form-group"><span className="form-label">Contact name</span><input className="form-input" value={form.contact_name} onChange={set('contact_name')} maxLength={128} /></label>
                <label className="form-group"><span className="form-label">Contact phone (on the day)</span><input className="form-input" type="tel" value={form.contact_phone} onChange={set('contact_phone')} maxLength={40} autoComplete="tel" /></label>
              </div>
              {view.entry.contact_email && <p className="te-hint">Emails about this tournament go to {view.entry.contact_email}.</p>}
            </fieldset>

            <fieldset className="glass-panel te-card" disabled={ro}>
              <legend><Shirt size={18} aria-hidden="true" /> Crest and kit</legend>
              <div className="te-crest-row">
                <span className="te-crest is-big"><img src={crestPreview || view.team.logo_url || DEFAULT_CREST} onError={crestOnError} alt={`${view.team.name} crest`} /></span>
                <div>
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => {
                    const f = e.target.files?.[0] || null;
                    if (f && f.size > 2 * 1024 * 1024) { setError('The crest must be 2 MB or smaller.'); return; }
                    setCrest(f);
                    setCrestPreview(f ? URL.createObjectURL(f) : null);
                  }} />
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}><Upload size={14} aria-hidden="true" /> {view.team.logo_url && view.team.logo_url !== DEFAULT_CREST ? 'Change crest' : 'Upload crest'}</button>
                  <p className="te-hint">PNG, JPG or WebP, up to 2 MB. A square picture with a see-through background looks best.</p>
                </div>
              </div>
              <div className="te-two">
                <label className="form-group"><span className="form-label">Main kit colour</span>
                  <span className="ht-colour"><input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value.toUpperCase() }))} /><span>{form.color}</span></span>
                </label>
                <label className="form-group"><span className="form-label">Second colour</span>
                  <span className="ht-colour"><input type="color" value={form.secondary_color} onChange={e => setForm(f => ({ ...f, secondary_color: e.target.value.toUpperCase() }))} /><span>{form.secondary_color}</span></span>
                </label>
              </div>
            </fieldset>

            {error && <p role="alert" className="frp-error">{error}</p>}
            {saved && <p role="status" className="te-saved"><Check size={16} aria-hidden="true" /> {saved}</p>}
            {open && (
              <div className="te-actions">
                <button type="button" className="btn btn-secondary" disabled={!!saving} onClick={() => save(false)}>{saving === 'draft' ? 'Saving…' : 'Save and finish later'}</button>
                <button type="submit" className="btn btn-primary" disabled={!!saving}>{saving === 'submit' ? 'Sending…' : submitted ? 'Save changes' : 'Send our entry'}</button>
              </div>
            )}
          </form>

          <aside className="te-side">
            <section className="glass-panel te-card te-deadline" data-tone={state.tone}>
              {!open ? <Lock size={18} aria-hidden="true" /> : submitted ? <Check size={18} aria-hidden="true" /> : <ClipboardList size={18} aria-hidden="true" />}
              <p>
                {!open ? 'Entries have closed. Contact the host club to change anything.'
                  : submitted ? `Sent ${view.entry.submitted_at ? when(view.entry.submitted_at) : ''}. You can still make changes${t.deadline ? ` until ${when(t.deadline)}` : ''}.`
                  : `Send it by ${t.deadline ? when(t.deadline) : 'the first game'}. Save as you go and come back to this link.`}
              </p>
            </section>

            {view.report && (
              <section className="glass-panel te-card">
                <h2><Trophy size={18} aria-hidden="true" /> {view.report.finish || 'How you went'}</h2>
                <table className="te-results">
                  <thead><tr><th scope="col"><abbr title="Played">P</abbr></th><th scope="col"><abbr title="Won">W</abbr></th><th scope="col"><abbr title="Drawn">D</abbr></th><th scope="col"><abbr title="Lost">L</abbr></th><th scope="col"><abbr title="Goals for">GF</abbr></th><th scope="col"><abbr title="Goals against">GA</abbr></th></tr></thead>
                  <tbody><tr><td>{view.report.played}</td><td>{view.report.won}</td><td>{view.report.drawn}</td><td>{view.report.lost}</td><td>{view.report.goalsFor}</td><td>{view.report.goalsAgainst}</td></tr></tbody>
                </table>
                {view.report.scorers.length > 0 && (
                  <p className="te-note">Scorers: {view.report.scorers.map(s => `${showName(s.name)}${s.goals > 1 ? ` (${s.goals})` : ''}`).join(', ')}</p>
                )}
                {(view.report.yellow > 0 || view.report.red > 0) && <p className="te-note">Cards: {view.report.yellow} yellow, {view.report.red} red.</p>}
                <Link href={t.publicPath} className="te-link">Your team page</Link>
              </section>
            )}

            {view.games.length > 0 && (
              <section className="glass-panel te-card">
                <h2><CalendarDays size={18} aria-hidden="true" /> Your games</h2>
                <table className="te-games">
                  <caption className="sr-only">Your games</caption>
                  <tbody>
                    {view.games.map((g, i) => (
                      <tr key={i} data-done={g.status === 'completed' ? 'true' : undefined}>
                        <td><span className="te-when">{g.when}</span>{g.pitch && <span className="te-sub">{g.pitch}</span>}</td>
                        <th scope="row">v {g.opponent}</th>
                        <td className="te-score">{g.score ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Link href={t.publicPath} className="te-link">Draw, tables and results</Link>
              </section>
            )}

            {view.fee && (
              <section className="glass-panel te-card">
                <h2><CreditCard size={18} aria-hidden="true" /> Entry fee</h2>
                <p className="te-fee-row">
                  <b>{money(view.fee.amount_cents, view.fee.currency)}</b>
                  <span className="te-state" data-tone={view.fee.status === 'paid' ? 'ok' : view.fee.status === 'awaiting_review' || view.fee.status === 'not_billed' ? 'warn' : 'due'}>
                    {view.fee.status === 'paid' ? 'Paid, thank you' : view.fee.status === 'awaiting_review' ? 'Receipt with the club' : view.fee.status === 'not_billed' ? 'Per team' : 'To pay'}
                  </span>
                </p>
                {view.fee.status === 'not_billed' && <p className="te-info">{view.club.name} will send you a link to pay it.</p>}
                {view.fee.payPath && view.fee.status === 'pending' && (
                  <Link href={view.fee.payPath} className="btn btn-primary btn-sm">Pay by card or bank transfer</Link>
                )}
              </section>
            )}

            {t.team_info && (
              <section className="glass-panel te-card">
                <h2><Info size={18} aria-hidden="true" /> Info for teams</h2>
                <p className="te-info">{t.team_info}</p>
              </section>
            )}

            <p className="te-foot">Keep this link to yourself: anyone with it can change your entry until entries close.</p>
          </aside>
        </div>
      </div>
    </div>
  );
}
