'use client';

import { ArrowLeftRight, Shield, Trophy } from 'lucide-react';
import { matchKind, type MatchKind } from '@/lib/fixtures';
import type { Match } from '@/lib/supabase/types';

const KINDS = [
  { id: 'club', label: 'Club games', icon: Shield },
  { id: 'tournament', label: 'Tournaments', icon: Trophy },
  { id: 'inhouse', label: 'In-house', icon: ArrowLeftRight },
] as const;

/**
 * Club games / Tournaments / In-house, above a page's fixture picker (Match Centre, Availability,
 * Lineup Draft). Only the kinds `games` has are shown, and nothing at all when there's just one.
 * Each tab says how many of its games are live, else still to play.
 */
export default function MatchKindSwitch({
  games,
  active,
  onPick,
}: {
  games: Pick<Match, 'tournament_id' | 'match_type' | 'status'>[];
  active: MatchKind;
  onPick: (kind: MatchKind) => void;
}) {
  const tabs = KINDS.map(k => {
    const own = games.filter(m => matchKind(m) === k.id);
    const live = own.filter(m => m.status === 'live' || m.status === 'halftime').length;
    const toPlay = own.filter(m => m.status === 'upcoming').length;
    return { ...k, count: own.length, live, sub: live ? `${live} live` : toPlay ? `${toPlay} to play` : `${own.length} played` };
  }).filter(t => t.count > 0);
  if (tabs.length < 2) return null;

  return (
    <div className="mc-kind-switch" role="tablist" aria-label="Kind of match" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
      {tabs.map(t => {
        const Icon = t.icon;
        const selected = active === t.id;
        return (
          <button data-view-ok
            key={t.id}
            type="button"
            role="tab"
            aria-selected={selected}
            className={`mc-kind-tab mc-kind-${t.id}`}
            onClick={() => { if (!selected) onPick(t.id); }}
          >
            <span className="mc-kind-label"><Icon size={15} aria-hidden="true" />{t.label}</span>
            <span className={`mc-kind-sub${t.live ? ' is-live' : ''}`}>
              {t.live > 0 && <span className="pulse-dot" aria-hidden="true" />}
              {t.sub}
            </span>
          </button>
        );
      })}
    </div>
  );
}
