'use client';

import Link from 'next/link';
import { ChevronRight, BellRing } from 'lucide-react';
import type { AttentionItem } from '@/lib/admin-attention';

/** Top of the admin dashboard: everything waiting on the committee, each row a link to do it. Hidden when nothing is. */
export default function NeedsYouCard({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="glass-panel needs-you" aria-labelledby="needs-you-title">
      <div className="needs-you-head">
        <h2 id="needs-you-title" className="needs-you-title">
          <BellRing size={18} aria-hidden="true" /> Needs you
        </h2>
        <span className="badge badge-live">{items.length} to do</span>
      </div>
      <ul className="needs-you-list">
        {items.map(item => (
          <li key={item.key}>
            <Link href={item.href} className={`needs-you-row${item.tone === 'urgent' ? ' needs-you-row-urgent' : ''}`}>
              {item.count != null && <span className="needs-you-count">{item.count}</span>}
              <span className="needs-you-text">{item.text}</span>
              <ChevronRight size={16} aria-hidden="true" className="needs-you-arrow" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
