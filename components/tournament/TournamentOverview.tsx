'use client';

// The public tournament page's Overview tab: one snapshot that follows the tournament. Before the first
// kick-off it says when, how it works and who's playing; while games run, what's on, where we are and
// the latest results; once the final is played, who won and how. Only what the host already stores.
import React from 'react';
import Link from 'next/link';
import { Award, BadgeDollarSign, Building2, ClipboardList, Flag, History, Info, Mail, Medal, Phone, Shield, Shirt, TrendingUp, Trophy, Users } from 'lucide-react';
import LocalTime from '@/components/LocalTime';
import EventCountdown from '@/components/EventCountdown';
import PlayerOfTournament from '@/components/tournament/PlayerOfTournament';
import { ChampionBanner, OnNowStrip } from '@/components/tournament/HostedPublic';
import { formatLines, STAGES, tournamentPhase } from '@/lib/tournament-overview';
import { DEFAULT_CREST } from '@/lib/crest';
import { kickoffIso, latestFirst, soonestFirst } from '@/lib/fixtures';
import { matchPath } from '@/lib/slugs';
import { plainText } from '@/lib/match-report';
import { tournamentStats } from '@/lib/tournament-stats';
import { GROUP_LETTERS } from '@/lib/tournament-engine';
import { formatMoney } from '@/lib/finance';
import { WRITEUP_LABELS, type tournamentWriteups } from '@/lib/tournament-writeups';
import type { ClubMember, Match, MatchEvent, Tournament, TournamentParticipant, TournamentStanding } from '@/lib/supabase/types';
import '@/components/tournament/hosted.css';

type Writeups = ReturnType<typeof tournamentWriteups>;

export default function TournamentOverview({ tournament, matches, events, participants, members, clubSlug, host, writeups, standings, showName, onTeam, onTab }: {
  tournament: Tournament;
  matches: Match[];
  events: MatchEvent[];
  participants: TournamentParticipant[];
  members: ClubMember[];
  clubSlug: string;
  /** The host club: the organiser and contact when the tournament names none */
  host: { name: string; contact_email?: string | null; contact_phone?: string | null };
  writeups: Writeups;
  standings: (group?: string) => TournamentStanding[];
  showName: (n: string) => string;
  onTeam: (teamId: string) => void;
  onTab: (tab: 'standings' | 'fixtures' | 'stats' | 'news' | 'teams') => void;
}) {
  const phase = tournamentPhase(tournament, matches);
  const ids = new Set(matches.map(m => m.id));
  const ev = events.filter(e => ids.has(e.match_id));

  if (phase === 'before') {
    const named = matches.filter(m => m.match_date && m.home_team_name !== 'TBD').sort(soonestFirst);
    const first = named[0];
    const firstAt = first ? kickoffIso(first) : null;
    const groups = tournament.format === 'group_knockout'
      ? GROUP_LETTERS.slice(0, tournament.group_count ?? 1).map(g => ({ g, list: participants.filter(p => p.group === g) })).filter(x => x.list.length)
      : [];
    const lines = formatLines(tournament, participants.length);
    return (
      <div className="tp-ov">
        {firstAt && <EventCountdown startTime={firstAt} />}
        <div className="tp-ov-pair">
          <section className="glass-panel tp-card tp-ov-how" aria-labelledby="tp-ov-how">
            <h3 id="tp-ov-how"><Info size={17} aria-hidden="true" />How it works</h3>
            {lines.map(l => <p key={l}>{l}</p>)}
            {tournament.description && <p className="tp-ov-desc">{tournament.description}</p>}
          </section>
          <Details tournament={tournament} host={host} />
        </div>
        <Prizes tournament={tournament} />
        {participants.length > 0 && (
          <section className="glass-panel tp-card" aria-labelledby="tp-ov-teams">
            <div className="tp-ov-head">
              <h3 id="tp-ov-teams"><Shield size={17} aria-hidden="true" />Who&apos;s playing</h3>
              <button type="button" className="tp-ov-more" onClick={() => onTab('teams')}>All {participants.length} teams</button>
            </div>
            {groups.length > 1 ? (
              <div className="tp-ov-groups">
                {groups.map(({ g, list }) => (
                  <div key={g}>
                    <h4>Group {g}</h4>
                    <CrestList teams={list} onTeam={onTeam} />
                  </div>
                ))}
              </div>
            ) : <CrestList teams={participants} onTeam={onTeam} />}
          </section>
        )}
        {matches.length
          ? <OnNowStrip matches={matches} clubSlug={clubSlug} showName={showName} title="First games" />
          : <p className="ht-empty">The draw hasn&apos;t been made yet. The games show here once it is.</p>}
        <Contact tournament={tournament} host={host} />
      </div>
    );
  }

  const s = tournamentStats(matches, ev, participants);
  const top = s.scorers[0];
  const topNames = top ? s.scorers.filter(r => r.goals === top.goals) : [];

  if (phase === 'during') {
    const latest = matches.filter(m => m.status === 'completed').sort(latestFirst).slice(0, 3);
    // The stage of the first game still to finish, in play order
    const left = matches.filter(m => m.status !== 'completed' && m.status !== 'cancelled');
    const order = STAGES.map(([k]) => k);
    const now = left.map(m => m.tournament_stage || 'group').sort((a, b) => order.indexOf(a) - order.indexOf(b))[0];
    const stages = STAGES.filter(([k]) => matches.some(m => (m.tournament_stage || 'group') === k));
    const inGroups = (now ?? 'group') === 'group' && tournament.format !== 'knockout';
    const adv = tournament.format === 'league' ? 3 : (tournament.teams_advancing_per_group ?? 2);
    const tables = tournament.format === 'group_knockout'
      ? GROUP_LETTERS.slice(0, tournament.group_count ?? 1).map(g => ({ title: (tournament.group_count ?? 1) > 1 ? `Group ${g}` : '', rows: standings(g).slice(0, adv) }))
      : [{ title: '', rows: standings().slice(0, adv) }];
    const latestWriteup = writeups[0];
    return (
      <div className="tp-ov">
        <OnNowStrip matches={matches} clubSlug={clubSlug} showName={showName} />
        <section className="glass-panel tp-card tp-ov-stage" aria-labelledby="tp-ov-stage">
          <h3 id="tp-ov-stage"><Flag size={17} aria-hidden="true" />Where we are</h3>
          {stages.length > 1 && (
            <ol className="tp-ov-steps">
              {stages.map(([k, label]) => (
                <li key={k} aria-current={k === now ? 'step' : undefined} className={order.indexOf(k) < order.indexOf(now ?? 'final') ? 'is-done' : undefined}>{label}</li>
              ))}
            </ol>
          )}
          <p><b>{s.played}</b> of {s.total} games played, <b>{s.goals}</b> {s.goals === 1 ? 'goal' : 'goals'} so far
            {topNames.length > 0 && <>. {topNames.slice(0, 2).map(r => `${showName(r.name)} (${showName(r.team)})`).join(' and ')}{topNames.length > 2 ? ` and ${topNames.length - 2} more` : ''} {topNames.length > 1 ? 'lead' : 'leads'} the scorers with {top.goals}</>}.</p>
        </section>
        <div className="tp-grid">
          <section className="glass-panel tp-card" aria-labelledby="tp-ov-latest">
            <div className="tp-ov-head">
              <h3 id="tp-ov-latest"><History size={17} aria-hidden="true" />Latest results</h3>
              <button type="button" className="tp-ov-more" onClick={() => onTab('fixtures')}>All games</button>
            </div>
            <ul className="tp-ov-results">
              {latest.map(m => (
                <li key={m.id}>
                  <Link href={matchPath(clubSlug, m)}>
                    <span className="tp-ov-t"><img src={m.home_team_logo || DEFAULT_CREST} alt="" width={24} height={24} loading="lazy" /><span>{showName(m.home_team_name)}</span></span>
                    <b>{m.home_score}–{m.away_score}</b>
                    <span className="tp-ov-t"><img src={m.away_team_logo || DEFAULT_CREST} alt="" width={24} height={24} loading="lazy" /><span>{showName(m.away_team_name)}</span></span>
                    {m.home_score === m.away_score && m.home_penalty_score != null && <small>{m.home_penalty_score}–{m.away_penalty_score} on penalties</small>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          {inGroups && (
            <section className="glass-panel tp-card" aria-labelledby="tp-ov-leaders">
              <div className="tp-ov-head">
                <h3 id="tp-ov-leaders"><TrendingUp size={17} aria-hidden="true" />{tournament.format === 'league' ? 'Top of the table' : 'Going through now'}</h3>
                <button type="button" className="tp-ov-more" onClick={() => onTab('standings')}>Full table</button>
              </div>
              {tables.map(t => (
                <div key={t.title || 'all'} className="tp-ov-table">
                  {t.title && <h4>{t.title}</h4>}
                  <ol>
                    {t.rows.map(r => (
                      <li key={r.team_id}>
                        <button type="button" onClick={() => onTeam(r.team_id)}>
                          <img src={r.logo_url || DEFAULT_CREST} alt="" width={22} height={22} loading="lazy" />
                          <span className="tp-ov-t">{r.name}</span>
                          <span className="tp-ov-pts">{r.points} pts</span>
                        </button>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </section>
          )}
        </div>
        {latestWriteup && <WriteupRow w={latestWriteup} />}
        <Prizes tournament={tournament} />
        <Contact tournament={tournament} host={host} />
      </div>
    );
  }

  // After the end
  const third = matches.find(m => m.tournament_stage === 'third_place' && m.status === 'completed');
  const thirdWon = third && (third.home_score !== third.away_score ? third.home_score > third.away_score
    : third.winner_side ? third.winner_side === 'home' : (third.home_penalty_score ?? 0) > (third.away_penalty_score ?? 0));
  const roundUp = writeups.find(w => w.kind === 'round-up') ?? writeups[0];
  return (
    <div className="tp-ov">
      <ChampionBanner tournament={tournament} matches={matches} events={ev} showName={showName}
        standingsLeader={tournament.format === 'league' ? standings()[0]?.name : undefined} />
      {third && <p className="tp-ov-third">Third place went to {showName(thirdWon ? third.home_team_name : third.away_team_name)}, who beat {showName(thirdWon ? third.away_team_name : third.home_team_name)} {Math.max(third.home_score, third.away_score)}–{Math.min(third.home_score, third.away_score)}{third.home_score === third.away_score ? ' on penalties' : ''}.</p>}
      <PlayerOfTournament tournament={tournament} members={members} />
      {roundUp && <WriteupRow w={roundUp} lead />}
      <section className="tp-sofar glass-panel" aria-label="The tournament in numbers">
        <div><b>{s.played}</b><span>games played</span></div>
        <div><b>{s.goals}</b><span>{s.goals === 1 ? 'goal' : 'goals'}</span></div>
        <div><b>{s.played ? (s.goals / s.played).toFixed(1) : '0'}</b><span>goals a game</span></div>
        <div><b>{s.shootouts}</b><span>penalty shoot-out{s.shootouts === 1 ? '' : 's'}</span></div>
      </section>
      {(s.fewestConceded || s.biggestWin) && (
        <section className="glass-panel tp-card" aria-labelledby="tp-ov-best">
          <div className="tp-ov-head">
            <h3 id="tp-ov-best"><Medal size={17} aria-hidden="true" />Best of the tournament</h3>
            <button type="button" className="tp-ov-more" onClick={() => onTab('stats')}>All stats</button>
          </div>
          <dl className="tp-records">
            {s.fewestConceded && <div><dt>Best defence</dt><dd><span className="tp-teams">{s.fewestConceded.teams.slice(0, 2).map(n => <span key={n} className="tp-team">{showName(n)}</span>)}</span><b>{s.fewestConceded.value} let in</b></dd></div>}
            {s.mostScored && s.mostScored.value > 0 && <div><dt>Most goals scored</dt><dd><span className="tp-teams">{s.mostScored.teams.slice(0, 2).map(n => <span key={n} className="tp-team">{showName(n)}</span>)}</span><b>{s.mostScored.value}</b></dd></div>}
            {s.biggestWin && <div><dt>Biggest win</dt><dd><Link className="tp-game" href={matchPath(clubSlug, s.biggestWin)}>{showName(s.biggestWin.home_team_name)} {s.biggestWin.home_score}–{s.biggestWin.away_score} {showName(s.biggestWin.away_team_name)}</Link></dd></div>}
          </dl>
        </section>
      )}
      <Contact tournament={tournament} host={host} />
    </div>
  );
}

type Host = { name: string; contact_email?: string | null; contact_phone?: string | null };

/** Age group, squad size, entry fee and organiser: only the ones the host filled in */
function Details({ tournament: t, host }: { tournament: Tournament; host: Host }) {
  const facts: [string, React.ReactNode, React.ElementType][] = [];
  if (t.age_group) facts.push(['Age group', t.age_group, Users]);
  if (t.max_squad) facts.push(['Squad size', <>Up to {t.max_squad} players<small>a team</small></>, Shirt]);
  if (t.entry_fee_cents) facts.push(['Entry fee', <>
    {/* shortcut: AUD until the public page reads the club's payment currency */}
    {formatMoney(t.entry_fee_cents, 'AUD')}<small>a team{t.entry_deadline && <>, entries close <LocalTime value={t.entry_deadline} /></>}</small>
  </>, BadgeDollarSign]);
  facts.push(['Organiser', t.organiser_name || host.name, Building2]);
  return (
    <section className="glass-panel tp-card" aria-labelledby="tp-ov-details">
      <h3 id="tp-ov-details"><ClipboardList size={17} aria-hidden="true" />Details</h3>
      <dl className="tp-ov-facts">
        {facts.map(([k, v, Icon]) => <div key={k}><dt><Icon size={15} aria-hidden="true" />{k}</dt><dd>{v}</dd></div>)}
      </dl>
    </section>
  );
}

function Prizes({ tournament }: { tournament: Tournament }) {
  const list = (tournament.prizes ?? []).filter(p => p?.label && p?.prize);
  if (!list.length) return null;
  return (
    <section className="glass-panel tp-card" aria-labelledby="tp-ov-prizes">
      <h3 id="tp-ov-prizes"><Trophy size={17} aria-hidden="true" />Prizes</h3>
      <ul className="tp-ov-prizes">
        {list.map((p, i) => <li key={`${p.label}-${i}`}><span>{i === 0 && <Award size={16} aria-hidden="true" />}{p.label}</span><b>{p.prize}</b></li>)}
      </ul>
    </section>
  );
}

/** Who to ask: the tournament's own contact, else the host club's public one */
function Contact({ tournament: t, host }: { tournament: Tournament; host: Host }) {
  const own = !!(t.organiser_phone || t.organiser_email);
  const phone = own ? t.organiser_phone : host.contact_phone;
  const email = own ? t.organiser_email : host.contact_email;
  if (!phone && !email) return null;
  return (
    <section className="glass-panel tp-card tp-ov-contact" aria-label="Contact the organiser">
      <p>Questions? <b>{t.organiser_name || host.name}</b> runs this tournament.</p>
      {phone && <a href={`tel:${phone.replace(/[^\d+]/g, '')}`}><Phone size={16} aria-hidden="true" />{phone}</a>}
      {email && <a href={`mailto:${email}`}><Mail size={16} aria-hidden="true" />{email}</a>}
    </section>
  );
}

function CrestList({ teams, onTeam }: { teams: TournamentParticipant[]; onTeam: (id: string) => void }) {
  return (
    <ul className="tp-ov-crests">
      {teams.map(t => (
        <li key={t.id}>
          <button type="button" onClick={() => onTeam(t.id)}>
            <img src={t.logo_url || DEFAULT_CREST} alt="" width={36} height={36} loading="lazy" />
            <span>{t.name}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function WriteupRow({ w, lead }: { w: Writeups[number]; lead?: boolean }) {
  return (
    <Link href={w.href} className={`glass-panel tn-row${lead ? ' tp-ov-read' : ''}`}>
      <span className="tn-tag">{WRITEUP_LABELS[w.kind]}{w.at && <>, <LocalTime value={w.at} /></>}</span>
      <span className="tn-head">{w.writeup.headline}</span>
      <span className="tn-lead">{plainText(w.writeup.lead)}</span>
    </Link>
  );
}
