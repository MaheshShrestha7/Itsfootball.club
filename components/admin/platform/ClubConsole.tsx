'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { memberLabels } from '@/lib/permissions';
import { setupSteps, timeAgo } from '@/lib/mission-control';
import type { ClubAdminInvite, PlatformAuditRow, PlatformClubItem, PlatformClubNote, PlatformClubPerson } from '@/lib/supabase/types';
import type { EmailDraft } from '@/components/admin/platform/EmailComposer';
import { askText, confirmAction, confirmWithCheck, notify } from '@/components/ConfirmDialog';
import { validateClubSlug } from '@/lib/club-context';
import { platformApi, platformDownload } from '@/components/admin/platform/api';
import { Check, Circle, Clock, Download } from 'lucide-react';
import { Avatar } from '@/components/admin/platform/McArt';

/** The day a closing club is deleted for good */
const closesOn = (closedAt: string) =>
  new Date(new Date(closedAt).getTime() + 30 * 86400000).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });

interface Props {
  club: PlatformClubItem;
  onEmail: (d: EmailDraft) => void;
  showToast: (msg: string) => void;
  /** The club list needs reloading (owner changed) */
  onChanged: () => void;
  /** Sections the panel adds after Who runs it (money, members and games) */
  middle?: React.ReactNode;
  /** A section just before Data and closing (the home page demo) */
  beforeClosing?: React.ReactNode;
  /** Suspend or turn back on, at the top of Data and closing */
  statusControl?: React.ReactNode;
}

const INVITE_COLS = 'id, club_id, email, role, keep_old_owner, invited_by_email, created_at, sent_at, expires_at, accepted_at, cancelled_at';
/** "expires in 6 days" / "expired" */
const expiresIn = (iso: string) => {
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  return days <= 0 ? 'expired' : days === 1 ? 'expires tomorrow' : `expires in ${days} days`;
};

/** The working parts of the club panel, in the order they're used: setup, who runs it, (money,
 *  members), web address, notes, history, then data and closing. */
export default function ClubConsole({ club, onEmail, showToast, onChanged, middle, beforeClosing, statusControl }: Props) {
  const [people, setPeople] = useState<PlatformClubPerson[]>([]);
  const [notes, setNotes] = useState<PlatformClubNote[]>([]);
  const [history, setHistory] = useState<PlatformAuditRow[]>([]);
  const [noteText, setNoteText] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'owner'>('admin');
  const [invites, setInvites] = useState<ClubAdminInvite[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [slug, setSlug] = useState(club.slug);
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);

  const load = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client) return;
    const [p, n, h, inv] = await Promise.all([
      client.rpc('get_platform_club_people', { p_club_id: club.id }),
      client.from('platform_club_notes').select('id, club_id, kind, body, author_email, created_at').eq('club_id', club.id).order('created_at', { ascending: false }).limit(30),
      client.rpc('get_platform_audit', { p_club_id: club.id, p_limit: 12 }),
      // Before migration 20261160 this errors and the Waiting list stays empty
      client.from('club_admin_invites').select(INVITE_COLS).eq('club_id', club.id).is('accepted_at', null).is('cancelled_at', null).order('created_at', { ascending: false }),
    ]);
    setLoadError(p.error ? 'Run migration 20261145_mission_control_phase1.sql to manage people, notes and history here.' : '');
    setPeople((p.data || []) as PlatformClubPerson[]);
    setNotes((n.data || []) as PlatformClubNote[]);
    setHistory((h.data || []) as PlatformAuditRow[]);
    setInvites(inv.error ? [] : ((inv.data || []) as ClubAdminInvite[]));
  }, [club.id]);

  useEffect(() => { load(); }, [load]);

  /** Runs an RPC; on success shows `ok`, reloads, and returns true */
  const run = async (fn: string, args: Record<string, unknown>, ok: string) => {
    const client = getSupabaseClient();
    if (!client) return false;
    setBusy(true);
    try {
      const { error } = await client.rpc(fn, args);
      if (error) { notify('That didn\'t work', error.message); return false; }
      showToast(ok);
      await load();
      return true;
    } finally {
      setBusy(false);
    }
  };

  const makeOwner = async (p: PlatformClubPerson) => {
    const current = people.find(x => x.is_owner);
    if (!(await confirmAction({
      title: `Make ${p.name} the Owner?`,
      message: `${p.name} becomes the Owner of ${club.name}.${current ? ` ${current.name} stays on as an admin until you remove them.` : ''} Tell both of them by email afterwards.`,
      confirmLabel: 'Transfer ownership',
    }))) return;
    if (await run('platform_transfer_club_owner', { p_club_id: club.id, p_user_id: p.user_id }, `✓ ${p.name} now owns ${club.name}`)) onChanged();
  };

  const removeAdmin = async (p: PlatformClubPerson) => {
    const memberOnly = !!p.member_id;
    if (!(await confirmAction({
      title: `Remove ${p.name} as admin?`,
      message: memberOnly ? 'They stay a member of the club but lose the Club Admin role.' : 'They lose access to the club admin straight away. They were never a club member, so nothing else changes.',
      confirmLabel: 'Remove admin',
      danger: true,
    }))) return;
    // Admin through a grant (no membership needed), through the member's label, or both
    if (p.has_grant && !(await run('remove_club_admin_grant', { p_club_id: club.id, p_user_id: p.user_id }, `✓ ${p.name} is no longer an admin`))) return;
    if (p.member_id && p.email) await run('platform_set_club_admin', { p_club_id: club.id, p_email: p.email, p_on: false }, `✓ ${p.name} is no longer an admin`);
  };

  const owner = people.find(x => x.is_owner);

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = adminEmail.trim().toLowerCase();
    if (!email) return;
    let keepOldOwner = true;
    if (inviteRole === 'owner') {
      const answer = await confirmWithCheck({
        title: `Invite ${email} to own ${club.name}?`,
        message: 'When they accept, they become the Owner and can do everything, including closing the club. Until then nothing changes.',
        ...(owner ? { checkLabel: `Keep ${owner.name} on as a Club Admin after the handover`, defaultChecked: true } : { checkLabel: 'The club has no Owner right now', defaultChecked: true }),
        confirmLabel: 'Send Owner invite',
      });
      if (!answer) return;
      keepOldOwner = answer.checked;
    }
    setBusy(true);
    const res = await platformApi<{ status?: string }>('club-invites', { action: 'invite', clubId: club.id, email, role: inviteRole, keepOldOwner });
    setBusy(false);
    if (res.error) {
      await load();
      notify('That didn\'t work', res.error);
      return;
    }
    setAdminEmail('');
    showToast(res.status === 'applied' ? `✓ ${email} is a member, so they're now a Club Admin` : `✓ Invite sent to ${email}`);
    await load();
  };

  const resendInvite = async (inv: ClubAdminInvite) => {
    setBusy(true);
    const res = await platformApi('club-invites', { action: 'resend', inviteId: inv.id });
    setBusy(false);
    if (res.error) { notify('That didn\'t work', res.error); return; }
    showToast(`✓ New invite link sent to ${inv.email}`);
    await load();
  };

  const cancelInvite = async (inv: ClubAdminInvite) => {
    if (!(await confirmAction({ title: `Cancel the invite for ${inv.email}?`, message: 'The link in their email stops working.', confirmLabel: 'Cancel invite', cancelLabel: 'Keep it', danger: true }))) return;
    await run('platform_cancel_club_admin_invite', { p_invite_id: inv.id }, `✓ Invite for ${inv.email} cancelled`);
  };

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const client = getSupabaseClient();
    const body = noteText.trim();
    if (!client || !body) return;
    setBusy(true);
    const { data: auth } = await client.auth.getUser();
    const { error } = await client.from('platform_club_notes').insert({ club_id: club.id, body, author_id: auth.user?.id, author_email: auth.user?.email || null });
    setBusy(false);
    if (error) { notify('Could not save the note', error.message); return; }
    setNoteText('');
    load();
  };

  const changeSlug = async (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateClubSlug(slug, [], club.id);
    if (!check.valid) { notify('That address won\'t work', check.error || ''); return; }
    if (!(await confirmAction({
      title: `Move ${club.name} to itsfootball.club/${check.cleanSlug}?`,
      message: `itsfootball.club/${club.slug} keeps working and redirects to the new address. Tell the club so they update printed links.`,
      confirmLabel: 'Change address',
    }))) return;
    if (await run('platform_set_club_slug', { p_club_id: club.id, p_slug: check.cleanSlug }, `✓ ${club.name} is now at /${check.cleanSlug}`)) onChanged();
  };

  const exportAll = async () => {
    setExporting(true);
    const error = await platformDownload(`export?clubId=${club.id}`, `${club.slug}-export.zip`);
    setExporting(false);
    if (error) { notify('Download failed', error); return; }
    setExported(true);
    showToast('✓ Export downloaded');
  };

  const closeClub = async () => {
    const typed = await askText({
      title: `Close ${club.name}?`,
      message: 'Its pages go offline now. In 30 days the club and its records are deleted for good; payments are kept for accounting. You can reopen it until then.',
      label: `Type ${club.slug} to confirm`,
      required: true,
      confirmLabel: 'Close club',
      danger: true,
    });
    if (typed === null) return;
    if (typed.trim().toLowerCase() !== club.slug) { notify('Not closed', 'The address you typed didn\'t match.'); return; }
    if (await run('platform_close_club', { p_club_id: club.id }, `✓ ${club.name} is closing`)) {
      onChanged();
      if (await confirmAction({ title: 'Tell the club?', message: 'Email the Owner and admins that the club is closing.', confirmLabel: 'Write email' })) {
        onEmail({ club, to: 'admins', template: 'closing' });
      }
    }
  };

  const reopen = async () => {
    if (await run('platform_reopen_club', { p_club_id: club.id }, `✓ ${club.name} is open again`)) onChanged();
  };

  const steps = setupSteps(club);
  const done = steps.filter(s => s.done).length;

  return (
    <>
      {loadError && <p role="alert" className="mc-cp-warn">{loadError}</p>}

      <section className="mc-cp-sec" aria-labelledby="mc-cp-setup">
        <h3 id="mc-cp-setup">Setup <span className="mc-muted num">{done} of {steps.length}</span></h3>
        <ul className="mc-steps">
          {steps.map(s => (
            <li key={s.key} className={s.done ? 'done' : 'todo'}>
              {s.done ? <Check size={14} aria-label="Done" /> : <Circle size={14} aria-label="Not done" />}
              {s.label}
            </li>
          ))}
        </ul>
        {done < steps.length && (
          <button type="button" className="mc-pill-btn ghost" style={{ marginTop: 12 }} onClick={() => onEmail({ club, to: 'owner', template: 'needHand' })}>
            Send a setup nudge
          </button>
        )}
      </section>

      <section className="mc-cp-sec" aria-labelledby="mc-cp-who">
        <h3 id="mc-cp-who">Who runs it</h3>
        {people.length === 0 && !loadError && <p className="mc-muted">No Owner or admins found.</p>}
        {people.map(p => {
          const labels = p.is_owner ? ['Owner'] : memberLabels(p.role, p.roles);
          return (
            <div key={`${p.member_id}-${p.user_id}`} className="mc-person">
              <Avatar name={p.name} />
              <div className="who">
                <b>{p.name}</b> <span className="mc-muted">{labels.join(', ')}</span>
                {p.is_member !== undefined && <span className={`mc-flag${p.is_member ? ' ok' : ''}`} style={{ marginLeft: 6 }}>{p.is_member ? 'Member' : 'Not a member'}</span>}
                <small>{p.email || 'No email'}, {p.last_sign_in_at ? `signed in ${timeAgo(p.last_sign_in_at)}` : 'never signed in'}</small>
              </div>
              <div className="acts">
                {!p.is_owner && (p.member_id || p.has_grant) && (
                  <button type="button" className="mc-pill-btn ghost" disabled={busy} onClick={() => makeOwner(p)}>Make owner</button>
                )}
                {!p.is_owner && p.is_admin && (
                  <button type="button" className="mc-pill-btn danger" disabled={busy} onClick={() => removeAdmin(p)}>Remove admin</button>
                )}
              </div>
            </div>
          );
        })}

        {invites.length > 0 && (
          <>
            <h4 className="mc-cp-sub">Waiting <span className="num">{invites.length}</span></h4>
            {invites.map(inv => (
              <div key={inv.id} className="mc-person">
                <span className="mc-sq tone-wait"><Clock size={14} /></span>
                <div className="who">
                  <b style={{ wordBreak: 'break-all' }}>{inv.email}</b> <span className="mc-muted">{inv.role === 'owner' ? 'Owner invite' : 'Club Admin invite'}</span>
                  <small>Sent {timeAgo(inv.sent_at)}{inv.invited_by_email ? ` by ${inv.invited_by_email}` : ''}, {expiresIn(inv.expires_at)}</small>
                </div>
                <div className="acts">
                  <button type="button" className="mc-pill-btn ghost" disabled={busy} onClick={() => resendInvite(inv)}>Resend</button>
                  <button type="button" className="mc-pill-btn danger" disabled={busy} onClick={() => cancelInvite(inv)}>Cancel</button>
                </div>
              </div>
            ))}
          </>
        )}

        <h4 className="mc-cp-sub">Invite someone</h4>
        <form onSubmit={sendInvite} className="mc-cp-form">
          <div className="mc-seg" role="radiogroup" aria-label="Invite as">
            {(['admin', 'owner'] as const).map(r => (
              <button key={r} type="button" role="radio" aria-checked={inviteRole === r} aria-pressed={inviteRole === r} onClick={() => setInviteRole(r)}>
                {r === 'owner' ? 'Owner' : 'Club Admin'}
              </button>
            ))}
          </div>
          <div className="mc-cp-inline">
            <label htmlFor="mc-add-admin" className="sr-only">Email to invite as {inviteRole === 'owner' ? 'Owner' : 'Club Admin'}</label>
            <input id="mc-add-admin" type="email" required className="mc-input" placeholder="Their email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} />
            <button type="submit" className="mc-pill-btn" disabled={busy}>Send invite</button>
          </div>
          <p className="mc-muted">
            Any email works. They don&rsquo;t need to join the club or pay a fee, and they won&rsquo;t show in the squad or members list.
            {inviteRole === 'admin' ? ' An approved member becomes Club Admin straight away.' : ' The Owner only changes when they accept.'}
          </p>
        </form>
      </section>

      {middle}

      <section className="mc-cp-sec" aria-labelledby="mc-cp-web">
        <h3 id="mc-cp-web">Web address</h3>
        <form onSubmit={changeSlug} className="mc-cp-inline">
          <label htmlFor="mc-slug" className="sr-only">Club web address</label>
          <span className="mc-muted">itsfootball.club/</span>
          <input id="mc-slug" className="mc-input" value={slug} onChange={e => setSlug(e.target.value)} />
          <button type="submit" className="mc-pill-btn ghost" disabled={busy || slug.trim().toLowerCase() === club.slug}>Change</button>
        </form>
        <p className="mc-muted" style={{ marginTop: 8 }}>The old address keeps working: it redirects to the new one.</p>
        <dl className="mc-kv" style={{ marginTop: 10 }}>
          <dt>Own domain</dt>
          <dd>{club.custom_domain || 'None'}</dd>
        </dl>
        {club.custom_domain && <p className="mc-muted" style={{ marginTop: 6 }}>The domain needs a CNAME record pointing to cname.itsfootball.club.</p>}
      </section>

      <section className="mc-cp-sec" aria-labelledby="mc-cp-notes">
        <h3 id="mc-cp-notes">Notes and emails</h3>
        <form onSubmit={addNote} className="mc-cp-form">
          <label htmlFor="mc-note" className="sr-only">Private note</label>
          <textarea id="mc-note" className="mc-input" rows={2} maxLength={4000} placeholder="Private note, only platform admins see it" value={noteText} onChange={e => setNoteText(e.target.value)} />
          <button type="submit" className="mc-pill-btn ghost" disabled={busy || !noteText.trim()} style={{ alignSelf: 'flex-end' }}>Save note</button>
        </form>
        <div className="mc-feed" style={{ marginTop: 8 }}>
          {notes.map(n => {
            const [first, ...rest] = n.body.split('\n');
            return (
              <details key={n.id} className="mc-feed-row">
                <summary>
                  <b>{n.kind === 'email' ? 'Email' : 'Note'}: {first}</b>
                  <time dateTime={n.created_at}>{n.author_email || 'Platform admin'}, {timeAgo(n.created_at)}</time>
                </summary>
                {rest.length > 0 && <p className="mc-muted" style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>{rest.join('\n').trim()}</p>}
              </details>
            );
          })}
        </div>
      </section>

      {history.length > 0 && (
        <section className="mc-cp-sec" aria-labelledby="mc-cp-history">
          <h3 id="mc-cp-history">Recent admin changes</h3>
          <div className="mc-feed">
            {history.map(h => (
              <div key={h.id} className="mc-feed-row">
                <div>
                  <b>{h.summary}</b>
                  <time dateTime={h.created_at}>{h.actor_email || 'System'}, {timeAgo(h.created_at)}</time>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {beforeClosing}

      <section className="mc-cp-sec danger" aria-labelledby="mc-cp-close">
        <h3 id="mc-cp-close">Data and closing</h3>
        {statusControl}
        <button type="button" className="mc-pill-btn ghost" disabled={exporting} onClick={exportAll}>
          <Download size={14} /> {exporting ? 'Preparing…' : exported ? 'Downloaded. Download again' : 'Download everything (ZIP)'}
        </button>
        <p className="mc-muted" style={{ margin: '8px 0 14px' }}>A spreadsheet for every kind of record the club has: members, fixtures, payments and more.</p>

        {club.closed_at ? (
          <>
            <p className="mc-cp-alert">Closing. Deleted for good on {closesOn(club.closed_at)}. Payments are kept for accounting.</p>
            <button type="button" className="mc-pill-btn ghost" disabled={busy} onClick={reopen}>Reopen the club</button>
          </>
        ) : (
          <>
            <p className="mc-muted" style={{ marginBottom: 8 }}>
              Closing hides the club at once and deletes it for good after 30 days. Payments are kept for accounting.{exported ? '' : ' The button unlocks once you download everything above.'}
            </p>
            <button type="button" className="mc-pill-btn danger" disabled={busy || !exported} onClick={closeClub} title={exported ? undefined : 'Download everything first'}>
              Close {club.name}
            </button>
          </>
        )}
      </section>
    </>
  );
}
