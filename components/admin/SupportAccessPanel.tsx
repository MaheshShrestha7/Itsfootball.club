'use client';

import { useCallback, useEffect, useState } from 'react';
import { LifeBuoy } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { confirmAction, notify } from '@/components/ConfirmDialog';
import type { SupportAccessRequest } from '@/lib/supabase/types';

// MCF-10: itsfootball.club support asks the Owner for a few hours of Club Admin access to help.
// The Owner says yes or no here (Roles page); access ends by itself and can be ended early.
// Hidden for everyone but the Owner, when there's nothing to show, or before migration 20261177.

const when = (iso: string) => new Date(iso).toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default function SupportAccessPanel({ clubId, isOwner }: { clubId: string; isOwner: boolean }) {
  const [rows, setRows] = useState<SupportAccessRequest[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const db = getSupabaseClient();
    if (!db || !isOwner) return;
    const { data, error } = await db.rpc('get_club_support_access', { p_club_id: clubId });
    setRows(error ? [] : ((data || []) as SupportAccessRequest[]));
  }, [clubId, isOwner]);
  useEffect(() => { load(); }, [load]);

  const now = Date.now();
  const open = rows.filter(r => r.status === 'pending' || (r.status === 'approved' && r.expires_at && new Date(r.expires_at).getTime() > now));
  if (!isOwner || !open.length) return null;

  const act = async (fn: 'club_decide_support_access' | 'end_support_access', args: Record<string, unknown>, done: string) => {
    const db = getSupabaseClient();
    if (!db) return;
    setBusy(true);
    const { error } = await db.rpc(fn, args);
    setBusy(false);
    if (error) return notify('That didn’t work', error.message);
    notify(done);
    load();
  };

  const approve = async (r: SupportAccessRequest) => {
    if (!(await confirmAction({
      title: `Give support ${r.hours} hours of admin access?`,
      message: 'They can see and change what a Club Admin can. Everything they change shows in your Activity log, and you can end it early here.',
      confirmLabel: 'Yes, give access',
    }))) return;
    act('club_decide_support_access', { p_id: r.id, p_approve: true }, 'Access given');
  };

  return (
    <section id="support-access" className="glass-panel" style={{ padding: '1.25rem', scrollMarginTop: '5rem' }} aria-labelledby="support-access-h">
      <h2 id="support-access-h" style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 0.3rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
        <LifeBuoy size={16} color="var(--c-blue)" aria-hidden="true" /> itsfootball.club support access
      </h2>
      <p className="text-meta" style={{ margin: '0 0 0.9rem' }}>Only you, the Owner, can say yes. Access ends by itself, and everything support changes shows in the Activity log.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
        {open.map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.6rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
            <div style={{ minWidth: 0 }}>
              <b>{r.status === 'pending' ? `Asking for ${r.hours} hours of access` : `Has access until ${when(r.expires_at!)}`}</b>
              <div className="text-meta" style={{ wordBreak: 'break-word' }}>
                {r.user_email || 'itsfootball.club support'}, asked {when(r.created_at)}{r.reason ? `. Why: ${r.reason}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {r.status === 'pending' ? (
                <>
                  <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => approve(r)}>Say yes</button>
                  <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => act('club_decide_support_access', { p_id: r.id, p_approve: false }, 'Request declined')}>Say no</button>
                </>
              ) : (
                <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => act('end_support_access', { p_id: r.id }, 'Access ended')} style={{ color: 'var(--c-red)' }}>End now</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
