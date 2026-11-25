'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Radio, Users, Wallet, Mail, DollarSign, ShoppingBag, Layers, BellRing, CalendarRange } from 'lucide-react';
import type { AttentionItem } from '@/lib/admin-attention';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import { snoozeSeason } from '@/lib/use-admin-attention';
import { confirmAction } from '@/components/ConfirmDialog';

// The mark and the one-word action for each kind of job, by its access area
const AREA = {
  'match-center': { icon: Radio, go: 'Open' },
  members: { icon: Users, go: 'Review' },
  squad: { icon: Users, go: 'Check' },
  finance: { icon: Wallet, go: 'Check' },
  inquiries: { icon: Mail, go: 'Read' },
  sponsors: { icon: DollarSign, go: 'Open' },
  shop: { icon: ShoppingBag, go: 'Open' },
  lineup: { icon: Layers, go: 'Pick' },
  seasons: { icon: CalendarRange, go: 'Open' },
} as const;

/** AUTO-7: "X has started. Make it the current season?" with the answer right on the line */
function SeasonRow({ item, onDone }: { item: AttentionItem; onDone: () => void }) {
  const { seasons, setCurrentSeason } = useClub();
  const { can } = useAuth();
  const season = seasons.find(x => `season-${x.id}` === item.key);
  if (!season) return null;
  const current = seasons.find(x => x.club_id === season.club_id && x.is_current);
  const canEdit = can(season.club_id, 'seasons', 'edit');
  const make = async () => {
    const ok = await confirmAction({
      title: `Make ${season.name} the current season?`,
      message: `Same as "Set as current" on the Seasons page.${current ? ` ${current.name} stays saved with all its games and stats.` : ''} Worth doing next: renew members in bulk on Member passes, check this season's fees, and check sponsor packages and prices.`,
      confirmLabel: `Make ${season.name} current`,
    });
    if (!ok) return;
    setCurrentSeason(season.club_id, season.id);
    onDone();
  };
  return (
    <li>
      <div className="admin-queue-row admin-season-row">
        <span className="admin-dash-mark"><CalendarRange size={18} aria-hidden="true" /></span>
        <span>{item.text}{current && <small>Stats, fees and season pickers are still on {current.name}.</small>}</span>
        {canEdit ? (
          <span className="admin-season-acts">
            <button type="button" className="btn btn-secondary" onClick={() => { snoozeSeason(season.id); onDone(); }}>Not yet</button>
            <button type="button" className="btn btn-primary" onClick={make}>Make current</button>
          </span>
        ) : <Link href={item.href} className="admin-dash-go">Open</Link>}
      </div>
    </li>
  );
}

/** Top of the admin dashboard: everything waiting on the committee, most urgent first, each row a link to do it. Says "All clear" when nothing is. */
export default function NeedsYouCard({ items: all }: { items: AttentionItem[] }) {
  // Lines answered right here (the new-season line) drop out without a reload
  const [done, setDone] = useState<string[]>([]);
  const items = all.filter(i => !done.includes(i.key));
  // DASH-8: say so when nothing is waiting, so "all done" doesn't look like "still loading"
  if (items.length === 0) {
    return (
      <section className="admin-panel" aria-labelledby="needs-you-title">
        <div className="admin-panel-head"><h2 id="needs-you-title">Needs you</h2><span className="admin-meta">All clear</span></div>
        <p className="admin-empty">Nothing is waiting on you right now.</p>
      </section>
    );
  }
  const sorted = [...items].sort((a, b) => Number(b.tone === 'urgent') - Number(a.tone === 'urgent'));
  return (
    <section className="admin-panel" aria-labelledby="needs-you-title">
      <div className="admin-panel-head">
        <h2 id="needs-you-title">Needs you</h2>
        <span className="admin-meta">{items.length} to do, most urgent first</span>
      </div>
      <ul className="admin-dash-queue">
        {sorted.map(item => {
          if (item.area === 'seasons') return <SeasonRow key={item.key} item={item} onDone={() => setDone(d => [...d, item.key])} />;
          const kind = AREA[item.area as keyof typeof AREA];
          const Icon = kind?.icon || BellRing;
          return (
            <li key={item.key} className={item.tone === 'urgent' ? 'is-urgent' : undefined}>
              <Link href={item.href}>
                <span className="admin-dash-mark">
                  {item.tone === 'urgent' && <span className="sr-only">Urgent: </span>}
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span>{item.text}</span>
                <span className="admin-dash-go" aria-hidden="true">{kind?.go || 'Open'}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
