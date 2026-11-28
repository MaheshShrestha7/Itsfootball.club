'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, ExternalLink, Trophy } from 'lucide-react';
import { DEFAULT_CREST } from '@/lib/crest';
import { useLinkInvites } from '@/lib/tournament-links';
import type { Club } from '@/lib/supabase/types';

/**
 * Admin dashboard: another club on itsfootball.club linked one of our teams into its tournament
 * (migration 20261197). Accept: the team links to our club page, and the games show in our Fixtures
 * if the host ticked that. Decline: we stay in their tournament as a plain typed-in team.
 * Hidden when there are none (and before the migration).
 */
export default function TournamentInvitesCard({ club }: { club: Club }) {
  const { invites, respond } = useLinkInvites(club.id);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!invites.length) return null;

  const answer = async (id: string, accept: boolean) => {
    setBusy(id);
    setError(null);
    const err = await respond(id, accept);
    if (err) setError(`That didn’t save: ${err}`);
    setBusy(null);
  };

  return (
    <section className="admin-panel fo" aria-labelledby="tournament-invites-title">
      <div className="admin-panel-head">
        <h2 id="tournament-invites-title">Tournament invitations</h2>
        <span className="admin-meta">{invites.length} from other clubs</span>
      </div>
      <div className="fo-list">
        {invites.map(i => {
          const when = i.tournament?.start_date
            ? new Date(i.tournament.start_date).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Australia/Sydney' })
            : null;
          return (
            <article key={i.participant_id} className="fo-item">
              <span className="admin-pill is-warn"><Trophy size={12} aria-hidden="true" /> Tournament invitation</span>
              <p className="fo-lead" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                <img src={i.host?.logo_url || DEFAULT_CREST} alt="" width={36} height={36} style={{ flex: 'none', borderRadius: 8 }} />
                <span><b>{i.host?.name || 'A club'}</b> added {i.club_team ? `your ${i.club_team.name}` : 'your club'} to <b>{i.tournament?.name || 'their tournament'}</b>
                {i.team ? <> as &ldquo;{i.team.name}&rdquo;</> : null}.</span>
              </p>
              <dl className="fo-facts">
                {when && <><dt>When</dt><dd>{when}</dd></>}
                {i.tournament?.venue && <><dt>Where</dt><dd>{i.tournament.venue}</dd></>}
              </dl>
              <div className="fo-acts">
                <button type="button" className="btn btn-primary btn-sm" disabled={busy === i.participant_id} onClick={() => answer(i.participant_id, true)}>
                  <Check size={14} aria-hidden="true" /> {busy === i.participant_id ? 'Saving…' : 'Accept'}
                </button>
                {i.host && i.tournament && (
                  <Link className="btn btn-secondary btn-sm" href={`/${i.host.slug}/tournaments/${i.tournament.id}`} target="_blank">
                    <ExternalLink size={14} aria-hidden="true" /> See the tournament
                  </Link>
                )}
                <button type="button" className="btn btn-secondary btn-sm" disabled={busy === i.participant_id} onClick={() => answer(i.participant_id, false)}>Decline</button>
              </div>
              <p className="fo-help">
                Accept links the team to your club page, and the games can show in your Fixtures and Results. Decline keeps you in their draw as a typed-in team.
              </p>
            </article>
          );
        })}
      </div>
      {error && <p className="fo-error" role="alert">{error}</p>}
    </section>
  );
}
