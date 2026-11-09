'use client';

import { useCallback, useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { confirmAction, notify } from '@/components/ConfirmDialog';
import type { ClubAdminGrant } from '@/lib/supabase/types';

// Who can open this club's admin without being a member: an Owner with no member row, and Club
// Admins invited from Mission Control (club_admin_grants, migration 20261160). Shown on the
// Roles page so the club can see who has the keys. Hidden when there's nobody, or before the migration.

const sinceDate = (iso: string) => new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });

export default function NonMemberAdmins({ clubId }: { clubId: string }) {
  const { user, refreshRoles } = useAuth();
  const [rows, setRows] = useState<ClubAdminGrant[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const db = getSupabaseClient();
    if (!db) return;
    const { data, error } = await db.rpc('get_club_admin_grants', { p_club_id: clubId });
    setRows(error ? [] : ((data || []) as ClubAdminGrant[]));
  }, [clubId]);

  useEffect(() => { load(); }, [load]);

  if (!rows.length) return null;

  const remove = async (r: ClubAdminGrant) => {
    const db = getSupabaseClient();
    if (!db) return;
    const self = r.user_id === user?.id;
    if (!(await confirmAction({
      title: self ? 'Remove your own admin access?' : `Remove admin access for ${r.name || r.email}?`,
      message: self ? 'You won’t be able to open this club’s admin any more.' : 'They can’t open the club admin any more. They were never a club member, so nothing else changes.',
      confirmLabel: 'Remove',
      danger: true,
    }))) return;
    setBusy(true);
    const { error } = await db.rpc('remove_club_admin_grant', { p_club_id: clubId, p_user_id: r.user_id });
    setBusy(false);
    if (error) return notify('Could not remove them.', error.message);
    await load();
    if (self) refreshRoles();
  };

  return (
    <section className="glass-panel" style={{ padding: '1.25rem' }} aria-labelledby="non-member-admins">
      <h2 id="non-member-admins" style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 0.3rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
        <KeyRound size={16} color="var(--c-blue)" aria-hidden="true" /> Admin access without a membership
      </h2>
      <p className="text-meta" style={{ margin: '0 0 0.9rem' }}>These people can open the admin but aren&rsquo;t club members, so they don&rsquo;t show in the squad or members list. itsfootball.club invites them.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
        {rows.map(r => (
          <div key={r.user_id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.6rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
            <div style={{ minWidth: 0 }}>
              <b>{r.name || r.email}</b>{' '}
              <span className="badge" style={{ fontSize: '0.66rem', background: r.is_owner ? 'rgba(59, 130, 246, 0.15)' : undefined, color: r.is_owner ? 'var(--c-blue)' : undefined }}>
                {r.is_owner ? 'Owner' : 'Club Admin'}
              </span>
              <div className="text-meta" style={{ wordBreak: 'break-all' }}>
                {[r.email, r.note || (r.since ? `since ${sinceDate(r.since)}` : null)].filter(Boolean).join(' · ')}
              </div>
            </div>
            {!r.is_owner && (
              <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => remove(r)} style={{ color: 'var(--c-red)' }}>Remove</button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
