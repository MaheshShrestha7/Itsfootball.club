'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Users, UserPlus, QrCode, CreditCard, MessageSquare, Send, CheckCircle2, Clock, AlertCircle, HeartPulse, Save } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import PaymentStep from '@/components/PaymentStep';
import VirtualPassCard from '@/components/VirtualPassCard';
import PlayerAvatar from '@/components/PlayerAvatar';
import { formatMoney, membershipTermEnd, todayIso } from '@/lib/finance';
import type { Club, ClubMember, MembershipPlan } from '@/lib/supabase/types';
import { DATE_LOCALE } from '@/lib/dates';
import { getSupabaseClient } from '@/lib/supabase/client';
import { clubTeamsOf, teamsOfMember, nextFixtureOf } from '@/lib/teams';
import { defaultSeasonLabel } from '@/lib/season';

// A parent or guardian's view of the children they look after at this club (my_children RPC,
// matched on their confirmed sign-in email = club_members.guardian_email): each child's application
// or pass, their fees, and a message thread with the club about them.

interface GuardianPortalProps {
  club: Club;
  childMembers: ClubMember[];
  /** The guardian's confirmed sign-in email */
  guardianEmail: string;
  plans: MembershipPlan[];
  currency: string;
  /** Children whose sign-up fee is paid or waiting for the club to check the receipt */
  signupPaid: Set<string>;
  onAddChild: () => void;
  /** The child the renewal email was about (?renew=): their renewal opens, however far off their expiry is */
  renewChildId?: string | null;
}

type Section = 'pass' | 'renew' | 'messages' | 'details';

const daysUntil = (date: string) => Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
const longDate = (date: string) => new Date(date).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
const fixtureWhen = (date: string) => new Date(date).toLocaleString(DATE_LOCALE, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

function statusOf(child: ClubMember): { label: string; color: string } {
  if (child.membership_status === 'pending') return { label: 'Waiting for review', color: 'var(--c-amber)' };
  if (child.membership_status === 'rejected') return { label: 'Not approved', color: 'var(--c-red)' };
  if (child.membership_expires_at && daysUntil(child.membership_expires_at) < 0) return { label: 'Expired', color: 'var(--c-red)' };
  return { label: 'Active member', color: 'var(--c-green)' };
}

export default function GuardianPortal({ club, childMembers, guardianEmail, plans, currency, signupPaid, onAddChild, renewChildId }: GuardianPortalProps) {
  const { sendMemberMessage, getMemberMessages, markClubMessagesRead, matches, clubTeams, clubTeamMembers, tournamentParticipants, playerStats, getActiveSeason } = useClub();
  const teams = clubTeamsOf(clubTeams, club.id);
  const season = getActiveSeason(club.id)?.name || defaultSeasonLabel();
  // Photo consent, emergency contact and medical notes, saved by the server (update_child_details)
  const [details, setDetails] = useState<Record<string, { photo_consent: boolean | null; emergency_contact: string; medical_notes: string }>>({});
  const [detailState, setDetailState] = useState<Record<string, string>>({});
  const detailsOf = (child: ClubMember) => details[child.id] ?? {
    photo_consent: child.photo_consent ?? null, emergency_contact: child.emergency_contact || '', medical_notes: child.medical_notes || '',
  };
  const saveDetails = (child: ClubMember) => async (e: React.FormEvent) => {
    e.preventDefault();
    const d = detailsOf(child);
    const db = getSupabaseClient();
    if (!db) return;
    setDetailState(x => ({ ...x, [child.id]: 'saving' }));
    const { error } = await db.rpc('update_child_details', {
      p_club_id: club.id, p_member_id: child.id, p_photo_consent: d.photo_consent, p_emergency_contact: d.emergency_contact, p_medical_notes: d.medical_notes,
    });
    setDetails(x => ({ ...x, [child.id]: d }));
    setDetailState(x => ({ ...x, [child.id]: error ? 'Not saved. Please try again.' : 'saved' }));
  };
  const [open, setOpen] = useState<Record<string, Section | undefined>>({});
  const [renewPlan, setRenewPlan] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, { subject: string; content: string }>>({});
  const [sentFor, setSentFor] = useState<string | null>(null);
  const paidPlans = plans.filter(p => p.price_cents > 0);

  // Arriving from a child's renewal email: open that child's renewal once the plans are in
  const renewLinkOpened = useRef(false);
  const linkedChild = childMembers.find(c => c.id === renewChildId && c.membership_status === 'approved' && c.membership_expires_at);
  useEffect(() => {
    if (renewLinkOpened.current || !linkedChild || !paidPlans.length) return;
    renewLinkOpened.current = true;
    setOpen(o => ({ ...o, [linkedChild.id]: 'renew' }));
    requestAnimationFrame(() => document.querySelector(`[data-guardian-child="${linkedChild.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }, [linkedChild, paidPlans.length]);
  // How the club sees who wrote: the guardian's name from the child's record, else their email
  const guardianLabel = (child: ClubMember) => `${child.guardian_name?.trim() || guardianEmail} (parent of ${child.full_name})`;

  const toggle = (id: string, section: Section) => {
    // Opening the messages reads them, so the "new" count clears
    if (section === 'messages' && open[id] !== 'messages') void markClubMessagesRead(club.id, id);
    setOpen(o => ({ ...o, [id]: o[id] === section ? undefined : section }));
  };

  const send = (child: ClubMember) => (e: React.FormEvent) => {
    e.preventDefault();
    const draft = drafts[child.id];
    if (!draft?.content.trim()) return;
    sendMemberMessage({
      club_id: club.id,
      member_id: child.id,
      sender_type: 'member',
      sender_name: guardianLabel(child),
      sender_email: guardianEmail,
      subject: draft.subject.trim() || `About ${child.full_name}`,
      category: 'General',
      content: draft.content.trim(),
    });
    setDrafts(d => ({ ...d, [child.id]: { subject: '', content: '' } }));
    setSentFor(child.id);
    setTimeout(() => setSentFor(s => (s === child.id ? null : s)), 3500);
  };

  return (
    <section aria-labelledby="guardian-family-heading" style={{ marginBottom: '2rem' }}>
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', borderTop: '4px solid rgba(139, 92, 246, 0.8)' }}>
        <div>
          <h2 id="guardian-family-heading" style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={20} color="var(--c-purple)" /> Your family at {club.name}
          </h2>
          <p className="text-note" style={{ margin: '0.25rem 0 0 0' }}>
            You&apos;re the parent or guardian on file for {childMembers.length === 1 ? 'this player' : `these ${childMembers.length} players`}.
            The club emails {guardianEmail} about them.
          </p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onAddChild} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <UserPlus size={16} /> Add another child
        </button>
      </div>

      <div style={{ display: 'grid', gap: '1rem' }}>
        {childMembers.map(child => {
          const status = statusOf(child);
          const section = open[child.id];
          const approved = child.membership_status === 'approved';
          const pending = child.membership_status === 'pending';
          const signupPlan = plans.find(p => p.name === child.membership_tier);
          const paid = signupPaid.has(child.id);
          const unpaid = pending && !paid && !!signupPlan && signupPlan.price_cents > 0;
          const days = child.membership_expires_at ? daysUntil(child.membership_expires_at) : null;
          const renewDue = approved && days !== null && days <= 30 && paidPlans.length > 0;
          const canRenew = renewDue || (child.id === linkedChild?.id && paidPlans.length > 0);
          const plan = paidPlans.find(p => p.id === renewPlan[child.id]) || paidPlans.find(p => p.name === child.membership_tier) || paidPlans[0];
          const thread = getMemberMessages(club.id, child.id);
          const draft = drafts[child.id] || { subject: '', content: '' };
          const unread = thread.filter(m => m.sender_type === 'admin' && !m.is_read).length;
          // At a glance: team, next game, this season's numbers, and what's owed
          const childTeams = teamsOfMember(clubTeamMembers, teams, child.id);
          const nextMatch = approved ? nextFixtureOf(matches, club.id, club.name, childTeams, clubTeams, tournamentParticipants) : undefined;
          const stats = playerStats.find(p => p.member_id === child.id && p.season === season);
          const due = unpaid && signupPlan ? `${formatMoney(signupPlan.price_cents, currency)} joining fee`
            : renewDue ? `Renewal due${days !== null && days >= 0 ? ` in ${days} day${days === 1 ? '' : 's'}` : ''}` : null;
          const d = detailsOf(child);
          const dState = detailState[child.id];
          return (
            <article key={child.id} className="glass-panel" data-guardian-child={child.id} style={{ padding: '1.25rem 1.5rem', borderLeft: `4px solid ${status.color}` }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <PlayerAvatar photoUrl={child.photo_url} name={child.full_name} size={44} style={{ borderRadius: '12px' }} />
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{child.full_name}</h3>
                    <div className="text-note">
                      {child.membership_tier}
                      {approved && child.membership_expires_at ? ` · ${days !== null && days < 0 ? 'expired' : 'expires'} ${longDate(child.membership_expires_at)}` : ''}
                    </div>
                  </div>
                </div>
                <span className="badge" style={{ color: status.color, border: `1px solid ${status.color}`, background: 'transparent' }}>{status.label}</span>
              </div>

              {approved && (
                <dl className="family-summary">
                  <div><dt>Team</dt><dd>{childTeams.map(t => t.name).join(', ') || 'Not placed yet'}</dd></div>
                  <div><dt>Next game</dt><dd>{nextMatch ? <>{fixtureWhen(nextMatch.match_date)}<br /><span className="text-meta">{nextMatch.home_team_name} v {nextMatch.away_team_name}{nextMatch.venue ? ` · ${nextMatch.venue}` : ''}</span></> : 'None scheduled'}</dd></div>
                  <div><dt>{season}</dt><dd>{stats ? `${stats.appearances} games · ${stats.goals} goals` : 'No games yet'}</dd></div>
                  <div><dt>Fees</dt><dd style={{ color: due ? 'var(--c-amber)' : undefined }}>{due || 'Nothing due'}</dd></div>
                </dl>
              )}

              {pending && (
                <p className="text-note" style={{ margin: '0.75rem 0 0 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Clock size={14} /> The committee is reviewing this application. We&apos;ll email you when they decide.
                  {signupPlan && signupPlan.price_cents > 0 && (paid ? ' Fee received.' : ` Fee: ${formatMoney(signupPlan.price_cents, currency)}.`)}
                </p>
              )}
              {child.membership_status === 'rejected' && (
                <p className="text-note" style={{ margin: '0.75rem 0 0 0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <AlertCircle size={14} /> {child.rejection_reason ? `Reason: ${child.rejection_reason}` : 'The committee wasn’t able to approve this application.'} You can message the club below.
                </p>
              )}
              {unpaid && signupPlan && (
                <div style={{ marginTop: '1rem' }}>
                  <PaymentStep clubId={club.id} kind="membership_signup" memberId={child.id} planId={signupPlan.id} amountCents={signupPlan.price_cents} label={`Pay for ${child.full_name}: ${signupPlan.name}`} />
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1rem' }}>
                {approved && (
                  <button type="button" className={`btn btn-sm ${section === 'pass' ? 'btn-primary' : 'btn-secondary'}`} aria-expanded={section === 'pass'} onClick={() => toggle(child.id, 'pass')} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <QrCode size={15} /> Pass
                  </button>
                )}
                {canRenew && (
                  <button type="button" className={`btn btn-sm ${section === 'renew' ? 'btn-primary' : 'btn-secondary'}`} aria-expanded={section === 'renew'} onClick={() => toggle(child.id, 'renew')} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <CreditCard size={15} /> Renew
                  </button>
                )}
                <button type="button" className={`btn btn-sm ${section === 'messages' ? 'btn-primary' : 'btn-secondary'}`} aria-expanded={section === 'messages'} onClick={() => toggle(child.id, 'messages')} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <MessageSquare size={15} /> Messages{thread.length ? ` (${thread.length})` : ''}{unread ? ` · ${unread} new` : ''}
                </button>
                <button type="button" className={`btn btn-sm ${section === 'details' ? 'btn-primary' : 'btn-secondary'}`} aria-expanded={section === 'details'} onClick={() => toggle(child.id, 'details')} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <HeartPulse size={15} /> Consent &amp; medical
                </button>
              </div>

              {section === 'pass' && approved && (
                <div style={{ marginTop: '1rem', maxWidth: '420px' }}>
                  <VirtualPassCard club={club} member={child} teams={childTeams} nextMatch={nextMatch} />
                </div>
              )}

              {section === 'renew' && canRenew && plan && child.membership_expires_at && (
                <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div className="text-note">
                    {/* Same rule as the payment: from today or the current expiry, whichever is later */}
                    Renewing now runs to {membershipTermEnd([todayIso(), child.membership_expires_at.slice(0, 10)].sort()[1], club, plan.duration_months)}.
                  </div>
                  <label className="form-label" htmlFor={`renew-plan-${child.id}`}>Plan</label>
                  <select id={`renew-plan-${child.id}`} className="form-select" value={plan.id} onChange={e => setRenewPlan(r => ({ ...r, [child.id]: e.target.value }))}>
                    {paidPlans.map(p => <option key={p.id} value={p.id}>{p.name}: {formatMoney(p.price_cents, currency)}</option>)}
                  </select>
                  <PaymentStep key={plan.id} clubId={club.id} kind="membership_renewal" memberId={child.id} planId={plan.id} amountCents={plan.price_cents} label={`Renew ${child.full_name}: ${plan.name} (${plan.duration_months} months)`} />
                </div>
              )}

              {section === 'details' && (
                <form onSubmit={saveDetails(child)} style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem', maxWidth: '560px' }}>
                  <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
                    <legend className="form-label">Photos of {child.full_name.split(' ')[0]} on the club&apos;s public pages</legend>
                    <div className="row" style={{ gap: '1rem', flexWrap: 'wrap' }}>
                      {([[true, 'Yes, that’s fine'], [false, 'No public photos']] as const).map(([value, label]) => (
                        <label key={label} className="row" style={{ gap: '0.4rem', minHeight: '44px' }}>
                          <input type="radio" name={`consent-${child.id}`} checked={d.photo_consent === value}
                            onChange={() => setDetails(x => ({ ...x, [child.id]: { ...d, photo_consent: value } }))} />
                          {label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <label className="form-label" htmlFor={`emergency-${child.id}`}>Emergency contact (name and phone)</label>
                  <input id={`emergency-${child.id}`} className="form-input" maxLength={200} value={d.emergency_contact} placeholder="e.g. Sam Lee 0400 000 000"
                    onChange={e => setDetails(x => ({ ...x, [child.id]: { ...d, emergency_contact: e.target.value } }))} />
                  <label className="form-label" htmlFor={`medical-${child.id}`}>Medical notes for coaches (optional)</label>
                  <textarea id={`medical-${child.id}`} className="form-input" rows={3} maxLength={2000} value={d.medical_notes} placeholder="Allergies, asthma, medication, anything the coach should know"
                    onChange={e => setDetails(x => ({ ...x, [child.id]: { ...d, medical_notes: e.target.value } }))} />
                  <p className="text-meta" style={{ margin: 0 }}>Only the club&apos;s committee and coaches see these. They&apos;re never shown publicly.</p>
                  <div className="row" style={{ gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={dState === 'saving'} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Save size={15} /> {dState === 'saving' ? 'Saving…' : 'Save details'}
                    </button>
                    {dState === 'saved' && <span role="status" style={{ color: 'var(--c-green)', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><CheckCircle2 size={15} /> Saved</span>}
                    {dState && dState !== 'saved' && dState !== 'saving' && <span role="alert" style={{ color: 'var(--c-red)', fontSize: '0.85rem' }}>{dState}</span>}
                  </div>
                </form>
              )}

              {section === 'messages' && (
                <div style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '320px', overflowY: 'auto' }}>
                    {thread.length === 0 ? (
                      <p className="text-note" style={{ margin: 0 }}>No messages about {child.full_name} yet.</p>
                    ) : thread.map(msg => {
                      const fromClub = msg.sender_type === 'admin';
                      return (
                        <div key={msg.id} style={{
                          alignSelf: fromClub ? 'flex-start' : 'flex-end', maxWidth: '85%', borderRadius: '10px', padding: '0.65rem 0.85rem',
                          background: fromClub ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          border: fromClub ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                        }}>
                          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: fromClub ? 'var(--c-sky)' : 'var(--c-green)', marginBottom: '0.2rem' }}>
                            {fromClub ? msg.sender_name : msg.sender_email?.toLowerCase() === guardianEmail.toLowerCase() ? 'You' : msg.sender_name}
                            <span className="text-meta" style={{ marginLeft: '0.5rem', fontWeight: 400 }}>{new Date(msg.created_at).toLocaleString(DATE_LOCALE, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          {msg.subject && <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{msg.subject}</div>}
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.45 }}>{msg.content}</p>
                        </div>
                      );
                    })}
                  </div>
                  {sentFor === child.id && (
                    <div role="status" style={{ color: 'var(--c-green)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <CheckCircle2 size={15} /> Sent to the club.
                    </div>
                  )}
                  <form onSubmit={send(child)} style={{ display: 'grid', gap: '0.5rem' }}>
                    <label className="form-label" htmlFor={`guardian-subject-${child.id}`}>Subject</label>
                    <input id={`guardian-subject-${child.id}`} className="form-input" maxLength={200} value={draft.subject} placeholder={`About ${child.full_name}`}
                      onChange={e => setDrafts(d => ({ ...d, [child.id]: { ...draft, subject: e.target.value } }))} />
                    <label className="form-label" htmlFor={`guardian-message-${child.id}`}>Message</label>
                    <textarea id={`guardian-message-${child.id}`} className="form-input" rows={3} maxLength={4000} required value={draft.content}
                      onChange={e => setDrafts(d => ({ ...d, [child.id]: { ...draft, content: e.target.value } }))} />
                    <button type="submit" className="btn btn-primary btn-sm" style={{ justifySelf: 'start', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Send size={15} /> Send to the club
                    </button>
                  </form>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
