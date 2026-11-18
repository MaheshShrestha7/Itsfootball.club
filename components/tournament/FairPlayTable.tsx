'use client';

// Cards across a tournament (TX-8): the fair play table, fairest first, and who sits out their
// team's next game after a red card. Made from the cards Match Centre logged.
import React from 'react';
import { fairPlay } from '@/lib/hosted-tournaments';
import { fixtureWhenLabel } from '@/lib/tournament-engine';
import type { Match, MatchEvent, TournamentParticipant } from '@/lib/supabase/types';

export default function FairPlayTable({ matches, events, participants, showName = n => n }: {
  matches: Match[];
  events: MatchEvent[];
  participants: TournamentParticipant[];
  /** Public pages pass juniorPublicName for a junior tournament */
  showName?: (name: string) => string;
}) {
  const ids = new Set(matches.map(m => m.id));
  const { table, suspended } = fairPlay(matches, events.filter(e => ids.has(e.match_id)), participants);
  const any = table.some(r => r.yellow || r.red);
  return (
    <div className="ht-fair">
      <p className="ht-lede">One point for a yellow card, three for a red. Fewest points is the fairest team.</p>
      {suspended.length > 0 && (
        <div className="ht-warn" role="note">
          <div>
            <b>Sitting out their next game</b>
            <ul>
              {suspended.map(s => (
                <li key={`${s.team}-${s.player}-${s.match.id}`}>{showName(s.player)} ({s.team}): red card, misses {fixtureWhenLabel(s.match)} v {s.match.home_team_name === s.team ? s.match.away_team_name : s.match.home_team_name}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {!any ? (
        <p className="ht-empty">No cards yet. They show here as games are scored in Match Centre.</p>
      ) : (
        <div className="ht-table-wrap">
          <table className="ht-table">
            <caption className="sr-only">Fair play table</caption>
            <thead><tr><th scope="col">#</th><th scope="col">Team</th><th scope="col">Yellow</th><th scope="col">Red</th><th scope="col">Points</th></tr></thead>
            <tbody>
              {table.map((r, i) => (
                <tr key={r.team}>
                  <td>{i + 1}</td>
                  <th scope="row">{r.team}</th>
                  <td><span className="ht-card-chip is-yellow" aria-hidden="true" />{r.yellow}</td>
                  <td><span className="ht-card-chip is-red" aria-hidden="true" />{r.red}</td>
                  <td><b>{r.points}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
