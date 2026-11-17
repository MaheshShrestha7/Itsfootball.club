'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { platformApi, useCanChange } from '@/components/admin/platform/api';
import { useEscapeToClose } from '@/lib/use-escape-to-close';
import { SUPPORT_SNIPPETS, setupSteps, timeAgo } from '@/lib/mission-control';
import type { PlatformClubItem, PlatformFeatureRequest, SupportReply, SupportRequest } from '@/lib/supabase/types';
import FeatureRequests, { FeatureTag } from '@/components/admin/platform/FeatureRequests';
import { Send, RefreshCw, CheckCircle2, RotateCcw, ArrowLeft } from 'lucide-react';

type Status = SupportRequest['status'];

interface Props {
  clubs: PlatformClubItem[];
  initialId?: string | null;
  onSelectClub: (c: PlatformClubItem) => void;
  onSearchPeople: (q: string) => void;
  showToast: (msg: string) => void;
  /** Open requests, for the rail badge */
  onOpenCount: (n: number) => void;
  /** The request picked in the list, so the web address can follow it */
  onSelectRequest?: (id: string | null) => void;
}

const FILTERS: { id: Status; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'waiting', label: 'Waiting on them' },
  { id: 'done', label: 'Done' },
];

/** Messages from club admins (and owners stuck deleting their account), answered by email from here. */
export default function SupportTab({ clubs, initialId, onSelectClub, onSearchPeople, showToast, onOpenCount, onSelectRequest }: Props) {
  const [filter, setFilter] = useState<Status | 'features'>('open');
  // MCF-5: null before migration 20261177, and the Feature requests view stays hidden
  const [features, setFeatures] = useState<PlatformFeatureRequest[] | null>(null);
  const [tagging, setTagging] = useState(false);
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [counts, setCounts] = useState<Record<Status, number>>({ open: 0, waiting: 0, done: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(initialId || null);
  const canChange = useCanChange();
  // Phones: a request opens as a full-screen panel over the list, like People (MCX-11)
  const [open, setOpen] = useState(!!initialId);
  const backBtn = useRef<HTMLButtonElement>(null);
  useEscapeToClose(open, setOpen);
  useEffect(() => { if (open) backBtn.current?.focus({ preventScroll: true }); }, [open, selectedId]);
  const [replies, setReplies] = useState<SupportReply[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const box = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client) return;
    setLoading(true);
    // ponytail: newest 500 requests, filtered here; page it if the inbox ever grows past that
    const [{ data, error }, f] = await Promise.all([
      client.from('support_requests').select('*').order('created_at', { ascending: false }).limit(500),
      client.from('platform_feature_requests').select('*').order('created_at', { ascending: false }),
    ]);
    setFeatures(f.error ? null : ((f.data || []) as PlatformFeatureRequest[]));
    setLoading(false);
    if (error) { setError('Run migration 20261146_mission_control_phase2.sql to turn on the support inbox.'); return; }
    const all = (data || []) as SupportRequest[];
    const c = { open: 0, waiting: 0, done: 0 };
    all.forEach(r => { c[r.status]++; });
    setCounts(c);
    onOpenCount(c.open);
    setRequests(all);
  }, [onOpenCount]);

  useEffect(() => { load(); }, [load]);

  const shown = requests.filter(r => r.status === filter);
  useEffect(() => { setTagging(false); }, [selectedId]);
  const selected = requests.find(r => r.id === selectedId) || shown[0] || null;
  // Opening a request from Today: show its folder
  useEffect(() => {
    const r = requests.find(x => x.id === initialId);
    if (r) setFilter(r.status);
  }, [initialId, requests]);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client || !selected) { setReplies([]); return; }
    client.from('support_replies').select('*').eq('request_id', selected.id).order('created_at')
      .then(({ data }) => setReplies((data || []) as SupportReply[]));
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const setStatus = async (status: Status) => {
    const client = getSupabaseClient();
    if (!client || !selected) return;
    setSelectedId(selected.id);
    const { error } = await client.from('support_requests').update({ status, updated_at: new Date().toISOString() }).eq('id', selected.id);
    if (error) { showToast(`Could not update: ${error.message}`); return; }
    showToast(status === 'done' ? '✓ Marked done' : '✓ Reopened');
    load();
  };

  const send = async (status: 'waiting' | 'done') => {
    if (!selected || !draft.trim()) return;
    setSelectedId(selected.id);
    setSending(true);
    const res = await platformApi('support', { requestId: selected.id, body: draft.trim(), status });
    setSending(false);
    if (res.error) { showToast(res.error); return; }
    setDraft('');
    showToast(`✓ Reply sent to ${selected.from_email}`);
    load();
    setReplies(prev => [...prev, { id: `local-${Date.now()}`, request_id: selected.id, body: draft.trim(), author_email: null, emailed: true, created_at: new Date().toISOString() }]);
  };

  const insert = (text: string) => {
    const el = box.current;
    const at = el ? el.selectionStart : draft.length;
    const next = `${draft.slice(0, at)}${text}${draft.slice(at)}`;
    setDraft(next);
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(at + text.length, at + text.length); });
  };

  const club = selected?.club_id ? clubs.find(c => c.id === selected.club_id) : undefined;
  const steps = club ? setupSteps(club) : [];

  return (
    <div>
      <div className="mc-page-h">
        <div>
          <h1>Support</h1>
          <p>Messages from club admins. Replies go by email and are kept here.</p>
        </div>
        <div className="right">
          <span className="mc-seg" role="group" aria-label="Show">
            {FILTERS.map(f => (
              <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => { setFilter(f.id); setSelectedId(null); }}>
                {f.label} {counts[f.id]}
              </button>
            ))}
            {features && (
              <button type="button" aria-pressed={filter === 'features'} onClick={() => { setFilter('features'); setSelectedId(null); }}>
                Feature requests {features.filter(x => x.status !== 'built').length}
              </button>
            )}
          </span>
          <button type="button" className="mc-icon-btn" onClick={load} disabled={loading} aria-label="Refresh"><RefreshCw size={14} className={loading ? 'spin' : ''} /></button>
        </div>
      </div>

      {error ? <div className="mc-card mc-empty" role="alert">{error}</div> : filter === 'features' && features ? (
        <FeatureRequests
          features={features}
          requests={requests}
          clubs={clubs}
          onOpenRequest={r => { setFilter(r.status); setSelectedId(r.id); onSelectRequest?.(r.id); }}
          onChanged={load}
          showToast={showToast}
        />
      ) : (
        <div className={`mc-users mc-users-sheet${open ? ' is-open' : ''}`}>
          <div className="mc-card">
            <div className="mc-ulist">
              {!loading && shown.length === 0 && <p className="mc-muted" style={{ padding: 8 }}>Nothing here.</p>}
              {shown.map(r => (
                <button key={r.id} type="button" className="mc-urow" aria-pressed={selected?.id === r.id} onClick={() => { setSelectedId(r.id); setOpen(true); onSelectRequest?.(r.id); }}>
                  <div style={{ minWidth: 0 }}>
                    <b>{r.topic}</b>
                    <small>{clubs.find(c => c.id === r.club_id)?.name || r.from_email}</small>
                    <small>{timeAgo(r.created_at)}</small>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {selected ? (
            <div className="mc-col">
              <div className="mc-sheet-bar">
                <button ref={backBtn} type="button" className="mc-pill-btn ghost" onClick={() => setOpen(false)}><ArrowLeft size={16} aria-hidden="true" /> Support</button>
              </div>
              <fieldset className="mc-fs mc-card" disabled={!canChange}>
                <div className="mc-card-h" style={{ flexWrap: 'wrap', gap: 8 }}>
                  <h3>{selected.topic}</h3>
                  {selected.status === 'done'
                    ? <button type="button" className="mc-pill-btn ghost" onClick={() => setStatus('open')}><RotateCcw size={14} /> Reopen</button>
                    : <button type="button" className="mc-pill-btn ghost" onClick={() => setStatus('done')}><CheckCircle2 size={14} /> Mark done</button>}
                </div>
                <div className="mc-msg">
                  <small>
                    <b>{selected.from_name || selected.from_email}</b>
                    {selected.from_name ? <span>{selected.from_email}</span> : null}
                    <time dateTime={selected.created_at}>{new Date(selected.created_at).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}</time>
                  </small>
                  <p>{selected.message}</p>
                </div>
                {replies.map(r => (
                  <div key={r.id} className="mc-msg me">
                    <small><b>{r.author_email || 'You'}</b><time dateTime={r.created_at}>{timeAgo(r.created_at)}</time>{r.emailed ? null : <span className="mc-flag warn">Not emailed</span>}</small>
                    <p>{r.body}</p>
                  </div>
                ))}

                {features && <FeatureTag key={`${selected.id}-${tagging}`} request={selected} features={features} onChanged={load} showToast={showToast} autoOpen={tagging} />}

                <label htmlFor="mc-support-reply" className="form-label" style={{ marginTop: 14 }}>Your reply</label>
                <textarea id="mc-support-reply" ref={box} className="form-input" rows={6} maxLength={4000} value={draft} onChange={e => setDraft(e.target.value)} style={{ resize: 'vertical', lineHeight: 1.5 }} />
                <div className="mc-reply-bar">
                  <span className="snips">
                    <small className="mc-muted">Saved replies:</small>
                    {SUPPORT_SNIPPETS.map(s => (
                      <button key={s.label} type="button" className="mc-pill-btn ghost" onClick={() => {
                        insert(s.text);
                        // The reply promises the request is noted: ask which feature it belongs to
                        if (s.label === 'Not built yet' && features && !selected.feature_id) {
                          setTagging(true);
                          requestAnimationFrame(() => document.getElementById('mc-feature-tag')?.scrollIntoView({ block: 'center' }));
                        }
                      }}>{s.label}</button>
                    ))}
                  </span>
                  <span className="send">
                    <button type="button" className="mc-pill-btn ghost" disabled={sending || !draft.trim()} onClick={() => send('waiting')}>Send, wait for them</button>
                    <button type="button" className="mc-pill-btn" disabled={sending || !draft.trim()} onClick={() => send('done')}><Send size={14} /> Send and mark done</button>
                  </span>
                </div>
              </fieldset>

              <div className="mc-card">
                <div className="mc-card-h"><h3>{club ? club.name : 'No club'}</h3></div>
                {club && (
                  <dl className="mc-kv" style={{ marginBottom: 10 }}>
                    <dt>Setup</dt><dd className="num">{steps.filter(s => s.done).length} of {steps.length}</dd>
                    <dt>Members</dt><dd className="num">{club.member_count}</dd>
                    <dt>Card payments</dt><dd>{club.stripe_ready ? 'Stripe connected' : 'No Stripe'}</dd>
                  </dl>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {club && <button type="button" className="mc-pill-btn ghost" onClick={() => onSelectClub(club)}>Open club console</button>}
                  <button type="button" className="mc-pill-btn ghost" onClick={() => onSearchPeople(selected.from_email)}>Look up {selected.from_name || 'the sender'}</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mc-card mc-empty">{loading ? 'Loading…' : 'Pick a message on the left.'}</div>
          )}
        </div>
      )}
    </div>
  );
}
