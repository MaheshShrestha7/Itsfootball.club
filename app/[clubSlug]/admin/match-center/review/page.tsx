'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, Lock, Trophy } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import ResultChip from '@/components/ResultChip';
import ReviewSaveNote from '@/components/admin/ReviewSaveNote';
import { formatShortDay } from '@/lib/dates';
import { compareEventMinute, eventMinuteLabel, fullMinutes } from '@/lib/match-length';
import { gameResult, minutesAcross, ourSide, ourTeamIn, REVIEW_MAX, type MatchReview } from '@/lib/match-review';
import type { MatchStatLine } from '@/lib/match-stats';
import { goalScoringSide } from '@/lib/teams';
import { loadStatLines, useMatchReview } from '@/lib/use-match-reviews';

const QUESTIONS: { field: keyof Omit<MatchReview, 'match_id'>; label: string; hint?: string }[] = [
  { field: 'went_well', label: 'What went well?' },
  { field: 'work_on', label: 'What do we work on?' },
  { field: 'next_week', label: 'Notes for next week', hint: 'Training plan, who to start, anything to follow up.' },
];

/** Admin > Match Centre > Match review: the facts of one finished game and the coach's three answers */
export default function MatchReviewPage({ params, searchParams }: {
  params: Promise<{ clubSlug: string }>;
  searchParams: Promise<{ match?: string }>;
}) {
  const { clubSlug } = use(params);
  const { match: matchId } = use(searchParams);
  const { clubs, selectClubBySlug, matches, matchEvents, members, events: clubEvents, tournaments, tournamentParticipants } = useClub();
  const { user } = useAuth();
  const club = selectClubBySlug(clubSlug) || clubs[0];
  const match = matches.find(m => m.id === matchId && m.club_id === club.id && m.status === 'completed');

  const { review, change, ready, failed, saveState, retry } = useMatchReview(club.id, match?.id, user?.full_name || '');

  const [lines, setLines] = useState<MatchStatLine[]>([]);
  useEffect(() => {
    if (!match?.id) return;
    let live = true;
    void loadStatLines([match.id]).then(by => { if (live) setLines(by[match.id] || []); });
    return () => { live = false; };
  }, [match?.id]);

  const facts = useMemo(() => {
    if (!match) return null;
    const team = ourTeamIn(match, tournamentParticipants);
    const result = gameResult(match, team);
    // With no side of our own (two of the club's teams), every goal and card is listed
    const side = result.outcome ? ourSide(match, team) : null;
    const logged = matchEvents.filter(e => e.match_id === match.id).sort(compareEventMinute);
    const scorers = new Map<string, string[]>();
    const conceded: string[] = [];
    for (const e of logged) {
      const to = goalScoringSide(e);
      if (!to) continue;
      if (side && to !== side) { conceded.push(`${eventMinuteLabel(e)}'`); continue; }
      const name = e.event_type === 'own_goal' ? `${e.player_name} (own goal)` : e.player_name;
      scorers.set(name, [...(scorers.get(name) || []), `${eventMinuteLabel(e)}'${e.event_type === 'penalty' ? ' pen' : ''}`]);
    }
    const cards = logged.filter(e => (!side || e.team_side === side) && (e.event_type === 'yellow_card' || e.event_type === 'red_card'));
    const yellow = cards.filter(e => e.event_type === 'yellow_card').length;
    const red = cards.length - yellow;
    const nameOf = (id: string) => members.find(m => m.id === id)?.full_name || 'A player';
    const mins = minutesAcross([match], { [match.id]: lines });
    return {
      result,
      goals: [...scorers].map(([name, at]) => `${name} ${at.join(', ')}`).join(', '),
      conceded: conceded.join(', '),
      cards: [yellow && `${yellow} yellow`, red && `${red} red`].filter(Boolean).join(', '),
      potm: lines.filter(l => l.motm).map(l => nameOf(l.member_id)).join(', '),
      underHalf: mins.rows.filter(r => r.underHalf).map(r => `${nameOf(r.member_id)} ${r.minutes}'`),
      fair: mins.fair,
    };
  }, [match, matchEvents, members, lines, tournamentParticipants]);

  const centre = `/${club.slug}/admin/match-center${match ? `?match=${match.id}` : ''}`;
  if (!match || !facts) {
    return (
      <div className="rv-page">
        <div className="admin-head"><div><h1>Match review</h1></div></div>
        <div className="admin-panel admin-empty">
          <p>A review is written once a game has finished. Open a finished game in Match Centre and choose Match review.</p>
          <Link href={centre} className="btn btn-secondary btn-sm">Open Match Centre</Link>
        </div>
      </div>
    );
  }

  // The cup this game is part of: an event (an outside cup) or one of the club's own tournaments
  const cupName = match.event_id ? clubEvents.find(e => e.id === match.event_id)?.title
    : match.tournament_id ? tournaments.find(t => t.id === match.tournament_id)?.name : undefined;
  const team = ourTeamIn(match, tournamentParticipants);
  const teamKey = match.event_id ? match.team_id || ''
    : tournamentParticipants.find(p => p.tournament_id === match.tournament_id && p.name === team)?.id || '';
  const cupHref = cupName
    ? `/${club.slug}/admin/match-center/cup-review?${match.event_id ? `event=${match.event_id}` : `tournament=${match.tournament_id}`}${teamKey ? `&team=${teamKey}` : ''}`
    : null;

  return (
    <div className="rv-page">
      <div className="admin-head">
        <div>
          <Link href={centre} className="rv-crumb"><ArrowLeft size={14} aria-hidden="true" /> Match Centre</Link>
          <h1>Match review</h1>
          <p>What you noticed today, while it&apos;s fresh. Next week&apos;s training starts here.</p>
        </div>
      </div>

      <div className="rv-stack">
        <section className="admin-panel" aria-label="The game">
          <div className="admin-panel-head">
            <div>
              <div className="admin-kicker">{[formatShortDay(match.match_date), cupName || match.competition].filter(Boolean).join(' · ')}</div>
              <h2 className="rv-score">{match.home_team_name} {match.home_score ?? 0}–{match.away_score ?? 0} {match.away_team_name}</h2>
            </div>
            {facts.result.outcome && <ResultChip outcome={facts.result.outcome} size="md" />}
          </div>
          <div className="rv-pad">
            <p className="rv-facts">
              {facts.goals && <span>Goals <b>{facts.goals}</b></span>}
              {facts.conceded && <span>Conceded <b>{facts.conceded}</b></span>}
              {facts.cards && <span>Cards <b>{facts.cards}</b></span>}
              {facts.potm && <span>Player of the Match <b>{facts.potm}</b></span>}
            </p>
            {facts.underHalf.length > 0 && (
              <p className="rv-flag">
                <AlertTriangle size={15} aria-hidden="true" />
                <span>Under half the game: <b>{facts.underHalf.join(', ')}</b> of {fullMinutes(match)}&apos;.{facts.fair ? ` A fair share was ${facts.fair}'.` : ''}</span>
              </p>
            )}
            {!match.is_audited && (
              <p className="rv-facts">
                <span>Player stats aren&apos;t saved for this game yet, so minutes and Player of the Match are missing. <Link href={centre} className="admin-dash-link">Save them in Match Centre</Link></span>
              </p>
            )}
          </div>
        </section>

        <section className="admin-panel" aria-labelledby="rv-questions">
          <div className="admin-panel-head">
            <h2 id="rv-questions">Three questions</h2>
            <span className="rv-private"><Lock size={13} aria-hidden="true" /> Coaches and admins only</span>
          </div>
          <div className="rv-pad" style={{ gap: 'var(--space-md)' }}>
            {failed && (
              <p className="rv-flag" role="alert">
                <AlertTriangle size={15} aria-hidden="true" />
                <span>The review can&apos;t be opened right now. Check your connection and reload the page.</span>
              </p>
            )}
            {QUESTIONS.map(q => (
              <label key={q.field} className="rv-q">
                <span className="form-label">{q.label}</span>
                {q.hint && <small>{q.hint}</small>}
                <textarea
                  className="form-textarea"
                  value={review[q.field]}
                  maxLength={REVIEW_MAX}
                  disabled={!ready}
                  onChange={e => change({ ...review, [q.field]: e.target.value })}
                />
              </label>
            ))}
            <div className="rv-foot">
              <ReviewSaveNote state={saveState} retry={retry} idle={cupName ? `Saves as you type. Shows on the ${cupName} review with the other games.` : 'Saves as you type'} />
              <div className="row row-wrap">
                {cupHref && (
                  <Link href={cupHref} className="btn btn-secondary btn-sm"><Trophy size={14} aria-hidden="true" /> {cupName} review</Link>
                )}
                <Link href={centre} className="btn btn-primary btn-sm">Done</Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
