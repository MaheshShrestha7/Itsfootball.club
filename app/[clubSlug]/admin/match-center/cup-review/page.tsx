'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, Check, Copy, Lock, PenLine } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import ResultChip from '@/components/ResultChip';
import ReviewSaveNote from '@/components/admin/ReviewSaveNote';
import { formatClock, formatShortDay } from '@/lib/dates';
import { hasKickoffTime, soonestFirst, tournamentTeamGroups } from '@/lib/fixtures';
import { CUP_SUMMARY_MAX, cupNumbers, gameResult, hasReview, minutesAcross, opponentName, reviewPoints, type MatchReview } from '@/lib/match-review';
import type { MatchStatLine } from '@/lib/match-stats';
import { compareTournamentMatches, tournamentMatchLabel } from '@/lib/tournament-engine';
import type { Match } from '@/lib/supabase/types';
import { loadMatchReviews, loadStatLines, useCupSummary } from '@/lib/use-match-reviews';

/** One of the club's teams in the cup, with its games in playing order */
interface CupTeam { key: string; name?: string; games: Match[] }

const when = (m: Match) => [
  formatShortDay(m.match_date, hasKickoffTime(m)),
  !hasKickoffTime(m) && m.match_time ? formatClock(m.match_time) : null,
  tournamentMatchLabel(m),
].filter(Boolean).join(' · ');

/** Admin > Match Centre > Cup review: every game of an event or tournament, with each game's review */
export default function CupReviewPage({ params, searchParams }: {
  params: Promise<{ clubSlug: string }>;
  searchParams: Promise<{ event?: string; tournament?: string; team?: string }>;
}) {
  const { clubSlug } = use(params);
  const { event: eventId, tournament: tournamentId, team: askedTeam } = use(searchParams);
  const { clubs, selectClubBySlug, matches, matchEvents, members, events: clubEvents, tournaments, tournamentParticipants, clubTeams } = useClub();
  const { user } = useAuth();
  const club = selectClubBySlug(clubSlug) || clubs[0];

  const event = eventId ? clubEvents.find(e => e.id === eventId && e.club_id === club.id) : undefined;
  const tournament = !event && tournamentId ? tournaments.find(t => t.id === tournamentId && t.club_id === club.id) : undefined;
  const cupName = event?.title || tournament?.name;

  // The club's teams in this cup: by club team for an event, by entry for a tournament. A tournament
  // with none of the club's own entries is listed whole, without a result for "us".
  const teams = useMemo<CupTeam[]>(() => {
    const own = matches.filter(m => m.club_id === club.id);
    if (event) {
      const games = own.filter(m => m.event_id === event.id).sort(soonestFirst);
      const ids = [...new Set(games.map(m => m.team_id || ''))];
      return ids.map(id => ({ key: id, name: clubTeams.find(t => t.id === id)?.name, games: games.filter(m => (m.team_id || '') === id) }));
    }
    if (tournament) {
      const games = own.filter(m => m.tournament_id === tournament.id);
      const groups = tournamentTeamGroups(games, tournamentParticipants.filter(p => p.tournament_id === tournament.id));
      return groups.length
        ? groups.map(g => ({ key: g.participant.id, name: g.participant.name, games: g.games }))
        : [{ key: '', games: [...games].sort(compareTournamentMatches) }];
    }
    return [];
  }, [matches, club.id, event, tournament, clubTeams, tournamentParticipants]);

  const [teamKey, setTeamKey] = useState(askedTeam || '');
  const team = teams.find(t => t.key === teamKey) || teams[0];
  // Only a tournament needs the team's name to tell which side is ours
  const ourName = tournament ? team?.name : undefined;
  const games = useMemo(() => team?.games || [], [team]);
  const idList = games.map(m => m.id).join(',');

  const [reviews, setReviews] = useState<Record<string, MatchReview> | null>({});
  const [lines, setLines] = useState<Record<string, MatchStatLine[]>>({});
  useEffect(() => {
    let live = true;
    const ids = idList ? idList.split(',') : [];
    void Promise.all([loadMatchReviews(ids), loadStatLines(ids)]).then(([r, l]) => {
      if (!live) return;
      setReviews(r);
      setLines(l);
    });
    return () => { live = false; };
  }, [idList]);

  const cup = team && (event || tournament) ? { eventId: event?.id, tournamentId: tournament?.id, teamKey: team.key } : null;
  const { summary, change, ready, saveState, retry } = useCupSummary(club.id, cup, user?.full_name || '');
  const [copied, setCopied] = useState(false);

  const view = useMemo(() => {
    const nameOf = (id: string) => members.find(m => m.id === id)?.full_name || 'A player';
    const played = games.filter(m => m.status === 'completed');
    const numbers = cupNumbers(games, matchEvents, ourName);
    const goals = new Map<string, number>();
    const potm: string[] = [];
    for (const m of played) {
      for (const l of lines[m.id] || []) {
        if (l.goals) goals.set(l.member_id, (goals.get(l.member_id) || 0) + l.goals);
        if (l.motm && !potm.includes(nameOf(l.member_id))) potm.push(nameOf(l.member_id));
      }
    }
    const most = Math.max(0, ...goals.values());
    const points = (field: 'went_well' | 'work_on') => played.flatMap(m =>
      reviewPoints(reviews?.[m.id]?.[field] || '').map(text => ({ from: `${gameResult(m, ourName).outcome ? 'vs ' : ''}${opponentName(m, ourName)}`, text })));
    return {
      played,
      numbers,
      topScorers: most ? [...goals].filter(([, n]) => n === most).map(([id]) => nameOf(id)).join(', ') : '',
      most,
      potm: potm.join(', '),
      reviewed: played.filter(m => hasReview(reviews?.[m.id])).length,
      wentWell: points('went_well'),
      workOn: points('work_on'),
      minutes: minutesAcross(played, lines),
      nameOf,
    };
  }, [games, matchEvents, members, lines, reviews, ourName]);

  const back = event ? `/${club.slug}/admin/events` : tournament ? `/${club.slug}/admin/tournaments/${tournament.id}` : `/${club.slug}/admin/match-center`;
  if (!cupName || !team) {
    return (
      <div className="rv-page">
        <div className="admin-head"><div><h1>Cup review</h1></div></div>
        <div className="admin-panel admin-empty">
          <p>{cupName ? `${cupName} has no games yet. Link its fixtures first, then come back.` : 'Open a cup review from an event’s Fixtures or from a tournament.'}</p>
          <Link href={back} className="btn btn-secondary btn-sm">Back</Link>
        </div>
      </div>
    );
  }

  const { numbers, played } = view;
  const reviewHref = (m: Match) => `/${club.slug}/admin/match-center/review?match=${m.id}`;
  const scoreLine = (m: Match) => {
    const r = gameResult(m, ourName);
    return r.outcome ? `${r.us}–${r.them} ${opponentName(m, ourName)}` : `${m.home_team_name} ${m.home_score ?? 0}–${m.away_score ?? 0} ${m.away_team_name}`;
  };

  // Everything on the page as plain text, for a message to the committee or the other coaches
  const copyText = () => {
    const list = (title: string, items: { from: string; text: string }[]) =>
      items.length ? [``, title, ...items.map(p => `- ${p.text} (${p.from})`)] : [];
    const text = [
      `${cupName} review${team.name ? `, ${team.name}` : ''}`,
      numbers.hasResults
        ? `Played ${numbers.played}: won ${numbers.won}, drew ${numbers.drawn}, lost ${numbers.lost}. Scored ${numbers.scored}, conceded ${numbers.conceded}.`
        : `Played ${numbers.played}.`,
      ...played.map(m => `${scoreLine(m)} (${formatShortDay(m.match_date)})`),
      ...list('Went well', view.wentWell),
      ...list('To work on', view.workOn),
      ...(summary.trim() ? ['', 'Summary', summary.trim()] : []),
    ].join('\n');
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="rv-page">
      <div className="admin-head">
        <div>
          <Link href={back} className="rv-crumb"><ArrowLeft size={14} aria-hidden="true" /> {event ? 'Events' : 'Tournament'}</Link>
          <h1>{cupName} review</h1>
          <p>Every game&apos;s review in one place, with the facts from Match Centre.</p>
        </div>
        <div className="admin-head-actions">
          <span className="rv-private"><Lock size={13} aria-hidden="true" /> Coaches and admins only</span>
        </div>
      </div>

      {teams.length > 1 && (
        <div className="admin-toolbar">
          <div className="admin-chips" role="group" aria-label="Team">
            {teams.map(t => (
              <button key={t.key} type="button" className="admin-chip" aria-pressed={t.key === team.key} onClick={() => setTeamKey(t.key)}>
                {t.name || 'No team set'}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rv-stack">
        {reviews === null && (
          <p className="rv-flag" role="alert">
            <AlertTriangle size={15} aria-hidden="true" />
            <span>The reviews can&apos;t be opened right now. Check your connection and reload the page.</span>
          </p>
        )}

        <section className="admin-panel" aria-labelledby="rv-numbers">
          <div className="admin-panel-head">
            <h2 id="rv-numbers">In numbers</h2>
            <span className="admin-meta">{played.length} of {games.length} {games.length === 1 ? 'game' : 'games'} played</span>
          </div>
          <div className="rv-pad">
            <dl className="admin-facts">
              <div><dt>Played</dt><dd>{numbers.played}</dd></div>
              {numbers.hasResults && (
                <>
                  <div><dt>Won · Drew · Lost</dt><dd>{numbers.won} · {numbers.drawn} · {numbers.lost}</dd></div>
                  <div><dt>Scored</dt><dd>{numbers.scored}</dd></div>
                  <div><dt>Conceded</dt><dd>{numbers.conceded}</dd></div>
                  <div><dt>Clean sheets</dt><dd>{numbers.cleanSheets}</dd></div>
                </>
              )}
            </dl>
            <p className="rv-facts">
              {view.topScorers && <span>Top scorer <b>{view.topScorers} ({view.most})</b></span>}
              {view.potm && <span>Player of the Match <b>{view.potm}</b></span>}
              {numbers.concededLate > 0 && <span>Goals conceded <b>{numbers.concededLate} of {numbers.concededLogged} in the last 15 minutes</b></span>}
            </p>
            {played.length > 0 && (
              <div className="rv-progress">
                <span><b>{view.reviewed} of {played.length}</b> {played.length === 1 ? 'game' : 'games'} reviewed</span>
                <div className="rv-bar" aria-hidden="true"><i style={{ width: `${(view.reviewed / played.length) * 100}%` }} /></div>
              </div>
            )}
          </div>
        </section>

        <div className="rv-two">
          {([['Went well', view.wentWell], ['To work on', view.workOn]] as const).map(([title, items]) => (
            <section key={title} className="admin-panel" aria-label={title}>
              <div className="admin-panel-head"><h2>{title}</h2><span className="admin-meta">From each review</span></div>
              {items.length ? (
                <ul className="rv-points">
                  {items.map((p, i) => <li key={i}><span className="rv-from">{p.from}</span><span>{p.text}</span></li>)}
                </ul>
              ) : <p className="rv-none">Nothing written yet.</p>}
            </section>
          ))}
        </div>

        {view.minutes.rows.length > 0 && (
          <section className="admin-panel" aria-labelledby="rv-minutes">
            <div className="admin-panel-head">
              <h2 id="rv-minutes">Minutes</h2>
              <span className="admin-meta">{view.minutes.fair ? `A fair share is ${view.minutes.fair}' of ${view.minutes.total}'` : `Out of ${view.minutes.total}'`}</span>
            </div>
            <div className="admin-table-wrap rv-pad">
              <table className="admin-table rv-mins">
                <thead><tr><th>Player</th><th className="is-num">Games</th><th className="is-num">Minutes</th><th aria-hidden="true" /></tr></thead>
                <tbody>
                  {view.minutes.rows.map(r => (
                    <tr key={r.member_id}>
                      <td>{view.nameOf(r.member_id)} {r.underHalf && <span className="admin-pill is-warn">Under half</span>}</td>
                      <td className="is-num">{r.games}</td>
                      <td className="is-num">{r.minutes}&apos;</td>
                      <td aria-hidden="true"><div className={`rv-bar${r.underHalf ? ' is-low' : ''}`}><i style={{ width: `${Math.min(100, (r.minutes / view.minutes.total) * 100)}%` }} /></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="admin-panel" aria-labelledby="rv-games">
          <div className="admin-panel-head"><h2 id="rv-games">Game by game</h2></div>
          {games.map(m => {
            const done = m.status === 'completed';
            const r = reviews?.[m.id];
            const outcome = done ? gameResult(m, ourName).outcome : null;
            return (
              <div key={m.id} className="rv-game">
                <div className="rv-game-head">
                  {outcome && <ResultChip outcome={outcome} />}
                  <b>{done ? scoreLine(m) : opponentName(m, ourName)}</b>
                  <span className="admin-kicker">{when(m)}</span>
                  {done && hasReview(r) && (
                    <Link href={reviewHref(m)} className="admin-dash-link rv-edit">Edit</Link>
                  )}
                </div>
                {!done ? <p className="rv-none" style={{ padding: 0 }}>Not played yet.</p>
                  : hasReview(r) ? (
                    <div className="rv-answers">
                      {([['Went well', r!.went_well], ['Work on', r!.work_on], ['Next week', r!.next_week]] as const).map(([title, text]) => (
                        <div key={title} className="rv-answer"><h4>{title}</h4>{text.trim() || '–'}</div>
                      ))}
                    </div>
                  ) : (
                    <div className="rv-missing">
                      <span>No review yet for this game.</span>
                      <Link href={reviewHref(m)} className="btn btn-secondary btn-sm"><PenLine size={14} aria-hidden="true" /> Write it now</Link>
                    </div>
                  )}
              </div>
            );
          })}
        </section>

        <section className="admin-panel" aria-labelledby="rv-summary">
          <div className="admin-panel-head">
            <h2 id="rv-summary">Your summary</h2>
            <span className="rv-private"><Lock size={13} aria-hidden="true" /> Coaches and admins only</span>
          </div>
          <div className="rv-pad">
            <textarea
              className="form-textarea rv-summary"
              aria-labelledby="rv-summary"
              placeholder={`What you take from ${cupName} as a whole. The points above are there to help.`}
              value={summary}
              maxLength={CUP_SUMMARY_MAX}
              disabled={!ready}
              onChange={e => change(e.target.value)}
            />
            <div className="rv-foot">
              <ReviewSaveNote state={saveState} retry={retry} />
              <button type="button" className="btn btn-secondary btn-sm" onClick={copyText}>
                {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />} {copied ? 'Copied' : 'Copy as text'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
