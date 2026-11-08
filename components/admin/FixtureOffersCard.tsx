'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Handshake, Plus } from 'lucide-react';
import { getAccessToken } from '@/lib/supabase/client';
import { DEFAULT_CREST } from '@/lib/crest';
import { ourSide } from '@/lib/friendlies';
import { useClub } from '@/lib/club-context';
import type { Club, ClubTeam } from '@/lib/supabase/types';

interface Offer {
  id: string;
  from: { name: string; logo_url: string | null; side: string };
  sender: string | null;
  our_team_hint: string | null;
  when: string;
  we_host: boolean;
  venue: string;
  game: string;
}

/**
 * Admin dashboard: friendlies another club on itsfootball.club accepted and offered to our site
 * (migration 20261159). Pick our team and add it: the game is then on both clubs' sites, with the
 * date, ground, status and score kept the same. Hidden when there are none.
 */
export default function FixtureOffersCard({ club, teams, canAdd }: { club: Club; teams: ClubTeam[]; canAdd: boolean }) {
  const { applyMatchRow } = useClub();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, { ok: boolean; text: string; matchId?: string }>>({});

  useEffect(() => {
    let stale = false;
    (async () => {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch(`/api/admin/fixture-offers?clubId=${club.id}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => ({}));
      if (!stale && Array.isArray(data.offers)) setOffers(data.offers);
    })().catch(() => {});
    return () => { stale = true; };
  }, [club.id]);

  if (offers.length === 0) return null;

  // Starts on the team the invitation named ("Reserves"), else the only team
  const teamFor = (o: Offer) => picked[o.id]
    ?? (teams.find(t => o.our_team_hint && t.name.toLowerCase() === o.our_team_hint.toLowerCase())?.id || (teams.length === 1 ? teams[0].id : ''));

  const answer = async (o: Offer, action: 'add' | 'decline') => {
    setBusy(o.id);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/admin/fixture-offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ clubId: club.id, offerId: o.id, action, teamId: teamFor(o) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setDone(d => ({ ...d, [o.id]: { ok: false, text: data.error || 'That didn’t save. Try again.' } }));
      else if (action === 'decline') setOffers(list => list.filter(x => x.id !== o.id));
      else {
        // Shows in Fixtures straight away, without waiting for the live update
        if (data.match) applyMatchRow(data.match);
        setDone(d => ({ ...d, [o.id]: { ok: true, text: 'Added to your fixtures.', matchId: data.matchId } }));
      }
    } catch {
      setDone(d => ({ ...d, [o.id]: { ok: false, text: 'That didn’t save. Check your connection.' } }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="admin-panel fo" aria-labelledby="fixture-offers-title">
      <div className="admin-panel-head">
        <h2 id="fixture-offers-title">Friendlies to add</h2>
        <span className="admin-meta">{offers.length} from other clubs</span>
      </div>
      <div className="fo-list">
        {offers.map(o => {
          const result = done[o.id];
          const teamId = teamFor(o);
          // Our side as the fixture will name it ("Leppington Rovers Reserves")
          const us = ourSide(club.name, teams.find(t => t.id === teamId)?.name);
          return (
            <article key={o.id} className="fo-item">
              <span className="admin-pill is-ok"><Handshake size={12} aria-hidden="true" /> Friendly confirmed</span>
              <p className="fo-lead"><b>{o.from.name}</b> accepted {o.sender ? `${o.sender}'s` : 'your'} invitation.</p>
              <div className="fo-vs">
                {[
                  { name: o.we_host ? us : o.from.side, logo: o.we_host ? club.logo_url : o.from.logo_url },
                  { name: o.we_host ? o.from.side : us, logo: o.we_host ? o.from.logo_url : club.logo_url },
                ].map((side, i) => (
                  <div key={i}>
                    <img src={side.logo || DEFAULT_CREST} alt="" width={40} height={40} />
                    <b>{side.name}</b>
                  </div>
                )).flatMap((el, i) => (i === 1 ? [<em key="v">V</em>, el] : [el]))}
              </div>
              <dl className="fo-facts">
                <dt>When</dt><dd>{o.when}</dd>
                <dt>Where</dt><dd>{o.venue || (o.we_host ? 'Our ground' : 'Their ground')}, {o.we_host ? 'we host' : 'they host'}</dd>
                <dt>Game</dt><dd>{o.game}</dd>
              </dl>
              {result?.ok ? (
                <p className="fo-done" role="status">
                  <Check size={15} aria-hidden="true" /> {result.text}{' '}
                  {result.matchId && <Link href={`/${club.slug}/admin/matches?open=${result.matchId}`}>Open it</Link>}
                </p>
              ) : canAdd ? (
                <>
                  {teams.length > 1 && (
                    <div className="form-group">
                      <label className="form-label" htmlFor={`fo-team-${o.id}`}>Which of our teams?</label>
                      <select id={`fo-team-${o.id}`} className="form-select" value={teamId} onChange={e => setPicked(p => ({ ...p, [o.id]: e.target.value }))}>
                        <option value="" disabled>Pick a team</option>
                        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="fo-acts">
                    <button type="button" className="btn btn-primary btn-sm" disabled={busy === o.id || !teamId} onClick={() => answer(o, 'add')}>
                      <Plus size={14} aria-hidden="true" /> {busy === o.id ? 'Adding…' : 'Add to our fixtures'}
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" disabled={busy === o.id} onClick={() => answer(o, 'decline')}>Not now</button>
                  </div>
                  {result && !result.ok && <p className="fo-error" role="alert">{result.text}</p>}
                  <p className="fo-help">
                    Once added, it&apos;s one game on both sites. Your players get availability and line-ups as normal. Each club runs its own line-up, and the score comes from whichever club is keeping it.
                  </p>
                </>
              ) : (
                <p className="fo-help">Someone who can edit fixtures can add it.</p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
