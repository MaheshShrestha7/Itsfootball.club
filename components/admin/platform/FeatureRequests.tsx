'use client';

// Mission Control -> Support -> Feature requests (MCF-5). The "Not built yet" reply says the request
// is noted; this is where it's noted. Tag a request with a feature, see what's asked for most, and
// email everyone who asked once it's built. platform_feature_requests, migration 20261177.
import React, { useState } from 'react';
import { Lightbulb, Tag } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { platformApi } from '@/components/admin/platform/api';
import { confirmAction, notify } from '@/components/ConfirmDialog';
import { timeAgo } from '@/lib/mission-control';
import { Crest } from '@/components/admin/platform/McArt';
import type { PlatformClubItem, PlatformFeatureRequest, SupportRequest } from '@/lib/supabase/types';

const STATUS: { id: PlatformFeatureRequest['status']; label: string }[] = [
  { id: 'asked', label: 'Asked' },
  { id: 'planned', label: 'Planned' },
  { id: 'built', label: 'Built' },
];

/** The tag on one request: pick a feature, or name a new one */
export function FeatureTag({ request, features, onChanged, showToast, autoOpen }: {
  request: SupportRequest;
  features: PlatformFeatureRequest[];
  onChanged: () => void;
  showToast: (m: string) => void;
  autoOpen?: boolean;
}) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const current = features.find(f => f.id === request.feature_id);

  const link = async (featureId: string | null) => {
    const db = getSupabaseClient();
    if (!db) return;
    setBusy(true);
    const { error } = await db.from('support_requests').update({ feature_id: featureId }).eq('id', request.id);
    setBusy(false);
    if (error) return showToast(`Could not save: ${error.message}`);
    showToast(featureId ? 'Noted as a feature request' : 'Tag removed');
    onChanged();
  };
  const addNew = async (e: React.FormEvent) => {
    e.preventDefault();
    const db = getSupabaseClient();
    const t = title.trim();
    if (!db || t.length < 2) return;
    setBusy(true);
    const { data, error } = await db.from('platform_feature_requests').insert({ title: t }).select('id').single();
    setBusy(false);
    if (error) return showToast(`Could not save: ${error.message}`);
    setTitle('');
    link((data as { id: string }).id);
  };

  return (
    <div className="mc-feature-tag" id="mc-feature-tag">
      <div className="mc-card-h" style={{ margin: '14px 0 6px' }}>
        <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Tag size={14} aria-hidden="true" /> Feature request</h3>
        {current && <button type="button" className="mc-pill-btn ghost" disabled={busy} onClick={() => link(null)}>Remove tag</button>}
      </div>
      {current ? (
        <p className="mc-muted" style={{ margin: 0 }}>Noted under <b>{current.title}</b> ({STATUS.find(s => s.id === current.status)?.label}). They get an email when it&apos;s built.</p>
      ) : (
        <div className="mc-cp-form">
          {features.filter(f => f.status !== 'built').length > 0 && (
            <>
              <label htmlFor="mc-feature-pick" className="sr-only">Add to a feature</label>
              <select id="mc-feature-pick" className="mc-input" value="" disabled={busy} onChange={e => e.target.value && link(e.target.value)} autoFocus={autoOpen}>
                <option value="">Add to a feature already asked for…</option>
                {features.filter(f => f.status !== 'built').map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
              </select>
            </>
          )}
          <form className="mc-cp-inline" onSubmit={addNew}>
            <label htmlFor="mc-feature-new" className="sr-only">A new feature</label>
            <input id="mc-feature-new" className="mc-input" maxLength={200} placeholder="Or name a new one, e.g. Split a fee into two payments" value={title} onChange={e => setTitle(e.target.value)} />
            <button type="submit" className="mc-pill-btn ghost" disabled={busy || title.trim().length < 2}>Add</button>
          </form>
        </div>
      )}
    </div>
  );
}

/** The Feature requests view: most asked first, each with the requests behind it */
export default function FeatureRequests({ features, requests, clubs, onOpenRequest, onChanged, showToast }: {
  features: PlatformFeatureRequest[];
  requests: SupportRequest[];
  clubs: PlatformClubItem[];
  onOpenRequest: (r: SupportRequest) => void;
  onChanged: () => void;
  showToast: (m: string) => void;
}) {
  const asks = (id: string) => requests.filter(r => r.feature_id === id);
  const clubCount = (id: string) => new Set(asks(id).map(r => r.club_id || r.from_email)).size;
  const latest = (id: string) => asks(id).reduce((m, r) => (r.created_at > m ? r.created_at : m), '');
  const order = { asked: 0, planned: 0, built: 1 };
  const sorted = [...features].sort((a, b) => order[a.status] - order[b.status] || clubCount(b.id) - clubCount(a.id) || latest(b.id).localeCompare(latest(a.id)));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const selected = sorted.find(f => f.id === selectedId) || sorted[0] || null;

  const setStatus = async (f: PlatformFeatureRequest, status: PlatformFeatureRequest['status']) => {
    if (status === f.status) return;
    if (status === 'built') {
      const people = new Set(asks(f.id).map(r => r.from_email.toLowerCase())).size;
      const email = !f.built_emailed_at && people > 0 && await confirmAction({
        title: `Email the ${people === 1 ? 'person' : `${people} people`} who asked?`,
        message: `They get a short email saying "${f.title}" is built.`,
        confirmLabel: 'Mark built and email', cancelLabel: 'Just mark built',
      });
      setBusy(true);
      const res = await platformApi<{ sent?: number }>('support', { action: 'feature_built', featureId: f.id, email: !!email });
      setBusy(false);
      if (res.error) return notify('That didn’t work', res.error);
      showToast(email ? `Marked built and emailed ${res.sent ?? 0}` : 'Marked built');
      return onChanged();
    }
    const db = getSupabaseClient();
    if (!db) return;
    setBusy(true);
    const { error } = await db.from('platform_feature_requests').update({ status, built_at: null }).eq('id', f.id);
    setBusy(false);
    if (error) return showToast(`Could not save: ${error.message}`);
    onChanged();
  };

  if (!features.length) {
    return <div className="mc-card mc-empty">No feature requests yet. Tag a support request as one, or pick the &ldquo;Not built yet&rdquo; reply.</div>;
  }
  return (
    <div className="mc-users">
      <div className="mc-card">
        <div className="mc-card-h"><h3>Asked for most</h3></div>
        <div className="mc-ulist">
          {sorted.map(f => (
            <button key={f.id} type="button" className="mc-urow" aria-pressed={selected?.id === f.id} onClick={() => setSelectedId(f.id)}>
              <span className="mc-sq tone-setup"><Lightbulb size={14} /></span>
              <div>
                <b>{f.title}</b>
                <small>{f.status === 'built' ? 'Built' : `${clubCount(f.id)} ${clubCount(f.id) === 1 ? 'club' : 'clubs'}${latest(f.id) ? `, latest ${timeAgo(latest(f.id))}` : ''}`}</small>
              </div>
            </button>
          ))}
        </div>
      </div>
      {selected && (
        <div className="mc-card">
          <div className="mc-card-h" style={{ flexWrap: 'wrap', gap: 8 }}>
            <h3>{selected.title}</h3>
            <span className="mc-seg" role="group" aria-label="Where it is">
              {STATUS.map(s => (
                <button key={s.id} type="button" aria-pressed={selected.status === s.id} disabled={busy} onClick={() => setStatus(selected, s.id)}>{s.label}</button>
              ))}
            </span>
          </div>
          <p className="mc-muted" style={{ margin: '0 0 6px' }}>
            {selected.built_emailed_at
              ? `Built. Everyone who asked was emailed ${timeAgo(selected.built_emailed_at)}.`
              : 'When you mark it Built, you can email everyone who asked that it’s there.'}
          </p>
          {asks(selected.id).length === 0 && <p className="mc-muted">No requests tagged with this yet.</p>}
          {asks(selected.id).map(r => {
            const c = clubs.find(x => x.id === r.club_id);
            return (
              <div key={r.id} className="mc-person">
                {c ? <Crest logoUrl={c.logo_url} label={c.short_name} color={c.primary_color} size={30} /> : <span className="mc-sq tone-support"><Lightbulb size={14} /></span>}
                <div className="who">
                  <b>{c?.name || r.from_name || r.from_email}</b> <span className="mc-muted">{r.topic}</span>
                  <small>{timeAgo(r.created_at)}</small>
                </div>
                <div className="acts"><button type="button" className="mc-pill-btn ghost" onClick={() => onOpenRequest(r)}>Open request</button></div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
