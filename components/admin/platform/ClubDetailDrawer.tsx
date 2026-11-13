'use client';

import React from 'react';
import Link from 'next/link';
import { PlatformClubItem } from '@/lib/supabase/types';
import { formatMoney } from '@/lib/finance';
import { formatDate } from '@/lib/dates';
import ClubConsole from '@/components/admin/platform/ClubConsole';
import type { EmailDraft } from '@/components/admin/platform/EmailComposer';
import PopupPanel from '@/components/PopupPanel';
import { Crest } from '@/components/admin/platform/McArt';
import { getSupabaseClient } from '@/lib/supabase/client';
import { X, Mail, Users, ExternalLink, Shield, Link2, Check } from 'lucide-react';

interface ClubDetailDrawerProps {
  club: PlatformClubItem | null;
  onClose: () => void;
  onToggleStatus: (clubId: string, currentStatus: boolean) => Promise<void>;
  statusUpdating: boolean;
  onEmail: (d: EmailDraft) => void;
  showToast: (msg: string) => void;
  onChanged: () => void;
}

const POLICY: Record<string, string> = {
  require_payment: 'Must pay to join',
  allow_waiver: 'Pay to join, fee can be waived',
  auto_approve: 'Free, joins straight away',
  auto_approve_with_waiver: 'Joins straight away, fee can be waived',
};

/** The club panel: everything about one club in one column, in the order it gets used. */
export default function ClubDetailDrawer({
  club,
  onClose,
  onToggleStatus,
  statusUpdating,
  onEmail,
  showToast,
  onChanged,
}: ClubDetailDrawerProps) {
  const [copiedLink, setCopiedLink] = React.useState(false);
  // The home page's "See a live club site" (F10-9): undefined while loading, 'missing' before migration 20261162
  const [demoId, setDemoId] = React.useState<string | null | 'missing' | undefined>(undefined);
  const [demoSaving, setDemoSaving] = React.useState(false);
  React.useEffect(() => {
    const client = getSupabaseClient();
    if (!client || !club) return;
    client.from('platform_home_demo').select('club_id').maybeSingle()
      .then(({ data, error }) => setDemoId(error ? 'missing' : (data?.club_id as string | null) ?? null));
  }, [club]);

  if (!club) return null;

  const isDemo = demoId === club.id;
  const setDemo = async (on: boolean) => {
    const client = getSupabaseClient();
    if (!client) return;
    setDemoSaving(true);
    const { error } = await client.rpc('platform_set_home_demo', { p_club_id: on ? club.id : null });
    setDemoSaving(false);
    if (error) return showToast(error.message.includes('Operators') ? 'Only Super admins and Operators can change this.' : 'Could not change the home page demo.');
    setDemoId(on ? club.id : null);
    showToast(on ? `${club.name} is now the home page demo. The home page shows it within 5 minutes.` : 'The home page demo is cleared.');
  };

  // The web address already names this club (?tab=…&club=<id>), so the link opens it again
  const copyLink = () => {
    navigator.clipboard?.writeText(window.location.href).catch(() => null);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const status = club.closed_at ? { label: 'Closing', tone: 'bad' } : club.is_active ? { label: 'Active', tone: 'ok' } : { label: 'Suspended', tone: 'bad' };

  return (
    <div className="mc-cp-scrim" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <PopupPanel onClose={onClose} label={`${club.name} details`} className="mc-cp">
        <header className="mc-cp-h">
          <div className="mc-cp-top">
            <Crest logoUrl={club.logo_url} label={club.short_name} color={club.primary_color} />
            <div className="who">
              <h2>{club.name} <span className={`mc-flag ${status.tone}`}>{status.label}</span></h2>
              <small title={`itsfootball.club/${club.slug}`}>itsfootball.club/{club.slug}</small>
            </div>
            <button type="button" className="mc-icon-btn" onClick={copyLink} aria-label="Copy a link to this panel" title="Copy a link to this panel">
              {copiedLink ? <Check size={14} /> : <Link2 size={14} />}
            </button>
            <button type="button" className="mc-icon-btn" onClick={onClose} aria-label="Close">
              <X size={15} />
            </button>
          </div>
          <div className="mc-cp-acts">
            <Link href={`/${club.slug}/admin`} target="_blank" className="mc-pill-btn"><Shield size={14} /> Enter club admin</Link>
            <Link href={`/${club.slug}`} target="_blank" className="mc-pill-btn ghost"><ExternalLink size={14} /> Open public site</Link>
            <button type="button" className="mc-pill-btn ghost" onClick={() => onEmail({ club, to: 'owner', template: 'blank' })}><Mail size={14} /> Email owner</button>
            <button type="button" className="mc-pill-btn ghost" onClick={() => onEmail({ club, to: 'admins', template: 'blank' })}><Users size={14} /> Email all admins</button>
          </div>
        </header>

        <ClubConsole
          key={club.id}
          club={club}
          onEmail={onEmail}
          showToast={showToast}
          onChanged={onChanged}
          middle={
            <>
              <section className="mc-cp-sec" aria-labelledby="mc-cp-money">
                <h3 id="mc-cp-money">Money</h3>
                <dl className="mc-kv">
                  <dt>Joining</dt><dd>{POLICY[club.membership_payment_policy] || club.membership_payment_policy.replace(/_/g, ' ')}</dd>
                  <dt>Card payments</dt>
                  <dd>
                    {club.stripe_ready
                      ? <span className="mc-flag ok">Stripe connected</span>
                      : <span className={`mc-flag${club.membership_payment_policy === 'require_payment' ? ' bad' : ''}`}>Bank transfer only</span>}
                  </dd>
                  <dt>Paid through the site, all time</dt><dd className="num">{formatMoney(club.gmv_cents, 'AUD')}</dd>
                </dl>
              </section>
              <section className="mc-cp-sec" aria-labelledby="mc-cp-members">
                <h3 id="mc-cp-members">Members and games</h3>
                <dl className="mc-kv">
                  <dt>Members</dt><dd className="num">{club.member_count.toLocaleString('en-AU')}{club.pending_count > 0 ? `, ${club.pending_count} waiting` : ''}</dd>
                  <dt>Teams</dt><dd className="num">{club.team_count}</dd>
                  <dt>Fixtures</dt><dd className="num">{club.match_count}</dd>
                  <dt>Visitors, last 30 days</dt><dd className="num">{club.visits_30d.toLocaleString('en-AU')}</dd>
                  <dt>Joined itsfootball.club</dt><dd>{formatDate(club.created_at)}</dd>
                </dl>
              </section>
            </>
          }
          beforeClosing={demoId !== undefined && (
            <section className="mc-cp-sec" aria-labelledby="mc-cp-demo">
              <h3 id="mc-cp-demo">Home page demo</h3>
              {demoId === 'missing' ? (
                <p className="mc-muted">Run the 20261162_home_demo_club.sql migration to choose which club the home page shows.</p>
              ) : (
                <>
                  <p className="mc-muted" style={{ marginBottom: 10 }}>
                    {isDemo
                      ? 'The home page links to this club as "See a live club site".'
                      : demoId
                        ? 'Another club is the home page demo. Using this one replaces it.'
                        : 'No club is chosen yet, so the home page links to the first club in the list.'}
                  </p>
                  <button type="button" className="mc-pill-btn ghost" disabled={demoSaving || !club.is_active} onClick={() => setDemo(!isDemo)}>
                    {demoSaving ? 'Saving…' : isDemo ? 'Stop using as the demo' : 'Use as the home page demo'}
                  </button>
                </>
              )}
            </section>
          )}
          statusControl={
            <div className="mc-cp-status">
              <p className="mc-muted">
                {club.is_active
                  ? 'Suspend the club while it\'s being fixed. Its pages show a short notice and member check-ins stop until you turn it back on.'
                  : 'This club is suspended. Turn it back on to open its pages and tournaments again.'}
              </p>
              <button
                type="button"
                disabled={statusUpdating}
                onClick={() => onToggleStatus(club.id, club.is_active)}
                className={`mc-pill-btn ${club.is_active ? 'danger' : 'ok'}`}
              >
                {statusUpdating ? 'Saving…' : club.is_active ? 'Suspend club' : 'Turn club back on'}
              </button>
            </div>
          }
        />
      </PopupPanel>
    </div>
  );
}
