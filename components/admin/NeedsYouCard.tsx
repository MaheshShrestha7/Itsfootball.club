'use client';

import Link from 'next/link';
import { Radio, Users, Wallet, Mail, DollarSign, ShoppingBag, Layers, BellRing } from 'lucide-react';
import type { AttentionItem } from '@/lib/admin-attention';

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
} as const;

/** Top of the admin dashboard: everything waiting on the committee, most urgent first, each row a link to do it. Says "All clear" when nothing is. */
export default function NeedsYouCard({ items }: { items: AttentionItem[] }) {
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
